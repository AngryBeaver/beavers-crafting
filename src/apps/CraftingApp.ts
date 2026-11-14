import {FilterType, RecipeCompendium} from "./RecipeCompendium.js";
import {Crafting, getCurrencyComponent} from "../Crafting.js";
import {getDataFrom, sanitizeUuid} from "../helpers/Utility.js";
import {Settings} from "../Settings.js";
import {AnyOf} from "../AnyOf.js";
import {Recipe} from "../Recipe.js";
import {ComponentResults, Result} from "../Result.js";
import {TestHandler} from "../TestHandler.js";
import { sortByFolder } from "../helpers/Folder.js";
import { createDragDrop, renderTemplate } from "../helpers/Compat.js";

type SlotStatus = "success" | "error" | "unknown" | undefined;

interface SlotView {
    type: DataType,
    group: string,
    key: string,
    uuid: string,
    name: string,
    img: string,
    need: number,
    have?: number,
    hasHave: boolean,
    status: SlotStatus,
    missing: boolean,
    isAnyOf: boolean,
    clickable: boolean,
    crafted: boolean,
}

interface GroupView {
    group: string,
    isChoice: boolean,
    options: SlotView[],
}

interface RecipeListView {
    uuid: string,
    name: string,
    img: string,
    craftable?: boolean,
    selected: boolean,
}

interface FolderView {
    name: string,
    path: string,
    collapsed: boolean,
    count: number,
    folders: FolderView[],
    recipes: RecipeListView[],
}

export class CraftingApp extends Application {
    _sheetRenderId = 0;
    data: {
        actor,
        filter,
        search: string,
        recipes: Recipe[],
        craftable: Map<string, boolean>,
        collapsed: Set<string>,
        instructionOpen: boolean,
        filterItems: {},
        selected?,
        recipe?: Recipe,
        result?: Result,
    };

    constructor(actor, options: any = {}) {
        super(options);
        this.data = {
            actor: actor,
            filter: FilterType.available,
            search: "",
            recipes: [],
            craftable: new Map(),
            collapsed: new Set(),
            instructionOpen: false,
            filterItems: {},
        };
        if (this.element.length > 0) {
            this.bringToTop();
        }
    }

    async close(options?: Application.CloseOptions) {
        Settings.set(Settings.CRAFTING_APP_WIDTH, this.position.width);
        Settings.set(Settings.CRAFTING_APP_HEIGHT, this.position.height);
        return super.close(options);
    }

    static get defaultOptions() {
        const classes = ["sheet", "beavers-crafting", "crafting-app"];
        // Foundry forces .theme-light on ApplicationV1 unless theme-dark is set explicitly,
        // so follow the user's application color scheme ourselves.
        if (document.body.classList.contains("theme-dark")) {
            classes.push("themed", "theme-dark");
        }
        return foundry.utils.mergeObject(super.defaultOptions, {
            // @ts-ignore
            title: game.i18n.localize(`beaversCrafting.crafting-app.title`),
            width: Settings.get(Settings.CRAFTING_APP_WIDTH),
            height: Settings.get(Settings.CRAFTING_APP_HEIGHT),
            template: "modules/beavers-crafting/templates/crafting-app.hbs",
            closeOnSubmit: true,
            submitOnClose: true,
            submitOnChange: true,
            resizable: true,
            classes: classes,
            popOut: true,
            id: 'beavers-crafting'
        });
    }

    async getData(options = {}) {
        const data: any = foundry.utils.mergeObject(await super.getData(options), {
            filter: this.data.filter,
            search: this.data.search,
        });
        const craftable = new Map<string, boolean>();
        let recipes = await RecipeCompendium.filterForActor(this.data.actor, this.data.filter, craftable);
        if (Object.values(this.data.filterItems).length != 0) {
            recipes = await RecipeCompendium.filterForItems(recipes, Object.values(this.data.filterItems));
        }
        if (this.data.search) {
            const search = this.data.search.toLowerCase();
            recipes = recipes.filter(r => r.name.toLowerCase().includes(search));
        }
        this.data.recipes = recipes;
        this.data.craftable = craftable;
        if (!this.data.selected || !recipes.find(r => r.uuid === this.data.selected)) {
            this.data.selected = recipes[0]?.uuid;
        }
        this.selectRecipe(this.data.selected);

        data.tree = this._buildTree(sortByFolder([...recipes]));
        const craftableCount = recipes.filter(r => craftable.get(r.uuid)).length;
        // @ts-ignore
        data.craftableText = game.i18n.format("beaversCrafting.crafting-app.craftableCount", {
            count: craftableCount,
            total: recipes.length
        });
        return data;
    }

    _buildTree(node, parentPath = ""): { recipes: RecipeListView[], folders: FolderView[], count: number } {
        const recipes: RecipeListView[] = (node[""] || []).map((r: Recipe) => ({
            uuid: r.uuid,
            name: r.name,
            img: r.img,
            craftable: this.data.craftable.get(r.uuid),
            selected: r.uuid === this.data.selected,
        }));
        const folders: FolderView[] = Object.keys(node)
            .filter(name => name !== "")
            .map(name => {
                const path = parentPath ? parentPath + "." + name : name;
                const sub = this._buildTree(node[name].folders, path);
                return {name, path, collapsed: this.data.collapsed.has(path), ...sub};
            });
        const count = recipes.length + folders.reduce((sum, f) => sum + f.count, 0);
        return {recipes, folders, count};
    }

    _allFolderPaths(): string[] {
        const paths = new Set<string>();
        for (const recipe of this.data.recipes) {
            if (!recipe.folder) continue;
            const parts = recipe.folder.split(".");
            for (let i = 1; i <= parts.length; i++) {
                paths.add(parts.slice(0, i).join("."));
            }
        }
        return [...paths];
    }

    selectRecipe(uuid: string) {
        this.data.selected = uuid;
        this.data.recipe = undefined;
        const recipe = this.data.recipes.find(r => r.uuid === uuid);
        if (recipe) {
            this.data.recipe = Recipe.clone(recipe);
        }
    }

    async renderRecipeSheet() {
        const main = this.element?.find(".bc-main");
        if (!main || main.length === 0) {
            return;
        }
        if (this.data.recipe === undefined) {
            main.empty();
            return;
        }
        const recipe = this.data.recipe;
        const renderId = ++this._sheetRenderId;
        const crafting = await Crafting.fromRecipe(this.data.actor.id, recipe);
        await crafting.checkCurrency();
        RecipeCompendium.validateRecipeToItemList(RecipeCompendium._filterData(recipe.input, (c) => c.type === "Item"), this.data.actor.items, crafting.result);
        await crafting.checkRequired();
        this.data.result = crafting.result;
        const content = await renderTemplate('modules/beavers-crafting/templates/crafting-app-main.hbs',
            this._recipeView(recipe, crafting.result));
        // a newer render was started while we were waiting
        if (renderId !== this._sheetRenderId) {
            return;
        }
        main.empty();
        main.append(content);
        this.activateRecipeSheetListener(main);
    }

    _recipeView(recipe: Recipe, result: Result) {
        const displayIngredients = !!Settings.get(Settings.DISPLAY_INGREDIENTS);
        const displayResults = !!Settings.get(Settings.DISPLAY_RESULTS);
        const hasCraftedFlag = Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) !== "none";

        const slot = (component: Component, type: DataType, group: string, key: string, results: ComponentResults | undefined, clickable: boolean): SlotView => {
            const isAnyOf = component.type === Settings.ANYOF_SUBTYPE;
            const isMoney = component.flags?.[Settings.NAMESPACE]?.subtype === "money";
            let status: SlotStatus = undefined;
            let have: number | undefined = undefined;
            if (results) {
                const componentResult = results.findComponentResult(component);
                if (componentResult && !isAnyOf) {
                    status = componentResult.hasError() ? "error" : "success";
                    if (!isMoney) {
                        have = componentResult.originalQuantity;
                    }
                } else {
                    status = "unknown";
                }
            }
            return {
                type, group, key,
                uuid: component.uuid,
                name: component.name,
                img: component.img,
                need: component.quantity,
                have,
                hasHave: have !== undefined,
                status,
                missing: status === "error",
                isAnyOf,
                clickable: clickable && !isAnyOf,
                crafted: hasCraftedFlag && !!component.flags?.[Settings.NAMESPACE]?.isCrafted,
            };
        };
        const groups = (data, type: DataType, results: ComponentResults | undefined, clickable: boolean): GroupView[] =>
            Object.entries(data || {}).map(([group, components]) => {
                const options = Object.entries(components as { [key: string]: Component })
                    .map(([key, component]) => slot(component, type, group, key, results, clickable));
                return {group, isChoice: options.length > 1, options};
            });

        const useAttendants = !!Settings.get(Settings.USE_ATTENDANTS);
        const required = useAttendants ? groups(recipe.required, "required", result._components.required, displayIngredients) : [];
        const input = groups(recipe.input, "input", result._components.consumed, displayIngredients);
        const output = groups(recipe.output, "output", undefined, displayResults);

        let currency: SlotView | undefined = undefined;
        if (recipe.currency) {
            const component = getCurrencyComponent(recipe.currency.name, recipe.currency.value);
            const status: SlotStatus = result._currencyResult ? (result._currencyResult.hasError ? "error" : "success") : "unknown";
            currency = {
                type: "input", group: "", key: "",
                uuid: component.uuid,
                name: component.name,
                img: component.img,
                need: recipe.currency.value,
                hasHave: false,
                status,
                missing: status === "error",
                isAnyOf: false,
                clickable: false,
                crafted: false,
            };
        }

        const missing: string[] = [];
        const describe = (s: SlotView) => s.hasHave ? `${s.need - (s.have ?? 0)}× ${s.name}` : `${s.need}× ${s.name}`;
        if (currency?.missing) {
            missing.push(describe(currency));
        }
        for (const group of [...required, ...input]) {
            if (group.isChoice) {
                if (group.options.every(o => o.missing)) {
                    missing.push(group.options.map(o => o.name).join(" / "));
                }
            } else {
                group.options.filter(o => o.missing).forEach(o => missing.push(describe(o)));
            }
        }

        const tests = recipe.beaversTests;
        const maxHits = tests ? TestHandler.getMaxHits(tests) : 0;

        // header: "Folder › Sub · produces N items" + summary tags
        const plural = (key: string, count: number) =>
            // @ts-ignore
            game.i18n.format(`beaversCrafting.crafting-app.summary.${key}${count === 1 ? "One" : "Many"}`, {count});
        const produced = output.reduce((sum, g) => sum + (Number(g.options[0]?.need) || 0), 0);
        const meta = [
            recipe.folder ? recipe.folder.split(".").join(" › ") : "",
            produced > 0 ? plural("produces", produced) : "",
        ].filter(s => s).join(" · ");
        const tags: { icon: string, text: string }[] = [];
        if (maxHits > 0) {
            tags.push({icon: "fa-dice-d20", text: plural("check", maxHits)});
        }
        if (required.length > 0) {
            tags.push({icon: "fa-screwdriver-wrench", text: plural("tool", required.length)});
        }
        const cost = [
            currency ? `${currency.need} ${currency.name}` : "",
            input.length > 0 ? plural("ingredient", input.length) : "",
        ].filter(s => s).join(" + ");
        if (cost) {
            tags.push({icon: "fa-coins", text: cost});
        }

        return {
            recipe: {
                uuid: recipe.uuid,
                name: recipe.name,
                img: recipe.img,
            },
            meta,
            tags,
            required,
            hasRequired: required.length > 0,
            currency,
            input,
            hasCost: !!currency || input.length > 0,
            output,
            hasOutput: output.length > 0,
            tests,
            maxHits,
            showFails: !!tests && tests.fails > 1,
            instruction: recipe.instruction,
            instructionPreview: CraftingApp._plainText(recipe.instruction),
            instructionOpen: this.data.instructionOpen,
            missing: missing.join(", "),
            hasMissing: missing.length > 0,
        };
    }

    /**
     * Plain text of an html snippet for previews. DOMParser does not execute scripts or load resources,
     * the result is escaped again by handlebars.
     */
    static _plainText(html: string | undefined, maxLength = 160): string {
        if (!html) {
            return "";
        }
        const body = new DOMParser().parseFromString(html, "text/html").body;
        body.querySelectorAll("script, style, template").forEach(e => e.remove());
        // keep words of separate lines/blocks apart
        body.querySelectorAll("br, p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, blockquote, section")
            .forEach(e => e.after(" "));
        const text = (body.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        return text.length > maxLength ? text.slice(0, maxLength).trimEnd() + "…" : text;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".bc-side select.filter").on("change", (e) => {
            this.data.filter = $(e.target).val();
            this.data.selected = null;
            this.render();
        });
        html.find(".bc-side input.search").on("input", (e) => {
            this.data.search = $(e.target).val() as string;
            this.data.selected = null;
            this.render();
        });
        if (this.data.search) {
            const searchInput = html.find(".bc-side input.search");
            searchInput.focus();
            const val = searchInput.val();
            searchInput.val("");
            searchInput.val(val);
        }
        html.find(".bc-list .bc-rec").on("click", (e) => {
            const id = $(e.currentTarget).data("id");
            this.selectRecipe(id);
            html.find(".bc-list .bc-rec.selected").removeClass("selected");
            $(e.currentTarget).addClass("selected");
            void this.renderRecipeSheet();
        });
        html.find(".bc-list .bc-fold").on("click", (e) => {
            const folder = $(e.currentTarget).closest(".bc-folder");
            const path = folder.data("path") + "";
            folder.toggleClass("collapsed");
            if (folder.hasClass("collapsed")) {
                this.data.collapsed.add(path);
            } else {
                this.data.collapsed.delete(path);
            }
        });
        html.find(".bc-side .collapse-all").on("click", () => {
            const anyOpen = html.find(".bc-list .bc-folder:not(.collapsed)").length > 0;
            if (anyOpen) {
                this.data.collapsed = new Set(this._allFolderPaths());
                html.find(".bc-list .bc-folder").addClass("collapsed");
            } else {
                this.data.collapsed.clear();
                html.find(".bc-list .bc-folder").removeClass("collapsed");
            }
        });
        void this.renderRecipeSheet();
    }

    activateRecipeSheetListener(html) {
        html.find(".open-sheet").on("click", e => {
            const uuid = $(e.currentTarget).data("id");
            if (uuid) {
                beaversSystemInterface.uuidToDocument(uuid).then(i => i?.sheet?.render(true));
            }
        });
        html.find(".bc-instruction").on("toggle", e => {
            this.data.instructionOpen = (e.currentTarget as HTMLDetailsElement).open;
        });
        html.find(".bc-craft").on("click", () => {
            if (this.data.recipe === undefined) {
                return;
            }
            Crafting.fromRecipe(this.data.actor.id, this.data.recipe)
                .then(crafting => crafting.craft())
                .then(() => this.close());
        });

        html.find(".choose").on("click", e => {
            const group = $(e.currentTarget).data("group") + "";
            const key = $(e.currentTarget).data("key") + "";
            const type = $(e.currentTarget).data("type");
            this._choose(type, group, key);
            void this.renderRecipeSheet();
        });

        html.find(".chooseAnyOf").on("click", e => {
            const group = $(e.currentTarget).data("group") + "";
            const key = $(e.currentTarget).data("key") + "";
            const type = $(e.currentTarget).data("type");
            if (this.data.recipe != undefined) {
                const pool = type === "output" ? game["items"].contents : this.data.actor.items;
                RecipeCompendium.evaluateAnyOf(type, this.data.recipe, group, key, pool)
                    .then(() => this.renderRecipeSheet());
            }
        });

        this.addDragDrop(html);
    }

    _choose(type: DataType, group: string, key: string) {
        if (this.data.recipe) {
            const component = this.data.recipe[type][group][key];
            this.data.recipe[type][group] = {};
            this.data.recipe._addData(type, component, key, group);
        }
    }

    addDragDrop(html) {
        const dropFilter = createDragDrop({
            dropSelector: '.drop-area, .bc-slot[data-type="input"]',
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this)
            }
        });
        for (const x in this._dragDrop) {
            if (this._dragDrop[x].dropSelector === dropFilter.dropSelector) {
                this._dragDrop[x].bind(html[0]);
                return;
            }
        }
        this._dragDrop.push(dropFilter);
        dropFilter.bind(html[0]);
    }

    async _onDrop(e) {
        const isFilterDrop = $(e.target).hasClass("drop-area");
        if (isFilterDrop) {
            return this._onDropFilter(e);
        }
        const uuid = $(e.currentTarget).data("id");
        if (uuid != undefined) {
            const key = $(e.currentTarget).data("key") + "";
            const group = $(e.currentTarget).data("group") + "";
            beaversSystemInterface.uuidToDocument(uuid).then(
                item => {
                    if (AnyOf.isAnyOf(item)) {
                        return this._onDropAnyOf(new AnyOf(item), group, key, e);
                    }
                    return;
                }
            )
        }
    }

    async _onDropAnyOf(anyOf: AnyOf, group: string, key: string, e: DragEvent) {
        if (this.data.recipe === undefined || e["isHandled"]) {
            return;
        }
        const data = getDataFrom(e);
        if (data) {
            if (data.type !== "Item") return;
            const entity = await fromUuid(data.uuid);
            let result = await anyOf.executeMacro(entity);
            if (result.value) {
                const previousComponent = this.data.recipe.input[group][key];
                const component = beaversSystemInterface.componentFromEntity(entity);
                const id = sanitizeUuid(data.uuid);
                component.quantity = previousComponent.quantity;
                this.data.recipe = Recipe.clone(this.data.recipe);
                //remove existing ingredient with same id and add quantity;
                if (this.data.recipe.input[group][id]) {
                    component.quantity = component.quantity + this.data.recipe.input[group][id].quantity;
                    delete this.data.recipe.input[group][id];
                }
                //copyInPlace;
                const ingredients = Object.fromEntries(
                    Object.entries(this.data.recipe.input[group]).map(([o_key, o_val]) => {
                        if (o_key === key) return [id, component];
                        return [o_key, o_val];
                    })
                );
                this.data.recipe.input[group] = ingredients;
                e["isHandled"] = true;
                void this.renderRecipeSheet();
            }
        }
    }

    async _onDropFilter(e: DragEvent) {
        const data = getDataFrom(e)
        if (data) {
            if (data.type !== "Item") return;
            let entity = await fromUuid(data.uuid);
            this.data.filterItems[data.uuid] = entity;
            this.render();
        }
    }

    protected _canDragDrop(selector: string): boolean {
        return true;
    }
}
