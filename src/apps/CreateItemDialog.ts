declare var beaversSystemInterface: any;
declare var Item: any;
declare var foundry: any;

import {Settings} from "../Settings.js";

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
                <option value="recipe">${(game as Game).i18n.localize(
                  "beaversCrafting.create-item-dialog.recipe",
                )}</option>
                <option value="anyOf">${(game as Game).i18n.localize(
                  "beaversCrafting.create-item-dialog.anyOf",
                )}</option>
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
              img:
                subType === "recipe"
                  ? "icons/sundries/scrolls/scroll-worn-tan.webp"
                  : "modules/beavers-crafting/icons/anyOf.png",
              flags: {
                [Settings.NAMESPACE]: {
                  subtype: subType === "recipe" ? Settings.RECIPE_SUBTYPE : Settings.ANYOF_SUBTYPE,
                },
              },
            };
            // @ts-ignore
            return Item.create(itemData);
          },
        },
      ],
      rejectClose: false,
    });
}
