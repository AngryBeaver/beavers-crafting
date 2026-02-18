import {Container} from "../Container.js";
import {getDataFrom} from "../helpers/Utility.js";
import {Settings} from "../Settings.js";

export class ContainerSheet {
    app;
    item;
    container;
    containerElement;

    static bind(app, html, data) {
        // Only bind our custom container sheet for beavers-crafting containers (not native dnd5e containers)
        const isBeaversContainer = foundry.utils.getProperty(app.item, `flags.${Settings.NAMESPACE}.subtype`) === 'container';
        if (isBeaversContainer) {
            new ContainerSheet(app, html);
        }
    }

    constructor(app, html) {
        this.app = app;
        this.item = app.item;
        this.container = new Container(this.item);
        this.init(html);
    }

    get editable() {
        return this.app.isEditable;
    }

    async init(html) {
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".beavers-crafting.container-sheet-wrapper");
        if (exists.length != 0) {
            exists.remove();
        }
        this.containerElement = $('<div class="beavers-crafting container-sheet-wrapper" style="height:100%;width:100%;padding:15px;"></div>');
        beaversSystemInterface.itemSheetReplaceContent(this.app, html, this.containerElement);
        await this.render();
    }

    async render() {
        const contents = await this.container.getContents();
        const template = await renderTemplate('modules/beavers-crafting/templates/container-sheet.hbs', {
            container: this.container,
            contents: contents,
            editable: this.editable
        });
        this.containerElement.html(template);
        this.handleEvents();
        this.addDragDrop();
    }

    handleEvents() {
        this.containerElement.find('select[name="flags.beavers-crafting.container.mode"]').on("change", async (e) => {
            const mode = e.target.value;
            const img = mode === 'recipes' ? 'icons/sundries/books/book-worn-brown.webp' : 'icons/containers/bags/sack-simple-leather-brown.webp';
            await this.item.update({
                [`flags.${Settings.NAMESPACE}.container.mode`]: mode,
                img: img
            });
            await this.render();
        });

        this.containerElement.find('.item-edit').on("click", async (e) => {
            const uuid = $(e.currentTarget).closest('.content-item').data("uuid");
            const item = await fromUuid(uuid);
            if (item) {
              // @ts-ignore
              item.sheet.render(true);
            }
        });

        this.containerElement.find('.item-delete').on("click", async (e) => {
            const uuid = $(e.currentTarget).closest('.content-item').data("uuid");
            const item = await fromUuid(uuid);
            if (item) {
                await item.delete();
                await this.render();
            }
        });

        this.containerElement.find('.item-remove').on("click", async (e) => {
            const id = $(e.currentTarget).closest('.content-item').data("id");
            await this.container.removeContent({id: id});
            await this.render();
        });

        this.containerElement.find('.quantity-plus').on("click", async (e) => {
            const uuid = $(e.currentTarget).closest('.content-item').data("uuid");
            const item = await fromUuid(uuid);
            if (item) {
                const quantityAttribute = beaversSystemInterface.itemQuantityAttribute;
                const quantity = beaversSystemInterface.objectAttributeGet(item, quantityAttribute, 0);
                const update = {};
                beaversSystemInterface.objectAttributeSet(update, quantityAttribute, quantity + 1);
                await item.update(update);
                await this.render();
            }
        });

        this.containerElement.find('.quantity-minus').on("click", async (e) => {
            const uuid = $(e.currentTarget).closest('.content-item').data("uuid");
            const item = await fromUuid(uuid);
            if (item) {
                const quantityAttribute = beaversSystemInterface.itemQuantityAttribute;
                const quantity = beaversSystemInterface.objectAttributeGet(item, quantityAttribute, 0);
                if (quantity > 1) {
                    const update = {};
                    beaversSystemInterface.objectAttributeSet(update, quantityAttribute, quantity - 1);
                    await item.update(update);
                    await this.render();
                }
            }
        });
    }

    addDragDrop() {
        if (this.editable) {
            const dragDrop = new DragDrop({
                dropSelector: '.drop-area',
                permissions: {
                    dragstart: () => true,
                    drop: () => true
                },
                callbacks: {
                    drop: (e) => this._onDrop(e)
                }
            });
            dragDrop.bind(this.containerElement[0]);
        }
    }

    async _onDrop(e) {
        const isDropArea = $(e.target).closest(".drop-area").length > 0;
        if (!isDropArea) return;
        const data = getDataFrom(e);
        if (data && data.type === "Item") {
            const item = await fromUuid(data.uuid);
            if (item) {
                if (item.id === this.item.id) {
                    ui.notifications?.warn("Beavers Crafting | Cannot add a container to itself.");
                    return;
                }
                const component = beaversSystemInterface.componentFromEntity(item);
                await this.container.addContent(component);
                await this.render();
            }
        }
    }
}
