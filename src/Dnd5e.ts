export class Dnd5e implements SystemApi {
    parent: System

    get version() {
        return 1;
    }

    get id() {
        return "dnd5e";
    }

    async actorRollSkill(actor, skillId) {
        return await actor.rollSkill(skillId);
    }

    async actorRollAbility(actor, abilityId) {
        return await actor.rollAbilityTest(abilityId);
    }

    actorGetCurrencies(actor) {
        return actor["system"].currency;
    }

    async actorAddCurrencies(actor, currencies: Currencies) {
        const actorCurrencies = this.actorGetCurrencies(actor);
        const addValue = this.parent.currencyToLowestValue(currencies);
        const actorValue = this.parent.currencyToLowestValue(actorCurrencies);
        const result = actorValue + addValue;
        if (result < 0) {
            return false;
        }
        const resultCurrencies = this.parent.currencyToCurrencies(result);
        await actor.update({system: {currency: resultCurrencies}});
        return true;
    }

    actorSheetAddTab(sheet, html, actor, tabData, tabBody) {
        const tabs = $(html).find('.tabs[data-group="primary"]');
        const tabItem = $('<a class="item" data-tab="' + tabData.id + '">' + tabData.label + '</a>');
        tabs.append(tabItem);
        const body = $(html).find(".sheet-body");
        const tabContent = $('<div class="tab" data-group="primary" data-tab="' + tabData.id + '"></div>');
        body.append(tabContent);
        tabContent.append(tabBody);
    }

    get configSkills() {
        return Object.entries(game["dnd5e"].config.skills)
            .map(skills => {
                // @ts-ignore
                return {id: skills[0], label: skills[1].label as string};
            })
    }

    get configAbilities() {
        return Object.entries(game["dnd5e"].config.abilities).map(ab => {
            return {id: ab[0], label: ab[1] as string};
        });
    }

    get configCurrencies() {
        return [
            {
                id: "pp",
                factor: 1000,
                label: game["dnd5e"].config.currencies.pp.label
            },
            {
                id: "gp",
                factor: 100,
                label: game["dnd5e"].config.currencies.gp.label
            },
            {
                id: "ep",
                factor: 50,
                label: game["dnd5e"].config.currencies.ep.label
            },
            {
                id: "sp",
                factor: 10,
                label: game["dnd5e"].config.currencies.sp.label
            },
            {
                id: "cp",
                factor: 1,
                label: game["dnd5e"].config.currencies.cp.label
            }
        ]
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
            quantity: entity.system.quantity | 1,
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