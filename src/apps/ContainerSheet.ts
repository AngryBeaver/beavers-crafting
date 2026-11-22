import {Container} from "../Container.js";
import {getDataFrom} from "../helpers/Utility.js";
import {Settings} from "../Settings.js";
import {createDragDrop, renderTemplate} from "../helpers/Compat.js";

/**
 * Content of the container sheet (ContainerItemSheet): mode, the contents and a drop area to add items.
 * The contents are other items, changing them does not touch the container: the sheet is re-rendered by hand.
 */
export class ContainerSheet {
    app;
    item;
    container: Container;

    constructor(app) {
        this.app = app;
        this.item = app.document;
        this.container = new Container(this.item);
    }

    get editable(): boolean {
        return !!this.app.isEditable;
    }

    async renderBody(): Promise<string> {
        return renderTemplate('modules/beavers-crafting/templates/container-sheet.hbs', {
            container: this.container,
            contents: await this.container.getContents(),
            editable: this.editable,
        });
    }

    attach(content: HTMLElement) {
        const html = $(content);
        const render = () => this.app.render();
        const contentItem = async (e) => fromUuid($(e.currentTarget).closest('.content-item').data("uuid")) as Promise<any>;

        html.find('select.container-mode').on("change", async (e) => {
            const mode = (e.target as HTMLSelectElement).value;
            const img = mode === 'recipes' ? 'icons/sundries/books/book-worn-brown.webp' : 'icons/containers/bags/sack-simple-leather-brown.webp';
            await this.item.update({[`flags.${Settings.NAMESPACE}.container.mode`]: mode, img});
        });

        html.find('.item-edit').on("click", async (e) => {
            (await contentItem(e))?.sheet.render(true);
        });

        html.find('.item-delete').on("click", async (e) => {
            const item = await contentItem(e);
            if (item) {
                await item.delete();
                render();
            }
        });

        html.find('.item-remove').on("click", async (e) => {
            const id = $(e.currentTarget).closest('.content-item').data("id");
            await this.container.removeContent({id});
            render();
        });

        const changeQuantity = async (e, delta: number) => {
            const item = await contentItem(e);
            if (!item) return;
            const attribute = beaversSystemInterface.itemQuantityAttribute;
            const quantity = beaversSystemInterface.objectAttributeGet(item, attribute, 0) + delta;
            if (quantity < 1) return;
            const update = {};
            beaversSystemInterface.objectAttributeSet(update, attribute, quantity);
            await item.update(update);
            render();
        };
        html.find('.quantity-plus').on("click", e => changeQuantity(e, 1));
        html.find('.quantity-minus').on("click", e => changeQuantity(e, -1));

        if (this.editable) {
            createDragDrop({
                dropSelector: '.drop-area',
                permissions: {drop: () => true},
                callbacks: {drop: this._onDrop.bind(this)},
            }).bind(content);
        }
    }

    async _onDrop(e) {
        const data = getDataFrom(e);
        if (data?.type !== "Item") return;
        const item: any = await fromUuid(data.uuid);
        if (!item) return;
        if (item.id === this.item.id) {
            ui.notifications?.warn("Beavers Crafting | Cannot add a container to itself.");
            return;
        }
        await this.container.addContent(beaversSystemInterface.componentFromEntity(item));
        this.app.render();
    }
}
