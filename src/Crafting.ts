import {Component, Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {getItem} from "./helpers/Utility.js";
import {AnyOf} from "./AnyOf.js";
import {ComponentResult, Result} from "./Result.js";
import {getSystem} from "./helpers/Helper.js";

export class Crafting implements CraftingData{
    uuid: string;
    name: string;
    img: string;
    startAt: number;
    endAt: number;
    result: Result;
    recipe: Recipe;
    actor;

    constructor(craftingData: CraftingData,actor) {
        this.uuid = craftingData.uuid || actor.uuid+".Crafting."+randomID();
        this.startAt = game["time"].worldTime;
        this.endAt = 0;
        this.name = craftingData.name;
        this.img = craftingData.img;
        this.recipe = new Recipe("invalid","invalid",craftingData.name,craftingData.img,craftingData.recipe);
        this.result = new Result(craftingData.result,actor);
        this.actor = actor;
    }

    serialize():CraftingData{
        return {
            uuid: this.uuid,
            name: this.name,
            img: this.img,
            startAt: this.startAt,
            endAt: this.endAt,
            result: this.result.serialize(),
            recipe: this.recipe.serialize(),
        }
    }

    static fromActorRecipe(actor, recipe: Recipe) {
        const craftingData = {
            name: recipe.name,
            img: recipe.img,
            startAt: 0,
            endAt: 0,
            result: Result.from(recipe,actor),
            recipe: recipe
        }
        return new Crafting(craftingData, actor);
    }

    static async fromRecipe(actorId, recipe: Recipe) {
        const actor = await fromUuid("Actor." + actorId);
        return Crafting.fromActorRecipe(actor,recipe);
    }

    static fromOwned(item): Crafting {
        return Crafting.fromActorRecipe(item.parent, Recipe.fromItem(item));
    }

    static async from(actorId, uuid:string): Promise<Crafting> {
        const item = await fromUuid(uuid);
        return Crafting.fromRecipe(actorId, Recipe.fromItem(item));
    }

    async craft() {
        await this.checkTool();
        await this.checkAttendants();
        await this.evaluateAnyOf();
        RecipeCompendium.validateRecipeToItemList(Object.values(this.recipe.ingredients), this.actor.items, this.result);
        this.checkCurrency();
        await this.checkSkill();
        await this.addOutput();
        await this.executeMacro();
        await this.updateActor();
        await this._sendToChat();
        this.end();
        await this._addToActor();
        return this.result;
    }

    async checkSkill() {
        if (this.recipe.skill) {
            const skillParts = this.recipe.skill.name.split("-")
            let skillName = skillParts[0];
            let roll;
            if (skillParts[0] === 'ability') {
                skillName = skillParts[1];
                roll = await this.actor.rollAbilityTest(skillParts[1], {"chatMessage": false});
            } else {
                roll = await this.actor.rollSkill(this.recipe.skill.name, {"chatMessage": false});
            }
            this.result._skill = {
                dc: this.recipe.skill.dc,
                name: skillName,
                total: roll.total
            }
        }
    }

    async checkTool() {
        await RecipeCompendium.validateTool(this.recipe, this.actor.items, this.result);
    }

    async checkAttendants(){
        await RecipeCompendium.validateAttendants(this.recipe, this.actor.items, this.result);
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

    checkCurrency() {
        if (this.recipe.currency) {
            this.result.payCurrency(this.recipe.currency);
        }
    }

    async addOutput(){
        const components = await this._getResultComponents(this.result);
        for (const component of components) {
            this.result.updateComponent("produced", component);
        }
    }

    async executeMacro() {
        const macroResult = await this.recipe.executeMacro(this.recipe.serialize(), this.result, this.actor);
        if (macroResult.error !== undefined) {
            // @ts-ignore
            ui.notifications.error("Beavers Crafting | recipe Error see logs")
            console.error("Beavers Crafting | recipe Error:", macroResult.error);
            this.result._hasException = true;
        }
    }

    async updateActor() {
        if (this.result._hasException) return ;
        const result = this.result;
        const hasError = this.result.hasError();
        const createItems: any[] = [];
        const updateItems: UpdateItem[] = [];
        const deleteItems: string[] = [];
        const actorItems = this.actor.items;

        async function addItemChange(componentResult: ComponentResult) {
            const itemChange = RecipeCompendium.findComponentInList(actorItems, componentResult.component);
            const isToCreate = itemChange.toUpdate["system.quantity"] === 0;
            let isFirstStack = false;
            if (isToCreate) {
                if(componentResult.component.quantity > 0) {
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
                }
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

        for (const componentResult of this.result._components.consumed._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                await addItemChange(componentResult);
            }
        }
        for (const componentResult of result._components.produced._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                await addItemChange(componentResult);
            }
        }
        if(result._currencyResult !== undefined){
            try {
                const currencies = {};
                currencies[result._currencyResult.name] = result._currencyResult.value;
                await getSystem().actorCurrencies_pay(this.actor, currencies)
            }catch(e){
                result._hasException = true;
            }
        }
        if (result._hasException) return ;
        const sanitizedCreateItems = createItems.filter(i => i["system.quantity"] > 0);
        const sanitizedUpdateItems = updateItems.filter(i => i["system.quantity"] > 0);
        for (const deleteUpdates of updateItems.filter(i => i["system.quantity"] <= 0)) {
            deleteItems.push(deleteUpdates._id);
        }
        await this.actor.createEmbeddedDocuments("Item", sanitizedCreateItems);
        await this.actor.updateEmbeddedDocuments("Item", sanitizedUpdateItems);
        await this.actor.deleteEmbeddedDocuments("Item", deleteItems);
        await this.actor.update(result._actorUpdate);

    }

    getChatData(): ChatData{
        const components: ComponentChatData[] = [];
        const hasError = this.result.hasError();
        for (const componentResult of this.result._components.required._data) {
            components.push({
                component: componentResult.component,
                hasError: componentResult.hasError(),
                type: "required"
            })
        }
        for (const componentResult of this.result._components.consumed._data) {
            components.push({
                component: componentResult.component,
                hasError: componentResult.hasError(),
                type: "consumed"
            })
        }
        for (const componentResult of this.result._components.produced._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                components.push({
                    component: componentResult.component,
                    hasError: componentResult.hasError(),
                    type: "produced"
                })
            }
        }
        components.push(...Object.values(this.result._chatAddition));
        return {
            title: this.recipe.name,
            img: this.recipe.img,
            success: !this.result.hasError(),
            skill: this.result._skill,
            components: components,
        }
    }


    async _sendToChat() {
        if (this.result._hasException) return;
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {
                data: this.getChatData(),
            })
        content = TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }
    async _addToActor(){
        const uuid = this.uuid.replace(/\./g, '-')
        const update = {
            flags:{
                "beavers-crafting":{
                    crafting:{}
                }
            }
        };
        update.flags["beavers-crafting"].crafting[uuid] = this.serialize();
        await this.actor.update(update);
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

    end(){
        this.endAt = game["time"].worldTime;
    }


}
