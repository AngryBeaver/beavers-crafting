/**
 * Recipe macros come in two forms:
 *  - old: a function body, it runs when the crafting starts
 *  - new: one object with a handler per moment: { start(){}, inputChosen(component){}, resultChosen(component){}, finish(success){} }
 * In both, result, actor and recipeData can be used.
 */
const AsyncFunction = (async function () {}).constructor as any;
const PARAMS = ["result", "actor", "recipeData"];

export type MacroPhase = "start" | "inputChosen" | "resultChosen" | "finish";

/** new form: the whole text is one object. Decided by compiling only, nothing runs. */
export function isHandlerMacro(code: string | undefined): boolean {
    if (!code) return false;
    const withoutComments = code.replace(/^(\s*(\/\/[^\n]*(\n|$)|\/\*[\s\S]*?\*\/))*\s*/, "");
    if (!withoutComments.startsWith("{")) return false;
    try {
        new AsyncFunction(...PARAMS, `return (\n${code}\n);`);
        return true;
    } catch (e) {
        // a block of statements, the old form
        return false;
    }
}

/** runs one handler of the new form; does nothing for the old form or when the handler is missing */
export async function runMacroHandler(code: string, phase: MacroPhase, context: { result, actor, recipeData }, ...args): Promise<void> {
    if (!isHandlerMacro(code)) return;
    const handlers = await new AsyncFunction(...PARAMS, `return (\n${code}\n);`)(context.result, context.actor, context.recipeData);
    if (typeof handlers?.[phase] === "function") {
        await handlers[phase](...args);
    }
}
