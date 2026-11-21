import {Settings} from "../Settings.js";

/**
 * Everything that only exists for the dnd5e system. Called once when the system is dnd5e.
 */
export function initDnd5e() {
    registerSettings();
    Hooks.on("dnd5e.restCompleted", removeFastCraftedItems);
}

function registerSettings() {
    game["settings"].register(Settings.NAMESPACE, "toolConfig;", {
        name: "ToolConfig",
        scope: "world",
        config: false,
        default: [],
        type: Object
    });
    // used by the macros of the "D&D 2024 Tool Recipes" compendium
    game["settings"].register(Settings.NAMESPACE, "dnd5eCrafterDiscount", {
        name: game["i18n"].localize("beaversCrafting.settings.dnd5eCrafterDiscount.name"),
        hint: game["i18n"].localize("beaversCrafting.settings.dnd5eCrafterDiscount.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
}

/**
 * Items with the flag "fastCrafted" (Crafter feat, Fast Crafting) fall apart
 * when the actor finishes the next long rest.
 */
async function removeFastCraftedItems(actor, result) {
    if (!result?.longRest || !actor?.isOwner) {
        return;
    }
    const items = actor.items.filter(i => i.getFlag(Settings.NAMESPACE, "fastCrafted"));
    if (items.length === 0) {
        return;
    }
    await actor.deleteEmbeddedDocuments("Item", items.map(i => i.id));
    const names = items.map(i => (foundry.utils as any).escapeHTML(i.name)).join(", ");
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor}),
        content: `<p>${game["i18n"].format("beaversCrafting.fastCrafting.fellApart", {items: names})}</p>`,
    });
}
