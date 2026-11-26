import {Settings} from "./Settings.js";
import {sanitizeUuid} from "./helpers/Utility.js";
import {Result} from "./Result.js";
import { recipeSkillToTests, recipeTestsToBeaversTests } from "./migration.js";
import { markReplaced } from "./helpers/Compat.js";
import { isHandlerMacro, MacroPhase, runMacroHandler } from "./helpers/RecipeMacro.js";

/** the icon of each kind: the recipe sheet's kind select and the crafting window */
export const RECIPE_KIND_ICONS: { [kind in RecipeKind]: string } = {
    recipe: "fa-scroll",
    blueprint: "fa-compass-drafting",
};

export class Recipe implements RecipeData {
    uuid: string;
    id: string;
    name: string;
    img: string;
    input: {
        [key: string]: {
            [key: string]: Component
        }
    }
    output: {
        [key: string]: {
            [key: string]: Component
        }
    }
    required: {
        [key: string]: {
            [key: string]: Component
        }
    }
    beaversTests?: BeaversCraftingTests;
    tests?: Tests;
    currency?: Currency;
    tool?: string;

    macro: string
    folder?: string;
    instruction?: string;
    kind: RecipeKind;

    /** our flag marks a recipe, whatever item type the system uses for it */
    static isRecipe(item) {
        if (foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.subtype`) === Settings.RECIPE_SUBTYPE) {
            return true;
        }
        // very old recipes were marked in system.source of the loot type
        // @ts-ignore
        return item?.system?.source === Settings.RECIPE_SUBTYPE && item?.type === beaversSystemInterface.configLootItemType;
    }

    static fromItem(item): Recipe {
        const flags = foundry.utils.getProperty(item,`flags.${Settings.NAMESPACE}.recipe`) || {};
        const data = foundry.utils.mergeObject({input: {}, output: {}, required: {}}, flags, {inplace: false});
        return new Recipe(item.uuid, item.id, item.name, item.img, data);
    }

    static clone(recipe: Recipe): Recipe {
        const data = recipe.serialize();
        return new Recipe(recipe.uuid, recipe.id, recipe.name, recipe.img, data);
    }

    constructor(uuid, id, name, img, data: RecipeData) {
        function deserializeComponents(map: { [key: string]: { [key: string]: ComponentData } }): { [key: string]: { [key: string]: Component } } {
            const result = {};
            for (const key in map) {
                const map2 = map[key];
                for (const key2 in map2) {
                    if (!result[key]) {
                        result[key] = {};
                    }
                    const component = map2[key2];
                    result[key][key2] = beaversSystemInterface.componentCreate(component);
                }
            }
            return result;
        }

        function migrate(map: { [key: string]: ComponentData }): false | { [key: string]: { [key: string]: Component } } {
            let hasResult = false;
            const result = {};
            let group = 0;
            for (const key in map) {
                group++;
                hasResult = true;
                result[group] = {key: beaversSystemInterface.componentCreate(map[key])};
            }
            if (hasResult) {
                return result;
            }
            return false;
        }

        this.uuid = uuid;
        this.id = id;
        this.name = name;
        this.img = img;
        this.required = migrate(data.attendants || {}) || deserializeComponents(data.required || {});
        this.input = migrate(data.ingredients || {}) || deserializeComponents(data.input || {});
        this.output = migrate(data.results || {}) || deserializeComponents(data.output || {});
        this.tests = data.tests;
        this.beaversTests = data.beaversTests;
        //own copy: a crafting may change it (macros) without touching the recipe it came from
        this.currency = data.currency ? {...data.currency} : undefined;
        this.tool = data.tool;
        this.macro = data.macro || "";
        this.folder = data.folder;
        this.instruction = data.instruction;
        this.kind = data.kind === "blueprint" ? "blueprint" : "recipe";
        recipeTestsToBeaversTests(this)
    }

    /** a blueprint can only be crafted by an actor that has learned it */
    get mustBeLearned(): boolean {
        return this.kind === "blueprint";
    }

    serialize(): RecipeData {
        //only holds what exists: the recipe is always stored as a whole, see updateData
        const serialized: any = {
            required: this.serializeData("required"),
            input: this.serializeData("input"),
            output: this.serializeData("output"),
        }
        if (this.tool) {
            serialized.tool = this.tool;
        }
        if (this.beaversTests) {
            serialized.beaversTests = this.serializeTests();
        }
        if (this.currency) {
            serialized.currency = this.currency;
        }
        if (this.macro) {
            serialized.macro = this.macro;
        }
        if (this.folder) {
            serialized.folder = this.folder;
        }
        if (this.tests) {
            serialized.tests = this.tests;
        }
        if (this.instruction !== undefined) {
            serialized.instruction = this.instruction;
        }
        if (this.mustBeLearned) {
            serialized.kind = this.kind;
        }
        return serialized;
    }

    serializeData(type) {
        const serialized = {};
        Object.keys(this[type]).forEach(key => {
            serialized[key] = {...this[type][key]};
        });
        return serialized
    }

    serializeTests() {
        if (this.beaversTests != undefined) {
            return {
                fails: this.beaversTests.fails,
                consume: this.beaversTests.consume,
                failsInARow: !!this.beaversTests.failsInARow,
                ands: JSON.parse(JSON.stringify(this.beaversTests.ands))
            };
        }
        return undefined;
    }

    _getNextId(obj) {
        const keys = Object.keys(obj);
        if(keys.length == 0){
            return 1;
        }
        const sorted = keys.map(Number).sort((a, b) => a - b);
        // @ts-ignore
        return sorted[sorted.length - 1] - 1 + 2;
    }

    addRequired(component:Component, keyId, group) {
        this._addData("required", component, keyId, group)
    }

    addInput(component:Component, keyId, group) {
        this._addData("input", component, keyId, group)
    }

    addOutput(component:Component, keyId, group) {
        this._addData("output", component, keyId, group)
    }

    removeRequired(group, id) {
        this._removeData("required", group, id);
    }

    removeInput(group, id) {
        this._removeData("input", group, id);
    }

    removeOutput(group, id) {
        this._removeData("output", group, id);
    }

    _addData(dataType:DataType, component:Component, keyId, group) {
        if (!group || !this[dataType][group]) {
            group = this._getNextId(this[dataType]);
            this[dataType][group] = {};
        }
        const id = sanitizeUuid(keyId);
        if (!this[dataType][group][id]) {
            this[dataType][group][id] = component;
        } else {
            this[dataType][group][id].quantity = this[dataType][group][id].quantity + component.quantity;
        }

    }

    _removeData(type:DataType, group:string, id) {
        delete this[type][group][id];
        if(Object.keys(this[type][group]).length==0){
            delete this[type][group]
        }
    }

    addTestAnd() {
        //copies: the defaults must not be changed through the recipe
        if (this.beaversTests == undefined) {
            this.beaversTests = foundry.utils.deepClone(test);
        } else {
            this.beaversTests.ands[nextKey(this.beaversTests.ands)] = foundry.utils.deepClone(testAnd);
        }
    }

    addTestOr(and) {
        if (this.beaversTests?.ands[and] != undefined) {
            const ors = this.beaversTests.ands[and].ors;
            ors[nextKey(ors)] = {type: "IncrementStep", data: {}};
        }
    }

    removeTestOr(and, or) {
        if (this.beaversTests?.ands[and]?.ors[or] != undefined) {
            if (Object.keys(this.beaversTests?.ands[and]?.ors).length <= 1) {
                if (Object.keys(this.beaversTests?.ands).length <= 1) {
                    this.beaversTests = undefined;
                } else {
                    delete this.beaversTests.ands[and];
                }
            } else {
                delete this.beaversTests.ands[and].ors[or];
            }
        }
    }

    addCurrency() {
        this.currency = new DefaultCurrency();
    }

    removeCurrency() {
        delete this.currency;
    }


    removeTool() {
        delete this.tool;
    }

    /** a handler of the new macro form (see helpers/RecipeMacro.ts); recipeData is this recipe */
    async runMacro(phase: MacroPhase, result: Result, actor, ...args): Promise<MacroResult<Result>> {
        const macroResult: MacroResult<Result> = {
            value: result
        }
        try {
            await runMacroHandler(this.macro, phase, {result, actor, recipeData: this}, ...args);
        } catch (err) {
            console.error(`Beavers Crafting | recipe macro ${phase}:`, err);
            macroResult.error = err;
        }
        return macroResult;
    }

    async executeMacro(recipeData: RecipeData, result: Result, actor): Promise<MacroResult<Result>> {
        const macroResult: MacroResult<Result> = {
            value: result
        }
        if (this.macro === undefined || this.macro === "") {
            return macroResult;
        }
        if (isHandlerMacro(this.macro)) {
            return this.runMacro("start", result, actor);
        }

        const AsyncFunction = (async function () { }).constructor;
        try {
            // @ts-ignore
            const fn = new AsyncFunction("result", "actor", "recipeData", this.macro);
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

    async updateData(data) {
        const item = await fromUuid(this.uuid);
        if (item?.update !== undefined) {
            //replace instead of merge so removed parts do not survive
            await item.update(markReplaced({}, `flags.${Settings.NAMESPACE}.recipe`, data));
        }
    }
}


class DefaultCurrency implements Currency {
    name = "gp"
    value = 5;
}

/** next free numeric key; keys are strings, so sorting them as text would put "10" before "2" */
function nextKey(map: object): number {
    return Math.max(0, ...Object.keys(map || {}).map(Number).filter(n => !isNaN(n))) + 1;
}

const defaultTest: SerializedTest<any> = {
    type: "",
    data: {},
}
const testAnd:BeaversTestAnd = {
    hits: 1,
    ors: {1:defaultTest},
}

const test:BeaversCraftingTests = {
    fails: 1,
    consume: true,
    ands: {1: testAnd}
}

//legacy Tests can be removed
export class DefaultTest implements Tests {
    fails: number = 1;
    consume: boolean = true;
    ands = {
        1: new DefaultAndTest()
    }
}

class DefaultAndTest implements TestAnd {
    hits: number = 1;
    ors = {
        1: new DefaultOrTest
    };
}

class DefaultOrTest implements TestOr {
    check: number = 8;
    type: TestType = "skill"
    uuid = ""
}