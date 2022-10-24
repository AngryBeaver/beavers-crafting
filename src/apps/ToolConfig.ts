import {DefaultComponent} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {getDataFrom, getItem} from "../helpers/Utility.js";

const components:Component[] = [];

export class ToolConfig extends FormApplication {

    tools:Component[]

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



export async function getToolConfig(): Promise<Component[]>{
    if(components.length === 0) {
        await _setToolConfig();
    }
    return components;
}

async function _setToolConfig(){
    components.length = 0;
    const tools = Settings.get(Settings.TOOL_CONFIG) || [];
    for (const uuid of tools) {
        await _addToolConfig(uuid);
    }
}
async function _addToolConfig(uuid){
    const item = await getItem(uuid);
    const component = new DefaultComponent(item, uuid, "Tool");
    components.push(component);
}
