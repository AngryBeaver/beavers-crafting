import { Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";

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
    _skill?: {
        name: string,
        dc: number,
        total: number,
    };
    _tests: {
        hits:number,
        fails: number,
        maxHits: number,
        maxFails: number
    }
    _currencyResult?: CurrencyResult
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
            _recipe: recipe.serialize()
        }
        return new Result(resultData, actor);
    }

    constructor(resultData: ResultData, actor) {
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
        if (resultData._skill) {
            this._skill = resultData._skill;
        }
        if (resultData._currencyResult) {
            this._currencyResult = new CurrencyResult(resultData._currencyResult);
        }
        this._chatAddition = resultData._chatAddition;
        this._recipe = resultData._recipe;
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
            _components: this._components,
            _skill: this._skill,
            _tests:this._tests,
            _chatAddition: this._chatAddition,
            _recipe: this._recipe,
        }
        if (this._currencyResult === undefined) {
            serialized["-=_currencyResult"]
        } else {
            serialized["_currencyResult"] = this._currencyResult.serialize();
        }
        if (!this._skill) {
            serialized["-=_skill"] = null;
        }
        if (!this._tests) {
            serialized["-=_tests"] = null;
        }
        return serialized;
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
        if (this._skill !== undefined) {
            if (this._skill.dc > this._skill.total) {
                hasError = true;
            }
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

    updateTests(hits:number, fails:number=0){
        if(!this._tests){
            this._initTests(1,1);
        }
        this._tests.hits +=hits;
        this._tests.fails +=fails;
    }

    async payCurrency(currency: Currency) {
        if(this._currencyResult?.isConsumed){
            void await this._currencyResult.pay(this._actor,true)
        }
        this._currencyResult = new CurrencyResult(currency);
        void await this._currencyResult.pay(this._actor);
    }

    async checkCurrency(currency: Currency) {
        this._currencyResult = new CurrencyResult(currency);
        void await this._currencyResult.canPay(this._actor);
    }

    async revertPayedCurrency() {
        if(this._currencyResult== undefined){
            return;
        }
        if(this._currencyResult.isConsumed) {
            const name = this._currencyResult.name;
            const configCurrency = beaversSystemInterface.configCurrencies.find(c=>c.id===name);
            void await this._currencyResult.pay(this._actor, true);
            const component = configCurrency?.component?configCurrency.component:beaversSystemInterface.componentCreate(
                {
                    type:"Currency",
                    name:configCurrency?.label,
                    img:'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp'
                });
            component.quantity = this._currencyResult.value * -1
            this.addChatComponent({
                component: component,
                hasError: this._currencyResult.hasError,
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
        let componentResult = this._components[type].findComponentResult(componentData);
        if (componentResult === undefined) {
            componentResult = new ComponentResult();
            const actorFindings = beaversSystemInterface.itemListComponentFind(this._actor.items,componentData);
            componentResult.component = beaversSystemInterface.componentCreate(componentData);
            componentResult.originalQuantity = actorFindings.quantity;
            componentResult.component.quantity = 0;
            componentResult.isProcessed = false;
            this._components[type].addComponentResult(componentResult);
        }
        let userInteraction: UserInteraction = "never";
        let quantity = componentData.quantity * -1;
        if (type === "produced") {
            userInteraction = "onSuccess";
            quantity = quantity * -1;
        }
        if (type === "consumed") {
            userInteraction = "onSuccess";
            if (this._recipe.skill?.consume || this._recipe.tests?.consume) {
                userInteraction = "always";
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
    isProcessed: boolean = true;

    static from(componentResultData: ComponentResultData): ComponentResult {
        const componentResult = new ComponentResult();
        componentResult.component = beaversSystemInterface.componentCreate(componentResultData.component);
        componentResult.originalQuantity = componentResultData.originalQuantity;
        componentResult.userInteraction = componentResultData.userInteraction;
        componentResult.isProcessed = componentResultData.isProcessed;
        return componentResult;
    }

    hasError(): boolean {
        return this.resultQuantity() < 0;
    }

    isAvailable(): boolean {
        return this.originalQuantity > 0;
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
        const config = mergeObject(CurrencyResult.defaultOptions, data);
        this.name = config.name;
        this.value = config.value;
        this.isConsumed = config.isConsumed;
        this.hasError = config.hasError;
    }

    async canPay(actor) {
        const currencies = {};
        currencies[this.name] = this.value*-1;
        const canPay = await beaversSystemInterface.actorCurrenciesCanAdd(actor, currencies);
        this.hasError = canPay;
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