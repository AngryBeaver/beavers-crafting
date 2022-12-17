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
    hasError: boolean;
    hasException: boolean;
}

type ComponentType = "consumed" | "required" | "output";

interface StackStatus {
    id: string;
    quantity: number;
    status:  "created" | "updated";
}

interface ChatData {
    components:{
        [key: string]: ComponentResult
    }
    name: string;
    img: string;
    success: boolean;
    skill?: {
        name: string;
        total: number;
        difference: number;
    };
};

interface PreCastData {
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
    currencies?: boolean;
};

interface ComponentResult {
    component: ComponentData,
    isAvailable: boolean,
    type: ComponentType
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
    "system.quantity": number
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

