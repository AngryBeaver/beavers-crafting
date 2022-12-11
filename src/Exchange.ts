import {getCurrencies} from "./systems/dnd5e.js";

export const ABBREVIATION = "abbreviation";
export const CONVERSION = "conversion";

export class Exchange {

    static pay(priceCurrency, actorCurrencies):Currencies5e {
        this.fixCurrencies(actorCurrencies);
        let lowestActorCurrency = this.toLowestCurrency(actorCurrencies);
        const lowestPriceCurrency = this.toLowestCurrency(this.toCurrencies(priceCurrency));
        const result = new DefaultCurrency();
        result.name=lowestActorCurrency.name;
        result.value=lowestActorCurrency.value - lowestPriceCurrency.value;
        if (result.value < 0) {
            throw "You can not afford this"
        }
        const exchangeCurrencies = this.toCurrencies(result);
        return this.toHighestCurrencies(exchangeCurrencies);
    }

    static fixCurrencies(currencies){
        getCurrencies().forEach(c => {
            if (Number.isNaN(currencies[ABBREVIATION])) {
                currencies[ABBREVIATION] = 0;
            }
        })
    }

    static toCurrencies(currency:Currency):Currencies5e {
        let currencies = {};
        getCurrencies().forEach(c => {
            if (currency.name === c[ABBREVIATION]) {
                currencies[c[ABBREVIATION]] = currency.value;
            } else {
                currencies[c[ABBREVIATION]] = 0;
            }
        })
        return currencies;
    }

    static toLowestCurrency(currencies):Currency {
        let highestCurrency = getCurrencies().find(c => !c[CONVERSION]);
        let transform = 0;
        while (true) {
            transform = transform + currencies[highestCurrency[ABBREVIATION]];
            let nextHighestCurrency = getCurrencies().find(c => c[CONVERSION]?.into === highestCurrency[ABBREVIATION]);
            if (!nextHighestCurrency) {
                break;
            }
            transform = transform * nextHighestCurrency[CONVERSION].each;
            highestCurrency = nextHighestCurrency;
        }
        const result = new DefaultCurrency();
        result.name = highestCurrency[ABBREVIATION];
        result.value = transform;
        return result;
    }

    static toHighestCurrencies(currencies):Currencies5e {
        let currency = this.toLowestCurrency(currencies);
        let lowestCurrency = getCurrencies().find(c => c[ABBREVIATION] === currency.name);
        const result = this.toCurrencies(currency);
        while (true) {
            if (!lowestCurrency[CONVERSION]?.each) {
                break;
            }
            let nextCurrency = getCurrencies().find(c => c[ABBREVIATION] === lowestCurrency[CONVERSION].into);
            const rest = (result[lowestCurrency[ABBREVIATION]] % lowestCurrency[CONVERSION].each);
            const next = Math.floor(result[lowestCurrency[ABBREVIATION]]/lowestCurrency[CONVERSION].each);
            result[lowestCurrency[ABBREVIATION]] = rest;
            result[nextCurrency[ABBREVIATION]] = next;
            lowestCurrency = nextCurrency;
        }
        return result;
    }
}
export class DefaultCurrency implements Currency {
    name;
    value= 5;
}