import {Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";
import {Settings} from "./Settings.js";

export class Crafting {
    recipe: Recipe;
    actor;
    item;
    roll;

    static messageToCraft = {};

    constructor(actor, item) {
        this.recipe = new Recipe(item)
        this.actor = actor;
        this.item = item;
    }

    static async from(actorId, itemId) {
        const actor = await fromUuid("Actor." + actorId)
        const item = await fromUuid("Item." + itemId);
        return new Crafting(actor, item);
    }

    preCondition(result?) {
        if (!result) result = new Result();
        this.checkIngredients(result);
        this.checkCurrency(result);
        return result;
    }

    async craft() {
        const result = await this.checkSkill();
        this.checkIngredients(result);
        this.checkCurrency(result);
        this.addResults(result);
        await this.updateActor(result);
        await this._sendToChat(result);
        return result;
    }

    checkIngredients(result?) {
        if (!result) result = new Result();
        for (const [k, component] of Object.entries(this.recipe.ingredients)) {
            const itemChange = this._getItemBySourceId(component);
            const remainingQuantity = itemChange.toUpdate["system.quantity"] - component.quantity;
            if (remainingQuantity < 0) {
                result.errors.ingredients[k] = component;
                result.hasErrors = true;
            } else {
                if (remainingQuantity == 0) {
                    result.success.items.toDelete.push(itemChange.toUpdate._id);
                } else {
                    itemChange.toUpdate["system.quantity"] = remainingQuantity;
                    result.success.items.toUpdate.push(itemChange.toUpdate);
                }
                result.success.items.toDelete.push(...itemChange.toDelete);
            }

        }
        return result;
    }

    _getItemBySourceId(component) {
        const itemChange = new ItemChange();
        this.actor.items.forEach((i) => {
            if (this._isSame(i, component)) {
                if (itemChange.toUpdate["system.quantity"] == 0) {
                    itemChange.toUpdate._id = i.id;
                } else {
                    itemChange.toDelete.push(i.id);
                }
                itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + (i.system?.quantity || 1);
            }
        });
        return itemChange;
    }

    _isSame(item, component) {
        const isSameName = (item, component) => item.name === component.name;
        const isFromSource = (item, component) => item.flags?.core?.sourceId == component.uuid;
        const hasSameSource = (item, component) => item.flags?.core?.sourceId == component.sourceId;
        return isSameName(item, component) && (isFromSource(item, component) || hasSameSource(item, component));
    }

    //if you have to comment it, its not clean code !
    addResults(result?) {
        if (!result) result = new Result();
        if (result.hasErrors) return;
        for (const [k, component] of Object.entries(this.recipe.results)) {
            const itemChange = this._getItemBySourceId(component);
            if (itemChange.toUpdate["system.quantity"] == 0) {                                                            // actor does not have item
                result.success.items.toCreate.push(component);                                                              //add that item
            } else {                                                                                                      // actor does have item
                const updates = result.success.items.toUpdate
                    .filter(x => x._id === itemChange.toUpdate._id);
                if (updates.length > 0) {                                                                                 //crafting already updated that item
                    updates.forEach(x => x["system.quantity"] = x["system.quantity"] + component.quantity)               //reupdate it
                } else {                                                                                                  //crafting does not update that item
                    if (result.success.items.toDelete.includes(itemChange.toUpdate._id)) {                                //crafting deleted that item
                        result.success.items.toCreate.push(component);                                                      //add that item // now i delete it then create it again.
                    } else {                                                                                              //on actor but not yet touched
                        itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + component.quantity
                        result.success.items.toUpdate.push(itemChange.toUpdate);
                        result.success.items.toDelete.push(...itemChange.toDelete);

                    }
                }
            }
        }
        return result;
    }

    //simple stupid functional but not performant (yagni)
    checkCurrency(result?) {
        if (!result) result = new Result();
        result.success.currencies = this.actor.system.currency;
        if (this.recipe.currency) {
            try {
                result.success.currencies = Exchange.pay(this.recipe.currency, result.success.currencies);
            } catch (e) {
                result.errors.currencies = true
                result.hasErrors = true;
            }
        }
        return result;
    }

    async checkSkill(result?) {
        if (!result) result = new Result();
        if (result.hasErrors) return;
        if (this.recipe.skill) {
            this.roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            if (this.roll.total < this.recipe.skill.dc) {
                result.errors.skill = true;
                result.hasErrors = true;
            } else {
                result.success.skill = true;
            }
        }
        return result;
    }

    async _sendToChat(result) {
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {recipe: this.recipe, result: result, item: this.item, roll: this.roll})
        content = await TextEditor.enrichHTML(content);
        ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }


    async updateActor(result) {
        if (!result) result = new Result();
        if (result.hasErrors && (!this.recipe.skill?.consume || !result.errors.skill)) return;
        await this.actor.updateEmbeddedDocuments("Item", result.success.items.toUpdate);
        await this.actor.deleteEmbeddedDocuments("Item", result.success.items.toDelete);
        const createItems:any[] = [];
        for (const component of result.success.items.toCreate) {
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
            "system.currency": result.success.currencies
        });
        return result;
    }

    processId() {
        return foundry.utils.randomID();
    }

}

class Result implements iResult{
    success = {
        items: {
            toUpdate: [],
            toDelete: [],
            toCreate: []
        },
        currencies: {},
    };
    errors = {
        ingredients: {},
        currencies: false,
        skill: false,
    };
    hasErrors = false;
}

interface iResult {
    success: {
        items: {
            toUpdate:any[],
            toDelete:any[],
            toCreate:any[]
        },
        currencies: {},
    }
    errors:
        {
            ingredients: {},
            currencies: boolean,
            skill:boolean
        };
    hasErrors:boolean
}

class ItemChange {
    toDelete: any[] = [];
    toUpdate = {
        "_id": "",
        "system.quantity": 0
    };
}
