import {Settings} from "./Settings.js";
import {DefaultCurrency} from "./Exchange.js";
import {sanitizeUuid} from "./helpers/Utility.js";

export class Recipe implements RecipeStoreData{
    id:string;
    name:string;
    img:string;
    ingredients:Map<string,Component>;
    results:Map<string,Component>;
    skill?:Skill;
    currency?:Currency;
    _trash:Trash;

    static fromItem(item):Recipe{
        const flags = item.flags[Settings.NAMESPACE]?.recipe;
        const data = mergeObject({ingredients:{},results:{}}, flags || {}, {inplace: false});
        return new Recipe(item.id,item.name,item.img,data);
    }


    constructor(id,name,img,data:RecipeStoreData){
        this.id = id;
        this.name = name;
        this.img = img;
        this.ingredients = data.ingredients || {}
        this.results = data.results || {}
        this.skill = data.skill;
        this.currency = data.currency;
        this._trash = {
            ingredients:{},
            results:{},
        };
    }

    serialize():RecipeStoreData {
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

    addIngredient(entity,uuid,type) {
        const uuidS = sanitizeUuid(uuid);
        if(!this.ingredients[uuidS]){
            this.ingredients[uuidS] = new DefaultComponent(entity,uuid,type);
        }else{
            DefaultComponent.inc(this.ingredients[uuidS])
        }
    }
    removeIngredient(uuidS){
        delete this.ingredients[uuidS];
        this._trash.ingredients["-="+uuidS] = null;
    }
    addResult(entity,uuid,type) {
        const uuidS = sanitizeUuid(uuid);
        if(!this.results[uuidS]){
            this.results[uuidS] = new DefaultComponent(entity,uuid,type);
        }else{
            DefaultComponent.inc(this.results[uuidS])
        }
    }
    removeResults(uuidS) {
        delete this.results[uuidS];
        this._trash.results["-=" + uuidS] = null;
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

export class DefaultComponent implements Component {
    id: string;
    img: string;
    name: string;
    quantity: number;
    sourceId: string;
    uuid: string;
    type: string;

    static clone(component: Component):Component{
        return new DefaultComponent(component,component.uuid, component.type)
    }

    constructor(entity, uuid, type) {
        this.id = entity.id;
        this.uuid = entity.uuid;
        this.type = type;
        this.name = entity.name;
        this.img = entity.img;
        this.quantity = entity.system?.quantity || entity.quantity || 1;
        this.sourceId = entity.flags?.core?.sourceId || entity.sourceId;
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