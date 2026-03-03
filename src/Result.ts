import { Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";
import { getActorContentPool } from "./ContainerHandler.js";


//todo currencies can be stored and can come in.
//in resultData is stored the orignalQuantity when started this then calculates if it hasError.
//when you processItems as you go you would need to change here something.
//as is it can not be serialized without beeing processed so the check for true is fine if we store originalQuantity.
//how to store OriginalQuantity. idea sumUp currencies as they come in if the combinedCurrency is valid originalQuantity = quantity needed.
//the check if the money is fine is then done automatically in the item and stored as all other as well.

export class Result implements ResultApi, ResultData {
    _actorUpdate: {
        [key: string]: string
    }
    _hasException: boolean;
    _components: {
        required: ComponentResults,
        consumed: ComponentResults,
        produced: ComponentResults
    }
    _tests: {
        hits:number,
        fails: number,
        maxHits: number,
        maxFails: number
    }
    _currencyResult?: CurrencyResult
    //sumUpCurrencies as they come in. is not serialized as it is also in the components !
    _currencyCombined: Currencies;
    _chatAddition: {
        [key: string]: ComponentChatData
    }
    _actor: any;
    _recipe: RecipeData;

    static from(recipe: Recipe, actor): Result {
        const resultData: ResultData = {
            _actorUpdate: {},
            _hasException: false,
            _components: {
                required: {
                    _data: []
                },
                consumed: {
                    _data: []
                },
                produced: {
                    _data: []
                }
            },
            _chatAddition: {},
            _recipe: recipe.serialize(),
        }
        return new Result(resultData, actor);
    }

    constructor(resultData: ResultData, actor) {
        this._currencyCombined = {};
        this._recipe = resultData._recipe;
        this._actorUpdate = resultData._actorUpdate;
        this._hasException = resultData._hasException;
        this._components = {
            required: new ComponentResults(),
            consumed: new ComponentResults(),
            produced: new ComponentResults()
        }
        if (resultData._tests) {
            this._tests = resultData._tests;
        }
        if (resultData._currencyResult) {
            this._currencyResult = new CurrencyResult(resultData._currencyResult);
        }else{
            if(this._recipe.currency){
                this._currencyResult = new CurrencyResult(this._recipe.currency);
            }
        }
        if(this._currencyResult){
            this._addCurrencie({name: this._currencyResult.name, value: this._currencyResult.value * -1 });
        }

        this._chatAddition = resultData._chatAddition;

        this._actor = actor;
        resultData._components.consumed._data.forEach(componentResultData => {
            this._components.consumed.addComponentResult(
                ComponentResult.from(componentResultData)
            );
        });
        resultData._components.required._data.forEach(componentResultData => {
            this._components.required.addComponentResult(
                ComponentResult.from(componentResultData)
            );
        });
        resultData._components.produced._data.forEach(componentResultData => {
            this._components.produced.addComponentResult(
                ComponentResult.from(componentResultData)
            );
        });
    }

    serialize() {
        const serialized = {
            _actorUpdate: this._actorUpdate,
            _hasException: this._hasException,
            _components: this.serializeComponents(),
            _tests:this._tests,
            _chatAddition: this._chatAddition,
            _recipe: this._recipe,
        }
        if (this._currencyResult === undefined) {
            serialized["-=_currencyResult"]
        } else {
            serialized["_currencyResult"] = this._currencyResult.serialize();
        }
        if (!this._tests) {
            serialized["-=_tests"] = null;
        }
        return serialized;
    }

    serializeComponents(){
        return {
            required: this._components.required.serialize(),
            consumed: this._components.consumed.serialize(),
            produced: this._components.produced.serialize()
        }
    }

    hasError(): boolean {
        let hasError = false;
        if (this._components.required.hasAnyError()) {
            hasError = true;
        }
        if (this._components.consumed.hasAnyError()) {
            hasError = true;
        }
        if(this._testHasError()){
            hasError = true;
        }
        if (this._currencyResult !== undefined) {
            if (this._currencyResult.hasError) {
                hasError = true;
            }
        }
        if (this._hasException ){
            hasError = true;
        }
        return hasError
    }

    _testHasError(){
        if(this._tests !== undefined){
            if(this._tests.maxFails > 0 && this._tests.maxFails <= this._tests.fails){
                return true;
            }
        }
        return false;
    }

    _isAnyConsumedAvailable(): boolean {
        return this._components.consumed.isAnyAvailable();
    }

    updateActorProperty(key: string, value: any) {
        this._actorUpdate[key] = value;
    }

    addChatComponent(componentChatData: ComponentChatData) {
        this._chatAddition["add_" + componentChatData.type + "_" + componentChatData.component.name] = componentChatData;
    }

    _initTests(maxHits: number, maxFails: number){
        if(!this._tests){
            this._tests = {hits:0,fails:0,maxHits:1,maxFails:1};
        }
        this._tests.maxHits=maxHits;
        this._tests.maxFails=maxFails;
    }
    _addCurrencie(currency:Currency){
        this._currencyCombined[currency.name] = (this._currencyCombined[currency.name] || 0 )+ currency.value
    }

    updateTests(hits:number, fails:number=0){
        if(!this._tests){
            this._initTests(1,1);
        }
        this._tests.hits +=hits;
        this._tests.fails +=fails;
    }

    async payCurrency() {
        if(this._currencyResult && !this._currencyResult.isConsumed){
            void await this._currencyResult.pay(this._actor)
        }
    }

    async checkCurrency() {
        if(this._currencyResult) {
            void await this._currencyResult.canPay(this._actor);
        }
    }

    async revertPayedCurrency() {
        if(this._currencyResult== undefined){
            return;
        }
        if(this._currencyResult.isConsumed) {
            const id = this._currencyResult.name;
            const configCurrency = beaversSystemInterface.configCurrencies.find(c=>c.id===id);
            let name = configCurrency?.label || "";
            void await this._currencyResult.pay(this._actor, true);
            const component = configCurrency?.component?configCurrency.component:beaversSystemInterface.componentCreate(
                {
                    type:"Currency",
                    name:name.replaceAll(".","-"),
                    img:'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp'
                });
            component.quantity = this._currencyResult.value * -1
            this.addChatComponent({
                component: component,
                status: this._currencyResult.hasError?'error':'undefined',
                type: "consumed",
                isProcessed: false,
            });
        }
    }

    deleteComponent(type: ComponentType, componentData: ComponentData) {
        this._components[type].deleteComponentResult(componentData);
    }

    updateComponent(type: ComponentType, componentData: ComponentData, fn: (componentResult: ComponentResult, quantity: number) => void = (componentResult: ComponentResult, quantity: number) => {
        componentResult.component.quantity = componentResult.component.quantity + quantity;
    }): void {
        if(type === "produced"){
            foundry.utils.setProperty(componentData,`flags.${Settings.NAMESPACE}.isCrafted`,true);
            foundry.utils.setProperty(componentData,`flags.${Settings.NAMESPACE}.crafted`,{byId:this._actor.id,byName:this._actor.name});
        }
        let componentResult
        if (componentData.flags?.[Settings.NAMESPACE]?.subtype !== "money") { //stack existings but not money.
            componentResult = this._components[type].findComponentResult(componentData);
        }
        if (componentResult === undefined) {
            componentResult = new ComponentResult();
            let originalQuantity = 0;
            if (componentData.flags?.[Settings.NAMESPACE]?.subtype !== "money") {
                const pool = getActorContentPool(this._actor, false);
                const actorFindings = beaversSystemInterface.itemListComponentFind(pool, componentData);
                originalQuantity = actorFindings.quantity;
            }
            componentResult.component = beaversSystemInterface.componentCreate(componentData);
            componentResult.originalQuantity = originalQuantity;
            componentResult.component.quantity = 0;
            componentResult.isProcessed = false;
            this._components[type].addComponentResult(componentResult);
        }
        let quantity = componentData.quantity * -1;
        if (type === "produced") {
            quantity = quantity * -1;
        }
        let userInteraction: UserInteraction = "never";
        if (type === "produced") {
            userInteraction = "onSuccess";
        } else if (type === "consumed") {
            if (componentData.flags?.[Settings.NAMESPACE]?.subtype === "money") {
                this._addCurrencie({ name: componentData.id, value: quantity});
                if(beaversSystemInterface.actorCurrenciesCanAdd(this._actor,this._currencyCombined)){
                    componentResult.originalQuantity = Math.abs(quantity);
                }
            }
            if (this._recipe.beaversTests?.consume) {
                userInteraction = "always";
            } else {
                userInteraction = "onSuccess";
            }

        }
        componentResult.userInteraction = userInteraction;
        fn(componentResult, quantity);
    }
}

export class ComponentResults implements ComponentResultsData {
    _data: ComponentResult[];

    constructor() {
        this._data = [];
    }

    serialize():ComponentResultsData{
        const serialized = {
            _data:[]
        };
        Object.values(this._data).forEach(c=>{
            const x = c.serialize();
            // @ts-ignore
            serialized._data.push(x);
        });
        return serialized;
    }

    hasAnyError() {
        for (const componentResult of this._data) {
            if (componentResult.hasError()) {
                return true;
            }
        }
        return false;
    }

    isAnyAvailable() {
        for (const componentResult of this._data) {
            if (componentResult.originalQuantity > 0) {
                return true;
            }
        }
        return this._data.length === 0;
    }

    hasError(componentData: ComponentData): boolean {
        const componentResult = this.findComponentResult(componentData);
        if (componentResult === undefined) {
            return false;
        }
        return componentResult.hasError()
    }

    addComponentResult(componentResult: ComponentResult) {
        this._data.push(componentResult);
    }

    findComponentResult(componentData: ComponentData): ComponentResult | undefined {
        return this._data.find(e => e.component.isSame(componentData));
    }

    deleteComponentResult(componentData: ComponentData) {
        this._data.splice(this._data.findIndex(e => e.component.isSame(componentData)), 1);
    }
}

export class ComponentResult implements ComponentResultData {
    component: Component;
    originalQuantity: number;
    userInteraction: UserInteraction;
    isProcessed: boolean = false;

    static from(componentResultData: ComponentResultData): ComponentResult {
        const componentResult = new ComponentResult();
        componentResult.component = beaversSystemInterface.componentCreate(componentResultData.component);
        componentResult.originalQuantity = componentResultData.originalQuantity;
        componentResult.userInteraction = componentResultData.userInteraction;
        componentResult.isProcessed = componentResultData.isProcessed;
        return componentResult;
    }

    constructor() {
    }

    serialize():ComponentResultData{
        return {
            component: this.component,
            isProcessed: this.isProcessed,
            originalQuantity: this.originalQuantity,
            userInteraction: this.userInteraction
        }
    }

    hasError(): boolean {
        return this.resultQuantity() < 0;
    }

    resultQuantity(): number {
        return this.originalQuantity + this.component.quantity;
    }

    setProcessed(isProcessed: boolean) {
        this.isProcessed = isProcessed;
    }
}

export class CurrencyResult implements CurrencyResultData {
    hasError: boolean = false;
    isConsumed: boolean = false;
    name: string;
    value: number;

    serialize(): CurrencyResultData {
        return {
            hasError: this.hasError,
            isConsumed: this.isConsumed,
            name: this.name,
            value: this.value
        }
    }

    static get defaultOptions(): CurrencyResultData {
        return  {
            hasError: false,
            isConsumed: false,
            name: "",
            value: 0
        };
    }

    constructor(data) {
        const config = foundry.utils.mergeObject(CurrencyResult.defaultOptions, data);
        this.name = config.name;
        this.value = config.value;
        this.isConsumed = config.isConsumed;
        this.hasError = config.hasError;
    }

    async canPay(actor) {
        const currencies = {};
        currencies[this.name] = this.value*-1;
        const canPay = await beaversSystemInterface.actorCurrenciesCanAdd(actor, currencies);
        this.hasError = !canPay;
        return canPay;
    }

    async pay(actor,revert:boolean= false) {
        if ((!this.isConsumed && !revert) || (revert && this.isConsumed)) {
            const currencies = {};
            currencies[this.name] = this.value*-1;
            if(revert){
                currencies[this.name] = currencies[this.name]*-1;
            }
            try {
                await beaversSystemInterface.actorCurrenciesAdd(actor, currencies,Settings.get(Settings.CURRENCY_EXCHANGE));
                this.isConsumed = !revert;
            }catch (e){
                console.error("Beavers Crafting | currency Error:", e);
                this.hasError = true;
            }
        }
    }

}