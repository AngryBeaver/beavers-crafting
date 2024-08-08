import {Settings} from "../Settings.js";
import {getDataFrom} from "../helpers/Utility.js";

const components:ComponentData[] = [];

export class ToolConfig extends FormApplication {

    tools:ComponentData[]

    static get defaultOptions(): any {
        // @ts-ignore
        const title = game.i18n.localize("beaversCrafting.tool-config.title");
        return mergeObject(super.defaultOptions, {
            title: title,
            template: "modules/beavers-crafting/templates/tool-config.hbs",
            id: "beavers-crafting-tool-config",
            width: 300,
            height: 600,
            closeOnSubmit: true,
            resizable:true,
            classes:  ["dnd5e", "beavers-crafting","tool-config"]
        })
    }

    async getData(options: any): Promise<any> {
        this.tools = await getToolConfig();
        return {
            tools: this.tools
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-delete').on("click",e=>{
            const index = e.target.dataset.id;
            this.tools.splice(index,1);
            this._updateTool();
        });

        const dropFilter = new DragDrop({
            dropSelector: '.drop-area',
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this)
            }
        });
        this._dragDrop.push(dropFilter);
        dropFilter.bind(html[0]);
    }

    async _onDrop(e){
        const isFilterDrop = $(e.target).hasClass("drop-area");
        if(isFilterDrop){
            return this._onDropFilter(e);
        }
    }

    async _onDropFilter(e:DragEvent){
        const data = getDataFrom(e)
        if(data){
            if(data.type !== "Item") return;
            await _addToolConfig(data.uuid);
            await this._updateTool();
        }
    }

    async _updateObject(event, formData) {
        await this._updateTool();
    }

    async _updateTool(){
        Settings.set(Settings.TOOL_CONFIG, this.tools.map(c => c.uuid));
        this.render();
    }
}

export async function getToolConfig(): Promise<ComponentData[]>{
    if(components.length === 0) {
        await _setToolConfig();
    }
    return components;
}

async function _setToolConfig(){
    components.length = 0;
    const tools = Settings.get(Settings.TOOL_CONFIG) || [];
    const resultTools : string[] = [];
    for (const uuid of tools) {
        try {
            await _addToolConfig(uuid);
            resultTools.push(uuid);
        } catch( e ){
            console.warn("Could not find tool uuid, automatically fixed by removing it");
        }
    }
    Settings.set(Settings.TOOL_CONFIG,resultTools);
}
async function _addToolConfig(uuid){
    const item = await beaversSystemInterface.uuidToDocument(uuid);
    const component = beaversSystemInterface.componentFromEntity(item);
    components.push(component);
}
