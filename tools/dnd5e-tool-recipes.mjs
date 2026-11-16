#!/usr/bin/env node
// Generates the "D&D 2024 Tool Recipes" sources (packs-src/dnd5e-tool-recipes) from the free dnd5e equipment.
// One recipe per tool: the tool is required, every item listed under "Craft" is a "one of" result.
// The recipe macro sets the cost to half the price of the chosen item and uses the Player's Handbook items when
// that module is active (they have the same ids as dnd5e.equipment24).
//
// Usage: node tools/dnd5e-tool-recipes.mjs [path to Foundry's Data folder]
//        default: the Data folder above package.json "devDir"

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const DATA = process.argv[2] || path.join(PACKAGE.devDir, "..");
const OUT = path.join(ROOT, "packs-src", "dnd5e-tool-recipes");

const E24 = "Compendium.dnd5e.equipment24.Item.";
const FOLDER = "Tools";

/** reads a LevelDB pack from a copy: Foundry keeps the original locked while it runs */
async function readPack(packPath) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "bc-pack-"));
  fs.cpSync(packPath, copy, { recursive: true });
  fs.rmSync(path.join(copy, "LOCK"), { force: true });
  const items = {};
  // collects the documents only, nothing is written
  await extractPack(copy, copy, {
    transformEntry: doc => {
      if (doc._key?.startsWith("!items!")) items[doc._id] = doc;
      return false;
    },
  });
  fs.rmSync(copy, { recursive: true, force: true });
  return items;
}

const packs = {
  equipment24: await readPack(path.join(DATA, "systems", "dnd5e", "packs", "equipment24")),
  items: await readPack(path.join(DATA, "systems", "dnd5e", "packs", "items")),
};
const mundane = Object.values(packs.equipment24).filter(i => !i.system.rarity && i.system.price?.value > 0);
const byName = name => {
  const item = mundane.find(i => i.name === name);
  if (!item) throw new Error("missing item " + name);
  return item;
};

/** the "Craft" entries a tool lists that are not links */
const GROUPS = {
  "Any Melee weapon (except Club, Greatclub, Quarterstaff, and Whip)": () => mundane.filter(i =>
    i.type === "weapon" && ["simpleM", "martialM"].includes(i.system.type.value) &&
    !["club", "greatclub", "quarterstaff", "whip"].includes(i.system.type.baseItem)),
  "Medium armor (except Hide)": () => mundane.filter(i =>
    i.type === "equipment" && i.system.type.value === "medium" && i.name !== "Hide Armor"),
  "Heavy armor": () => mundane.filter(i => i.type === "equipment" && i.system.type.value === "heavy"),
  "Ranged weapons (except Pistol, Musket, and Sling)": () => mundane.filter(i =>
    i.type === "weapon" && ["simpleR", "martialR"].includes(i.system.type.value) &&
    !["pistol", "musket", "sling"].includes(i.system.type.baseItem)),
  "Arcane Focus": () => ["Crystal", "Orb", "Rod", "Staff", "Wand"].map(byName),
  "Druidic Focus": () => ["Sprig of mistletoe", "Wooden staff", "Yew wand"].map(byName),
  "Holy Symbol": () => ["Amulet", "Emblem", "Reliquary"].map(byName),
};
/** not craftable by a recipe alone: needs a spell, see the instruction */
const SKIPPED = ["Spell Scroll"];

function craftList(tool) {
  const html = tool.system.description.value;
  const match = html.match(/Craft[^<]*<\/[^>]+>([\s\S]*?)<\/p>/i);
  if (!match) return [];
  const items = [];
  for (const [, pack, id] of match[1].matchAll(/@UUID\[Compendium\.dnd5e\.(equipment24|items)\.Item\.(\w+)\]\{[^}]+\}/g)) {
    const item = packs[pack][id];
    if (!item) throw new Error(`${tool.name}: missing ${pack}.${id}`);
    items.push({ item, pack });
  }
  // what is left are plain entries; split on commas outside of parentheses
  const plain = match[1].replace(/@UUID\[[^\]]+\]\{[^}]+\}/g, "").replace(/<[^>]+>/g, "")
    .split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
  for (const entry of plain) {
    if (SKIPPED.includes(entry)) continue;
    const group = GROUPS[entry];
    if (!group) throw new Error(`${tool.name}: unknown craft entry "${entry}"`);
    for (const item of group()) items.push({ item, pack: "equipment24" });
  }
  return items;
}

function component(item, pack, quantity) {
  const uuid = `Compendium.dnd5e.${pack}.Item.${item._id}`;
  return {
    key: uuid.replace(/\./g, "-"),
    data: { id: item._id, uuid, img: item.img, name: item.name, type: "Item", quantity, itemType: item.type },
  };
}

/** ammunition is sold (and priced) as a bundle, everything else as one piece */
const resultQuantity = item => item.system.type?.value === "ammo" ? (item.system.quantity || 1) : 1;

function macro(tool) {
  const key = tool.system.type.baseItem;
  return `// D&D 2024 crafting (Player's Handbook, SRD 5.2)
// - proficiency with the tool is needed
// - the raw materials cost half the price of the chosen item
// - one step per day of work: a day (8 hours) per 10 GP of the price
// - the items come from the Player's Handbook when it is active, otherwise from the free dnd5e equipment
{
  async resultChosen(component, preview) {
    if (game.modules.get("dnd-players-handbook")?.active) {
      component.uuid = component.uuid.replace("${E24}", "Compendium.dnd-players-handbook.equipment.Item.");
    }
    const tool = "${key}";
    const proficient = actor.system.tools?.[tool]?.value > 0
      || actor.items.some(i => i.type === "tool" && i.system.type?.baseItem === tool && i.system.prof?.multiplier > 0);
    if (!preview && !proficient) {
      ui.notifications.warn(\`\${actor.name} is not proficient with ${tool.name}\`);
      throw new Error(\`\${actor.name} is not proficient with ${tool.name}\`);
    }
    const item = await fromUuid(component.uuid);
    const price = item?.system.price;
    if (!price?.value) return;
    // in copper, halved and rounded up, then in the largest coin that fits exactly
    const perGold = CONFIG.DND5E.currencies[price.denomination]?.conversion || 1;
    const copper = Math.ceil(price.value * 100 / perGold / 2);
    const coin = copper % 100 === 0 ? "gp" : copper % 10 === 0 ? "sp" : "cp";
    recipeData.currency = {name: coin, value: copper / {gp: 100, sp: 10, cp: 1}[coin]};
    const step = recipeData.beaversTests?.ands?.[1];
    if (step) step.hits = Math.max(1, Math.ceil(copper * 2 / 1000));
  }
}`;
}

function instruction(tool, skipped) {
  const extra = skipped.length
    ? `<p>${skipped.join(", ")}: not part of this recipe, it follows its own rules in the Player's Handbook.</p>` : "";
  return `<p>Crafting with <strong>${tool.name}</strong> by the D&amp;D 2024 rules.</p>
<ul>
<li>You need proficiency with ${tool.name}.</li>
<li>Choose what to craft; the raw materials cost half of its price.</li>
<li>The work takes one day of 8 hours per 10 GP of the item's price (at least one day). Several proficient crafters share the days.</li>
</ul>${extra}`;
}

const id = base => ("bcr24" + base.replace(/[^a-zA-Z0-9]/g, "")).padEnd(16, "0").slice(0, 16);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let count = 0;
for (const tool of Object.values(packs.equipment24).filter(i => i.type === "tool").sort((a, b) => a.name.localeCompare(b.name))) {
  const crafts = craftList(tool);
  if (crafts.length === 0) continue;
  const skipped = SKIPPED.filter(s => tool.system.description.value.includes(s));
  const output = {};
  const seen = new Set();
  for (const { item, pack } of crafts.sort((a, b) => a.item.name.localeCompare(b.item.name))) {
    const c = component(item, pack, resultQuantity(item));
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    output[c.key] = c.data;
  }
  const required = component(tool, "equipment24", 1);
  const _id = id(tool.system.type.baseItem);
  const doc = {
    _id,
    _key: `!items!${_id}`,
    name: `${tool.name} Recipes`,
    type: "loot",
    img: tool.img,
    system: { description: { value: instruction(tool, skipped) } },
    flags: {
      "beavers-crafting": {
        subtype: "Recipe",
        recipe: {
          required: { 1: { [required.key]: required.data } },
          input: {},
          output: { 1: output },
          // the days of work, set by the macro for the chosen item
          beaversTests: {
            fails: 0,
            consume: true,
            ands: { 1: { hits: 1, ors: { 1: { type: "IncrementStep", data: { name: "Craft" } } } } },
          },
          macro: macro(tool),
          folder: FOLDER,
          instruction: instruction(tool, skipped),
        },
      },
    },
  };
  const file = tool.system.type.baseItem + ".json";
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(doc, null, 2) + "\n");
  console.log(`${doc.name}: ${Object.keys(output).length} results`);
  count++;
}
console.log(`${count} recipes -> ${OUT}`);
