export class Pf2e implements SystemApi {
    parent: System

    get version() {
        return 1;
    }

    get id() {
        return "pf2e";
    }

    async actorRollSkill(actor, skillId) {
        return await actor.skills[skillId].check.roll()
    }

    async actorRollAbility(actor, abilityId) {
        throw Error("I don't know how to do this, plz fix bsa-pf2e")
    }

    actorGetCurrencies(actor) {
        const result = {};
        actor.items.forEach(item => {
                if (item.type === "treasure") {
                    beaversSystemInterface.configCurrencies.forEach(
                        currency =>{
                            if(item.name === currency.itemName){
                                result[currency.id]= item.system.quantity;
                            }
                        }
                    )
                }
            }
        );
        return result;
    }

    async actorAddCurrencies(actor, currencies: Currencies) {
        const actorCurrencies = beaversSystemInterface.actorGetCurrencies(actor);
        const actorValue = beaversSystemInterface.currencyToLowestValue(actorCurrencies);
        const addValue = beaversSystemInterface.currencyToLowestValue(currencies);
        const result = actorValue+addValue;
        if (result < 0) {
            throw new Error("negative money");
        }
        const resultCurrencies = beaversSystemInterface.currencyToCurrencies(result);
        actor = await fromUuid(actor.uuid);
        const deleteItems:string[] = []
        const createItems:any[] = [];
        //delete all previous currency items
        actor.items.forEach(item => {
            if (item.type === "treasure") {
                for (const [key, value] of Object.entries(this.configCurrencies)) {
                    if (item.name === value.itemName) {
                        deleteItems.push(item.id);
                    }
                }
            }
        });
        //add currency
        for(const [key, value] of Object.entries(resultCurrencies)){
            const configCurrency = this.configCurrencies.find(c=>c.id === key);
            if(configCurrency === undefined){
                throw new Error("currency" +key+ " not valid");
            }
            const item = await beaversSystemInterface.uuidToDocument(configCurrency.uuid);
            const itemData = item.toObject();
            itemData.system.quantity = value;
            if(itemData.system.quantity > 0) {
                createItems.push(itemData);
            }
        }
        await actor.deleteEmbeddedDocuments("Item", deleteItems);
        await actor.createEmbeddedDocuments("Item", createItems);
        return true;
    }

    actorSheetAddTab(sheet, html, actor, tabData, tabBody) {
        const tabs = $(html).find('nav[data-group="primary"]');
        const tabItem = $('<a class="item" data-tab="' + tabData.id + '" title="' + tabData.label + '">'+tabData.html+'</a>');
        tabs.append(tabItem);
        const body = $(html).find(".sheet-content");
        const tabContent = $('<div class="tab" data-group="primary" data-tab="' + tabData.id + '"></div>');
        body.append(tabContent);
        tabContent.append(tabBody);
    }

    get configSkills() {
        return Object.entries(CONFIG["PF2E"].skillList).map(skills => {
            return {
                id: skills[0],
                label: game["i18n"].localize(skills[1])
            };
        })
    }

    get configAbilities() {
        return Object.entries(CONFIG["PF2E"].abilities).map(ab => {
            return {
                id: ab[0],
                label: game["i18n"].localize(ab[1])
            };
        });
    }

    get configCurrencies() {
        return [
            {
                id: "pp",
                factor: 1000,
                label: game["i18n"].localize("PF2E.CurrencyPP"),
                uuid: "Compendium.pf2e.equipment-srd.JuNPeK5Qm1w6wpb4",
                itemName: "Platinum Pieces"
            },
            {
                id: "gp",
                factor: 100,
                label: game["i18n"].localize("PF2E.CurrencyGP"),
                uuid: "Compendium.pf2e.equipment-srd.B6B7tBWJSqOBz5zz",
                itemName: "Gold Pieces"
            },
            {
                id: "sp",
                factor: 10,
                label: game["i18n"].localize("PF2E.CurrencySP"),
                uuid: "Compendium.pf2e.equipment-srd.5Ew82vBF9YfaiY9f",
                itemName: "Silver Pieces"
            },
            {
                id: "cp",
                factor: 1,
                label: game["i18n"].localize("PF2E.CurrencyCP"),
                uuid: "Compendium.pf2e.equipment-srd.lzJ8AVhRcbFul5fh",
                itemName: "Copper Pieces"
            }
        ]
    }

    get configCanRollAbility():boolean {
        return false;
    }
    get configLootItemType(): string {
        return "treasure";
    }

    get componentDefaultData() {
        return {
            id: "invalid",
            uuid:"invalid",
            img: "invalid",
            type: "invalid",
            name: "invalid",
            quantity: 1,
            itemType: undefined,
        }
    };
    componentFromEntity(entity: any):Component {
        const data = {
            id: entity.id,
            uuid: entity.uuid,
            img: entity.img,
            name: entity.name,
            type : entity.documentName,
            quantity: entity.system.quantity || 1,
            itemType: entity.documentName === "Item" ? entity.type : undefined,
        }
        return this.parent.componentCreate(data);
    };
    componentIsSame(a: ComponentData,b: ComponentData): boolean {
        const isSameName = a.name === b.name;
        const isSameType = a.type === b.type;
        const isSameItemType = a.itemType === b.itemType;
        return isSameName && isSameType && isSameItemType;
    };

    get itemPriceAttribute(): string {
        return "system.price";
    }

    get itemQuantityAttribute(): string {
        return "system.quantity";
    }

    itemListAddComponentList(itemList: any[], componentList: ComponentData[]): ComponentData[] {
        return [];
    }
}