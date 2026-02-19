import { rerenderItemDirectory, Settings } from "./Settings.js";
import { findSourceChildrenComponents } from "./ContainerHandler.js";

export class Container {
  item;

  constructor(item) {
    this.item = item;
  }

  static isContainer(item) {
    const subtype = foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.subtype`);
    return subtype === "container";
  }

  get mode() {
    return foundry.utils.getProperty(this.item, `flags.${Settings.NAMESPACE}.container.mode`) || "recipes";
  }

  set mode(value) {
    this.item.update({ [`flags.${Settings.NAMESPACE}.container.mode`]: value });
  }

  async getContents() {
     return findSourceChildrenComponents(this.item);
  }

  async addContent(componentData) {
    const component = beaversSystemInterface.componentCreate(componentData);
    const content = await beaversSystemInterface.uuidToDocument(component.uuid);
    if (content.actor === this.item.actor) {
      await content.update({ [`flags.${Settings.NAMESPACE}.containerId`]: this.item.id });
    } else if (this.item.actor && !content.actor) {
      const itemData = content.toObject();
      foundry.utils.setProperty(itemData, `flags.${Settings.NAMESPACE}.containerId`, this.item.id);
      beaversSystemInterface.objectAttributeSet(itemData, beaversSystemInterface.itemQuantityAttribute, component.quantity);
      await this.item.actor.createEmbeddedDocuments("Item", [itemData]);
    } else if (!this.item.actor && content.actor) {
      console.warn("Beavers Crafting | Cannot add an actor item to a world container.");
    }
    if (!this.item.actor) {
      rerenderItemDirectory();
    }
  }

  async removeContent(componentData) {
    const itemCollection = this.item.actor ? this.item.actor.items : (game as any).items;
    const item = itemCollection.find(i => i.id === componentData.id && foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`) === this.item.id);
    if (item) {
      await item.update({ [`flags.${Settings.NAMESPACE}.-=containerId`]: null });
    }
    if (!this.item.actor) {
      rerenderItemDirectory();
    }
  }

  static async preDeleteItem(item, options, userId) {
    if (userId !== (game as Game)?.user?.id) return true;
    if (!Container.isContainer(item)) return true;

    const contents = await findSourceChildrenComponents(item);
    if (contents.length === 0) return true;

    let action = Settings.get(Settings.CONTAINER_CONTENT_HANDLING);

    if (action === "ask") {
      // @ts-ignore
      action = await foundry.applications.api.DialogV2.wait({
        window: { title: (game as Game).i18n.localize("beaversCrafting.container.deleteDialog.title") },
        content: (game as Game).i18n.format("beaversCrafting.container.deleteDialog.content", { name: item.name }),
        buttons: [
          {
            action: "move",
            icon: "fas fa-suitcase",
            label: (game as Game).i18n.localize("beaversCrafting.container.deleteDialog.move"),
            default: true,
          },
          {
            action: "remove",
            icon: "fas fa-trash",
            label: (game as Game).i18n.localize("beaversCrafting.container.deleteDialog.remove"),
          },
        ],
        rejectClose: false,
      });
    }

    if (action === "move" || (Settings.get(Settings.CONTAINER_CONTENT_HANDLING) === "ask" && (action === null || action === undefined))) {
      const itemCollection = item.actor ? item.actor.items : (game as any).items;
      const updates = [];
      for (const componentData of contents) {
        const contentItem = itemCollection.get(componentData.id);
        if (contentItem) {
          // @ts-ignore
          updates.push({ _id: contentItem.id, [`flags.${Settings.NAMESPACE}.-=containerId`]: null });
        }
      }
      if (updates.length > 0) {
        if (item.actor) {
          await item.actor.updateEmbeddedDocuments("Item", updates);
        } else {
          await Item.updateDocuments(updates);
        }
      }
    } else if (action === "remove") {
      const itemCollection = item.actor ? item.actor.items : (game as any).items;
      const idsToRemove = contents.map(c => c.id).filter(id => itemCollection.has(id));
      if (idsToRemove.length > 0) {
        if (item.actor) {
          await item.actor.deleteEmbeddedDocuments("Item", idsToRemove);
        } else {
          await Item.deleteDocuments(idsToRemove);
        }
      }
    }
    return true;
  }
}
