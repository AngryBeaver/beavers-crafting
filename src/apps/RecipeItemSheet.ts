import { Recipe } from "../Recipe.js";
import { Settings } from "../Settings.js";
import { RecipeSheet } from "./RecipeSheet.js";
import { AnyOfItemSheet, ScriptItemSheet } from "./SubtypeItemSheet.js";
import { AnyOf } from "../AnyOf.js";
import { Script } from "../Script.js";
import { editImage, openSystemSheet } from "../helpers/ItemSheetActions.js";

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
        editImage(this);
    }

    static onSystemSheet(this: RecipeItemSheet) {
        openSystemSheet(this);
    }
}

/**
 * Registers our sheets (recipe, AnyOf, Script) for every item type (selectable in Foundry's sheet config, never default)
 * and routes items flagged with that subtype to them unless the user picked another sheet for that item.
 * Call in the init hook; the routing is installed on setup, when the system has set its Item class.
 */
export function registerRecipeItemSheet() {
    const sheets: [any, string, (item) => boolean][] = [
        [RecipeItemSheet, "beaversCrafting.recipeSheet.sheetLabel", item => Recipe.isRecipe(item)],
        [AnyOfItemSheet, "beaversCrafting.anyOf.sheetLabel", item => AnyOf.isAnyOf(item)],
        [ScriptItemSheet, "beaversCrafting.script.sheetLabel", item => Script.isScript(item)],
    ];
    for (const [cls, label] of sheets) {
        (foundry as any).applications.apps.DocumentSheetConfig.registerSheet(Item, Settings.NAMESPACE, cls, {
            label,
            makeDefault: false,
            canBeDefault: false,
        });
    }
    Hooks.once("setup", () => {
        const proto = CONFIG.Item.documentClass.prototype as any;
        const original = proto._getSheetClass;
        proto._getSheetClass = function () {
            if (this.getFlag("core", "sheetClass") == null) {
                const own = sheets.find(([, , is]) => is(this));
                if (own) return own[0];
            }
            return original.call(this);
        };
    });
}
