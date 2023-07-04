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
    attendants: {
        [key: string]: Component
    }
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

    macro: string
    folder?: string;
    instruction?: string;
    _trash: {
        required: {
            ands: {},
            ors: {}
        };
        input: {
            ands: {},
            ors: {}
        };
        output: {
            ands: {},
            ors: {}
        };
        tests: {
            ands: {},
            ors: {}
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
        const data = mergeObject({input: {}, output: {}, required: {}}, flags || {}, {inplace: false});
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
        this.skill = data.skill;
        this.tests = data.tests;
        this.currency = data.currency;
        this.tool = data.tool;
        this.macro = data.macro || "";
        this.folder = data.folder;
        this.instruction = data.instruction;
        this._trash = {
            required: {
                ands: {},
                ors: {}
            },
            input: {
                ands: {},
                ors: {}
            },
            output: {
                ands: {},
                ors: {}
            },
            tests: {
                ands: {},
                ors: {},
            }
        };

    }

    serialize(): RecipeData {
        const serialized = {
            required: this.serializeData("required"),
            input: this.serializeData("input"),
            output: this.serializeData("output"),
            skill: this.skill,
            currency: this.currency,
            tool: this.tool,
            macro: this.macro,
            folder: this.folder,
            instruction: this.instruction,
            tests: this.serializeTests()
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
        if (!this.folder) {
            serialized["-=folder"] = null;
        }
        serialized["-=attendants"] = null;
        serialized["-=ingredients"] = null;
        serialized["-=results"] = null;
        return serialized;
    }

    serializeData(type) {
        const serialized = {...this[type], ...this._trash[type].ands}
        Object.keys(serialized).forEach(key => {
            if (this._trash[type].ors[key] !== undefined) {
                serialized[key] = {...this[type][key], ...this._trash[type].ors[key]}
            }
        });
        return serialized
    }

    serializeTests() {
        if (this.tests != undefined) {
            const serialized = {fails: this.tests.fails, consume: this.tests.consume, ands: this.tests.ands};
            const ands = {...this.tests.ands, ...this._trash.tests.ands}
            Object.keys(ands).forEach(key => {
                if (this._trash.tests.ors[key] !== undefined) {
                    ands[key].ors = {...ands[key].ors, ...this._trash.tests.ors[key]}
                }
            })
            serialized.ands = ands;
            return serialized;
        }
        return undefined;
    }

    _getNextId(obj) {
        const keys = Object.keys(obj);
        if(keys.length == 0){
            return 1;
        }
        const sorted = keys.sort();
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

    _addData(dataType, component:Component, keyId, group) {
        if (!group || !this[dataType][group]) {
            group = this._getNextId(this[dataType]);
            this[dataType][group] = {};
            delete this._trash[dataType].ands["-=" +group]
        }
        const id = sanitizeUuid(keyId);
        if (!this[dataType][group][id]) {
            this[dataType][group][id] = component;
        } else {
            this[dataType][group][id].quantity = this[dataType][group][id].quantity + component.quantity;
        }

    }

    _removeData(type, group, id) {
        delete this[type][group][id];
        if (!this._trash[type].ors[group]) {
            this._trash[type].ors[group] = {}
        }
        this._trash[type].ors[group]["-=" + id] = null;
        if(Object.keys(this[type][group]).length==0){
            delete this[type][group]
            delete this._trash[type].ors[group]
            this._trash[type].ands["-=" +group]=null;
        }
    }

    addTestAnd() {
        if (this.skill) {
            // @ts-ignore
            recipeSkillToTests(this);
            return;
        }
        if (this.tests == undefined) {
            this.tests = new DefaultTest();
        } else {
            const sorted = Object.keys(this.tests.ands).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length - 1] - 1 + 2;
            this.tests.ands[nextId] = new DefaultAndTest;
        }
    }

    addTestOr(and) {
        if (this.tests?.ands[and] != undefined) {
            const sorted = Object.keys(this.tests?.ands[and].ors).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length - 1] - 1 + 2;
            this.tests.ands[and].ors[nextId] = new DefaultOrTest();
        }
    }

    removeTestOr(and, or) {
        if (this.tests?.ands[and]?.ors[or] != undefined) {
            if (Object.keys(this.tests?.ands[and]?.ors).length <= 1) {
                if (Object.keys(this.tests?.ands).length <= 1) {
                    this.tests = undefined;
                } else {
                    delete this.tests.ands[and];
                    this._trash.tests.ands["-=" + and] = null;
                }
            } else {
                delete this.tests.ands[and].ors[or];
                if (this._trash.tests.ors[and] == undefined) {
                    this._trash.tests.ors[and] = {};
                }
                this._trash.tests.ors[and]["-=" + or] = null;
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

    async updateData(data) {
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

class DefaultSkill implements Skill {
    name: string;
    dc: number = 8;
    consume: boolean = true;
}

class DefaultCurrency implements Currency {
    name = "gp"
    value = 5;
}