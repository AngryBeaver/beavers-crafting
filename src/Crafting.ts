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
        await this.addOutput(result);
        await this.updateActor(result);
        await this._sendToChat(result);
        return result;
    }

    async checkSkill(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe,this.actor);
        if (result.hasError) return result;
        if (this.recipe.skill) {
            const skillParts = this.recipe.skill.name.split("-")
            if(skillParts[0] === 'ability'){
                this.roll = await this.actor.rollAbilityTest(skillParts[1], {"chatMessage": false});
            }else{
                this.roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            }
            result.chat.skill = {
                name: this.recipe.skill.name,
                difference: this.roll.total - this.recipe.skill.dc,
                total: this.roll.total
            }
            if (this.roll.total < this.recipe.skill.dc) {
                result.hasError = true;
                result.chat.success = false;
            }
        }
        return result;
    }

    async checkTool(result?: Result): Promise<Result> {
        if(!result) result = new Result(this.recipe,this.actor);
        return await RecipeCompendium.validateTool(this.recipe,this.actor.items,result);
    }

    async checkAttendants(result?: Result): Promise<Result> {
        if(!result) result = new Result(this.recipe,this.actor);
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

    checkCurrency(result?: Result): Result {
        if (!result) result = new Result(this.recipe,this.actor);
        if (this.recipe.currency) {
            result.changeCurrency(this.recipe.currency);
        }
        return result;
    }

    async addOutput(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe,this.actor);
        if (result.hasError) return result;
        const components = await this._getResultComponents(result);
        for (const component of components) {
            result.addComponent("output", component);
        }
        return result;
    }

    async updateActor(result: Result) {
        if (!result) result = new Result(this.recipe,this.actor);
        if (result.hasException || (result.hasError && (!this.recipe.skill?.consume ))) return;
        const createItems: any[] = [];
        const updateItems: any[] = [];
        for (const component of result.updates.items.toCreate) {
            if(component.uuid && component.quantity > 0) {
                const item = await fromUuid(component.uuid);
                if (item !== null) {
                    const itemData = item.toObject();
                    itemData.system.quantity = component.quantity;
                    createItems.push(itemData);
                }
            }
        }
        for (const update of result.updates.items.toUpdate) {
            if( update["system.quantity"] > 0) {
                updateItems.push(update);
            }else{
                result.updates.items.toDelete.push(update._id);
            }
        }
        await this.actor.createEmbeddedDocuments("Item", createItems);
        await this.actor.updateEmbeddedDocuments("Item", updateItems);
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

    async _getResultComponents(result: ResultData): Promise<ComponentData[]> {
        const items = Object.values(this.recipe.results).filter(component => component.type === "Item");
        const tables = Object.values(this.recipe.results).filter(component => component.type === "RollTable");
        for (const component of tables) {
            items.push(...await rollTableToComponents(component, result));
            if (result.hasError) return [];
        }
        return items;
    }


}
