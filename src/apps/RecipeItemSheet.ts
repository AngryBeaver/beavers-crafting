import { Recipe } from "../Recipe.js";
import { Settings } from "../Settings.js";
import { RecipeSheet } from "./RecipeSheet.js";

const DocumentSheetV2 = (foundry as any).applications.api.DocumentSheetV2 as any;

/**
 * Our own sheet for recipes, whatever item type the system uses for them.
 * It is not the default sheet of any type: recipes are routed here by their flag (see registerRecipeItemSheet).
 * The content is built by RecipeSheet, the price / weight / description of the item stay on the system sheet.
 */
export class RecipeItemSheet extends DocumentSheetV2 {
    recipeSheet: RecipeSheet;

    static DEFAULT_OPTIONS = {
        classes: ["beavers-crafting", "recipe-item-sheet"],
        position: {width: 720, height: 720},
        window: {resizable: true, icon: "fa-solid fa-scroll"},
        form: {
            handler: RecipeItemSheet.onSubmit,
            submitOnChange: false,
            closeOnSubmit: false,
        },
        actions: {
            editImage: RecipeItemSheet.onEditImage,
            systemSheet: RecipeItemSheet.onSystemSheet,
        },
    };

    constructor(options) {
        super(options);
        this.recipeSheet = new RecipeSheet(this);
    }

    get title() {
        return this.document.name;
    }

    async _renderHTML(context, options) {
        return this.recipeSheet.renderHTML(options);
    }

    _replaceHTML(result, content, options) {
        const scroll = content.scrollTop;
        content.innerHTML = result;
        content.scrollTop = scroll;
        this.recipeSheet.attach(content);
    }

    _onClose(options) {
        this.recipeSheet.closeSelects();
        super._onClose?.(options);
    }

    /** enter in a field submits the form: save like any other change */
    static async onSubmit(this: RecipeItemSheet) {
        await this.recipeSheet.update();
    }

    static onEditImage(this: RecipeItemSheet) {
        if (!this.isEditable) return;
        const FilePicker = (foundry as any).applications.apps.FilePicker.implementation;
        new FilePicker({
            current: this.document.img,
            type: "image",
            callback: path => this.document.update({img: path}),
            position: {top: this.position.top + 40, left: this.position.left + 10},
            document: this.document,
        }).browse();
    }

    /** the sheet the system has for this item type, for price, weight, description … */
    static onSystemSheet(this: RecipeItemSheet) {
        const sheets = CONFIG.Item.sheetClasses[this.document.type] || {};
        const entries = Object.values(sheets).filter((s: any) => s.cls !== RecipeItemSheet) as any[];
        const entry = entries.find(s => s.default) ?? entries.find(s => s.canBeDefault) ?? entries[0];
        if (!entry) return;
        const cls = entry.cls;
        const sheet = (foundry.utils as any).isSubclass(cls, DocumentSheetV2)
            ? new cls({document: this.document})
            : new cls(this.document, {editable: this.document.isOwner});
        sheet.render(true);
    }
}

/**
 * Registers the sheet for every item type (selectable in Foundry's sheet config, never default)
 * and routes items flagged as recipe to it unless the user picked another sheet for that item.
 * Call in the init hook; the routing is installed on setup, when the system has set its Item class.
 */
export function registerRecipeItemSheet() {
    (foundry as any).applications.apps.DocumentSheetConfig.registerSheet(Item, Settings.NAMESPACE, RecipeItemSheet, {
        label: "beaversCrafting.recipeSheet.sheetLabel",
        makeDefault: false,
        canBeDefault: false,
    });
    Hooks.once("setup", () => {
        const proto = CONFIG.Item.documentClass.prototype as any;
        const original = proto._getSheetClass;
        proto._getSheetClass = function () {
            if (this.getFlag("core", "sheetClass") == null && Recipe.isRecipe(this)) {
                return RecipeItemSheet;
            }
            return original.call(this);
        };
    });
}
