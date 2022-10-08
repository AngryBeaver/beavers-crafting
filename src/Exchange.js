import {getCurrencies} from "./systems/dnd5e.js";

//no typescript so at least some safty
export const ABBREVIATION = "abbreviation";
export const CONVERSION = "conversion";

export class Exchange {

    static pay(priceCurrency, actorCurrencies) {
        let lowestActorCurrency = this.toLowestCurrency(actorCurrencies);
        const lowestPriceCurrency = this.toLowestCurrency(this.toCurrencies(priceCurrency));
        const result = new Currency();
        result.name=lowestActorCurrency.name;
        result.value=lowestActorCurrency.value - lowestPriceCurrency.value;
        if (result.value < 0) {
            throw "You can not afford this"
        }
        const exchangeCurrencies = this.toCurrencies(result);
        return this.toHighestCurrencies(exchangeCurrencies);
    }

    static toCurrencies(currency) {
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

    static toLowestCurrency(currencies) {
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
        const result = new Currency();
        result.name = highestCurrency[ABBREVIATION];
        result.value = transform;
        return result;
    }

    static toHighestCurrencies(currencies) {
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

export class Currency {
    name;
    value= 5;
}