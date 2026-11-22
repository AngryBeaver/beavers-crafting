import {Script, SCRIPT_EXAMPLE, ScriptCheckResult} from "../Script.js";
import {getDataFrom} from "../helpers/Utility.js";
import {createDragDrop, renderTemplate} from "../helpers/Compat.js";

/**
 * Content of the Script sheet (ScriptItemSheet): the code and a drop area to test its check with an actor.
 * The code is saved by the sheet's form on change.
 */
export class ScriptSheet {
    app;
    item;
    /** the actor dropped to test the check, kept between renders */
    checkActor?;

    constructor(app) {
        this.app = app;
        this.item = app.document;
    }

    get editable(): boolean {
        return !!this.app.isEditable;
    }

    async renderBody(): Promise<string> {
        const script = new Script(this.item);
        let checkResult: ScriptCheckResult | undefined = undefined;
        if (this.checkActor) {
            checkResult = await script.check(this.checkActor, undefined);
        }
        return renderTemplate('modules/beavers-crafting/templates/script-sheet.hbs', {
            script,
            editable: this.editable,
            hasCheck: await script.hasCheck(),
            checkActor: this.checkActor,
            checkResult,
        });
    }

    attach(content: HTMLElement) {
        const html = $(content);
        html.find('button.test').on("click", () => this.app.render());
        html.find('button.example').on("click", async () => {
            const script = new Script(this.item);
            script.macro = SCRIPT_EXAMPLE;
            await script.update();
        });
        createDragDrop({
            dropSelector: ".drop-area",
            permissions: {drop: () => true},
            callbacks: {drop: this._onDrop.bind(this)},
        }).bind(content);
    }

    /** an actor dropped on the drop area is used to test the check */
    async _onDrop(e) {
        const data = getDataFrom(e);
        if (data?.type === "Actor") {
            this.checkActor = await fromUuid(data.uuid);
        }
        this.app.render();
    }
}
