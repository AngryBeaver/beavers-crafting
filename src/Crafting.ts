import {Component, Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {getItem} from "./helpers/Utility.js";
import {AnyOf} from "./AnyOf.js";
import {ComponentResult, Result} from "./Result.js";
import {getSystem} from "./helpers/Helper.js";

export class Crafting {
    recipe: Recipe;
    actor;
    item;
    roll;

    constructor(actor, recipe: Recipe) {
        this.recipe = recipe;
        this.actor = actor;
    }

    static async fromRecipe(actorId, recipe: Recipe) {
        const actor = await fromUuid("Actor." + actorId);
        return new Crafting(actor, recipe);
    }

    static fromOwned(item): Crafting {
        return new Crafting(item.parent, Recipe.fromItem(item));
    }

    static async from(actorId, uuid): Promise<Crafting> {
        const item = await fromUuid(uuid);
        return Crafting.fromRecipe(actorId, Recipe.fromItem(item));
    }

    async craft(): Promise<Result> {
        const result = await this.checkTool();
        await this.checkAttendants(result);
        await this.evaluateAnyOf();
        RecipeCompendium.validateRecipeToItemList(Object.values(this.recipe.ingredients), this.actor.items, result);
        this.checkCurrency(result);
        await this.checkSkill(result);
        await this.addOutput(result);
        await this.executeMacro(result);
        await this.updateActor(result);
        await this._sendToChat(result);
        return result;
    }

    async checkSkill(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe, this.actor);
        if (this.recipe.skill) {
            const skillParts = this.recipe.skill.name.split("-")
            let skillName = skillParts[0];
            if (skillParts[0] === 'ability') {
                skillName = skillParts[1];
                this.roll = await this.actor.rollAbilityTest(skillParts[1], {"chatMessage": false});
            } else {
                this.roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            }
            result._skill = {
                dc: this.recipe.skill.dc,
                name: skillName,
                total: this.roll.total
            }
        }
        return result;
    }

    async checkTool(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe, this.actor);
        return await RecipeCompendium.validateTool(this.recipe, this.actor.items, result);
    }

    async checkAttendants(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe, this.actor);
        return await RecipeCompendium.validateAttendants(this.recipe, this.actor.items, result);
    }

    async evaluateAnyOf() {
        const toDelete: string[] = [];
        const toAdd: ComponentData[] = [];
        for (const [key, component] of Object.entries(this.recipe.ingredients)) {
            if (component.type === Settings.ANYOF_SUBTYPE) {
                const item = await component.getEntity();
                const anyOf = new AnyOf(item);
                let results = await anyOf.filter(this.actor.items);
                results = results.filter(c => {
                    let quantity = c.quantity;
                    toAdd.forEach(a => {
                        if (a.id === c.id) {
                            quantity = quantity - a.quantity;
                        }
                    });
                    return quantity >= component.quantity
                });
                if (results.length >= 0) {
                    const result = results[Math.floor(Math.random() * results.length)];
                    result.quantity = component.quantity;
                    toAdd.push(result);
                    toDelete.push(key);
                }
            }
        }
        toDelete.forEach(k => this.recipe.removeIngredient(k));
        toAdd.forEach(component => {
            this.recipe.addIngredient(component, component.uuid, component.type)
        });
    }

    checkCurrency(result?: Result): Result {
        if (!result) result = new Result(this.recipe, this.actor);
        if (this.recipe.currency) {
            result.payCurrency(this.recipe.currency);
        }

        return result;
    }

    async addOutput(result?: Result): Promise<Result> {
        if (!result) result = new Result(this.recipe, this.actor);
        const components = await this._getResultComponents(result);
        for (const component of components) {
            result.updateComponent("produced", component);
        }
        return result;
    }

    async executeMacro(result: Result) {
        if (!result) result = new Result(this.recipe, this.actor);
        const macroResult = await this.recipe.executeMacro(this.recipe.serialize(), result, this.actor);
        if (macroResult.error !== undefined) {
            // @ts-ignore
            ui.notifications.error("Beavers Crafting | recipe Error see logs")
            console.error("Beavers Crafting | recipe Error:", macroResult.error);
            result._hasException = true;
            return result;
        } else {
            return result;
        }
    }

    async updateActor(result: Result) {
        if (!result) result = new Result(this.recipe, this.actor);
        if (result._hasException) return result;
        const hasError = result.hasError();
        const createItems: any[] = [];
        const updateItems: UpdateItem[] = [];
        const deleteItems: string[] = [];
        const actorItems = this.actor.items;

        async function addItemChange(componentResult: ComponentResult) {
            const itemChange = RecipeCompendium.findComponentInList(actorItems, componentResult.component);
            const isToCreate = itemChange.toUpdate["system.quantity"] === 0;
            let isFirstStack = false;
            if (isToCreate) {
                let itemData = createItems.find(i => i.uuid === componentResult.component.uuid);
                if (itemData === undefined) {
                    isFirstStack = true;
                    const item = await fromUuid(componentResult.component.uuid);
                    if (item === null) {
                        // @ts-ignore
                        ui.notifications.error("Beavers Crafting | can not create Item " + component.name + " from " + component.uuid);
                        result._hasException = true;
                        return;
                    }
                    itemData = item.toObject();
                    itemData["system.quantity"] = componentResult.originalQuantity;
                    createItems.push(itemData);
                }
                itemData["system.quantity"] = itemData["system.quantity"] + componentResult.component.quantity;
            } else {
                let updateItem: UpdateItem | undefined = updateItems.find(i => i._id === itemChange.toUpdate._id);
                if (updateItem === undefined) {
                    isFirstStack = true;
                    updateItem = itemChange.toUpdate;
                    updateItems.push(itemChange.toUpdate);
                }
                updateItem["system.quantity"] = updateItem["system.quantity"] + componentResult.component.quantity;
            }
            if (isFirstStack) {
                deleteItems.push(...itemChange.toDelete);
            }
        }

        for (const componentResult of result._components.consumed._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                await addItemChange(componentResult);
            }
        }
        for (const componentResult of result._components.produced._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                await addItemChange(componentResult);
            }
        }
        if (result._hasException) return result;
        const sanitizedCreateItems = createItems.filter(i => i["system.quantity"] > 0);
        const sanitizedUpdateItems = updateItems.filter(i => i["system.quantity"] > 0);
        for (const deleteUpdates of updateItems.filter(i => i["system.quantity"] <= 0)) {
            deleteItems.push(deleteUpdates._id);
        }
        await this.actor.createEmbeddedDocuments("Item", sanitizedCreateItems);
        await this.actor.updateEmbeddedDocuments("Item", sanitizedUpdateItems);
        await this.actor.deleteEmbeddedDocuments("Item", deleteItems);
        await this.actor.update(result._actorUpdate);
        if(result._currencyResult !== undefined){
            const currencies = {};
            currencies[result._currencyResult.name] = result._currencyResult.value;
            await getSystem().actorCurrencies_pay(this.actor,currencies)
        }
        return result;
    }


    async _sendToChat(result: Result) {
        if (result._hasException) return;
        console.log(result);
        const components: ComponentChatData[] = [];
        const hasError = result.hasError();
        for (const componentResult of result._components.required._data) {
            components.push({
                component: componentResult.component,
                hasError: componentResult.hasError(),
                type: "required"
            })
        }
        for (const componentResult of result._components.consumed._data) {
            components.push({
                component: componentResult.component,
                hasError: componentResult.hasError(),
                type: "consumed"
            })
        }
        for (const componentResult of result._components.produced._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                components.push({
                    component: componentResult.component,
                    hasError: componentResult.hasError(),
                    type: "produced"
                })
            }
        }
        components.push(...Object.values(result._chatAddition));
        const chatData: ChatData = {
            title: this.recipe.name,
            img: this.recipe.img,
            success: !result.hasError(),
            skill: result._skill,
            components: components,
        }
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {
                data: chatData,
            })
        content = TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }

    async _getResultComponents(result: Result): Promise<ComponentData[]> {
        const items = Object.values(this.recipe.results).filter(component => component.type === "Item");
        const tables = Object.values(this.recipe.results).filter(component => component.type === "RollTable");
        for (const component of tables) {
            items.push(...await this._rollTableToComponents(component, result));
        }
        return items;
    }

    async _rollTableToComponents(component: Component, result: Result) {
        const table = await getItem(component.uuid);
        let components: Component[] = [];
        if (!table) {
            // @ts-ignore
            ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableNotFound`) + component.name);
            result._hasException = true;
            return [];
        }
        for (let x = 0; x < component.quantity; x++) {
            const object = await table.roll();
            for (const r of object.results) {
                let uuid = r.documentCollection + "." + r.documentId;
                if (r.documentCollection !== "Item") {
                    const parts = r.documentCollection.split(".");
                    if (parts.length < 2) {
                        // @ts-ignore
                        ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableNotValid`) + r.name);
                        result._hasException = true;
                        return [];
                    }
                    uuid = "Compendium." + uuid;
                }
                const item = await getItem(uuid)
                if (!item) {
                    // @ts-ignore
                    ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableItemNotFound`) + r.name);
                    result._hasException = true;
                    return [];
                }
                components.push(new Component(item, item.uuid, r.documentCollection));
            }
        }
        return components;
    }


}
