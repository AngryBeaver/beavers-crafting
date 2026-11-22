import { Settings } from "../Settings.js";

const DocumentSheetV2 = (foundry as any).applications.api.DocumentSheetV2 as any;

/** actions shared by our own item sheets (recipe, AnyOf, Script) */

/** the file picker for the item's image */
export function editImage(sheet) {
    if (!sheet.isEditable) return;
    const FilePicker = (foundry as any).applications.apps.FilePicker.implementation;
    new FilePicker({
        current: sheet.document.img,
        type: "image",
        callback: path => sheet.document.update({img: path}),
        position: {top: sheet.position.top + 40, left: sheet.position.left + 10},
        document: sheet.document,
    }).browse();
}

/** the sheet the system has for this item type, for price, weight, description … */
export function openSystemSheet(sheet) {
    const sheets = CONFIG.Item.sheetClasses[sheet.document.type] || {};
    // ours are registered as "beavers-crafting.<class>"
    const entries = Object.entries(sheets)
        .filter(([id]) => !id.startsWith(Settings.NAMESPACE + "."))
        .map(([, entry]) => entry) as any[];
    const entry = entries.find(s => s.default) ?? entries.find(s => s.canBeDefault) ?? entries[0];
    if (!entry) return;
    const cls = entry.cls;
    const system = (foundry.utils as any).isSubclass(cls, DocumentSheetV2)
        ? new cls({document: sheet.document})
        : new cls(sheet.document, {editable: sheet.document.isOwner});
    system.render(true);
}
