import {Settings} from "../Settings.js";
import {getDataFrom} from "../helpers/Utility.js";

const components:ComponentData[] = [];

export class ModuleConfig extends FormApplication {

    tools:ComponentData[]

    static get defaultOptions(): any {
        // @ts-ignore
        const title = game.i18n.localize("beaversCrafting.module-config.title");
        return mergeObject(super.defaultOptions, {
            title: title,
            template: "modules/beavers-crafting/templates/module-config.hbs",
            id: "beavers-crafting-module-config",
            width: 600,
            height: 400,
            closeOnSubmit: true,
            submitOnClose: true,
            resizable:true,
            classes:  [ "beavers-crafting"]
        })
    }

    async getData(options: any): Promise<any> {
        return {
            title: Settings.get(Settings.CREATE_ITEM_TITLE),
            captureTitle: Settings.get(Settings.CAPTURE_CREATE_ITEM_TITLE)
        }
    }

    async _updateObject(event, formData) {
        Settings.set(Settings.CREATE_ITEM_TITLE,formData.title);
        Settings.set(Settings.CAPTURE_CREATE_ITEM_TITLE,formData.captureTitle);
        this.render();
    }

}
