export abstract class System {
    abstract getCurrencies: () => any;
    abstract getSkills: () => any;
    abstract getAbilities: () => any;
    //order does matter from highest to lowest !
    abstract getSystemCurrencies: ()=>SystemCurrencies;
    abstract actorSheet_addTab: (id: string, tabHeader: string, tabBody: JQuery, html) => void;
    abstract actorCurrencies_get:(actor: Actor) => Currencies;
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
