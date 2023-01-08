import {System} from "./System.js";

export class Dnd5e extends System {

    getCurrencies = () => Object.entries(game["dnd5e"].config.currencies).map(currency => currency[1]);


    getSkills = () => Object.entries(game["dnd5e"].config.skills).map(skills => {
        // @ts-ignore
        return {id: skills[0], ...skills[1]};
    });

    getAbilities = () => Object.entries(game["dnd5e"].config.abilities).map(ab => {
        return {id: "ability-" + ab[0], label: ab[1]};
    });

    getSystemCurrencies = (): SystemCurrencies => ({
        pp: {
            name: "pp",
            factor: 1000,
            label: game["dnd5e"].config.currencies.pp.label
        },
        gp: {
            name: "gp",
            factor: 100,
            label: game["dnd5e"].config.currencies.gp.label
        },
        ep: {
            name: "ep",
            factor: 50,
            label: game["dnd5e"].config.currencies.ep.label
        },
        sp: {
            name: "sp",
            factor: 10,
            label: game["dnd5e"].config.currencies.sp.label
        },
        cp: {
            name: "cp",
            factor: 1,
            label: game["dnd5e"].config.currencies.cp.label
        },
    });

    actorSheet_addTab = (id: string, tabHeader: string, tabBody: JQuery, html) => {
        const tabs = $(html).find('.tabs[data-group="primary"]');
        const tabItem = $('<a class="item" data-tab="' + id + '">' + tabHeader + '</a>');
        tabs.append(tabItem);
        const body = $(html).find(".sheet-body");
        const tabContent = $('<div class="tab ' + id + '" data-group="primary" data-tab="' + id + '"></div>');
        body.append(tabContent);
        tabContent.append(tabBody);
    };

    actorCurrencies_get = (actor: Actor): Currencies => actor["system"].currency;
    actorCurrencies_pay = async (actor: Actor, currencies: Currencies): Promise<void> => {
       const result = this._actorCurrencies_subtractToLowestCurrency(actor,currencies);
       if(result < 0){
          throw new Error("You can not afford this");
       }
       const resultCurrencies = this._actorCurrencies_lowestCurrencyToCurrencies(result);
       await actor.update({system:{currency:resultCurrencies}});
    };


}