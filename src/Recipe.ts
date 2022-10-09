import {Settings} from "./Settings.js";
import {DefaultCurrency} from "./Exchange.js";

export class Recipe implements RecipeStoreData{
    id:string;
    name:string;
    img:string;
    ingredients:Map<string,Component>;
    results:Map<string,Component>;
    skill?:Skill;
    currency?:Currency;
    _trash:Trash;

    constructor(item) {
        const flags = item.flags[Settings.NAMESPACE]?.recipe;
        const data = mergeObject(this.defaultData(), flags || {}, {inplace: false});
        this.id = item.id;
        this.name = item.name;
        this.img = item.img;
        this.ingredients = data.ingredients;
        this.results = data.results;
        this.skill = data.skill;
        this.currency = data.currency;
        this._trash = {
            ingredients:{},
            results:{},
        };
    }

    defaultData() {
        return {
            ingredients: {},
            results: {},
        }
    }
    serialize() {
        const serialized = {
            ingredients: this.serializeIngredients(),
            skill: this.skill,
            results: this.serializeResults(),
            currency: this.currency
        }
        if(!this.skill){
            serialized["-=skill"] = null;
        }
        if(!this.currency){
            serialized["-=currency"] = null;
        }
        return serialized;
    }

    serializeIngredients(){
        return {...this.ingredients,...this._trash.ingredients}
    }
    serializeResults(){
        return {...this.results,...this._trash.results}
    }

    addIngredient(entity,uuid) {
        if(!this.ingredients[entity.id]){
            this.ingredients[entity.id] = new DefaultComponent(entity,uuid);
        }else{
            DefaultComponent.inc(this.ingredients[entity.id])
        }
    }
    removeIngredient(id){
        delete this.ingredients[id];
        this._trash.ingredients["-="+id] = null;
    }
    addResult(entity,uuid) {
        if(!this.results[entity.id]){
            this.results[entity.id] = new DefaultComponent(entity,uuid);
        }else{
            DefaultComponent.inc(this.results[entity.id])
        }
    }
    removeResults(id) {
        delete this.results[id];
        this._trash.results["-=" + id] = null;
    }
    addSkill() {
        this.skill = new DefaultSkill();
    }
    removeSkill(){
        delete this.skill;
    }
    addCurrency(){
        this.currency = new DefaultCurrency();
    }
    removeCurrency(){
        delete this.currency;
    }
}
interface Trash {
    ingredients:{};
    results:{};
}

class DefaultComponent implements Component {
    id: string;
    img: string;
    name: string;
    quantity: number;
    sourceId: string;
    uuid: string;

    constructor(entity,uuid) {
        this.id = entity.id;
        this.uuid = uuid;
        this.name = entity.name;
        this.img = entity.img;
        this.quantity = entity.system.quantity;
        this.sourceId = entity.flags.core?.sourceId;
    }

    static inc(component){
        component.quantity = component.quantity+1;
    }
}

class DefaultSkill implements DefaultSkill{
    name:string;
    dc:number= 8;
    consume:boolean=true;
}

interface RecipeStoreData {
    ingredients:Map<string,Component>;
    results:Map<string,Component>;
    skill?:Skill;
    currency?:Currency;
}