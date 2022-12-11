import {Settings} from "./Settings.js";
import {DefaultCurrency} from "./Exchange.js";
import {getItem, sanitizeUuid} from "./helpers/Utility.js";
import {getToolConfig} from "./apps/ToolConfig.js";

export class Recipe implements RecipeData {
    uuid:string;
    id:string;
    name:string;
    img:string;
    ingredients:{
        [key: string]: Component
    }
    results: {
        [key: string]: Component
    }
    skill?:Skill;
    currency?:Currency;
    tool?:string;
    attendants:{
        [key: string]: Component
    }
    macro:string
    _trash:{
        ingredients:{};
        results:{};
        attendants:{};
    }

    static isRecipe(item) {
        // @ts-ignore
        return (item?.type === 'loot' && item?.system?.source === Settings.RECIPE_SUBTYPE);
    }

    static fromItem(item):Recipe{
        const flags = item.flags[Settings.NAMESPACE]?.recipe;
        const data = mergeObject({attendants:{},ingredients:{},results:{}}, flags || {}, {inplace: false});
        return new Recipe(item.uuid,item.id,item.name,item.img,data);
    }

    static fromRecipe(recipe: Recipe):Recipe{
        const data = recipe.serialize();
        return new Recipe(recipe.uuid,recipe.id,recipe.name,recipe.img,data);
    }

    constructor(uuid, id,name,img,data:RecipeData){
        function deserializeComponents(map:{[key: string]: ComponentData}): {[key: string]: Component}{
            const result = {};
            for(const key in map){
                const component = map[key];
                result[key] = new Component(component,component.uuid,component.type);
            }
            return result;
        }
        this.uuid=uuid;
        this.id = id;
        this.name = name;
        this.img = img;
        this.ingredients = deserializeComponents(data.ingredients || {});
        this.results = deserializeComponents(data.results || {});
        this.skill = data.skill;
        this.currency = data.currency;
        this.tool = data.tool;
        this.attendants = deserializeComponents(data.attendants || {});
        this.macro = data.macro || "";
        this._trash = {
            ingredients:{},
            results:{},
            attendants:{}
        };

    }

    serialize():RecipeData {
        const serialized = {
            ingredients: this.serializeIngredients(),
            skill: this.skill,
            results: this.serializeResults(),
            currency: this.currency,
            tool: this.tool,
            attendants: this.serializeAttendants(),
            macro: this.macro
        }
        if(!this.tool){
            serialized["-=tool"] = null;
        }
        if(!this.skill){
            serialized["-=skill"] = null;
        }
        if(!this.currency){
            serialized["-=currency"] = null;
        }
        return serialized;
    }

    serializeAttendants(){
        return {...this.attendants,...this._trash.attendants}
    }
    serializeIngredients(){
        return {...this.ingredients,...this._trash.ingredients}
    }
    serializeResults(){
        return {...this.results,...this._trash.results}
    }

    addAttendant(entity,uuid,type) {
        const uuidS = sanitizeUuid(uuid);
        if(!this.attendants[uuidS]){
            this.attendants[uuidS] = new Component(entity,uuid,type);
        }else{
            this.attendants[uuidS].inc();
        }
    }
    removeAttendant(uuidS){
        delete this.attendants[uuidS];
        this._trash.attendants["-="+uuidS] = null;
    }

    addIngredient(entity,uuid,type) {
        const uuidS = sanitizeUuid(uuid);
        if(!this.ingredients[uuidS]){
            this.ingredients[uuidS] = new Component(entity,uuid,type);
        }else{
            this.ingredients[uuidS].inc();
        }
    }
    removeIngredient(uuidS){
        delete this.ingredients[uuidS];
        this._trash.ingredients["-="+uuidS] = null;
    }
    addResult(entity,uuid,type) {
        const uuidS = sanitizeUuid(uuid);
        if(!this.results[uuidS]){
            this.results[uuidS] = new Component(entity,uuid,type);
        }else{
            this.results[uuidS].inc();
        }
    }
    removeResult(uuidS) {
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
    async addTool(){
        const config = await getToolConfig()
        this.tool = config[0].uuid;
    }
    removeTool(){
        delete this.tool;
    }

    async executeMacro(result:Result): Promise<MacroResult<Result>> {
        const macroResult: MacroResult<Result> = {
            value: result
        }
        if(this.macro === undefined || this.macro ===""){
            return macroResult;
        }
        const AsyncFunction = (async function () {}).constructor;
        // @ts-ignore
        const fn = new AsyncFunction("result", this.macro);
        try {
            macroResult.value = await fn(result);
        } catch (err) {
            // @ts-ignore
            logger.error(err);
            macroResult.error = err;
        }
        return macroResult;
    }

    async update(){
        const flags={};
        flags[Settings.NAMESPACE] = {
            recipe: this.serialize()
        };
        const item = await fromUuid(this.uuid);
        if(item?.update !== undefined) {
            await item.update({
                "flags": flags
            });
        }
    }

}

export class Component implements ComponentData {
    id: string;
    img: string;
    name: string;
    quantity: number;
    uuid: string;
    type: string;
    itemType?: string;

    static clone(component: ComponentData):ComponentData{
        return new Component(component,component.uuid, component.type)
    }

    constructor(entity, uuid, type) {
        this.id = entity.id;
        this.uuid = entity.uuid;
        this.type = type;
        if(type === "Item") {
            this.itemType = entity.itemType || (entity.type==="Item"?undefined:entity.type);
        }
        this.name = entity.name;
        this.img = entity.img;
        this.quantity = entity.system?.quantity || entity.quantity || 1;
    }

    inc(){
        this.quantity = this.quantity+1;
    }

    async getEntity(){
        return getItem(this.uuid);
    }

    static inc(component: ComponentData){
        component.quantity = component.quantity+1;
    }
}

class DefaultSkill implements DefaultSkill{
    name:string;
    dc:number= 8;
    consume:boolean=true;
}