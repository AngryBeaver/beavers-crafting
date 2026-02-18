import { Container } from "./Container.js";
import { Settings } from "./Settings.js";

/**
 * Container handling utilities abstracted for both native dnd5e containers and
 * Beaver's Crafting container subtype.
 */

/**
 * Find children of a source container by scanning siblings next to the source
 * (either in its compendium pack or in world items), matching:
 * - `flags.beavers-crafting.containerId === source.id` (Beaver's Crafting)
 * Returns Components for convenience.
 */
export async function findSourceChildrenComponents(sourceEntity: any): Promise<Component[]> {
  if (!Container.isContainer(sourceEntity)) return [];

  const srcId = sourceEntity.id;
  const uuid: string = sourceEntity.uuid;
  let sourceChildren: any[] = [];

  // Case 1: Item is on an Actor (World or Compendium)
  // UUID for actor item is often "Actor.<id>.Item.<id>" or "Compendium.<pack>.Actor.<id>.Item.<id>"
  if (uuid?.includes(".Actor.") || uuid?.startsWith("Actor.")) {
    try {
      const actor = sourceEntity.actor || (await fromUuid(uuid.split(".Item.")[0]));
      if (actor && actor.items) {
        sourceChildren = actor.items.filter((i: any) => {
          if (i.id === srcId) return false;
          const beaversContainerId = foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`);
          return beaversContainerId === srcId;
        });
      }
    } catch (e) {
      console.warn("Beavers Crafting | container copy: actor scan failed", e);
    }
  }

  // Case 2: Item is in a Compendium (top-level)
  // UUID is "Compendium.<pack>.Item.<id>"
  if (sourceChildren.length === 0 && uuid?.startsWith("Compendium.")) {
    try {
      const parts = uuid.split(".");
      const packId = parts[1] + "." + parts[2];
      const pack = (game as Game).packs?.get(packId);
      if (pack) {
        const docs = await pack.getDocuments();
        sourceChildren = docs.filter((i: any) => {
          if (i.id === srcId) return false;
          const beaversContainerId = foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`);
          return beaversContainerId === srcId;
        });
      }
    } catch (e) {
      console.warn("Beavers Crafting | container copy: pack scan failed", e);
    }
  }

  // Case 3: Fallback: scan world items
  if (sourceChildren.length === 0 && (game as Game).items) {
    const worldItems = (game as Game)?.items?.contents || [];
    sourceChildren = worldItems.filter((i: any) => {
      if (i.id === srcId) return false;
      const beaversContainerId = foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`);
      return beaversContainerId === srcId;
    });
  }

  return sourceChildren.map((child) => beaversSystemInterface.componentFromEntity(child));
}

/**
 * Attach discovered source container contents to the created container,
 */
export async function attachContentsToCreatedContainer(createdContainerItem: Item, sourceComponent: Component): Promise<void> {
  const children = await findSourceChildrenComponents(await sourceComponent.getEntity());
  if (children.length === 0) return;
  const cont = new Container(createdContainerItem);
  for (const cc of children) {
    await cont.addContent(cc);
  }
}

/**
 * Unified read API to get the content pool an actor offers to crafting logic.
 * For now, this simply maps actor.items to components; hiding is a UI concern.
 */
export function getActorContentPool(actor: Actor, asComponents: boolean = true): Component[] | any[] {
  const filteredItems = actor.items
    .filter((i: any) => {
      const isBeaversContainer = foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.subtype`) === 'container';
      const isNativeDnd5eContainer = ((game as Game).system?.id === 'dnd5e') && i.type === 'container';
      // Filter OUT containers themselves, but KEEP their contents and regular items
      return !(isBeaversContainer || isNativeDnd5eContainer);
    });
  if (asComponents) {
    return filteredItems.map((i: any) => beaversSystemInterface.componentFromEntity(i));
  }
  return filteredItems;
}

/**
 * Utility helpers for beavers-crafting container subtype (non-dnd5e native case).
 */
export function isBeaversContainer(item: Item): boolean {
  return foundry.utils.getProperty(item, `flags.${Settings.NAMESPACE}.subtype`) === 'container';
}
