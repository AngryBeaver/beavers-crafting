import {Settings} from "./Settings.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";

export class AnyOf {
    macro;
    uuid;
    img;
    name;

    static isAnyOf(item) {
        // @ts-ignore
        return (
            item?.type === beaversSystemInterface.configLootItemType && (
                item?.system?.source === Settings.ANYOF_SUBTYPE ||
                getProperty(item,`flags.${Settings.NAMESPACE}.subtype`) === Settings.ANYOF_SUBTYPE
            )
        );
    }

    constructor(item) {
        const flags = getProperty(item,`flags.${Settings.NAMESPACE}.anyOf`) || {};
        const data = mergeObject(this.defaultData(), flags, {inplace: false});
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
        const result = {
            value:false,
            error: undefined
        }
        try {
            // @ts-ignore
            const fn = new AsyncFunction("item", this.macro);
            result.value = await fn(item);
        } catch (err) {
            // @ts-ignore
            logger.error(err);
            result.error = err;
        }
        return result;
    }

    async filter(itemList): Promise<Component[]>{
        const resultList:Component[] = [];
        for(const item of itemList){
            const result = await this.executeMacro(item);
            const componentItem = beaversSystemInterface.componentFromEntity(item);
            if(result.value){
                const same = resultList.filter(component => component.isSame(componentItem))
                if(same.length > 0){
                    same[0].quantity = same[0].quantity + componentItem.quantity;
                }else{
                    resultList.push(componentItem);
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