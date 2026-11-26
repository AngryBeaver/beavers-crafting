#!/usr/bin/env node
// Generates the "D&D 2024 Tool Recipes" (packs-src/dnd5e-tool-recipes) sources from the free dnd5e equipment.
// The Artificer recipes are in their own module: beavers-artificer-crafting.
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
  // some items are also in the contents of an equipment pack: take the one that is not
  const item = mundane.find(i => i.name === name && !i.system.container) || mundane.find(i => i.name === name);
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
/** not in the tool's recipe: it has its own recipe "Scribe Spell Scroll" */
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

function macro() {
  return `{
  async resultChosen(component, preview) {
    if (game.modules.get("dnd-players-handbook")?.active) {
      component.uuid = component.uuid.replace("${E24}", "Compendium.dnd-players-handbook.equipment.Item.");
    }
    const item = await fromUuid(component.uuid);
    const price = item?.system.price;
    if (!price?.value) return;
    // materials: half the price (40% with the Crafter discount), rounded down to the copper
    const perGold = CONFIG.DND5E.currencies[price.denomination]?.conversion || 1;
    const fullCopper = price.value * 100 / perGold;
    const crafterDiscount = game.settings.settings.has("beavers-crafting.dnd5eCrafterDiscount")
      && game.settings.get("beavers-crafting", "dnd5eCrafterDiscount")
      && actor.items.some(i => i.type === "feat" && (i.system.identifier === "crafter" || i.name === "Crafter"));
    const copper = Math.floor(fullCopper * (crafterDiscount ? 4 : 5) / 10);
    const coin = copper % 100 === 0 ? "gp" : copper % 10 === 0 ? "sp" : "cp";
    recipeData.currency = copper > 0 ? {name: coin, value: copper / {gp: 100, sp: 10, cp: 1}[coin]} : undefined;
    const step = recipeData.beaversTests?.ands?.[1];
    // days: one per 10 GP of the full price
    if (step) step.hits = Math.max(1, Math.ceil(fullCopper / 1000));
  }
}`;
}

function instruction(tool, skipped) {
  const extra = skipped.length
    ? `<p>${skipped.join(", ")}: see the recipe <strong>Scribe Spell Scroll</strong>.</p>` : "";
  return `<p>Crafting with <strong>${tool.name}</strong> by the D&amp;D 2024 rules.</p>
<ul>
<li>You need proficiency with ${tool.name}.</li>
<li>Choose what to craft; the raw materials cost half of its price.</li>
<li>Optional (setting "Crafter feat discount on tool recipes"): with the Crafter feat the raw materials cost 40% of its price.</li>
<li>The work takes one day of 8 hours per 10 GP of the item's price (at least one day). Several proficient crafters share the days.</li>
</ul>${extra}`;
}

const id = base => ("bcr24" + base.replace(/[^a-zA-Z0-9]/g, "")).padEnd(16, "0").slice(0, 16);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** a folder of the compendium, the recipes are sorted into it */
function compendiumFolder(name, sort) {
  const _id = id("folder" + name);
  const doc = { _id, _key: `!folders!${_id}`, name, type: "Item", folder: null, sorting: "a", sort, color: null, description: "", flags: {} };
  fs.writeFileSync(path.join(OUT, `folder-${name.replace(/[^a-zA-Z0-9]/g, "")}.json`), JSON.stringify(doc, null, 2) + "\n");
  return _id;
}
const TOOLS_FOLDER_ID = compendiumFolder(FOLDER, 100000);
const FAST_FOLDER_ID = compendiumFolder("Fast Crafting", 200000);
const REQUIREMENTS_FOLDER_ID = compendiumFolder("Requirements", 300000);

// Script items: requirements of the recipes, checked before anything is chosen
const SCRIPT_IMG = "icons/magic/symbols/cog-glowing-green.webp";
/** the actor's proficiency with one tool (dnd5e: actor.system.tools, 1 = proficient, 2 = expertise; 0.5 = half does not count) */
const proficientScript = (key, toolName) => `{
  check() {
    const tool = "${key}";
    return actor.system.tools?.[tool]?.value >= 1 || "not proficient with ${toolName}";
  }
}`;

/** writes a Script item into the pack, returns it as a "required" entry of a recipe */
function scriptItem(name, idBase, code, description, img = SCRIPT_IMG) {
  const _id = id(idBase);
  const doc = {
    _id,
    _key: `!items!${_id}`,
    name,
    type: "loot",
    folder: REQUIREMENTS_FOLDER_ID,
    img,
    system: { description: { value: description } },
    flags: { "beavers-crafting": { subtype: "Script", script: { macro: code } } },
  };
  fs.writeFileSync(path.join(OUT, `script-${idBase}.json`), JSON.stringify(doc, null, 2) + "\n");
  const uuid = `Compendium.beavers-crafting.dnd5e-tool-recipes.Item.${_id}`;
  return {
    key: uuid.replace(/\./g, "-"),
    data: { id: _id, uuid, img, name, type: "Script", quantity: 1, itemType: "loot" },
  };
}
/** the "Proficient with <tool>" Script of a tool, written once */
const proficientScripts = {};
function proficient(tool) {
  const key = tool.system.type.baseItem;
  proficientScripts[key] ??= scriptItem(`Proficient with ${tool.name}`, "prof" + key, proficientScript(key, tool.name),
    `<p>Requirement: the actor is proficient with ${tool.name}.</p>`, tool.img);
  return proficientScripts[key];
}
// the Crafter feat of the Player's Handbook as a required item: it matches the actor's feat by name
const CRAFTER_UUID = "Compendium.dnd-players-handbook.feats.Item.phbftCrafter0000";
const CRAFTER = {
  key: CRAFTER_UUID.replace(/\./g, "-"),
  data: {
    id: "phbftCrafter0000", uuid: CRAFTER_UUID, img: "icons/tools/hand/hammer-and-nail.webp",
    name: "Crafter", type: "Item", quantity: 1, itemType: "feat",
  },
};

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
    folder: TOOLS_FOLDER_ID,
    img: tool.img,
    system: { description: { value: instruction(tool, skipped) } },
    flags: {
      "beavers-crafting": {
        subtype: "Recipe",
        recipe: {
          required: { 1: { [required.key]: required.data }, 2: { [proficient(tool).key]: proficient(tool).data } },
          input: {},
          output: { 1: output },
          // the days of work, set by the macro for the chosen item
          beaversTests: {
            fails: 0,
            consume: true,
            ands: { 1: { hits: 1, ors: { 1: { type: "IncrementStep", data: { name: "Day of work" } } } } },
          },
          macro: macro(),
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

// Crafter feat, Fast Crafting: after a long rest one item of this table, it falls apart after the next long rest
const FAST_CRAFTING = {
  carpenter: ["Ladder", "Torch"],
  leatherworker: ["Case, Crossbow Bolt", "Case, Map or Scroll", "Pouch"],
  mason: ["Block and Tackle"],
  potter: ["Jug", "Lamp"],
  smith: ["Ball Bearings", "Bucket", "Caltrops", "Grappling Hook", "Pot, Iron"],
  tinker: ["Bell", "Shovel", "Tinderbox"],
  weaver: ["Basket", "Rope", "Net", "Tent"],
  woodcarver: ["Club", "Greatclub", "Quarterstaff"],
};
// always a separate item, removed by the module after the next long rest
const FAST_FLAGS = { "beavers-crafting": { noStack: true, fastCrafted: true } };

function fastMacro() {
  return `{
  resultChosen(component, preview) {
    if (game.modules.get("dnd-players-handbook")?.active) {
      component.uuid = component.uuid.replace("${E24}", "Compendium.dnd-players-handbook.equipment.Item.");
    }
  }
}`;
}

function fastInstruction(tool) {
  return `<p>Fast Crafting with <strong>${tool.name}</strong> (Crafter feat, D&amp;D 2024).</p>
<ul>
<li>You need the Crafter feat and proficiency with ${tool.name}.</li>
<li>When you finish a long rest, you can craft one item of this list, without cost.</li>
<li>The item lasts until you finish another long rest, then it falls apart and is removed.</li>
</ul>`;
}

for (const [key, names] of Object.entries(FAST_CRAFTING)) {
  const tool = Object.values(packs.equipment24).find(i => i.type === "tool" && i.system.type?.baseItem === key);
  if (!tool) throw new Error("missing tool " + key);
  const output = {};
  for (const name of names) {
    const item = byName(name);
    const c = component(item, "equipment24", resultQuantity(item));
    output[c.key] = { ...c.data, flags: FAST_FLAGS };
  }
  const required = component(tool, "equipment24", 1);
  const _id = id("fast" + key);
  const doc = {
    _id,
    _key: `!items!${_id}`,
    name: `${tool.name} Fast Crafting`,
    type: "loot",
    folder: FAST_FOLDER_ID,
    img: tool.img,
    system: { description: { value: fastInstruction(tool) } },
    flags: {
      "beavers-crafting": {
        subtype: "Recipe",
        recipe: {
          required: {
            1: { [required.key]: required.data },
            2: { [proficient(tool).key]: proficient(tool).data },
            3: { [CRAFTER.key]: CRAFTER.data },
          },
          input: {},
          output: { 1: output },
          macro: fastMacro(),
          folder: "Fast Crafting",
          instruction: fastInstruction(tool),
        },
      },
    },
  };
  fs.writeFileSync(path.join(OUT, `fast-${key}.json`), JSON.stringify(doc, null, 2) + "\n");
  console.log(`${doc.name}: ${names.length} results`);
  count++;
}
// Scribe Spell Scroll (Player's Handbook 2024, "Scribing Spell Scrolls"): proficiency in Arcana or with Calligrapher's
// Supplies, a spell you have prepared, cost and days by its level; no spell slot is used
const ANYOF_IMG = "icons/magic/symbols/runes-star-pentagon-orange.webp";
const SCROLL_IMG = "icons/sundries/scrolls/scroll-bound-blue-tan.webp";
/** level: [days, GP] */
const SCROLL_COSTS = { 0: [1, 15], 1: [1, 25], 2: [3, 100], 3: [5, 150], 4: [10, 1000], 5: [25, 1500], 6: [40, 10000], 7: [50, 12500], 8: [60, 15000], 9: [120, 50000] };

const scribeProficient = scriptItem("Proficient in Arcana or with Calligrapher's Supplies", "scribeprof", `{
  check() {
    return actor.system.skills?.arc?.value >= 1 || actor.system.tools?.calligrapher?.value >= 1
      || "not proficient in Arcana or with Calligrapher's Supplies";
  }
}`, "<p>Requirement: the actor is proficient in the Arcana skill or with Calligrapher's Supplies.</p>", "icons/magic/symbols/rune-sigil-black-pink.webp");

/** AnyOf: a spell of the actor it can cast now; dnd5e 5+: system.method/prepared, before: system.preparation */
const preparedSpellId = id("anyofprepspell");
const preparedSpellDoc = {
  _id: preparedSpellId,
  _key: `!items!${preparedSpellId}`,
  name: "Prepared spell",
  type: "loot",
  folder: REQUIREMENTS_FOLDER_ID,
  img: ANYOF_IMG,
  system: { description: { value: "<p>Any spell of the actor that it has prepared: cantrips, prepared spells and spells that are always available (innate, pact, always prepared).</p>" } },
  flags: {
    "beavers-crafting": {
      subtype: "AnyOf",
      anyOf: {
        macro: `if (item.type !== "spell") return false;
const s = item.system;
if (s.level === 0) return true;
// dnd5e before 5.0
if (s.preparation) return s.preparation.mode !== "prepared" || !!s.preparation.prepared;
// prepared (1) or always prepared (2); innate, pact and at will spells are not prepared, they are always there
return !s.canPrepare || s.prepared >= 1;`,
      },
    },
  },
};
fs.writeFileSync(path.join(OUT, "anyof-prepared-spell.json"), JSON.stringify(preparedSpellDoc, null, 2) + "\n");
const preparedSpellUuid = `Compendium.beavers-crafting.dnd5e-tool-recipes.Item.${preparedSpellId}`;
const preparedSpell = {
  key: preparedSpellUuid.replace(/\./g, "-"),
  data: { id: preparedSpellId, uuid: preparedSpellUuid, img: ANYOF_IMG, name: "Prepared spell", type: "AnyOf", quantity: 1, itemType: "loot" },
};

/** a money line of the cost (like "| coin" in the recipe sheet); its name tells the lines apart in the crafting window */
const GOLD_IMG = "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp";
const gold = (name, quantity) => ({ id: "gp", name, img: GOLD_IMG, type: "item", quantity, flags: { "beavers-crafting": { subtype: "money" } } });

function scrollMacro() {
  return `{
  // the chosen spell sets the cost and the days by its level (Player's Handbook 2024)
  async requiredChosen(component, preview) {
    if (component.itemType !== "spell") return;
    const spell = await fromUuid(component.uuid);
    if (!spell) return;
    const costs = ${JSON.stringify(SCROLL_COSTS)};
    const [days, gp] = costs[Math.min(9, Math.max(0, spell.system.level))];
    // two money lines: the scribing by the level, the Material components the spell consumes (dnd5e: cost in GP)
    const scribing = recipeData.input?.[1]?.gp;
    if (scribing) scribing.quantity = gp;
    const materialGp = consumedMaterialsGp(spell.system.materials);
    const line = recipeData.input?.[2]?.gp;
    if (materialGp > 0 && line) {
      // less than whole gold (Gentle Repose: 2 CP): pay it in copper
      if (!Number.isInteger(materialGp)) {
        line.id = "cp";
        line.name = (CONFIG.DND5E.currencies.cp?.label || "Copper") + " (material components)";
        line.quantity = Math.round(materialGp * 100);
      } else line.quantity = materialGp;
    } else delete recipeData.input?.[2];

    /** GP of the Material components the spell consumes: the price field, or "worth 300+ GP" in the text before "consumes" */
    function consumedMaterialsGp(materials) {
      if (!materials?.consumed) return 0;
      if (Number(materials.cost) > 0) return Number(materials.cost);
      const text = String(materials.value || "");
      const end = text.toLowerCase().lastIndexOf("consume");
      const part = end >= 0 ? text.slice(0, end) : text;
      const perGp = {pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01};
      let sum = 0;
      for (const [, amount, coin] of part.matchAll(/worth\\s+([\\d,.]+)\\+?\\s*(PP|GP|EP|SP|CP)/gi)) {
        sum += Number(amount.replace(/,/g, "")) * perGp[coin.toLowerCase()];
      }
      return Math.round(sum * 100) / 100;
    }
    const step = recipeData.beaversTests?.ands?.[1];
    if (step) step.hits = days;
  },
  // the scroll is made from the spell, with the scribe's spell save DC and attack bonus
  async finish(success) {
    if (!success) return;
    const component = Object.values(recipeData.required || {}).flatMap(group => Object.values(group))
      .find(c => c.itemType === "spell");
    const spell = component && await fromUuid(component.uuid);
    if (!spell) throw new Error("the spell for the scroll is no longer there");
    const scroll = await CONFIG.Item.documentClass.createScrollFromSpell(spell, {}, {dialog: false});
    if (!scroll) throw new Error("dnd5e could not create the scroll");
    const data = scroll.toObject();
    foundry.utils.setProperty(data, "flags.beavers-crafting.isCrafted", true);
    await actor.createEmbeddedDocuments("Item", [data]);
  }
}`;
}

function scrollInstruction() {
  return `<p>Scribing a <strong>Spell Scroll</strong> by the D&amp;D 2024 rules.</p>
<ul>
<li>You need proficiency in the Arcana skill or with Calligrapher's Supplies.</li>
<li>Choose a spell you have prepared (a cantrip or a spell that is always available counts as well). You must have it prepared on each day of the work.</li>
<li>No spell slot is used.</li>
<li>You must have the spell's Material components at hand. If the spell consumes Material components with a price, that price is a second cost: "Gold (material components)". Others are not part of this recipe.</li>
<li>Each day of work is 8 hours; the days needn't be consecutive.</li>
<li>Cost and days of work by the spell's level:</li>
</ul>
<table><tr><th>Level</th><th>Days</th><th>Cost</th></tr>
${Object.entries(SCROLL_COSTS).map(([level, [days, gp]]) => `<tr><td>${level === "0" ? "Cantrip" : level}</td><td>${days}</td><td>${gp.toLocaleString("en")} GP</td></tr>`).join("\n")}
</table>
<p>The scroll uses your spell save DC and spell attack bonus.</p>`;
}

{
  const _id = id("scribescroll");
  const doc = {
    _id,
    _key: `!items!${_id}`,
    name: "Scribe Spell Scroll",
    type: "loot",
    folder: TOOLS_FOLDER_ID,
    img: SCROLL_IMG,
    system: { description: { value: scrollInstruction() } },
    flags: {
      "beavers-crafting": {
        subtype: "Recipe",
        recipe: {
          required: {
            1: { [scribeProficient.key]: scribeProficient.data },
            2: { [preparedSpell.key]: preparedSpell.data },
          },
          // set by the macro for the chosen spell; the second line goes away when the spell consumes no priced components
          input: {
            1: { gp: gold("Gold (scribing)", 15) },
            2: { gp: gold("Gold (material components)", 0) },
          },
          output: {},
          // the days of work, set by the macro for the chosen spell
          beaversTests: {
            fails: 0,
            consume: true,
            ands: { 1: { hits: 1, ors: { 1: { type: "IncrementStep", data: { name: "Day of work" } } } } },
          },
          macro: scrollMacro(),
          folder: FOLDER,
          instruction: scrollInstruction(),
        },
      },
    },
  };
  fs.writeFileSync(path.join(OUT, "scribe-spell-scroll.json"), JSON.stringify(doc, null, 2) + "\n");
  console.log(`${doc.name}: spell levels 0-9`);
  count++;
}

console.log(`${count} recipes -> ${OUT}`);

