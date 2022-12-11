import {Component, Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";
import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {rollTableToComponents} from "./helpers/Utility.js";
import {AnyOf} from "./AnyOf.js";
import {Result} from "./Result.js";

export class Crafting {
    recipe: Recipe;
    actor;
    item;
    roll;

    constructor(actor, recipe: Recipe) {
        this.recipe = recipe;
        this.actor = actor;
    }

    static async fromRecipe(actorId,recipe: Recipe){
        const actor = await fromUuid("Actor." + actorId);
        return new Crafting(actor,  recipe);
    }

    static fromOwned(item): Crafting {
        return new Crafting(item.parent,  Recipe.fromItem(item));
    }

    static async from(actorId, uuid): Promise<Crafting> {
        const item = await fromUuid(uuid);
        return Crafting.fromRecipe(actorId, Recipe.fromItem(item));
    }

    async craft(): Promise<ResultData> {
        const result =  await this.checkTool();
        await this.checkAttendants(result);
        await this.evaluateAnyOf();
        RecipeCompendium.validateRecipeToItemList(Object.values(this.recipe.ingredients), this.actor.items, result);
        this.checkCurrency(result);
        await this.checkSkill(result);
        await this.addResults(result);
        await this.updateActor(result);
        await this._sendToChat(result);
        return result;
    }

    async checkSkill(result?: ResultData): Promise<ResultData> {
        if (!result) result = new Result(this.recipe);
        if (result.hasErrors) return result;
        if (this.recipe.skill) {
            const skillParts = this.recipe.skill.name.split("-")
            if(skillParts[0] === 'ability'){
                this.roll = await this.actor.rollAbilityTest(skillParts[1], {"chatMessage": false});
            }else{
                this.roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            }
            result.chat.skill ={
                name: this.recipe.skill.name,
                difference: this.roll.total - this.recipe.skill.dc,
                total: this.roll.total
            }
            if (this.roll.total < this.recipe.skill.dc) {
                result.hasErrors = true;
                result.chat.success = false;
            }
        }
        return result;
    }

    async checkTool(result?: ResultData): Promise<ResultData> {
        if(!result) result = new Result(this.recipe);
        return await RecipeCompendium.validateTool(this.recipe,this.actor.items,result);
    }

    async checkAttendants(result?: ResultData): Promise<ResultData> {
        if(!result) result = new Result(this.recipe);
        return await RecipeCompendium.validateAttendants(this.recipe,this.actor.items,result);
    }

    async evaluateAnyOf(){
        const toDelete:string[] = [];
        const toAdd:ComponentData[] = [];
        for(const [key,component] of Object.entries(this.recipe.ingredients)){
            if(component.type === Settings.ANYOF_SUBTYPE){
                const item = await component.getEntity();
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
    checkCurrency(result?: ResultData): ResultData {
        if (!result) result = new Result(this.recipe);
        result.updates.actor["system.currency"] = this.actor.system.currency;
        if (this.recipe.currency) {
            let isAvailable = false;
            try {
                result.updates.actor["system.currency"] = Exchange.pay(this.recipe.currency, result.updates.actor["system.currency"]);
                isAvailable = true;
            } catch (e) {
            }
            result.chat.input.consumed["currency"] = {
                component: {
                    id: "invalid",
                    uuid: "invalid",
                    type: "Currency",
                    name: this.recipe.currency.name,
                    img: 'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp',
                    quantity: this.recipe.currency.value
                },
                isAvailable:isAvailable
            }

            if(!isAvailable){
                result.currencies = false
                result.hasErrors = true;
                result.chat.success = false;
            }
        }
        return result;
    }

    async addResults(result?: ResultData): Promise<ResultData> {
        if (!result) result = new Result(this.recipe);
        if (result.hasErrors) return result;
        const components = await this._getResultComponents(result);
        for (const component of components) {
            this._addComponentToResult(result, component);
        }
        return result;
    }

    async updateActor(result: ResultData) {
        if (!result) result = new Result(this.recipe);
        if (result.hasException || (result.hasErrors && (!this.recipe.skill?.consume || !result.skill))) return;
        const createItems: any[] = [];
        for (const component of result.updates.items.toCreate) {
            if (component.uuid) {
                const item = await fromUuid(component.uuid);
                const itemData = item?.toObject();
                itemData.system.quantity = component.quantity;
                createItems.push(itemData);
            }
        }
        await this.actor.createEmbeddedDocuments("Item", createItems);
        await this.actor.updateEmbeddedDocuments("Item", result.updates.items.toUpdate);
        await this.actor.deleteEmbeddedDocuments("Item", result.updates.items.toDelete);
        await this.actor.update(result.updates.actor);
        return result;
    }

    async _sendToChat(result: ResultData) {
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {
                data: result.chat,
            })
        content = TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }

    _addComponentToResult(result: ResultData, component: ComponentData) {
        const itemChange = RecipeCompendium.findComponentInList(this.actor.items, component);
        const isAlreadyOnActor = itemChange.toUpdate["system.quantity"] > 0
        const isAlreadyUpdated = result.updates.items.toUpdate
            .filter(x => x._id === itemChange.toUpdate._id).length > 0
        const isAlreadyCreated = result.updates.items.toCreate
            .filter(x => x.id === itemChange.toUpdate._id).length > 0
        const isAlreadyDeleted = result.updates.items.toDelete.includes(itemChange.toUpdate._id)

        if(result.chat.output["result."+component.uuid]){
            Component.inc(result.chat.output["result."+component.uuid]);
        }else{
            result.chat.output["result."+component.uuid] = component;
        }
        //deprecated
        if(result.results[component.uuid]){
            Component.inc(result.results[component.uuid]);
        }else{
            result.results[component.uuid] = component;
        }
        if (!isAlreadyOnActor) {
            if(isAlreadyCreated){
                const creates =  result.updates.items.toCreate.filter(x => x.id === itemChange.toUpdate._id);
                creates.forEach(x => x.quantity = x.quantity + component.quantity)
            } else {
                result.updates.items.toCreate.push(Component.clone(component));
            }
        } else {
            if(isAlreadyDeleted){
                const deleteIndex = result.updates.items.toDelete.indexOf(itemChange.toUpdate._id);
                result.updates.items.toDelete.splice(deleteIndex,1);
            }
            if(isAlreadyUpdated){
                const updates = result.updates.items.toUpdate.filter(x => x._id === itemChange.toUpdate._id)
                updates.forEach(x => x["system.quantity"] = x["system.quantity"] + component.quantity)
            }else{
                itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + component.quantity
                result.updates.items.toUpdate.push(itemChange.toUpdate);
            }
        }
    }

    async _getResultComponents(result: ResultData): Promise<ComponentData[]> {
        const items = Object.values(this.recipe.results).filter(component => component.type === "Item");
        const tables = Object.values(this.recipe.results).filter(component => component.type === "RollTable");
        for (const component of tables) {
            items.push(...await rollTableToComponents(component, result));
            if (result.hasErrors) return [];
        }
        return items;
    }


}
