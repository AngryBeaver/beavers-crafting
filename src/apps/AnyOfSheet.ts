import { AnyOf } from "../AnyOf.js";
import { getDataFrom } from "../helpers/Utility.js";
import { createDragDrop, renderTemplate } from "../helpers/Compat.js";

/**
 * Content of the AnyOf sheet (AnyOfItemSheet): the code and a drop area to test it with an item.
 * The code is saved by the sheet's form on change.
 */
export class AnyOfSheet {
    app;
    item;
    /** the item dropped to test the code, kept between renders */
    checkItem?;

    constructor(app) {
        this.app = app;
        this.item = app.document;
    }

    get editable(): boolean {
        return !!this.app.isEditable;
    }

    async renderBody(): Promise<string> {
        const anyOf = new AnyOf(this.item);
        let macroResult: MacroResult<boolean> = {value: true};
        if (this.checkItem) {
            macroResult = await anyOf.executeMacro(this.checkItem);
        }
        return renderTemplate('modules/beavers-crafting/templates/anyof-sheet.hbs',
            {anyOf, editable: this.editable, checkItem: this.checkItem, macroResult});
    }

    attach(content: HTMLElement) {
        $(content).find('button.test').on("click", () => this.app.render());
        createDragDrop({
            dropSelector: ".drop-area",
            permissions: {drop: () => true},
            callbacks: {drop: this._onDrop.bind(this)},
        }).bind(content);
    }

    async _onDrop(e) {
        const data = getDataFrom(e);
        if (data?.type === "Item") {
            this.checkItem = await fromUuid(data.uuid);
        }
        this.app.render();
    }
}
