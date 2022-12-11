import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {Component} from "./Recipe.js";

export class AnyOf {
    macro;
    uuid;
    img;
    name;

    static isAnyOf(item) {
        // @ts-ignore
        return (item?.type === 'loot' && item?.system?.source === Settings.ANYOF_SUBTYPE);
    }

    constructor(item) {
        const flags = item.flags[Settings.NAMESPACE]?.anyOf;
        const data = mergeObject(this.defaultData(), flags || {}, {inplace: false});
        this.macro = data.macro;
        this.img = item.img;
        this.name = item.name;
        this.uuid = item.uuid;
    }

    defaultData() {
        return {
            macro: "",
        }
    }

    serialize(): AnyOfStoreData {
        const serialized = {
            macro: this.macro,
        }
        return serialized;
    }

    async executeMacro(item): Promise<MacroResult<boolean>> {
        const AsyncFunction = (async function () {}).constructor;
        // @ts-ignore
        const fn = new AsyncFunction("item", this.macro);
        const result = {
            value:false,
            error: undefined
        }
        try {
            result.value = await fn(item);
        } catch (err) {
            // @ts-ignore
            logger.error(err);
            result.error = err;
        }
        return result;
    }

    async filter(itemList): Promise<ComponentData[]>{
        const resultList:ComponentData[] = [];
        for(const item of itemList){
            const result = await this.executeMacro(item);
            if(result.value){
                const same = resultList.filter(component => RecipeCompendium.isSame(item,component))
                if(same.length > 0){
                    same[0].quantity = same[0].quantity + item.system?.quantity;
                }else{
                    resultList.push(new Component(item,item.uuid,"Item"));
                }
            }
        }
        return resultList;
    }

    async update() {
        const flags={};
        flags[Settings.NAMESPACE] = {
            anyOf: this.serialize()
        };
        const item = await fromUuid(this.uuid);
        if(item?.update !== undefined) {
            await item.update({
                "flags": flags
            });
        }
    }

}