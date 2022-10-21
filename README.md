# Beaver's Crafting System
![Foundry Core Compatible Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dflat%26url%3Dhttps%3A%2F%2Fgithub.com%2FAngryBeaver%2Fbeavers-crafting%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![Foundry System](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fsystem%3FnameType%3Draw%26showVersion%3D1%26style%3Dflat%26url%3Dhttps%3A%2F%2Fraw.githubusercontent.com%2FAngryBeaver%2Fbeavers-crafting%2Fmain%2Fmodule.json)
![Download Count](https://img.shields.io/github/downloads/AngryBeaver/beavers-crafting/total?color=bright-green)

## Work in progress

! Carefully structure might change until i finalize this module with version 1.0.0 !,

! breaking change release: 0.2.x -> 0.3.x !
## Features
![img.gif](pictures/video.gif)
### Loot subtype Recipe
![img.png](pictures/newItem.png)

For this to work you must go to your settings and enter the name of the create Item Dialog.
Default is "Create New Item" obviously you need to adapt if you have a different language.

### Configure subtype Recipe
![img.png](pictures/configure.png)

#### cost: 
you may add costs to the crafting process
#### Ingredients:


You may add Items via drag and drop as Ingredients.
#### skill: 
you may add a skill that is required in the crafting process.
you can enable that costs and ingredients are also payed when the check failed.
#### results:
You may add Items or RollTable via drag and drop as result.
The result is the outcome of a successfull crafting process.
If you add a RollTable you will get quantity amount of rolls on that table not one roll quantity of times.

### Crafting
You can start a crafting process by clicking on a recipe in your inventar

#### Recipe Compendium
![img.png](pictures/img.png)
![img.png](pictures/crafting.png)
or throu recipe compendium
- list all recipes that you have permission to see for all items in your world (not compendium)
  - filter available: only those that you have at least one ingredient of any quantity of.
  - filter useable: only those that you have all ingredients in required quantity of.
  - filter by item: only those recipes that uses all items in the filter regardless of quantity.
- you can display details for a Recipe:
  - it will display you an uneditable recipe and shows you which ingredients are missing.
- you can hit the craft button to start a craft process.
  - a craft process will ask for the given skill if any and returns with a result
### Result
![img.png](pictures/result.png)

You will see a chat message with your result

### Compendiums
This module comes with some example compendiums.
#### Ingredients
![img.png](pictures/ingredients.png)

You do not need to import those just drag and drop them into your recipes or use the recipe compendium.
#### Potions
![img.png](pictures/potions.png)

You do not need to import those just drag and drop them into your recipes or use the recipe compendium.
#### RandomTable
![img.png](pictures/table.png)

You do not need to import those just drag and drop them into your recipes or use the recipe compendium.
#### Recipes
![img.png](pictures/recipes.png)

You need to import them and then grant permission to the users you want to have access to it.
The recipecompendium will only show the recipes the user has access to.


## latest features:
### 0.4.x feature compendiums,
you now can use items directly from compendium,
module comes with 4 compendiums ingredients,rolltables,potions and recipes
### 0.3.x feature add initial anyOf ingredient
you now can have anyOf ingredients
breaking change 0.2.x -> 0.3.x
### 0.2.x feature add rollTable result
you now can produce a random Potion.
breaking change 0.1.x -> 0.2.x


## Upcoming Changes
### "any" of ingredient (initial 0.3.x)
I want to create recipes with "any" xxx e.g. (weapon,mushroom,etc) therefor i may need some new fields in recipe or a new subtype ingredient
- 0.3.0
currently it will only take randomly from avaiable items on actor in required quantity.
the precast is wrong it always shows that AnyOf is not available.

### results should include rollTables (done 0.2.x)
I want to create a random potion.
### macro
I want to be able to add macros to recipes.
giving them more flexibility e.g. get damage on certain recipes where you failed your check.
### ingredients/potions/recipes package (done 0.4.x)
The identity of ingredients works best when the item originates from compendium
- I want a compendium package with lots of garbage items (mushrooms etc. that you can drop as loot)
- I want a compendium package with various potions (dnd5e is so borring here)
- I want a compendium package with recipes using the above two as a starter package for other creators.
### hooks for the crafting process
Once the process is stabilized
- I want to create hooks to make live easier for other 
developer that invent recipe packages that needed a little special extra 
- or developers that might extend specials to this module


## Notes
### Currency reorder
When adding costs to your recipe your currency will get exchanged to highest values.
### Items reorder
Actor Items will get merged to stacks in the crafting process. 
(only those that match ingredients or results)


## Credits
Copy organizational structur from midi-qol (gulpfile,package.json,tsconcig.json)