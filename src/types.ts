
interface Result {
    changes: {
        items: {
            toUpdate:any[],
            toDelete:any[],
            toCreate:any[]
        },
        currencies: {},
    }
    ingredients: {
        [key: string]: IngredientResult }
    currencies: boolean;
    skill?:{
        name: string,
        total: number,
        difference: number,
    };
    hasErrors:boolean;
    isAvailable:boolean;
}

interface IngredientResult {
    component:Component,
    isAvailable:boolean,
    difference:number
}

interface Component {
    id:string;
    uuid:string;
    sourceId:string;
    name:string;
    img:string;
    quantity:number;
}

interface Skill {
    name:string;
    dc:number;
    consume:boolean;
}

interface Currency {
    name:string;
    value:number;
}

interface ItemChange {
    toDelete: any[];
    toUpdate:{
        "_id": string,
        "system.quantity": number
    };
}
