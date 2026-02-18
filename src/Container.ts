import {Settings} from "./Settings.js";
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
  }

  async removeContent(componentData) {
    const itemCollection = this.item.actor ? this.item.actor.items : (game as any).items;
    const item = itemCollection.find(i => i.id === componentData.id && foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`) === this.item.id);
    if (item) {
      await item.update({ [`flags.${Settings.NAMESPACE}.-=containerId`]: null });
    }
  }
}
