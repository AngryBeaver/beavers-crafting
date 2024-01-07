import {getDataFrom} from "../helpers/Utility.js";
import {AnyOf} from "../AnyOf.js";

const anyOfSheets: { [key: string]: AnyOfSheet } = {};

export class AnyOfSheet {
    app;
    item;
    editable: boolean;
    anyOf: AnyOf;
    anyOfElement?;
    checkItem?;


    static bind(app, html) {
        if (AnyOf.isAnyOf(app.item)) {
            if (!anyOfSheets[app.id]) {
                anyOfSheets[app.id] = new AnyOfSheet(app);
            }
            anyOfSheets[app.id].init(html);
        }
    }

    constructor(app) {
        this.app = app;
        this.item = app.item;
        this.editable = app.options.editable;
    }

    init(html) {
        this.anyOf = new AnyOf(this.item);
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".sheet-body .beavers-crafting");
        if (exists.length != 0) {
            return;
        }
        this.anyOfElement = $('<div class="beavers-crafting"></div>');
        beaversSystemInterface.itemSheetReplaceContent(this.app,html,this.anyOfElement);
        this.render().then(()=>this.addDragDrop());
    }

    async render() {
        let macroResult:MacroResult<boolean> = {value:true};
        if (this.checkItem) {
            macroResult = await this.anyOf.executeMacro(this.checkItem);
        }
        let template = await renderTemplate('modules/beavers-crafting/templates/anyof-sheet.hbs',
            {anyOf: this.anyOf, editable: this.editable, checkItem: this.checkItem, macroResult: macroResult});
        this.anyOfElement.find('.anyOf').remove();
        this.anyOfElement.append(template);
        this.handleEvents();
    }

    handleEvents() {
        this.anyOfElement.find('button').click(e => {
            return this.render();
        });
    }

    addDragDrop() {
        if (this.editable &&!this.app._dragDrop?.find(d=>d.name === "anyOfSheet")) {
            const dragDrop = new DragDrop({
                dropSelector: '',
                permissions: {
                    dragstart: this.app._canDragStart.bind(this.app),
                    drop: this.app._canDragDrop.bind(this.app)
                },
                callbacks: {
                    dragstart: this.app._onDragStart.bind(this.app),
                    dragover: this.app._onDragOver.bind(this.app),
                    drop: this._onDrop.bind(this)
                }
            });
            dragDrop["name"]="anyOfSheet";
            this.app._dragDrop.push(dragDrop);
            dragDrop.bind(this.anyOfElement[0]);
        }
    }

    async _onDrop(e) {
        const isDropArea = $(e.target).hasClass("drop-area")
        if (!isDropArea) {
            return;
        }
        const data = getDataFrom(e);
        if (data && (data.type === "Item")) {
            this.checkItem = await fromUuid(data.uuid);
        }
        this.render();
    }

}