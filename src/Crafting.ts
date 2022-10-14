import {DefaultComponent, Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";
import {Settings} from "./Settings.js";
import {DefaultResult, RecipeCompendium} from "./RecipeCompendium.js";
import {rollTableToComponents} from "./helpers/RollTableToComponent.js";

export class Crafting {
    recipe: Recipe;
    actor;
    item;
    roll;

    constructor(actor, item) {
        this.recipe = new Recipe(item)
        this.actor = actor;
        this.item = item;
    }

    static fromOwned(item): Crafting {
        return new Crafting(item.parent, item);
    }

    static async from(actorId, itemId): Promise<Crafting> {
        const actor = await fromUuid("Actor." + actorId)
        const item = await fromUuid("Item." + itemId);
        return new Crafting(actor, item);
    }

    async craft(): Promise<Result> {
        const result = await this.checkSkill();
        RecipeCompendium.validateRecipeToItemList(this.recipe, this.actor.items, result);
        this.checkCurrency(result);
        await this.addResults(result);
        await this.updateActor(result);
        await this._sendToChat(result);
        return result;
    }

    async checkSkill(result?: Result): Promise<Result> {
        if (!result) result = new DefaultResult();
        if (result.hasErrors) return result;
        if (this.recipe.skill) {
            this.roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            result.skill = {
                name: this.recipe.skill.name,
                difference: this.roll.total - this.recipe.skill.dc,
                total: this.roll.total
            }
            if (this.roll.total < this.recipe.skill.dc) {
                result.hasErrors = true;
            }
        }
        return result;
    }

    //simple stupid functional but not performant (yagni)
    checkCurrency(result?: Result): Result {
        if (!result) result = new DefaultResult();
        result.changes.currencies = this.actor.system.currency;
        if (this.recipe.currency) {
            try {
                result.changes.currencies = Exchange.pay(this.recipe.currency, result.changes.currencies);
            } catch (e) {
                result.currencies = false
                result.hasErrors = true;
            }
        }
        return result;
    }

    async addResults(result?: Result): Promise<Result> {
        if (!result) result = new DefaultResult();
        if (result.hasErrors) return result;
        const components = await this._getResultComponents(result);
        for (const component of components) {
            this._addComponentToResult(result, component);
        }
        return result;
    }

    async updateActor(result: Result) {
        if (!result) result = new DefaultResult();
        if (result.hasException || (result.hasErrors && (!this.recipe.skill?.consume || !result.skill))) return;
        await this.actor.updateEmbeddedDocuments("Item", result.changes.items.toUpdate);
        await this.actor.deleteEmbeddedDocuments("Item", result.changes.items.toDelete);
        const createItems: any[] = [];
        for (const component of result.changes.items.toCreate) {
            if (component.uuid) {
                const item = await fromUuid(component.uuid);
                const itemData = item?.toObject();
                itemData.system.quantity = component.quantity;
                if (!itemData.flags.core?.sourceId) {
                    itemData.flags.core = itemData.flags.core || {};
                    itemData.flags.core.sourceId = component.uuid;
                }
                createItems.push(itemData);

            }
        }
        await this.actor.createEmbeddedDocuments("Item", createItems)
        await this.actor.update({
            "system.currency": result.changes.currencies
        });
        return result;
    }

    async _sendToChat(result: Result) {
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {recipe: this.recipe, result: result, roll: this.roll})
        content = TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }

    //if you have to comment it, its not clean code !
    _addComponentToResult(result: Result, component: Component) {
        const itemChange = RecipeCompendium.findComponentInList(this.actor.items, component);
        if(result.results[component.uuid]){
            DefaultComponent.inc(result.results[component.uuid])
        }else{
            result.results[component.uuid] = component;
        }
        if (itemChange.toUpdate["system.quantity"] == 0) {                                                            // actor does not have item
            result.changes.items.toCreate.push(component);                                                              //add that item
        } else {                                                                                                      // actor does have item
            const updates = result.changes.items.toUpdate
                .filter(x => x._id === itemChange.toUpdate._id);
            if (updates.length > 0) {                                                                                 //crafting already updated that item
                updates.forEach(x => x["system.quantity"] = x["system.quantity"] + component.quantity)               //reupdate it
            } else {                                                                                                  //crafting does not update that item
                if (result.changes.items.toDelete.includes(itemChange.toUpdate._id)) {                                //crafting deleted that item
                    result.changes.items.toCreate.push(component);                                                      //add that item // now i delete it then create it again.
                } else {                                                                                              //on actor but not yet touched
                    itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + component.quantity
                    result.changes.items.toUpdate.push(itemChange.toUpdate);
                    result.changes.items.toDelete.push(...itemChange.toDelete);

                }
            }
        }
    }

    async _getResultComponents(result: Result): Promise<Component[]> {
        const items = Object.values(this.recipe.results).filter(component => component.type === "Item");
        const tables = Object.values(this.recipe.results).filter(component => component.type === "RollTable");
        for (const component of tables) {
            items.push(...await rollTableToComponents(component, result));
            if (result.hasErrors) return [];
        }
        return items;
    }


}
