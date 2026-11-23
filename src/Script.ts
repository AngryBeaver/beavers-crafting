import {Settings} from "./Settings.js";

const AsyncFunction = (async function () {}).constructor as any;
const PARAMS = ["actor", "recipe"];

export const SCRIPT_EXAMPLE = `// available: actor (who crafts), recipe (the recipe)
// "Required": needs check(); "Cost": needs pay(), check() and refund() are optional
// quantity: the amount set in the recipe (the same script several times: the sum)
{
  // true when it is there (in this quantity); false or a text (the reason) when not
  check(quantity) {
    if (actor.items.some(i => i.name === "Forge")) return true;
    return "needs a Forge";
  },
  // as a cost: pay it, at the moment the other costs are paid
  // pay(quantity) { },
  // as a cost: give it back, when a failed crafting returns its costs
  // refund(quantity) { }
}`;

export interface ScriptCheckResult {
    ok: boolean,
    reason?: string,
}

/**
 * Script item: a small script as an item, like AnyOf.
 * The code is one object with a function per job:
 * check (requirement, or whether a cost can be paid), pay and refund (a cost); each gets the quantity.
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

    async hasHandler(name: "check" | "pay" | "refund"): Promise<boolean> {
        try {
            return typeof (await this.handlers())[name] === "function";
        } catch (e) {
            return false;
        }
    }

    async hasCheck(): Promise<boolean> {
        return this.hasHandler("check");
    }

    async hasPay(): Promise<boolean> {
        return this.hasHandler("pay");
    }

    /** runs pay or refund; a missing handler does nothing, an error is thrown */
    async run(name: "pay" | "refund", actor, recipe, quantity = 1): Promise<void> {
        const handlers = await this.handlers(actor, recipe);
        if (typeof handlers[name] === "function") {
            await handlers[name](quantity);
        }
    }

    /** true: met; false or anything else: not met with the name as reason; a text or an error: not met with that reason */
    async check(actor, recipe, quantity = 1): Promise<ScriptCheckResult> {
        try {
            const handlers = await this.handlers(actor, recipe);
            if (typeof handlers.check !== "function") {
                return {ok: false, reason: this.name};
            }
            const value = await handlers.check(quantity);
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
