# Beaver's Crafting Module
![Foundry Core Compatible Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dflat%26url%3Dhttps%3A%2F%2Fgithub.com%2FAngryBeaver%2Fbeavers-crafting%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![Foundry System](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fsystem%3FnameType%3Draw%26showVersion%3D1%26style%3Dflat%26url%3Dhttps%3A%2F%2Fraw.githubusercontent.com%2FAngryBeaver%2Fbeavers-crafting%2Fmain%2Fmodule.json)
![Download Count](https://img.shields.io/github/downloads/AngryBeaver/beavers-crafting/total)

Recipes for everything your characters can work on over time:
- crafting, brewing, harvesting, mining, fabricating, gathering
- character advancement, tech trees, skill trees, ability trees
- downtime activities, faction or organisation reputation, quest logs, skill training

A recipe can
- require items, features, tools, classes or backgrounds
- consume ingredients and money
- ask for checks (skills, tools, abilities) or simply advance step by step
- grant specific or random items, containers or run macros on success

It works in possibly every system through the [Beaver's System Interface](https://github.com/AngryBeaver/beavers-system-interface) ([list of adaption layers](https://github.com/AngryBeaver/beavers-system-interface/wiki/BSA-x-links)).

**New to the module?** Start with the [ready-made recipes](#ready-made-recipes): with dnd5e you get a recipe for every tool of the D&D 2024 rules out of the box.

## Features
### Crafting
![potionCrafting.png](pictures/potionCrafting.png)

**Create a recipe**

https://github.com/user-attachments/assets/f5e02b8f-ef72-4c76-a622-9aabf0788f51

**Craft it**

https://github.com/user-attachments/assets/6da63c89-439c-4681-9d1c-798b2250eaf1

### Downtime activities
![downtime.png](pictures/downtime.png)
### Containers
![container.png](pictures/container.png)

- Recipes can produce containers, including their contents.
- dnd5e: the system's own container type is used.
- Other systems: Beaver's Crafting brings its own container item (experimental).
- Dropping a Beaver's Crafting container onto an actor copies its predefined contents to the actor and puts them into the new container.

## Contents
<!-- TOC -->
* [Ready-made recipes](#ready-made-recipes)
  * [Tool Recipes (dnd5e)](#tool-recipes-dnd5e)
  * [Ingredients (dnd5e)](#ingredients-dnd5e)
* [Create a recipe](#create-a-recipe)
* [The recipe sheet](#the-recipe-sheet)
  * [Instruction](#instruction)
  * [Required](#required)
  * [Cost](#cost)
  * [Results](#results)
  * [Checks](#checks)
  * [Macro](#macro)
* [Crafting](#crafting-1)
  * [Choose a recipe](#choose-a-recipe)
  * [Progress](#progress)
  * [Result](#result)
* [AnyOf](#anyof)
* [Hooks](#hooks)
* [Settings](#settings)
* [Good to know](#good-to-know)
* [Troubleshooting](#troubleshooting)
* [Credits](#credits)
<!-- TOC -->

## Ready-made recipes
The easiest way to get started is to import existing recipes.

### Tool Recipes (dnd5e)
This module includes the compendium **D&D 2024 Tool Recipes**: one recipe for every tool that can craft something by the D&D 2024 rules, e.g. "Smith's Tools Recipes".
1. Import the recipes into your world (they go into the folder "Tools").
2. Give the players permission to see them.

When crafting, the player chooses what to make from everything the tool can craft.
- Proficiency with the tool is needed.
- The raw materials cost half the price of the chosen item.
- The work is a "Day of work" step, advanced once per day of work: one day per 10 GP of the item's price (at least one).
- The items come from the Player's Handbook when that module is active, otherwise from the free dnd5e equipment (SRD 5.2).

### Artificer Recipes (dnd5e)
The compendium **D&D 2024 Artificer Recipes** has a recipe for the Artificer feature "Tinker's Magic".
- Requires Tinker's Tools and the feature "Tinker's Magic" on the actor (matched by its name).
- The results do not stack and are removed after the next long rest.
- Uses per long rest are not tracked.

The rules themselves are in the book; the recipe only names the feature and the items.

### Ingredients (dnd5e)
The compendium "ingredients" of this module has example ingredients you can use in your own recipes.

![img.png](pictures/ingredients.png)

## Create a recipe
![img.png](pictures/newItem.png)

Create a new item and choose "Recipe" (or "AnyOf") as its type.

If the type is missing, enable the [Create Beaver's Item Button](#create-beavers-item-button) or see [Troubleshooting](#troubleshooting).

Recipes are recognized by the module, whatever item type your system uses for them, and always open in the recipe sheet.
The button **System sheet** in its header opens your system's own item sheet, e.g. for price, weight or description.

## The recipe sheet
![configure.png](pictures/configure.png)

The header shows the image, the name and the folder of the recipe.
The folder groups the recipes in the crafting window and on the actor tab; click it to change it, e.g. `Smithing/Weapons`.

The sheet follows Foundry's light and dark mode. Every section can be folded; players without edit rights see a read-only version.

### Instruction
Flavour text or instructions for the players, e.g. how long the work takes.

![description.png](pictures/description.png)

### Required
Items that must be present but are not used up: tools, features, classes, backgrounds …

### Cost
Ingredients and money that are used up.

### Results
What the crafting gives on success: items, containers, roll tables or macros.
- A roll table with quantity 3 is rolled three times.
- A macro as result runs on success; it gets the same parameters as the recipe macro, see [Output macros](macros.md#output-macros).
- The hammer next to an item marks it as "crafted", see [isCrafted flag](#iscrafted-flag).

For Required, Cost and Results:
- Drag and drop items (from a compendium, see [Good to know](#good-to-know)) into the section.
- Every line is needed (and). Drop an item on the **or** zone below a line to add an alternative: the player then picks **one of** them.
- Click **| coin** at the end of a drop zone to add money; choose the currency in the line.

![img.png](pictures/simpleOr.png)

### Checks
Optional checks the crafting needs, as numbered steps that are done one after another.
- **+ Add step** adds a step; **+ alternative check** adds a check the player can choose instead.
- A step needs a number of successes before the next step starts.
- Check types: skill, ability, tool, or a fixed success without rolling (just progress over time). What is available depends on your system.
- **Fails allowed**: the crafting fails when this many checks fail; 0 means it can never fail.
- **Consume on fail**: whether the cost is lost when the crafting fails.

![img.png](pictures/skillchallenge.png)

This example means:
- 3 successes in Insight DC 8 or Forgery Kit DC 8,
- then 2 successes in History,
- before 3 fails overall.

### Macro
For advanced users: JavaScript that runs during the crafting, with `result`, `actor` and `recipeData` available.

Plain code runs when the crafting starts. Or write one object with a function per moment, every function is optional:
```js
{
  start() {},                           // the crafting starts
  inputChosen(component, preview) {},   // a cost is chosen, before anything is checked or paid
  resultChosen(component, preview) {},  // a result is chosen, before anything is checked or paid
  finish(success) {}                    // the crafting ends, before the results are given
}
```
`inputChosen` and `resultChosen` can change quantities and money; the crafting window shows these changes as a preview (`preview` is `true` there).
Throwing an error stops the crafting, it counts as failed.

The sheet has an example to insert; more in [Macros](macros.md).

Example: the cost is half the price of the chosen result (dnd5e)
```js
{
  async resultChosen(component, preview) {
    const item = await fromUuid(component.uuid);
    const price = item?.system.price;
    if (!price?.value) return;
    // half the price in copper, rounded up
    const perGold = CONFIG.DND5E.currencies[price.denomination]?.conversion || 1;
    recipeData.currency = {name: "cp", value: Math.ceil(price.value * 100 / perGold / 2)};
  }
}
```

## Crafting
Players find a new tab on their actor sheet.

![img.png](pictures/craftingTab.png)

### Choose a recipe
Click **Craft…** to open the crafting window.

![img.png](pictures/crafting.png)

- It lists every recipe in your world that you may see (not those in compendiums).
- Filters:
  - **available**: you have at least one of the ingredients
  - **usable**: you have all ingredients in the needed quantity
  - **own**: the recipe is in your inventory
  - **by item**: drop items to see only recipes using all of them
- The recipe shows what you have and what is missing.
- Where a recipe offers a choice ("one of", AnyOf), make it in the window; it can be undone.
- **Start** begins the crafting.

### Progress
The tab lists everything you are working on, grouped by folder; click a name for details.

If the recipe has checks, the needed resources are locked and you advance by clicking the progress:

![advance.png](pictures/advance.png)

At 100% you get the results. If the crafting fails, you get nothing.

### Result
A chat message shows the result.

![img.png](pictures/result.png)

Items created or updated by a successful crafting are flagged with `flags.beavers-crafting.isCrafted = true`.

## AnyOf
An AnyOf is an ingredient that stands for "any item that …", e.g. any weapon or any herb.
Its macro gets an `item` and returns `true` when the item matches.

```js
return item.name.startsWith("Test")   // any item whose name starts with "Test"
return item.type === "weapon"         // any weapon (if your system has this type)
```
The attributes of an item depend on your system. To look at them, use `console.log(item); return false` and open the console (F12).

Test your AnyOf by dropping an item on its drop area and clicking "test item".

**Without code:** with the module [Item Tags](https://foundryvtt.com/packages/item-tags) you can filter by tags:
`return ItemTags.Check(item, ['metal','sword'])` ([API](https://modules.zoty.dev/itemTags/apiReference.html)).

**When crafting**, choose which item is used for the AnyOf:
- click it to pick from your matching items,

  ![selection.png](pictures/selection.png)
- or drag an item from your inventory onto it.

  ![img.png](pictures/anyOfDrop1.png)
  ![img.png](pictures/anyOfDrop2.png)

An AnyOf that is not chosen yet asks before the crafting starts. Selecting the recipe again starts over.

## Hooks
### beavers-crafting.start
Fires for every crafting after all components are chosen and before anything is processed.
The recipe can be changed here to change the crafting.
```js
Hooks.on("beavers-crafting.start", (recipe) => {
  console.log(recipe);
});
```

## Settings
### Create Beaver's Item Button
Adds a button to the Item Directory to create Beaver's Crafting items (Recipe, AnyOf) directly (Foundry v12+).
Enable **Add Beaver's Item Button** in the module settings.

![createItemButton.png](pictures/createItemButton.png)

### isCrafted flag
Tells crafted items apart from bought or found ones, e.g. a recipe that only accepts crafted daggers. Disabled by default.
- **Full**: a crafted item never counts as a normal one; recipes need to say explicitly that they accept crafted items.
- **Partial**: recipes can require crafted items, and all other recipes accept crafted items as well. Non-crafted items are used first.

Crafted items are marked with an icon.

![img.png](pictures/craftedIcon.png)

### Draggable chat result
Results in the chat message can be dragged to another character.
- Only one item is copied each time.
- This creates items beyond what the recipe gave.
- Only items can be dragged.
- Copied items are not flagged as crafted.
### Currency exchange
Money is exchanged automatically (e.g. a gold coin is changed to pay 5 silver).
Turn it off to require the exact coins.

## Good to know
- **Recipes store references, not copies.** If you change an item later, the recipe uses the changed item.
- **Where you take the items from matters:**
  - Never take them from an actor.
  - Items of your world work, but only in that world.
  - Items from a compendium work in every world that has the same compendium, so recipes can be exported and imported.
- **Stacks:** items on the actor that match ingredients or results are merged into stacks while crafting.

## Troubleshooting

### "Recipe" is missing when creating an item
The module adds Recipe and AnyOf to the item creation window. It finds that window by its title, which is "Create New Item" in English.

![img.png](pictures/newItem.png)

**Solutions, from the easiest:**
1. Enable the [Create Beaver's Item Button](#create-beavers-item-button) (Foundry v12+), which does not need the window at all.
2. Enter the title of your item creation window (in your language) in the module settings.

   ![image](https://github.com/AngryBeaver/beavers-crafting/assets/10677192/2161e666-7e5f-4398-bb4c-aa7ecaf62de5)
3. If your system changes the title, enable capturing in the settings:

   ![img.png](pictures/capture-settings.png)

   A bullseye ![img.png](icons/bullseye.png) appears in window headers. Click it in the item creation window; the module remembers that window from then on.

**Why so complicated?** Foundry has no way for a module to add an item type to every system (not even the [module sub-types](https://foundryvtt.com/article/module-sub-types/) since v11), so the module adds the entries to the window when it opens.

## Credits
- Brazilian Portuguese translation by [Andersants](https://github.com/Andersants)
- French translation by [Michel](https://github.com/jehan-michel)
- Module icon "Anvil impact" by [Lorc](https://lorcblog.blogspot.com) from [game-icons.net](https://game-icons.net/1x1/lorc/anvil-impact.html), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)

## License
This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
