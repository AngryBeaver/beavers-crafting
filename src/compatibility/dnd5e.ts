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
 * dnd5e 3+ shows the item types of the create dialog as cards: adds the beaver's item types.
 * @returns false when it is not dnd5e 3+, then the dialog of the other systems is used
 */
export function dnd5eCreateItemDialog(app, html): boolean {
    if (game["system"].id !== "dnd5e" || Number(game["dnd5e"]?.version?.split(".")[0]) < 3) {
        return false;
    }
    const itemType = beaversSystemInterface.configLootItemType;
    const card = (img: string, name: string, subType: string) => `<li>
            <label>
                <img src="${img}" alt="${name}">
                <span>${name}</span>
                <input type="radio" data-subType="${subType}" name="type" value="${itemType}">
            </label>
        </li>`;
    // no beaver's container: dnd5e has its own containers
    html.find("ol.card").append(
        card("icons/sundries/scrolls/scroll-worn-tan.webp", "Recipe", "recipe")
        + card("modules/beavers-crafting/icons/anyOf.png", "AnyOf", "anyOf")
        + card("icons/magic/symbols/cog-glowing-green.webp", "Script", "script")
        + `<input class="subtype" name="flags.beavers-crafting.subtype" style="display:none" value="">`);
    html.find("input[type=radio]").on("click", function () {
        html.find("input.subtype").val($(this).data("subtype"));
    });
    app.setPosition({height: "auto"});
    return true;
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
