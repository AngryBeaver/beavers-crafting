export abstract class System {
    abstract getSkills: () => any;
    abstract getAbilities: () => any;
    /**
     * whatever your system currency is, you need to cast it down to SystemCurrencies interface
     * You should order the Object properties from highest to lowest.
     */
    abstract getSystemCurrencies: ()=>SystemCurrencies;
    /**
     * This is used to add a tab with and id and a tabHeader name to a system actor sheet.
     * Html is the actorSheetHtml that is about to get extended and tabBody is the tabBody that will be underneath the tab.
     */
    abstract actorSheet_addTab: (id: string, tabHeader: string, tabBody: JQuery, html) => void;
    /**
     * whatever your actor currency is, you need to cast it down to Currencies interface
     */
    abstract actorCurrencies_get:(actor: Actor) => Currencies;
    /**
     * here you need to implement how your system will pay currencies.
     * e.g. for some it is updating an actor property for others it is adding and removing items.
     */
    abstract actorCurrencies_pay: (actor: Actor, currencies: Currencies) => Promise<void>;

    actorCurrencies_canPay(actor: Actor, currencies: Currencies): boolean {
        return this._actorCurrencies_subtractToLowestCurrency(actor,currencies) < 0;
    }

    _actorCurrencies_subtractToLowestCurrency(actor: Actor, currencies: Currencies){
        const systemCurrencies = this.getSystemCurrencies();
        const actorCurrencies = this.actorCurrencies_get(actor);
        let actorValue = 0;
        let payValue = 0;
        for (const id of Object.keys(systemCurrencies)) {
            actorValue = actorValue + ( (actorCurrencies[id]|0) * systemCurrencies[id].factor);
            payValue = payValue + ( (currencies[id]|0) * systemCurrencies[id].factor);
        }
        return actorValue - payValue;
    }
    _actorCurrencies_lowestCurrencyToCurrencies(value:number):Currencies {
        const systemCurrencies = this.getSystemCurrencies();
        const result = {};
        for (const id of Object.keys(systemCurrencies)) {
            result[id] = Math.floor(value/systemCurrencies[id].factor);
            value = value - (result[id]*systemCurrencies[id].factor);
        }
        return result;
    }

}
