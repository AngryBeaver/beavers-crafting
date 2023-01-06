import {Component, Recipe} from "./Recipe.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {getSystem} from "./helpers/Helper.js";

export class Result implements ResultApi {
    _actorUpdate = {};
    _hasException= false;
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
    _currencyResult?: CurrencyResult
    _chatAddition: {
        [key: string]:ComponentChatData
    }
    _actor: any;
    _recipe: Recipe;

    constructor( recipe: Recipe, actor ){
        this._components = {
            required: new ComponentResults(),
            consumed: new ComponentResults(),
            produced: new ComponentResults()
        };
        this._chatAddition = {};
        this._actor = actor;
        this._recipe = recipe;
    }

    hasError():boolean {
        let hasError = false;
        if(this._components.required.hasAnyError()){
            hasError = true;
        }
        if(this._components.consumed.hasAnyError()){
            hasError = true;
        }
        if(this._skill !== undefined){
            if(this._skill.dc > this._skill.total){
                hasError = true;
            }
        }
        if(this._currencyResult !== undefined){
            if(this._currencyResult.hasError ){
                hasError = true;
            }
        }
        return hasError
    }
    _isAnyConsumedAvailable(): boolean {
       return this._components.consumed.isAnyAvailable();
    }

    updateActorProperty(key:string,value:any){
        this._actorUpdate[key]=value;
    }

    addChatComponent(componentChatData : ComponentChatData) {
        this._chatAddition["add_"+componentChatData.type+"_"+componentChatData.component.name] = componentChatData;
    }

    payCurrency(currency: Currency) {
        const system = getSystem();
        this._currencyResult = {...currency,hasError:false};
        const currencies = {};
        currencies[currency.name] = currency.value;
        this._currencyResult.hasError = system.actorCurrencies_canPay(this._actor, currencies);
        this.addChatComponent({
            component: {
                id: "invalid",
                uuid: "invalid",
                type: "Currency",
                name: system.getSystemCurrencies()[currency.name]?.label,
                img: 'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp',
                quantity: currency.value*-1
            },
            hasError: this._currencyResult.hasError,
            type: "consumed"
        });
    }

    deleteComponent(type: ComponentType, componentData: ComponentData) {
        this._components[type].deleteComponentResult(componentData);
    }

    updateComponent(type: ComponentType, componentData: ComponentData, fn: (componentResult:ComponentResult,quantity: number)=>void = (componentResult: ComponentResult,quantity:number)=>{
        componentResult.component.quantity = componentResult.component.quantity + quantity;
    }):void {
        let componentResult = this._components[type].findComponentResult(componentData);
        if(componentResult === undefined){
            componentResult = new ComponentResult();
            componentResult.component = Component.clone(componentData);
            componentResult.component.quantity = 0;
            const itemChange = RecipeCompendium.findComponentInList(this._actor.items, componentData);
            componentResult.component.id = itemChange.toUpdate._id;
            componentResult.originalQuantity = itemChange.toUpdate["system.quantity"];
            this._components[type].addComponentResult(componentResult);
        }
        let userInteraction: UserInteraction = "never";
        let quantity = componentData.quantity*-1;
        if(type === "produced"){
            userInteraction = "onSuccess";
            quantity = quantity*-1;
        }
        if(type === "consumed"){
            userInteraction = "onSuccess";
            if(this._recipe.skill?.consume) {
                userInteraction = "always";
            }
        }
        componentResult.userInteraction=userInteraction;
        fn(componentResult,quantity);
    }
}

export class ComponentResults implements ComponentResultsData {
    _data:ComponentResult[];
    constructor(){
        this._data = [];
    }
    hasAnyError(){
        for(const componentResult of this._data){
            if(componentResult.hasError()){
                return true;
            }
        }
        return false;
    }
    isAnyAvailable(){
        for(const componentResult of this._data){
            if(componentResult.originalQuantity > 0){
                return true;
            }
        }
        return this._data.length === 0;
    }
    hasError(componentData: ComponentData):boolean {
        const componentResult = this.findComponentResult(componentData);
        if (componentResult === undefined) {
            return false;
        }
        return componentResult.hasError()
    }
    addComponentResult(componentResult:ComponentResult){
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

    static from(componentResultData:ComponentResultData):ComponentResult{
        const componentResult = new ComponentResult();
        componentResult.component = Component.clone(componentResultData.component);
        componentResult.originalQuantity = componentResultData.originalQuantity;
        componentResult.userInteraction = componentResultData.userInteraction;
        return componentResult;
    }
    hasError():boolean{
        return this.resultQuantity() < 0;
    }
    isAvailable():boolean{
        return this.originalQuantity > 0;
    }
    resultQuantity():number{
        return this.originalQuantity+this.component.quantity;
    }
}