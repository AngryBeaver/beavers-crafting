interface ResultData {
    updates: {
        items: {
            toUpdate: updateItem[],
            toDelete: string[],
            toCreate: ComponentData[]
        },
        actor: {
            "system.currency"?: Currencies5e;
            [key: string]: any
        }
    }
    chat: ChatData;
    precast: PreCastData;
    isAvailable: boolean;
    hasErrors: boolean;
    hasException: boolean;
}

interface ChatData {
    name: string,
    img: string,
    success: boolean
    input: {
        consumed: {
            [key: string]: ComponentResult
        }
        required: {
            [key: string]: ComponentResult
        }
    }
    output: {
        [key: string]: ComponentData
    }
    skill?: {
        name: string,
        total: number,
        difference: number,
    }
}

interface PreCastData{
    ingredients: {
        [key: string]: {
            isAvailable: boolean
        }
    }
    attendants: {
        [key: string]: {
            isAvailable: boolean
        }
    }
    tool?: boolean;
    currencies?: boolean
}

interface ComponentResult {
    component: ComponentData,
    isAvailable: boolean,
}

interface IngredientResult {
    component: ComponentData,
    isAvailable: boolean,
    difference: number
}

interface ComponentData {
    id: string;
    uuid: string;
    type: string;
    name: string;
    img: string;
    quantity: number;
    itemType?: string;
}

interface Skill {
    name: string;
    dc: number;
    consume: boolean;
}

interface Currencies5e {
    pp?: number;
    gp?: number;
    ep?: number;
    sp?: number;
    cp?: number;
}

interface Currency {
    name: string;
    value: number;
}

interface ItemChange {
    toDelete: string[];
    toUpdate: updateItem;
}

interface updateItem {
    "_id": string,
    "system.quantity": number,

    [key: string]: any
}

interface MacroResult<t> {
    value: t,
    error?: Error
}

interface AnyOfStoreData {
    macro: string
}

interface RecipeData {
    ingredients: {
        [key: string]: ComponentData
    }
    results: {
        [key: string]: ComponentData
    }
    skill?: Skill;
    currency?: Currency;
    tool?: string;
    attendants: {
        [key: string]: ComponentData
    },
    macro?: string
}