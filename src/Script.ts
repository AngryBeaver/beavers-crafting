import {Settings} from "./Settings.js";

const AsyncFunction = (async function () {}).constructor as any;
const PARAMS = ["actor", "recipe"];

export const SCRIPT_EXAMPLE = `// a requirement of a recipe, put it into "Required"
// available: actor (who crafts), recipe (the recipe)
// check: true when the requirement is met;
//        false or a text (the reason) when it is not
{
  check() {
    if (actor.items.some(i => i.name === "Forge")) return true;
    return "needs a Forge";
  }
}`;

export interface ScriptCheckResult {
    ok: boolean,
    reason?: string,
}

/**
 * Script item: a small script as an item, like AnyOf.
 * The code is one object with a function per job; for now only "check" (a requirement of a recipe).
 */
export class Script {
    macro: string;
    uuid: string;
    img: string;
    name: string;

    static isScript(item): boolean {
        return item?.type === beaversSystemInterface.configLootItemType
            && foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.subtype`) === Settings.SCRIPT_SUBTYPE;
    }

    constructor(item) {
        this.macro = foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.script.macro`) || "";
        this.img = item.img;
        this.name = item.name;
        this.uuid = item.uuid;
    }

    /** the handlers of the code; it is compiled and the object is created, no handler runs */
    async handlers(actor?, recipe?): Promise<{ [key: string]: any }> {
        const fn = new AsyncFunction(...PARAMS, `return (\n${this.macro}\n);`);
        const handlers = await fn(actor, recipe);
        return handlers && typeof handlers === "object" ? handlers : {};
    }

    async hasCheck(): Promise<boolean> {
        try {
            return typeof (await this.handlers()).check === "function";
        } catch (e) {
            return false;
        }
    }

    /** true: met; false or anything else: not met with the name as reason; a text or an error: not met with that reason */
    async check(actor, recipe): Promise<ScriptCheckResult> {
        try {
            const handlers = await this.handlers(actor, recipe);
            if (typeof handlers.check !== "function") {
                return {ok: false, reason: this.name};
            }
            const value = await handlers.check();
            if (value === true) {
                return {ok: true};
            }
            return {ok: false, reason: typeof value === "string" && value ? value : this.name};
        } catch (e) {
            console.error(`Beavers Crafting | script "${this.name}":`, e);
            return {ok: false, reason: e?.message || this.name};
        }
    }

    async update() {
        const item = await fromUuid(this.uuid);
        if (item?.update !== undefined) {
            await item.update({[`flags.${Settings.NAMESPACE}.script.macro`]: this.macro});
        }
    }
}
