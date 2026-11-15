import { Pip, progressPips } from "../helpers/Progress.js";

/**
 * View model of the chat message posted when a crafting ends (templates/crafting-chat.hbs).
 * The text is localized here because the message is stored as finished html.
 */
interface ChatCardView {
    name: string;
    img: string;
    ok: boolean;
    sub: string;
    pips?: Pip[];
    reason: string;
    produced: { uuid: string, name: string, img: string, quantity: number, lost: boolean }[];
    used: ChipView[];
    tools: ChipView[];
}

interface ChipView {
    name: string;
    img: string;
    cls: "" | "bad" | "kept";
}

const t = (key: string) => game["i18n"].localize("beaversCrafting." + key);
const f = (key: string, data: object) => game["i18n"].format("beaversCrafting." + key, data);

export function chatCardView(chat: ChatData, hasTests: boolean): ChatCardView {
    const ok = chat.status !== "error";
    const tests = chat.beaversTests;
    const withTests = hasTests && tests.maxHits > 0;
    const hits = Math.min(tests.hits, tests.maxHits);
    const fails = Math.min(tests.fails, tests.maxFails);

    const chip = (c: ComponentChatData): ChipView => {
        const quantity = Math.abs(c.component.quantity ?? 1);
        return {
            name: quantity !== 1 || c.component.type === "Currency" ? `${quantity}× ${c.component.name}` : c.component.name,
            img: c.component.img,
            // missing items are marked, items a failed crafting did not use are dimmed
            cls: c.status === "error" ? "bad" : !ok && !c.isProcessed ? "kept" : "",
        };
    };
    const missing = [...chat.components.required, ...chat.components.consumed]
        .filter(c => c.status === "error")
        .map(c => c.component.name);

    let reason = "";
    if (!ok) {
        reason = missing.length ? f("actorSheet.missing", {items: missing.join(", ")}) : t("actorSheet.tooManyFails");
    }
    return {
        name: chat.name,
        img: chat.img,
        ok,
        sub: withTests
            ? f("chat.checks", {hits, maxHits: tests.maxHits})
            : t(ok ? "chat.crafted" : "chat.notCrafted"),
        pips: withTests ? progressPips(hits, tests.maxHits, fails, tests.maxFails) : undefined,
        reason,
        produced: chat.components.produced.map(c => ({
            uuid: c.component.uuid,
            name: c.component.name,
            img: c.component.img,
            quantity: Math.abs(c.component.quantity ?? 1),
            lost: !ok,
        })),
        used: chat.components.consumed.map(chip),
        tools: chat.components.required.map(chip),
    };
}
