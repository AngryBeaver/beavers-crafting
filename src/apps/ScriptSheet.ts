import {Script, SCRIPT_EXAMPLE, ScriptCheckResult} from "../Script.js";
import {getDataFrom} from "../helpers/Utility.js";
import {createDragDrop, renderTemplate} from "../helpers/Compat.js";

const scriptSheets: { [key: string]: ScriptSheet } = {};

/** replaces the content of the system's item sheet for Script items, like the AnyOf sheet */
export class ScriptSheet {
    app;
    item;
    script: Script;
    scriptElement?;
    checkActor?;

    static bind(app, html, version) {
        if (Script.isScript(app.item)) {
            app.version = version;
            if (!scriptSheets[app.id]) {
                scriptSheets[app.id] = new ScriptSheet(app);
            }
            scriptSheets[app.id].init(html);
        }
    }

    get editable() {
        return this.app.options.editable || (this.app.isEditable && this.app._mode == 2) //V2 or DNDv5
    }

    constructor(app) {
        this.app = app;
        this.item = app.item;
    }

    init(html) {
        this.script = new Script(this.item);
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        const exists = html.find(".beavers-crafting.script");
        if (exists.length != 0) {
            if (this.app.version === 1) {
                return; //do not repaint
            }
            exists.remove(); // repaint everything
        }
        this.scriptElement = $('<div class="beavers-crafting script" style="height:100%;width:100%;padding:15px;"></div>');
        beaversSystemInterface.itemSheetReplaceContent(this.app, html, this.scriptElement);
        this.render().then(() => this.addDragDrop());
    }

    async render() {
        let checkResult: ScriptCheckResult | undefined = undefined;
        if (this.checkActor) {
            checkResult = await this.script.check(this.checkActor, undefined);
        }
        const template = await renderTemplate('modules/beavers-crafting/templates/script-sheet.hbs', {
            script: this.script,
            editable: this.editable,
            hasCheck: await this.script.hasCheck(),
            checkActor: this.checkActor,
            checkResult,
        });
        this.scriptElement.find('.script-sheet').remove();
        this.scriptElement.append(template);
        this.handleEvents();
    }

    handleEvents() {
        this.scriptElement.find('button.test').on("click", () => this.render());
        this.scriptElement.find('button.example').on("click", async () => {
            this.script.macro = SCRIPT_EXAMPLE;
            await this.script.update();
            await this.render();
        });
        this.scriptElement.find('textarea').on("change", async (e) => {
            this.script.macro = e.target.value;
            await this.script.update();
            await this.render();
        });
    }

    addDragDrop() {
        if (this.app._dragDrop) {
            this.app._dragDrop = this.app._dragDrop.filter(d => d.name !== "scriptSheet");
        }
        const dragDrop = createDragDrop({
            dropSelector: '',
            permissions: {
                dragstart: () => true,
                drop: () => true
            },
            callbacks: {
                dragstart: this.app._onDragStart?.bind(this.app),
                dragover: this.app._onDragOver?.bind(this.app),
                drop: this._onDrop.bind(this)
            }
        });
        dragDrop["name"] = "scriptSheet";
        this.app._dragDrop?.push(dragDrop);
        dragDrop.bind(this.scriptElement[0]);
    }

    /** an actor dropped on the drop area is used to test the check */
    async _onDrop(e) {
        if (!$(e.target).closest(".drop-area").length) {
            return;
        }
        const data = getDataFrom(e);
        if (data?.type === "Actor") {
            this.checkActor = await fromUuid(data.uuid);
        }
        await this.render();
    }
}
