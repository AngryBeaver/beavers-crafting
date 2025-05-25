import { AnyOf } from "../AnyOf.js";
import { getDataFrom } from "../helpers/Utility.js";


const anyOfSheets: { [key: string]: AnyOfSheet } = {};

export class AnyOfSheet {
    app;
    item;
    anyOf: AnyOf;
    anyOfElement?;
    checkItem?;
    timeout?;


    static bind(app, html, version) {
        if (AnyOf.isAnyOf(app.item)) {
            app.anyOf = this;
            app.version = version;
            if (!anyOfSheets[app.id]) {
                anyOfSheets[app.id] = new AnyOfSheet(app);
            }
            anyOfSheets[app.id].init(html);
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
        this.anyOf = new AnyOf(this.item);
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".beavers-crafting.any-of");
        if(exists.length != 0){
            if(this.app.version === 1){
                return; //do not repaint
            }else{
                exists.remove(); // repaint everything
            }
        }
        this.anyOfElement = $('<div class="beavers-crafting any-of" style="height:100%;width:100%;padding:15px;"></div>');
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
        this.anyOfElement.find('textarea').on("change", (e) => {
            this.anyOf.macro = e.target.value;
            this.anyOf.update();
        });

    }

    addDragDrop() {
        if (this.editable) {
            if (this.app._dragDrop) {
                this.app._dragDrop = this.app._dragDrop.filter(d => d.name !== "anyOfSheet");
            }
            const dragDrop = new DragDrop({
                dropSelector: '',
                permissions: {
                    dragstart: ()=>true,
                    drop: ()=>true
                },
                callbacks: {
                    dragstart: this.app._onDragStart.bind(this.app),
                    dragover: this.app._onDragOver.bind(this.app),
                    drop: this._onDrop.bind(this)
                }
            });
            dragDrop["name"]="anyOfSheet";
            this.app._dragDrop?.push(dragDrop);
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