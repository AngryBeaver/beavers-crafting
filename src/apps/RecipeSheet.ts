import {Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {getDataFrom} from "../helpers/Utility.js";
import {AnyOf} from "../AnyOf.js";

const recipeSheets: { [key: string]: RecipeSheet } = {};

export class RecipeSheet {
    app;
    item;
    editable:boolean;
    recipe:Recipe;
    recipeElement?;
    sheet:{
        active:string
    }

    static bind(app, html, data) {
        app.recipeSheet = this;
        if(Recipe.isRecipe(app.item)){
            if(!recipeSheets[app.id]){
                recipeSheets[app.id] = new RecipeSheet(app);
            }
            recipeSheets[app.id].init(html);
            if(!app.initialized){
                app.options.height = 500;
                app.options.width = 700;
                app.setPosition({height:app.options.height,width:app.options.width});
            }
            app.initialized = true;

            app._onResize = (e)=>{
                app.options.height = app.position.height;
                app.options.width = app.position.width;
            }
        }
    }

    constructor(app) {
        this.app = app;
        this.item = app.item;
        this.editable = app.options.editable;
        this.sheet = {
            active : "main"
        };
    }

    init(html){
        if(html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".beavers-crafting.recipe");
        if(exists.length != 0){
            return;
        }
        this.recipeElement = $('<div class="beavers-crafting recipe" style="height:100%;width:100%;padding:15px;"></div>');
        if(!this.app.form){
            this.recipeElement = $('<form class="beavers-crafting recipe" style="height:100%;width:100%;padding:15px;"></form>')
        }
        beaversSystemInterface.itemSheetReplaceContent(this.app,html,this.recipeElement);
        this.recipe = Recipe.fromItem(this.item);
        this.render().then(i=>this.addDragDrop());
    }

    addDragDrop(){
        if(this.editable && !this.app._dragDrop?.find(d=>d.name === "recipeSheet")) {
            const dragDrop = new DragDrop({
                dropSelector: '',
                permissions: {
                    dragstart: this.app._canDragStart.bind(this.app),
                    drop: this.app._canDragDrop.bind(this.app)
                },
                callbacks: {
                    dragstart: this.app._onDragStart.bind(this.app),
                    dragover: this.app._onDragOver.bind(this.app),
                    drop: this._onDrop.bind(this)
                }
            });
            dragDrop["name"]="recipeSheet";
            this.app._dragDrop.push(dragDrop);
            dragDrop.bind(this.recipeElement[0]);
        }
    }

    async render(){
        let main = await renderTemplate('modules/beavers-crafting/templates/recipe-main.hbs',
            {
                recipe: this.recipe,
                currencies: beaversSystemInterface.configCurrencies,
                editable:this.editable,
                displayResults:Settings.get(Settings.DISPLAY_RESULTS),
                displayIngredients:Settings.get(Settings.DISPLAY_RESULTS),
                useAttendants: Settings.get(Settings.USE_ATTENDANTS),
                canRollAbility:beaversSystemInterface.configCanRollAbility,
                hasCraftedFlag: Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) !== "none",
            });
        let description = await renderTemplate('modules/beavers-crafting/templates/recipe-description.hbs',
            {
                recipe: this.recipe,
                editable:this.editable,
            });
        let template = await renderTemplate('modules/beavers-crafting/templates/recipe-sheet.hbs',{
            main: main,
            description: description,
            active: this.sheet.active,
            advanced: "test",
            recipe: this.recipe
        });
        this.recipeElement.find('.recipe').remove();
        this.recipeElement.append(template);
        if(this.app.scrollToPosition){
            this.recipeElement.scrollTop(this.app.scrollToPosition)
        }
        this.handleEvents();
    }

    handleEvents(){

        this.app._activateEditor(this.recipeElement.find(".editor-content")[0]);
        this.recipeElement.find('.tabs a').click(e=>{
            this.sheet.active = $(e.currentTarget).data("tab");
            this.render();
        });

        this.handleMainEvents();
    }

    async _onDrop(e) {
        await this._onDropMain(e);
    }

    async update() {
        let update={flags:{}};
        const formData = this.getFormData();
        // add macro before setting it via serialization to null
        if(!this.app.form){
            for (const [key, value] of Object.entries(formData)) {
                let recipeKey = key.replace("flags.beavers-crafting.recipe.", "");
                foundry.utils.setProperty(this.recipe,recipeKey,value);
            }
        }
        update.flags[Settings.NAMESPACE] = {
            recipe: this.recipe.serialize()
        };
        if(!this.app.form){
            // @ts-ignore
            for (const [key, value] of Object.entries(formData)) {
                foundry.utils.setProperty(update,key,value);
            }
        }
        await this.item.update(update,{ performDeletions:true });
        this.recipe = Recipe.fromItem(this.item);

        if(this.recipeElement) {
            this.app.scrollToPosition = this.recipeElement.scrollTop();
        }
        await this.render();
    }

    getFormData(){
        let data = {};
        for(let el of this.recipeElement[0].elements) {
            let element = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

            if(element.name){ //make sure the element has a name attribute.
                // Check for element type
                if(element.type === 'number') {
                    data[element.name] = element.value ? parseFloat(element.value) : null;
                } else if (element.type === 'checkbox' && element instanceof HTMLInputElement) {
                    data[element.name] = element.checked;
                } else if (element.type === 'select-one' || element.type === 'select-multiple') {
                    let select: HTMLSelectElement = el as HTMLSelectElement;
                    let selectedValues = Array.from(select.selectedOptions)
                      .map(option => option.value);
                    data[element.name] = selectedValues;
                } else if (element.type === 'textarea') {
                    data[element.name] = element.value;
                } else {
                    data[element.name] = element.value;
                }
            }
        }
        return data;
    }
    handleMainEvents() {
        this.recipeElement.find('.beavers-fontsize-svg-img').click(e=>{
            const group = e.target.dataset.group;
            const type = e.target.dataset.type;
            const key = e.target.dataset.key;
            const name=`${type}.${group}.${key}.flags.${Settings.NAMESPACE}.isCrafted`;
            const value = foundry.utils.getProperty(this.recipe,name);
            if(value){
                foundry.utils.setProperty(this.recipe, name, null);
            }else {
                foundry.utils.setProperty(this.recipe, name, true);
            }
            this.update();
        });

        this.recipeElement.find('.ingredients .item-delete').click(e=>{
            this.recipe.removeInput(e.target.dataset.group,e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.results .item-delete').click(e=>{
            this.recipe.removeOutput(e.target.dataset.group,e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.attendants .item-delete').click(e=>{
            this.recipe.removeRequired(e.target.dataset.group,e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.currencies .item-delete').click(async e => {
            this.recipe.removeCurrency();
            await this.render();
            this.update();
        });
        this.recipeElement.find('.cost .item-add').click(e=>{
            this.recipe.addCurrency();
            this.update();
        });
        this.recipeElement.find('.tests .testAnd .item-add').click(e=>{
            this.recipe.addTestAnd();
            this.update();
        });
        this.recipeElement.find('.tests .testOr .item-add').click(async e => {
            const and = $(e.currentTarget).data("and");
            this.recipe.addTestOr(and);
            //first rerender so we get rid of the old data in form.
            await this.render();
            this.update();
        });
        this.recipeElement.find('.tests .item-delete').click(async e => {
            const and = $(e.currentTarget).data("and");
            const or = $(e.currentTarget).data("or");
            this.recipe.removeTestOr(and, or);
            //first rerender so we get rid of the old data in form.
            await this.render();
            this.update();
        });

        this.recipeElement.find(".beavers-test-selection select").on("change",async e => {
            const name = e.target.name;
            const { ands: and, ors: or } = name.split('.').reduce((result, item, index, array) =>
              (item === 'ands' || item === 'ors') ? { ...result, [item]: array[index + 1] } : result, {});
            const type = $(e.target).val() as string;
            if (this.recipe.beaversTests?.ands[and]?.ors[or]) {
                this.recipe.beaversTests.ands[and].ors[or].type = type;
                this.recipe.beaversTests.ands[and].ors[or].data = {};
            }
            //first rerender so we get rid of the old data in form.
            await this.render();
            await this.update();
        })
        //fix some systems e.g. a5e does not update for selects
        this.recipeElement.find(".beavers-test select:not(.beavers-test .beavers-test-selection select)").on("change",async e => {e
            await this.update();
        });
        this.recipeElement.find("input, .currencies select, .advanced textarea").on("change",async e => {e
            await this.update();
        });

        this.recipeElement.find('.results .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_RESULTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.recipeElement.find('.ingredients .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.recipeElement.find('.attendants .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
    }


    async _onDropMain(e){
        const isDrop = $(e.target).hasClass("drop-area");
        const isInput = $(e.target).parents(".beavers-crafting.recipe .ingredients").length !==0;
        const isOutput = $(e.target).parents(".beavers-crafting.recipe .results").length !==0;
        const isRequired = $(e.target).parents(".beavers-crafting.recipe .attendants").length !==0;
        if(!isDrop&& !isInput && !isOutput && !isRequired){
            return;
        }
        const data = getDataFrom(e);
        if(data &&
            (data.type === "Item" ||
                (data.type === "RollTable" && isOutput)
            )
        ) {
            const entity = await fromUuid(data.uuid);
            if (entity) {
                const isAnyOf = AnyOf.isAnyOf(entity)
                if(isAnyOf && isOutput){
                    return;
                }
                const component = beaversSystemInterface.componentFromEntity(entity);
                component.type = data.type;
                if (isInput) {
                    let keyid = data.uuid;
                    if(AnyOf.isAnyOf(entity)){
                        component.type = Settings.ANYOF_SUBTYPE;
                        keyid = foundry.utils.randomID();
                    }
                    this.recipe.addInput(component, keyid,$(e.target).data("id"));
                }
                if (isOutput) {
                    this.recipe.addOutput(component, data.uuid, $(e.target).data("id"));
                }
                if (isRequired) {
                    let keyid = data.uuid;
                    if(AnyOf.isAnyOf(entity)){
                        component.type = Settings.ANYOF_SUBTYPE;
                        keyid = foundry.utils.randomID();
                    }
                    this.recipe.addRequired(component, keyid,$(e.target).data("id"));
                }
                this.update();
            }
        }
    }
}