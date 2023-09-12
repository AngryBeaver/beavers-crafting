# Macros
When writing a macro your code has access to 3 properties.
- actor, 
- recipeData,
- result
### actor
the actual actor that is crafting your result, details what you can do with that you have to look up in the system documentation.
You can get a glimpse when logging this property
```
console.log(actor);
```
### recipeData (!! try not to use !!)
- recipe will be subject to changes (the module will evolve) -> depending too much on this property will lead to breaking changes.

A copy of recipeData from your actual recipe (readOnly changes will not have any effects)

see [RecipeData](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)
```
console.log(recipeData);
```
### result
The current crafting Result ! Interacting with it will change the craft result.
When interacting with this you should not access any "_" underscore prefixed methods or properties
Non underscored objects are considered stable and you will get a breaking change notification if the module will evolve in a way that requires changing them.

see [ResultApi](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)
````javascript
interface ResultApi {
    actorUpdate: {
        [key: string]: any
    },
    hasError: ()=>boolean,
    updateActorProperty:(key:string,value:any)=>void,
    addChatComponent: (componentChatData:ComponentChatData)=>void,
    updateComponent: (type: ComponentType, componentData: ComponentData, fn: (componentResult:ComponentResultData,quantity: number)=>void)=>void,
    deleteComponent: (type: ComponentType, componentData: ComponentData)=>void,
    payCurrency: (currency:Currency)=>void
}
````
#### hasError,
will calculate if the current crafting has any Errors;
#### updateActorProperty (!! carefull !!)
is used to update anything on the actorDocument! be carefull when using this you might break your actor data !!!

parameter:
- key: a dot seperated string of the property you want to change in the actorDocument. e.g. "system.currency"
- value: the value that will replace the existing value in the actorDocument.
#### addChatComponent,
Is only used for the Chat display. Will add additional componentChatResults to the chat.
E.g. this is usefully when updating ActorProperties as those are normally not visualized.

parameter:
- componentChatData [ComponentChatData](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)
```javascript
interface ComponentChatData {
  component: ComponentData,
  type: ComponentType,
  hasError: boolean
}
```
- 
  - component: [ComponentData](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts) used to display a Component
  - type: [ComponentType](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts) used to mark components by type e.g. consumed in this crafting.
  - hasError: is used to mark a component that has failed in this crafting
#### payCurrency
is used to pay the actor currency correctly e.g. exchanging money.
it will return true when actor is able to pay.
multiple calls will !not! stack the last call will win.

parameter:
- currency: [Currency](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)

````javascript
interface Currency {
  name: string; //Dnd5e "pp"|"gp"|"ep"|"sp"|"cp"
  value: number;
}
````

#### updateComponent
possibly adds a componentResult to the actor.
Depending on type the behaviour will change slightly.
examples: 
- Usually you will add an item in quantity amount when using "produced" 
- usually you will remove an item in quantity amount when using "consumed"
- advanced you can also undo consumed, required or produced components in quantity amount.
- advanced you can also overwrite component behaviour to also get consumed or produced when failed.

multiple calls to the same component will accumulate changes. 

parameter:
- type: [ComponentType](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts) is used to define default behaviour
- componentData: [ComponentData](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)
````
{
  //needed to hand this item to the actor when its an output item
  uuid: string,
  //for display and compareing to actor items
  name: string,
  //should be "Item" or "RollTable"
  "type": string,
  //for displaying an image
  img: string,
  //quantity of that component
  quantity: number,
  //used for compareing to actor items e.g. "weapon,loot,tool etc"
  "itemType": string
}
````
- fn: optional for advanced usage
  - componentResult: [ComponentResult](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts) the original reference you can manipulate
  - quantity: the type adjusted quantity e.g. for "consumed" components it is negative.

The default implementation of fn will add the adjusted quantity to the result. If you write your own method your can manipulate componentResult
````
{
  //a duplicate of the orginal component holding the accumulated adjusted quantity e.g. consumed are negative
  component: ComponentData,
  //the quantity of that component found on user before crafting
  originalQuantity: number,
  //defines how this component will interact with the actor "never", "onSuccess", "always". e.g. attendatns are "never"
  userInteraction: UserInteraction
}
````
the default ComponentResult hasError() implementation is as followed. You can use this to fake requirements see [Examples](#Examples)
````typescript
hasError():boolean {
  return ( this.originalQuantity + this.component.quantity ) < 0;
}
````


#### deleteComponent
Similar to update this will delete all appearance of that component in the crafting process.
- type: [ComponentType](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts) is used to identify component
- componentData: [ComponentData](https://github.com/AngryBeaver/beavers-crafting/blob/main/src/types.ts)

## Examples
### Selectively keep ingredients on failed crafting
with this code your crafting will not consume the first ingredient component when crafting fails. 
````javascript
const ingredient1 = Object.values(recipeData.input)[0];
result.updateComponent("consumed",ingredient1,
  (componentResult, quantity) => {
    componentResult.userInteraction = "onSuccess"
});
````
or the other way it will explicitly consume the first ingredient component also on failed crafting checks.
````javascript
const ingredient1 = Object.values(recipeData.input)[0];
result.updateComponent("consumed",ingredient1,
  (componentResult, quantity) => {
    componentResult.userInteraction = "always"
});
````
### Additional Recipe Requirements
with this code you can have additional requirements not covered by items, here we check for required level 8
````javascript
const requiredLevel = 8;
const actualLevel = actor.system?.details?.level | 1;
result.updateComponent("required",
        {
          id: "invalid",
          uuid: "invalid",
          type: "level",
          name: "Level "+requiredLevel,
          img: "icons/magic/life/crosses-trio-red.webp",
          quantity: requiredLevel
        },
        (componentResult,quantity) => {
          componentResult.originalQuantity = actualLevel
          componentResult.component.quantity = quantity;
        });
````
### Reward XP
with this code a recipe also grants xp on a successfull craft.
```javascript
if(!result.hasError()){
  const xp = 200;
  const nextXp = (actor.system?.details?.xp?.value|0)+xp;
  result.updateActorProperty("system.details.xp.value",nextXp );
  result.addChatComponent({
    component: {
      id: "invalid",
      uuid: "invalid",
      type: "XP",
      name: "XP",
      img: 'icons/commodities/gems/pearl-water.webp',
      quantity: xp
    },
    isAvailable: true,
    type: "produced"
  });
}
```
### Simple Spell consumption
with this code a recipe requires a spell present on actor and a given spellslot available.
it will then consume the spellslot.
this is simple spell consumption you can not upcast the spell, check for preparation or use it from a wand.

```javascript
const currentSpellSlot = actor.system?.spells?.spell1?.value | 0;
const nextSpellSlot = currentSpellSlot-1;
const fakeSpellComponent = {
  id: "invalid",
  uuid: "invalid",
  type: "Item",
  name: "Cure Wounds",
  img: "icons/magic/life/heart-cross-green.webp",
  quantity: 1,
  itemType: "spell"
};
const updateComponentResult = (componentResult,quantity) =>{
  if(nextSpellSlot < 0){
    componentResult.originalQuantity = 0
  }
  componentResult.component.quantity = quantity;
}
result.updateComponent("required",fakeSpellComponent,updateComponentResult);
if(!result.hasError()){
  result.updateActorProperty("system.spells.spell1.value",nextSpellSlot);
}
```
you can transform a real Item into a Component by using:
````javascript
const entity // real item e.g. fromUuid(uuid) 
const component = game["beavers-system-interface"].system.createComponent(entity);
````

