import {DefaultComponent, Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";
import {Settings} from "./Settings.js";
import {DefaultResult, RecipeCompendium} from "./apps/RecipeCompendium.js";
import {rollTableToComponents} from "./helpers/Utility.js";
import {AnyOf} from "./apps/AnyOfSheet.js";

export class Crafting {
    recipe: Recipe;
    actor;
    item;
    roll;

    constructor(actor, item) {
        this.recipe = Recipe.fromItem(item)
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
        const result =  await this.checkTool();
        await this.checkSkill(result);
        await this.evaluateAnyOf();
        RecipeCompendium.validateRecipeToItemList(Object.values(this.recipe.ingredients), this.actor.items, result);
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

    async checkTool(result?: Result): Promise<Result> {
        if(!result) result = new DefaultResult();
        if (result.hasErrors) return result;
        return await RecipeCompendium.validateTool(this.recipe,this.actor.items,result);
    }

    async evaluateAnyOf(){
        const toDelete:string[] = [];
        const toAdd:Component[] = [];
        for(const [key,component] of Object.entries(this.recipe.ingredients)){
            if(component.type === Settings.ANYOF_SUBTYPE){
                const item = await fromUuid(component.uuid);
                const anyOf = new AnyOf(item);
                let results = await anyOf.filter(this.actor.items);
                results = results.filter(c=>{
                    let quantity = c.quantity;
                    toAdd.forEach(a=>{
                        if(a.id === c.id){
                            quantity = quantity-a.quantity;
                        }
                    });
                    return quantity >= component.quantity
                });
                if(results.length >= 0) {
                    const result = results[Math.floor(Math.random() * results.length)];
                    result.quantity = component.quantity;
                    toAdd.push(result);
                    toDelete.push(key);
                }
            }
        }
        toDelete.forEach(k=>this.recipe.removeIngredient(k));
        toAdd.forEach(component=>{this.recipe.addIngredient(component,component.uuid,component.type)});
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
        await this.actor.createEmbeddedDocuments("Item", createItems);
        await this.actor.updateEmbeddedDocuments("Item", result.changes.items.toUpdate);
        await this.actor.deleteEmbeddedDocuments("Item", result.changes.items.toDelete);
        await this.actor.update({
            "system.currency": result.changes.currencies
        });
        return result;
    }

    async _sendToChat(result: Result) {
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {
                recipe: this.recipe,
                result: result,
                roll: this.roll,
                displayTool: Settings.get(Settings.USE_TOOL)
            })
        content = TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }

    _addComponentToResult(result: Result, component: Component) {
        const itemChange = RecipeCompendium.findComponentInList(this.actor.items, component);
        const isAlreadyOnActor = itemChange.toUpdate["system.quantity"] > 0
        const isAlreadyUpdated = result.changes.items.toUpdate
            .filter(x => x._id === itemChange.toUpdate._id).length > 0
        const isAlreadyCreated = result.changes.items.toCreate
            .filter(x => x.id === itemChange.toUpdate._id).length > 0
        const isAlreadyDeleted = result.changes.items.toDelete.includes(itemChange.toUpdate._id)

        if(result.results[component.uuid]){
            DefaultComponent.inc(result.results[component.uuid]);
        }else{
            result.results[component.uuid] = component;
        }
        if (!isAlreadyOnActor) {
            if(isAlreadyCreated){
                const creates =  result.changes.items.toCreate.filter(x => x.id === itemChange.toUpdate._id);
                creates.forEach(x => x.quantity = x.quantity + component.quantity)
            } else {
                result.changes.items.toCreate.push(DefaultComponent.clone(component));
            }
        } else {
            if(isAlreadyDeleted){
                const deleteIndex = result.changes.items.toDelete.indexOf(itemChange.toUpdate._id);
                result.changes.items.toDelete.splice(deleteIndex,1);
            }
            if(isAlreadyUpdated){
                const updates = result.changes.items.toUpdate.filter(x => x._id === itemChange.toUpdate._id)
                updates.forEach(x => x["system.quantity"] = x["system.quantity"] + component.quantity)
            }else{
                itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + component.quantity
                result.changes.items.toUpdate.push(itemChange.toUpdate);
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
