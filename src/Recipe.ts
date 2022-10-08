import {Settings} from "./Settings.js";
import {Currency} from "./Exchange.js";

export class Recipe {
    ingredients:Map<string,Component>;
    results:Map<string,Component>;
    skill?:Skill;
    currency?:Currency;
    _trash:Trash;

    constructor(item) {
        const flags = item.flags[Settings.NAMESPACE]?.recipe;
        const data = mergeObject(this.defaultData(), flags || {}, {inplace: false});
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
        return {
            ingredients: this.serializeIngredients(),
            skill: this.skill,
            results: this.serializeResults(),
            currency: this.currency
        }
    }
    serializeIngredients(){
        return {...this.ingredients,...this._trash.ingredients}
    }
    serializeResults(){
        return {...this.results,...this._trash.results}
    }

    addIngredient(entity,uuid) {
        if(!this.ingredients[entity.id]){
            this.ingredients[entity.id] = new Component(entity,uuid);
        }else{
            Component.inc(this.ingredients[entity.id])
        }
    }
    removeIngredient(id){
        delete this.ingredients[id];
        this._trash.ingredients["-="+id] = null;
    }
    addResult(entity,uuid) {
        if(!this.results[entity.id]){
            this.results[entity.id] = new Component(entity,uuid);
        }else{
            Component.inc(this.results[entity.id])
        }
    }
    removeResults(id) {
        delete this.results[id];
        this._trash.results["-=" + id] = null;
    }
    addSkill() {
        this.skill = new Skill();
    }
    removeSkill(){
        delete this.skill;
    }
    addCurrency(){
        this.currency = new Currency();
    }
    removeCurrency(){
        delete this.currency;
    }
}
class Trash {
    ingredients:{};
    results:{};
}

class Component {
    id:string;
    uuid:string;
    sourceId:string;
    name:string;
    img:string;
    quantity:number;

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

class Skill {
    name:string;
    dc:number= 8;
    consume:boolean=true;
}
