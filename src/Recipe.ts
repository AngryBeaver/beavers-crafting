import {Settings} from "./Settings.js";
import {sanitizeUuid} from "./helpers/Utility.js";
import {Result} from "./Result.js";
import { recipeSkillToTests, recipeTestsToBeaversTests } from "./migration.js";

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
        beaversTests: {
            ands: {},
            ors: {}
        };
    }

    static isRecipe(item) {
        // @ts-ignore
        return (item?.type === beaversSystemInterface.configLootItemType && (
                item?.system?.source === Settings.RECIPE_SUBTYPE ||
                foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.subtype`) === Settings.RECIPE_SUBTYPE
            )
        )
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
            beaversTests: {
                ands: {},
                ors: {},
            }
        };
        recipeTestsToBeaversTests(this)
    }

    serialize(): RecipeData {
        const serialized = {
            required: this.serializeData("required"),
            input: this.serializeData("input"),
            output: this.serializeData("output"),
            currency: this.currency,
            tool: this.tool,
            macro: this.macro,
            folder: this.folder,
            instruction: this.instruction,
            beaversTests: this.serializeTests()
        }
        if (!this.tool) {
            serialized["-=tool"] = null;
        }
        if (!this.beaversTests) {
            serialized["-=beaversTests"] = null;
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
        if(!this.tests) {
            serialized["-=tests"] = null;
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
        if (this.beaversTests != undefined) {
            const serialized = {fails: this.beaversTests.fails, consume: this.beaversTests.consume, ands: {}};
            const ands = {...JSON.parse(JSON.stringify(this.beaversTests.ands)), ...this._trash.beaversTests.ands}
            Object.keys(ands).forEach(key => {
                if (this._trash.beaversTests.ors[key] !== undefined) {
                    ands[key].ors = {...ands[key].ors, ...this._trash.beaversTests.ors[key]}
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
            delete this._trash[dataType].ands["-=" +group]
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
        if (this.beaversTests == undefined) {
            this.beaversTests = test
        }else {
            const sorted = Object.keys(this.beaversTests.ands).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length - 1] - 1 + 2;
            this.beaversTests.ands[nextId] = testAnd;
        }
    }

    addTestOr(and) {
        if (this.beaversTests?.ands[and] != undefined) {
            const sorted = Object.keys(this.beaversTests?.ands[and].ors).sort();
            // @ts-ignore
            const nextId = sorted[sorted.length - 1] - 1 + 2;
            this.beaversTests.ands[and].ors[nextId] = {type:"IncrementStep",data:{}}
        }
    }

    removeTestOr(and, or) {
        if (this.beaversTests?.ands[and]?.ors[or] != undefined) {
            if (Object.keys(this.beaversTests?.ands[and]?.ors).length <= 1) {
                if (Object.keys(this.beaversTests?.ands).length <= 1) {
                    this.beaversTests = undefined;
                } else {
                    delete this.beaversTests.ands[and];
                    this._trash.beaversTests.ands["-=" + and] = null;
                }
            } else {
                delete this.beaversTests.ands[and].ors[or];
                if (this._trash.beaversTests.ors[and] == undefined) {
                    this._trash.beaversTests.ors[and] = {};
                }
                this._trash.beaversTests.ors[and]["-=" + or] = null;
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

    async executeMacro(recipeData: RecipeData, result: Result, actor): Promise<MacroResult<Result>> {
        const macroResult: MacroResult<Result> = {
            value: result
        }
        if (this.macro === undefined || this.macro === "") {
            return macroResult;
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


class DefaultCurrency implements Currency {
    name = "gp"
    value = 5;
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