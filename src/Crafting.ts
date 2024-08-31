import {Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {Result} from "./Result.js";
import {TestHandler} from "./TestHandler.js";

export class Crafting implements CraftingData {
    uuid: string;
    name: string;
    img: string;
    startAt: number;
    lastAt: number;
    endAt: number;
    isFinished?: boolean;
    result: Result;
    recipe: Recipe;
    actor;
    restore:any[];

    constructor(craftingData: CraftingData, actor) {
        this.uuid = craftingData.uuid || actor.uuid + ".Crafting." + randomID();
        this.startAt = craftingData.startAt;
        this.endAt = craftingData.endAt
        this.lastAt = craftingData.lastAt | craftingData.startAt;
        this.isFinished = craftingData.isFinished;
        this.name = craftingData.name;
        this.img = craftingData.img;
        this.recipe = new Recipe("invalid", "invalid", craftingData.name, craftingData.img, craftingData.recipe);
        this.result = new Result(craftingData.result, actor);
        this.restore = craftingData.restore || [];
        this.actor = actor;
    }

    serialize(): CraftingData {
        return {
            uuid: this.uuid,
            name: this.name,
            img: this.img,
            startAt: this.startAt,
            lastAt: this.lastAt,
            endAt: this.endAt,
            result: this.result.serialize(),
            recipe: this.recipe.serialize(),
            isFinished: this.isFinished,
            restore: this.restore,
        }
    }

    static fromActorRecipe(actor, recipe: Recipe) {
        const craftingData = {
            name: recipe.name,
            img: recipe.img,
            startAt: game["time"].worldTime,
            lastAt:  game["time"].worldTime,
            endAt: 0,
            result: Result.from(recipe, actor),
            recipe: recipe,
            restore: []
        }
        return new Crafting(craftingData, actor);
    }

    static async fromRecipe(actorId, recipe: Recipe) {
        const actor = await fromUuid("Actor." + actorId);
        return Crafting.fromActorRecipe(actor, recipe);
    }

    static fromOwned(item): Crafting {
        return Crafting.fromActorRecipe(item.parent, Recipe.fromItem(item));
    }

    static async from(actorId, uuid: string): Promise<Crafting> {
        const item = await fromUuid(uuid);
        return Crafting.fromRecipe(actorId, Recipe.fromItem(item));
    }

    get nextTest():string{
        if(this.recipe.beaversTests){
            const testHandler = new TestHandler(this.recipe.beaversTests,this.result,this.actor);
            return testHandler.nextTest();
        }
        return "progress"
    }

    async startCrafting() {
        await this.evaluatePossibilities();
        Hooks.call(Settings.NAMESPACE+".start",this.recipe);
        await this.checkRequired();
        RecipeCompendium.validateRecipeToItemList(RecipeCompendium._filterData(this.recipe.input,component=>true), this.actor.items, this.result);
        await this.payCurrency();
        await this.addOutput();
        await this.executeMacro();
        await this.processInput();
        await this._addToActor();
        return this.result;
    }

    async continueCrafting() {
        const moreChecks = await this.checkTests();
        if(moreChecks === false){
            this.endCrafting()
        }
    }

    async endCrafting() {
        await this.processAll();
        this.end();
        await this._sendToChat();
        await this._addToActor();
        return this.result;
    }

    async craft() {
        await this.startCrafting();
        if(Settings.get(Settings.TIME_TO_CRAFT) === "instantly"){
            let moreChecks = await this.checkTests();
            while(moreChecks){
                moreChecks = await this.checkTests();
            }
            await this.endCrafting();
        }
        if(Settings.get(Settings.TIME_TO_CRAFT) === "interaction"){
            if(this.result.hasError()){
                await this.endCrafting();
            }
            this.actor.sheet.activeTab = Settings.ACTOR_TAB_ID;
            await this.actor.sheet.render(true);
            this.actor.sheet.bringToTop();
        }
        return this.result;

    }

    /**
     * returns true if there are further tests.
     */
    async checkTests(){
        if (this.recipe.beaversTests) {
            const testHandler = new TestHandler(this.recipe.beaversTests,this.result,this.actor);
            if(testHandler.hasAdditionalTests()){
                await testHandler.test();
                this.lastAt = game["time"].worldTime;
                await this._addToActor();
            }
            return testHandler.hasAdditionalTests();
        }
        return false;
    }

    async checkRequired() {
        await RecipeCompendium.validateRequired(this.recipe, this.result);
    }

    async evaluatePossibilities(){
        await RecipeCompendium.evaluateOptions("required",this.recipe,this.actor.items);
        await RecipeCompendium.evaluateOptions("input",this.recipe,this.actor.items);
        await RecipeCompendium.evaluateOptions("output",this.recipe,this.actor.items);
    }

    async checkCurrency() {
        if (this.recipe.currency) {
            await this.result.checkCurrency(this.recipe.currency);
        }
    }

    async payCurrency() {
        if (this.recipe.currency) {
            await this.result.payCurrency(this.recipe.currency);
        }
    }

    async addOutput() {
        const components = await this._getResultComponents(this.result);
        for (const component of components) {
            this.result.updateComponent("produced", component);
        }
    }

    async executeMacro() {
        const macroResult = await this.recipe.executeMacro(this.recipe, this.result, this.actor);
        if (macroResult.error !== undefined) {
            // @ts-ignore
            ui.notifications.error("Beavers Crafting | recipe Error see logs")
            console.error("Beavers Crafting | recipe Error:", macroResult.error);
            this.result._hasException = true;
        }
    }

    async processInput() {
        if (this.result._hasException) return;
        this.actor = await fromUuid(this.actor.uuid); //refresh Actor
        const componentList: Component[] = [];
        for (const componentResult of this.result._components.required._data) {
            const component = beaversSystemInterface.componentCreate(componentResult.component);
            if (componentResult.userInteraction !== "never") {
                componentList.push(component);
            }
        }
        for (const componentResult of this.result._components.consumed._data) {
            const component = beaversSystemInterface.componentCreate(componentResult.component);
            if (componentResult.userInteraction !== "never") {
                componentList.push(component);
            }
        }
        try{
            const itemChange = await beaversSystemInterface.actorComponentListAdd(this.actor,componentList);
            this.restore = itemChange.delete;
        }catch(e){
            // @ts-ignore
            ui.notifications.error(e.message)
            this.result._hasException = true;
            return;
        }
        this.actor = await fromUuid(this.actor.uuid);
        for (const componentResult of this.result._components.required._data) {
            if (componentResult.userInteraction !== "never") {
                componentResult.setProcessed(true);
            }
        }
        for (const componentResult of this.result._components.consumed._data) {
            if (componentResult.userInteraction !== "never") {
                componentResult.setProcessed(true);
            }
        }
    }

    private _processComponentResult(componentResults: ComponentResultsData):Component[]{
        const componentList:Component[] = [];
        for (const componentResult of componentResults._data) {
            let component = beaversSystemInterface.componentCreate(componentResult.component);
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !this.result.hasError())) {
                if (!componentResult.isProcessed){
                    componentList.push(component);
                }
            } else {
                if (componentResult.isProcessed) {
                    component.quantity = component.quantity * -1;
                    this.restore.forEach(r=>{
                        if(component.isSame(r)){
                            r.quantity = component.quantity;
                            component = beaversSystemInterface.componentCreate(r);
                        }
                    })
                    componentList.push(component);
                }
            }
        }
        return componentList;
    }

    async processAll() {
        if (this.result._hasException) return;
        this.actor = await fromUuid(this.actor.uuid); //refresh Actor
        const componentList: Component[] = [];
        componentList.push(...this._processComponentResult(this.result._components.required));
        componentList.push(...this._processComponentResult(this.result._components.consumed));
        componentList.push(...this._processComponentResult(this.result._components.produced));
        if (this.result._currencyResult !== undefined) {
            if (!this.recipe.tests?.consume && this.result.hasError()) {
                this.result.revertPayedCurrency();
            }
        }
        try{
            const itemChange = await beaversSystemInterface.actorComponentListAdd(this.actor,componentList);
            if(!this.result.hasError()){
                await this.actor.update(this.result._actorUpdate);
            }
            Object.values(this.result._components).forEach(crs=>{
                for (const componentResult of crs._data) {
                    if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !this.result.hasError())) {
                        componentResult.setProcessed(true);
                    } else {
                        componentResult.setProcessed(false);
                    }
                }
            })
            Hooks.call(Settings.NAMESPACE+".processed",{recipe:this.recipe,result:this.result,processed:itemChange});
        }catch(e){
            // @ts-ignore
            ui.notifications.error(e.message)
            this.result._hasException = true;
            return;
        }
    }

    get chatData(): ChatData {
        return this.getChatData();
    }

    getChatData(): ChatData {
        const components: {
            required:ComponentChatData[],
            consumed:ComponentChatData[],
            produced:ComponentChatData[]
        } = {
            required:[],
            consumed:[],
            produced:[]
        };
        const hasError = this.result.hasError();
        for (const componentResult of this.result._components.required._data) {
            const status = componentResult.hasError()?'error':!componentResult.isProcessed?'undefined':this.isFinished?'success':'locked';
            components.required.push({
                component: componentResult.component,
                status: status,
                type: "required",
                isProcessed: componentResult.isProcessed
            })
        }
        if(this.result._currencyResult) {
            const component = getCurrencyComponent(this.result._currencyResult?.name,this.result._currencyResult.value * -1)
            const status = this.result._currencyResult.hasError?'error':!this.result._currencyResult.isConsumed?'undefined':this.isFinished?'success':'locked';
            components.consumed.push({
                component: component,
                status: status,
                type: "consumed",
                isProcessed: this.result._currencyResult.isConsumed,
            });
        }
        for (const componentResult of this.result._components.consumed._data) {
            const status = componentResult.hasError()?'error':!componentResult.isProcessed?'undefined':this.isFinished?'success':'locked';
            components.consumed.push({
                component: componentResult.component,
                status: status,
                type: "consumed",
                isProcessed: componentResult.isProcessed
            })
        }
        for (const componentResult of this.result._components.produced._data) {
            if (componentResult.userInteraction === "always" || (componentResult.userInteraction === "onSuccess" && !hasError)) {
                const status = componentResult.hasError()?'error':!componentResult.isProcessed?'undefined':this.isFinished?'success':'locked';
                components.produced.push({
                    component: componentResult.component,
                    status: status,
                    type: "produced",
                    isProcessed: componentResult.isProcessed
                })
            }
        }
        Object.values(this.result._chatAddition)
            .filter(s=>s.component.type !== "Currency")//legacy
            .forEach(c=>{
                components[c.type].push(c);
            });


        const tests = {maxHits:1,maxFails:1,hits:0,fails:0,hitPer:0,failPer:0}
        if(this.recipe.beaversTests){
            TestHandler.initialize(this.result,this.recipe.beaversTests);
            tests.maxHits = this.result._tests.maxHits;
            tests.maxFails = this.result._tests.maxFails;
            tests.hits = this.result._tests.hits;
            tests.fails = this.result._tests.fails;
            if(tests.maxFails > 0){
                tests.failPer = Math.round(tests.fails*100/tests.maxFails);
            }
            if(tests.maxHits > 0){
                tests.hitPer = Math.round(tests.hits*100/tests.maxHits);
            }
        }

        let status = "active";
        if(this.result.hasError()){
            status = "error";
            tests.failPer = 100;
        }else if(this.endAt > 0 || this.isFinished){
            status = "success";
            tests.hitPer = 100;
        }
        return {
            name: this.recipe.name,
            img: this.recipe.img,
            status: status,
            beaversTests:tests,
            components: components,
        }

    }

    async _sendToChat() {
        let content = await renderTemplate(`modules/${Settings.NAMESPACE}/templates/crafting-chat.hbs`,
            {
                data: this.getChatData(),
            })
        content = await TextEditor.enrichHTML(content);
        await ChatMessage.create({
            content: content,
            speaker: {actor: this.actor.id},
        })
    }

    async _addToActor() {
        const uuid = this.uuid.replace(/\./g, '-')
        const update = {
            flags: {
                "beavers-crafting": {
                    crafting: {}
                }
            }
        };
        foundry.utils.setProperty(update, `flags.${Settings.NAMESPACE}.crafting.${uuid}`, this.serialize());
        await this.actor.update(update);
    }

    async _getResultComponents(result: Result): Promise<ComponentData[]> {
        const resultComponents = RecipeCompendium._filterData(this.recipe.output,c => c.type === "Item");
        const tables = RecipeCompendium._filterData(this.recipe.output,c => c.type === "RollTable");
        for (const component of tables) {
            resultComponents.push(...await this._rollTableToComponents(component, result));
        }
        return resultComponents;
    }

    async _rollTableToComponents(component: Component, result: Result) {
        const table = await beaversSystemInterface.uuidToDocument(component.uuid);
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
                const item = await beaversSystemInterface.uuidToDocument(uuid)
                if (!item) {
                    // @ts-ignore
                    ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableItemNotFound`) + r.name);
                    result._hasException = true;
                    return [];
                }
                components.push(beaversSystemInterface.componentFromEntity(item));
            }
        }
        return components;
    }

    end() {
        this.isFinished = true;
        this.restore = [];
        this.endAt = game["time"].worldTime;
    }
}

export function getCurrencyComponent(id:string, quantity:number): Component{
    const configCurrency = beaversSystemInterface.configCurrencies.find(c=>c.id===id);
    const component = configCurrency?.component?configCurrency.component:beaversSystemInterface.componentCreate(
        {
            type:"Currency",
            name:configCurrency?.label,
            img:'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp'
        });
    component.quantity = quantity;
    return component;
}