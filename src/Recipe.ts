import {Settings} from "./Settings.js";
import {sanitizeUuid} from "./helpers/Utility.js";
import {getToolConfig} from "./apps/ToolConfig.js";
import {Result} from "./Result.js";
import {recipeSkillToTests} from "./migration.js";

export class Recipe implements RecipeData {
    uuid: string;
    id: string;
    name: string;
    img: string;
    ingredients: {
        [key: string]: Component
    }
    results: {
        [key: string]: Component
    }
    tests?: Tests;
    skill?: Skill;
    currency?: Currency;
    tool?: string;
    attendants: {
        [key: string]: Component
    }
    macro: string
    _trash: {
        ingredients: {};
        results: {};
        attendants: {};
        tests: {
            ands:{},
            ors:{}
        };
    }

    static isRecipe(item) {
        // @ts-ignore
        return (item?.type === beaversSystemInterface.configLootItemType && (
                item?.system?.source === Settings.RECIPE_SUBTYPE ||
                item?.flags["beavers-crafting"]?.subtype === Settings.RECIPE_SUBTYPE
            )
        )
    }

    static fromItem(item): Recipe {
        const flags = item.flags[Settings.NAMESPACE]?.recipe;
        const data = mergeObject({attendants: {}, ingredients: {}, results: {}}, flags || {}, {inplace: false});
        return new Recipe(item.uuid, item.id, item.name, item.img, data);
    }

    static clone(recipe: Recipe): Recipe {
        const data = recipe.serialize();
        return new Recipe(recipe.uuid, recipe.id, recipe.name, recipe.img, data);
    }

    constructor(uuid, id, name, img, data: RecipeData) {
        function deserializeComponents(map: { [key: string]: ComponentData }): { [key: string]: Component } {
            const result = {};
            for (const key in map) {
                const component = map[key];
                result[key] = beaversSystemInterface.componentCreate(component);
            }
            return result;
        }

        this.uuid = uuid;
        this.id = id;
        this.name = name;
        this.img = img;
        this.ingredients = deserializeComponents(data.ingredients || {});
        this.results = deserializeComponents(data.results || {});
        this.skill = data.skill;
        this.tests = data.tests;
        this.currency = data.currency;
        this.tool = data.tool;
        this.attendants = deserializeComponents(data.attendants || {});
        this.macro = data.macro || "";
        this._trash = {
            ingredients: {},
            results: {},
            attendants: {},
            tests: {
                ands:{},
                ors:{},
            }
        };

    }

    serialize(): RecipeData {
        const serialized = {
            ingredients: this.serializeIngredients(),
            skill: this.skill,
            tests: this.serializeTests(),
            results: this.serializeResults(),
            currency: this.currency,
            tool: this.tool,
            attendants: this.serializeAttendants(),
            macro: this.macro
        }
        if (!this.tool) {
            serialized["-=tool"] = null;
        }
        if (!this.skill) {
            serialized["-=skill"] = null;
        }
        if (!this.tests) {
            serialized["-=tests"] = null;
        }
        if (!this.currency) {
            serialized["-=currency"] = null;
        }
        if (!this.macro) {
            serialized["-=macro"] = null;
        }
        return serialized;
    }

    serializeAttendants() {
        return {...this.attendants, ...this._trash.attendants}
    }

    serializeIngredients() {
        return {...this.ingredients, ...this._trash.ingredients}
    }

    serializeResults() {
        return {...this.results, ...this._trash.results}
    }
    serializeTests() {
        if(this.tests != undefined){
            const serialized =  {fails:this.tests.fails,consume:this.tests.consume,ands:this.tests.ands};
            const ands = {...this.tests.ands, ...this._trash.tests.ands}
            Object.keys(ands).forEach(key=>{
                if(this._trash.tests.ors[key] !== undefined){
                    ands[key].ors = {...ands[key].ors,...this._trash.tests.ors[key]}
                }
            })
            serialized.ands = ands;
            return serialized;
        }
        return undefined;
    }

    addAttendant(entity, keyId, type) {
        const uuidS = sanitizeUuid(keyId);
        if (!this.attendants[uuidS]) {
            this.attendants[uuidS] = beaversSystemInterface.componentFromEntity(entity);
            this.attendants[uuidS].type = type;
        } else {
            this.attendants[uuidS].quantity = this.attendants[uuidS].quantity+1;
        }
    }

    removeAttendant(uuidS) {
        delete this.attendants[uuidS];
        this._trash.attendants["-=" + uuidS] = null;
    }

    addIngredient(entity, keyId, type) {
        const uuidS = sanitizeUuid(keyId);
        if (!this.ingredients[uuidS]) {
            this.ingredients[uuidS] = beaversSystemInterface.componentFromEntity(entity);
            this.ingredients[uuidS].type = type;
        } else {
            this.ingredients[uuidS].quantity = this.ingredients[uuidS].quantity+1;
        }
    }
    addIngredientComponent(component) {
        const uuidS = sanitizeUuid(component.uuid);
        if (!this.ingredients[uuidS]) {
            this.ingredients[uuidS] = component;
        } else {
            this.ingredients[uuidS].quantity = this.ingredients[uuidS].quantity+1;
        }
    }

    removeIngredient(uuidS) {
        delete this.ingredients[uuidS];
        this._trash.ingredients["-=" + uuidS] = null;
    }

    addResult(entity, keyId, type) {
        const uuidS = sanitizeUuid(keyId);
        if (!this.results[uuidS]) {
            this.results[uuidS] = beaversSystemInterface.componentFromEntity(entity);
            this.results[uuidS].type = type;
        } else {
            this.results[uuidS].quantity = this.results[uuidS].quantity+1;
        }
    }

    removeResult(uuidS) {
        delete this.results[uuidS];
        this._trash.results["-=" + uuidS] = null;
    }

    addTestAnd() {
        if(this.skill){
            // @ts-ignore
            recipeSkillToTests(this);
            return;

        }
        if(this.tests == undefined){
            this.tests = new DefaultTest();
        }else{
            const sorted = Object.keys(this.tests).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length-1]-1+2;
            this.tests.ands[nextId] = new DefaultAndTest;
        }
    }

    addTestOr(and) {
        if(this.tests?.ands[and] != undefined){
            const sorted = Object.keys(this.tests?.ands[and].ors).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length-1]-1+2;
            this.tests.ands[and].ors[nextId] = new DefaultOrTest();
        }
    }

    removeTestOr(and,or){
        if(this.tests?.ands[and]?.ors[or] != undefined){
            if(Object.keys(this.tests?.ands[and]?.ors).length <= 1) {
                if(Object.keys(this.tests?.ands).length <= 1) {
                    this.tests = undefined;
                }else{
                    delete this.tests.ands[and];
                    this._trash.tests.ands["-="+and] = null;
                }
            }else{
                delete this.tests.ands[and].ors[or];
                if( this._trash.tests.ors[and] == undefined){
                    this._trash.tests.ors[and] = {};
                }
                this._trash.tests.ors[and]["-="+or] = null;
            }
        }
    }

    addSkill() {
        this.skill = new DefaultSkill();
    }

    removeSkill() {
        delete this.skill;
    }

    addCurrency() {
        this.currency = new DefaultCurrency();
    }

    removeCurrency() {
        delete this.currency;
    }

    async addTool() {
        const config = await getToolConfig()
        this.tool = config[0].uuid;
    }

    removeTool() {
        delete this.tool;
    }

    async executeMacro(recipeData: RecipeData, result: Result, actor): Promise<MacroResult<Result>> {
        const macroResult: MacroResult<Result> = {
            value: result
        }
        if (this.macro === undefined || this.macro === "") {
            return macroResult;
        }
        const AsyncFunction = (async function () {
        }).constructor;
        // @ts-ignore
        const fn = new AsyncFunction("result", "actor", "recipeData", this.macro);
        try {
            macroResult.value = await fn(result, actor, recipeData);
        } catch (err) {
            // @ts-ignore
            logger.error(err);
            macroResult.error = err;
        }
        return macroResult;
    }

    async update() {
        await this.updateData(this.serialize());
    }

    async updateData(data){
        const flags = {};
        flags[Settings.NAMESPACE] = {
            recipe: data
        };
        const item = await fromUuid(this.uuid);
        if (item?.update !== undefined) {
            await item.update({
                "flags": flags
            });
        }
    }

}

export class DefaultTest implements Tests {
    fails:number =1;
    consume: boolean = true;
    ands={
        1: new DefaultAndTest()
    }
}
class DefaultAndTest implements TestAnd {
    hits:number=1;
    ors={
        1: new DefaultOrTest
    };
}
class DefaultOrTest implements TestOr{
    check:number=8;
    type:TestType="skill"
    uuid=""
}

class DefaultSkill implements Skill {
    name: string;
    dc: number = 8;
    consume: boolean = true;
}

class DefaultCurrency implements Currency {
    name = "gp"
    value = 5;
}