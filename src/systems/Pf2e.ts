import {getItem} from "../helpers/Utility.js";

export class Pf2e {
    /*
 getSkills = () => Object.entries(CONFIG["PF2E"].skillList).map(skills => {
     return {
         id: skills[0],
         label: game["i18n"].localize(skills[1])
     };
 });

 getAbilities = () => Object.entries(CONFIG["PF2E"].abilities).map(ab => {
     return {
         id: "ability-" + ab[0],
         label: game["i18n"].localize(ab[1])
     };
 });

 getSystemCurrencies = (): SystemCurrencies => ({
     pp: {
         name: "pp",
         factor: 1000,
         label: game["i18n"].localize("PF2E.CurrencyPP"),
         data:{
             itemName: "Platinum Pieces",
             itemUuid: "Compendium.pf2e.equipment-srd.JuNPeK5Qm1w6wpb4"
         }
     },
     gp: {
         name: "gp",
         factor: 100,
         label: game["i18n"].localize("PF2E.CurrencyGP"),
         data:{
             itemName: "Gold Pieces",
             itemUuid: "Compendium.pf2e.equipment-srd.B6B7tBWJSqOBz5zz"
         }
     },
     sp: {
         name: "sp",
         factor: 10,
         label: game["i18n"].localize("PF2E.CurrencySP"),
         data:{
             itemName: "Silver Pieces",
             itemUuid: "Compendium.pf2e.equipment-srd.5Ew82vBF9YfaiY9f"
         }
     },
     cp: {
         name: "cp",
         factor: 1,
         label: game["i18n"].localize("PF2E.CurrencyCP"),
         data:{
             itemName: "Copper Pieces",
             itemUuid: "Compendium.pf2e.equipment-srd.lzJ8AVhRcbFul5fh"
         }
     },
 });

 actorSheet_addTab = (id: string, tabName: string, tabBody: JQuery, html) => {
     const tabs = $(html).find('nav[data-group="primary"]');

     const tabItem = $('<a class="item" data-tab="' + id + '" title="' + tabName + '"><i class="fas fa-scroll"/></a>');
     tabs.append(tabItem);
     const body = $(html).find(".sheet-content");
     const tabContent = $('<div class="tab ' + id + '" data-group="primary" data-tab="' + id + '"></div>');
     body.append(tabContent);
     tabContent.append(tabBody);
 };

 actorCurrencies_get = (actor): Currencies => {
     const result = {};
     actor.items.forEach(item => {
             if (item.type === "treasure") {
                 for (const [key, value] of Object.entries(this.getSystemCurrencies())){
                     if(item.name === value.data.itemName){
                         result[key]= item.system.quantity;
                     }
                 }
             }
         }
     );
     return result;
 }

 actorCurrencies_pay = async (actor, currencies: Currencies): Promise<void> => {
     const result = this._actorCurrencies_subtractToLowestCurrency(actor, currencies);
     if (result < 0) {
         throw new Error("You can not afford this");
     }
     const resultCurrencies = this._actorCurrencies_lowestCurrencyToCurrencies(result);
     actor = await fromUuid(actor.uuid);
     const deleteItems:string[] = []
     const createItems:any[] = [];
     actor.items.forEach(item => {
         if (item.type === "treasure") {
             for (const [key, value] of Object.entries(this.getSystemCurrencies())) {
                 if (item.name === value.data.itemName) {
                     deleteItems.push(item.id);
                 }
             }
         }
     });

     for(const [key, value] of Object.entries(resultCurrencies)){
         const item = await getItem(this.getSystemCurrencies()[key].data.itemUuid);
         const itemData = item.toObject();
         itemData.system.quantity = value;
         if(itemData.system.quantity > 0) {
             createItems.push(itemData);
         }

     }
     await actor.deleteEmbeddedDocuments("Item", deleteItems);
     await actor.createEmbeddedDocuments("Item", createItems);
 };


    actorRollSkill= async (actor, skill) => {
        return await actor.skills[skill].check.roll()
    }

    actorRollAbility= async (actor, ability) =>{
        throw new Error("ablityRoll not supported by System");
    }

*/
}