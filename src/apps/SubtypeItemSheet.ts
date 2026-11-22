import { AnyOfSheet } from "./AnyOfSheet.js";
import { ScriptSheet } from "./ScriptSheet.js";
import { editImage, openSystemSheet } from "../helpers/ItemSheetActions.js";
import { renderTemplate } from "../helpers/Compat.js";

const DocumentSheetV2 = (foundry as any).applications.api.DocumentSheetV2 as any;

/** the content part of a subtype sheet */
interface SubtypeContent {
    /** the html of the body, below the header */
    renderBody(): Promise<string>;
    /** the html is in place: wire it up */
    attach(content: HTMLElement): void;
}

/**
 * Our own sheet for the small subtypes (AnyOf, Script): header with image, name and the system sheet,
 * the body comes from the content class. Name and code are saved by the form on change.
 * Routed here by their flag, see registerRecipeItemSheet.
 */
class SubtypeItemSheet extends DocumentSheetV2 {
    content: SubtypeContent;

    static DEFAULT_OPTIONS: any = {
        classes: ["beavers-crafting", "subtype-item-sheet"],
        position: {width: 560, height: 560},
        window: {resizable: true},
        form: {
            submitOnChange: true,
            closeOnSubmit: false,
        },
        actions: {
            editImage: function (this: SubtypeItemSheet) { editImage(this); },
            systemSheet: function (this: SubtypeItemSheet) { openSystemSheet(this); },
        },
    };

    constructor(options) {
        super(options);
    }

    get title() {
        return this.document.name;
    }

    async _renderHTML(context, options) {
        return renderTemplate("modules/beavers-crafting/templates/subtype-item-sheet.hbs", {
            name: this.document.name,
            img: this.document.img,
            editable: this.isEditable,
            body: await this.content.renderBody(),
        });
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;
        const dark = this.element?.classList.contains("theme-dark")
            || (!this.element?.classList.contains("theme-light") && document.body.classList.contains("theme-dark"));
        content.querySelector(".brs")?.classList.toggle("dark", !!dark);
        this.content.attach(content);
    }
}

export class AnyOfItemSheet extends SubtypeItemSheet {
    static DEFAULT_OPTIONS: any = {
        window: {icon: "fa-solid fa-filter"},
    };

    constructor(options) {
        super(options);
        this.content = new AnyOfSheet(this);
    }
}

export class ScriptItemSheet extends SubtypeItemSheet {
    static DEFAULT_OPTIONS: any = {
        window: {icon: "fa-solid fa-code"},
    };

    constructor(options) {
        super(options);
        this.content = new ScriptSheet(this);
    }
}
