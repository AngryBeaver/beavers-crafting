declare var beaversSystemInterface: any;
declare var Item: any;
declare var foundry: any;

import {Settings} from "../Settings.js";

const images={
  recipe: "icons/sundries/scrolls/scroll-worn-tan.webp",
  anyOf: "modules/beavers-crafting/icons/anyOf.png",
  container: "icons/containers/bags/sack-simple-leather-brown.webp"
}
const types = {
  recipe: Settings.RECIPE_SUBTYPE,
  anyOf: Settings.ANYOF_SUBTYPE,
  container: "container"
}

export async function showCreateItemDialog() {
    const itemType = beaversSystemInterface.configLootItemType;
    const content = `
    <div class="form-group">
        <label>${(game as Game).i18n.localize("beaversCrafting.create-item-dialog.name")}</label>
        <div class="form-fields">
            <input type="text" name="name" placeholder="New Item Name" autofocus/>
        </div>
    </div>
    <div class="form-group">
        <label>${(game as Game).i18n.localize("beaversCrafting.create-item-dialog.type")}</label>
        <div class="form-fields">
            <select name="type">
                <option value="recipe">
                    ${(game as Game).i18n.localize("beaversCrafting.create-item-dialog.recipe")}
                </option>
                <option value="anyOf">
                    ${(game as Game).i18n.localize("beaversCrafting.create-item-dialog.anyOf")}
               </option>
                <option value="container">
                    ${(game as Game).i18n.localize("beaversCrafting.create-item-dialog.container")}
                </option>
            </select>
        </div>
    </div>`;

    // @ts-ignore
    return foundry.applications.api.DialogV2.wait({
      window: {
        title: (game as Game).i18n.localize("beaversCrafting.create-item-dialog.title"),
      },
      content: content,
      buttons: [
        {
          action: "create",
          icon: "fas fa-check",
          label: (game as Game).i18n.localize("beaversCrafting.create-item-dialog.create"),
          default: true,
          callback: async (event, button, dialog) => {
            const form = dialog.element.querySelector("form") || dialog.element;
            const name = form.querySelector('[name="name"]').value || "New Item";
            const subType = form.querySelector('[name="type"]').value;
            const itemData = {
              name: name,
              type: itemType,
              img: images[subType],
              flags: {
                [Settings.NAMESPACE]: {
                  subtype: subType
                },
              },
            };
            // @ts-ignore
            const created = await Item.create(itemData);
            // Open the sheet for the created item
            try { created?.sheet?.render(true); } catch (e) { console.warn("Beavers Crafting: Failed to open item sheet", e); }
            return created;
          },
        },
      ],
      rejectClose: false,
    });
}
