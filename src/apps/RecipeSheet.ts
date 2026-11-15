import { Recipe } from "../Recipe.js";
import { Settings } from "../Settings.js";
import { getDataFrom } from "../helpers/Utility.js";
import { AnyOf } from "../AnyOf.js";
import { createDragDrop, markReplaced, renderTemplate } from "../helpers/Compat.js";
import { MAX_PIPS } from "../helpers/Progress.js";
import { CraftingApp } from "./CraftingApp.js";

const COINS = "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp";
/** icons of the known test types, others get a d20 */
const TEST_ICONS = {
  IncrementStep: "fa-shoe-prints",
  GmRequest: "fa-user-shield",
  AbilityTest: "fa-dumbbell",
  SkillTest: "fa-person-running",
  ToolTest: "fa-screwdriver-wrench",
};
/** folded sections per recipe item, survives re-rendering */
const foldedSections = new Map<string, Set<string>>();
/** shown in an empty macro and inserted on request; works in every system */
const MACRO_EXAMPLE = `// runs when the crafting starts
// result: the crafting so far · actor: who crafts · recipeData: this recipe
ui.notifications.info(\`\${actor.name} starts crafting \${recipeData.name}\`);

// throwing an error stops the crafting, it counts as failed
if (!actor.isOwner) {
  throw new Error("only the owner of the actor may craft this");
}`;

/**
 * Content of the recipe sheet (RecipeItemSheet): builds the view, wires the events, saves the recipe.
 * The recipe is kept here between renders, so a change can be shown before it is saved.
 */
export class RecipeSheet {
  app;
  item;
  recipe: Recipe;
  recipeElement?;

  constructor(app) {
    this.app = app;
    this.item = app.document;
  }

  get editable(): boolean {
    return !!this.app.isEditable;
  }

  /** re-render the sheet from the recipe as it is in memory */
  async render() {
    await this.app.render({keepRecipe: true});
  }

  async renderHTML(options): Promise<string> {
    if (!options?.keepRecipe || !this.recipe) {
      this.recipe = Recipe.fromItem(this.item);
    }
    return renderTemplate("modules/beavers-crafting/templates/recipe-sheet.hbs", this._view());
  }

  /** the html is in place: wire it up */
  attach(content: HTMLElement) {
    this.recipeElement = $(content);
    this.recipeElement.find(".brs").toggleClass("dark", this._isDark());
    this.handleEvents();
    if (this.editable) {
      createDragDrop({
        dropSelector: ".brs-target",
        permissions: {drop: () => this.editable},
        callbacks: {drop: this._onDrop.bind(this)},
      }).bind(content);
    }
  }

  /** Foundry puts theme-dark / theme-light on the window; without one it follows the page */
  _isDark(): boolean {
    const classes = this.app.element?.classList;
    if (classes?.contains("theme-dark")) return true;
    if (classes?.contains("theme-light")) return false;
    return document.body.classList.contains("theme-dark");
  }

  get folded(): Set<string> {
    let set = foldedSections.get(this.item.uuid);
    if (!set) {
      //start with empty instruction / macro folded
      set = new Set();
      if (!this.recipe.instruction) set.add("instruction");
      if (!this.recipe.macro) set.add("macro");
      foldedSections.set(this.item.uuid, set);
    }
    return set;
  }

  _view() {
    const recipe = this.recipe;
    const t = (key: string) => game["i18n"].localize("beaversCrafting.recipeSheet." + key);
    const f = (key: string, data: object) => game["i18n"].format("beaversCrafting.recipeSheet." + key, data);
    const hasCraftedFlag = Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) !== "none";
    const currencies = (beaversSystemInterface.configCurrencies || []) as any[];
    const currencyView = (id: string) => {
      const c = currencies.find(c => c.id === id);
      return {label: c?.label || id || "", img: c?.component?.img || COINS};
    };
    const currencyChoices = (id: string) => currencies.map(c => ({
      value: c.id, label: c.label, img: c.component?.img || COINS, on: c.id === id,
    }));

    const entries = (type: "required" | "input" | "output") => {
      const clickable = Settings.get(type === "output" ? Settings.DISPLAY_RESULTS : Settings.DISPLAY_INGREDIENTS);
      return Object.entries(recipe[type] || {}).map(([group, components]) => {
        const options = Object.entries(components as { [key: string]: Component }).map(([key, component]) => {
          const isMoney = component.flags?.[Settings.NAMESPACE]?.subtype === "money";
          const tag = component.type === Settings.ANYOF_SUBTYPE ? {icon: "fa-filter", text: t("tag.anyOf")}
            : component.type === "Macro" ? {icon: "fa-terminal", text: t("tag.macro")}
            : component.type === "RollTable" ? {icon: "fa-table-list", text: t("tag.table")}
            : undefined;
          return {
            key,
            name: component.name,
            img: isMoney ? currencyView(component.id).img || component.img : component.img,
            uuid: component.uuid,
            quantity: component.quantity,
            hasQty: component.type !== "Macro",
            isMoney,
            currencyId: component.id,
            currency: isMoney ? {label: currencyView(component.id).label} : undefined,
            currencyChoices: isMoney ? currencyChoices(component.id) : undefined,
            tag,
            hasCrafted: hasCraftedFlag && type !== "output" && !isMoney,
            crafted: !!component.flags?.[Settings.NAMESPACE]?.isCrafted,
            clickable: clickable && !isMoney && !!component.uuid,
          };
        });
        //macros run as they are, there is nothing to choose between
        return {group, isOr: options.length > 1, canOr: !options.some(o => o.tag?.icon === "fa-terminal"), options};
      });
    };
    const itemSummary = (list: ReturnType<typeof entries>, extra: string[] = []) => {
      const parts = [...extra];
      if (list.length === 1 && list[0].options.length === 1) {
        const o = list[0].options[0];
        parts.push(o.hasQty ? `${o.quantity}× ${o.isMoney ? o.currency?.label : o.name}` : o.name);
      } else if (list.length > 0) {
        parts.push(f("summary.items", {count: list.length}));
      }
      return parts.join(" · ");
    };

    const required = Settings.get(Settings.USE_ATTENDANTS) ? entries("required") : undefined;
    const input = entries("input");
    const output = entries("output");
    const legacy = recipe.currency;
    const cost = {
      entries: input,
      currency: legacy ? {
        id: legacy.name,
        value: legacy.value,
        img: currencyView(legacy.name).img,
        current: {label: currencyView(legacy.name).label},
        choices: currencyChoices(legacy.name),
      } : undefined,
      summary: itemSummary(input, legacy ? [`${legacy.value} ${currencyView(legacy.name).label}`] : []),
    };

    // checks: steps (AND) with alternative checks (OR); the fields come from the test classes of the system
    const testClasses = beaversSystemInterface.testClasses;
    const tests = recipe.beaversTests;
    //steps without checks are left overs, they are dropped on the next save
    const steps = Object.entries(tests?.ands || {}).filter(([, step]) => step?.ors).map(([and, step], index) => {
      const hits = Number(step.hits) || 0;
      const alts = Object.entries(step.ors || {}).map(([or, test]) => {
        const prefix = `flags.beavers-crafting.recipe.beaversTests.ands.${and}.ors.${or}`;
        const testClass = testClasses[test.type];
        const typeChoices = Object.entries(testClasses).map(([type, clazz]: [string, any]) => ({
          value: type,
          label: clazz.informationField?.label || type,
          hint: clazz.informationField?.note || "",
          icon: TEST_ICONS[type] || "fa-dice-d20",
          on: type === test.type,
        }));
        const fields = Object.entries(testClass?.customizationFields || {})
          .filter(([, field]: [string, any]) => field.type !== "info" && field.type !== "button")
          .map(([key, field]: [string, any]) => {
            const value = test.data?.[key] ?? field.defaultValue ?? "";
            const view: any = {
              name: `${prefix}.data.${key}`,
              value,
              label: field.label,
              note: field.note,
              placeholder: field.defaultValue ?? field.label ?? "",
            };
            if (field.type === "selection") {
              const choices = Object.entries(field.choices || {}).map(([id, choice]: [string, any]) => ({
                value: id, label: choice.text, img: choice.img, on: id === value,
              }));
              const chosen = choices.find(c => c.on);
              return {...view, kind: "select", choices, filter: choices.length > 8,
                current: {label: chosen?.label || "", img: chosen?.img}};
            }
            return {...view, kind: field.type === "number" ? "number" : field.type === "area" ? "area" : "text"};
          });
        return {
          check: or, prefix, type: test.type, typeChoices, fields,
          typeCurrent: {label: testClass?.informationField?.label || test.type || t("chooseCheck"), icon: TEST_ICONS[test.type] || "fa-dice-d20"},
        };
      });
      return {step: and, num: index + 1, hits, successes: t(hits === 1 ? "success" : "successes"), alts};
    });
    const maxHits = steps.reduce((sum, s) => sum + s.hits, 0);
    const fails = Number(tests?.fails) || 0;
    const checks = {
      steps,
      fails,
      consume: !!tests?.consume,
      // preview of what is needed: empty green ones per success, empty red ones per allowed fail
      pips: maxHits + fails <= MAX_PIPS
        ? [...Array(maxHits).fill({cls: ""}), ...(fails ? [{sep: true}] : []), ...Array(fails).fill({cls: "bad"})]
        : [],
      summary: steps.length ? f("summary.checks", {steps: steps.length, hits: maxHits, fails}) : t("noChecks"),
    };

    const folded = Object.fromEntries([...this.folded].map(id => [id, true]));
    const macroLines = recipe.macro ? recipe.macro.split("\n").length : 0;
    return {
      editable: this.editable,
      name: this.item.name,
      img: this.item.img,
      typeLabel: game["i18n"].localize(CONFIG.Item.typeLabels?.[this.item.type] || this.item.type),
      folder: recipe.folder || "",
      folderParts: (recipe.folder || "").split(".").filter(p => p !== ""),
      instruction: recipe.instruction || "",
      instructionSummary: CraftingApp._plainText(recipe.instruction, 80),
      macro: recipe.macro || "",
      macroExample: MACRO_EXAMPLE,
      macroSummary: macroLines ? f("summary.lines", {count: macroLines}) : "",
      folded,
      required: required ? {entries: required, summary: itemSummary(required)} : undefined,
      cost,
      results: {entries: output, summary: itemSummary(output)},
      checks,
    };
  }

  handleEvents() {
    if (game["version"].split(".")[0] < 12) {
      this.app._activateEditor?.(this.recipeElement.find(".editor-content")[0]);
    }
    this.recipeElement.find(".brs-sec-h").on("click", e => {
      const section = $(e.currentTarget).closest(".brs-sec");
      section.toggleClass("folded");
      if (section.hasClass("folded")) this.folded.add(section.data("sec")); else this.folded.delete(section.data("sec"));
    });
    this.handleSelects();
    this.handleMainEvents();
  }

  async _onDrop(e) {
    await this._onDropMain(e);
  }

  async update() {
    const update = { flags: {} };
    const formData = this.getFormData();
    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith(`flags.${Settings.NAMESPACE}.recipe.`)) {
        foundry.utils.setProperty(this.recipe, key.replace(`flags.${Settings.NAMESPACE}.recipe.`, ""), value);
      }
    }
    const recipeData = this.recipe.serialize();
    const expandedFormData = foundry.utils.expandObject(formData);
    const recipeFormData = foundry.utils.getProperty(expandedFormData,`flags.${Settings.NAMESPACE}.recipe`) || {};
    //the form may still show components that have just been removed from the recipe
    for (const type of ["required", "input", "output"]) {
      for (const [group, components] of Object.entries(recipeFormData[type] || {})) {
        for (const id of Object.keys(components as object)) {
          if (recipeData[type]?.[group]?.[id] === undefined) {
            delete recipeFormData[type][group][id];
          }
        }
        if (Object.keys(components as object).length === 0) {
          delete recipeFormData[type][group];
        }
      }
    }
    const merged = foundry.utils.mergeObject(recipeData, recipeFormData, {inplace: false}) as any;
    //steps without checks (left overs) would break crafting
    for (const [key, step] of Object.entries(merged.beaversTests?.ands || {})) {
      if (!(step as any)?.ors || Object.keys((step as any).ors).length === 0) delete merged.beaversTests.ands[key];
    }
    if (merged.beaversTests && Object.keys(merged.beaversTests.ands || {}).length === 0) delete merged.beaversTests;
    //replace instead of merge so removed parts do not survive
    update.flags[Settings.NAMESPACE] = markReplaced({}, "recipe", merged);
    // name and other fields of the item itself
    for (const [key, value] of Object.entries(formData)) {
      if (!key.startsWith(`flags.${Settings.NAMESPACE}.recipe`)) {
        foundry.utils.setProperty(update, key, value);
      }
    }
    //the sheet re-renders by itself when the item changed
    await this.item.update(update);
  }

  getFormData() {
    let data = {};
    // @ts-ignore
    const elements = this.recipeElement[0].querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea, prose-mirror",
    );
    for (let el of elements) {
      let element = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      if (element.name) { //make sure the element has a name attribute.
        // Check for element type
        if (element.type === "number") {
          data[element.name] = element.value ? parseFloat(element.value) : null;
        } else if (element.type === "checkbox" && element instanceof HTMLInputElement) {
          data[element.name] = element.checked;
        } else if (element.type === "select-one") {
          data[element.name] = element.value;
        } else if (element.type === "select-multiple") {
          const select = element as HTMLSelectElement;
          data[element.name] = Array.from(select.selectedOptions)
            .map(option => option.value);
        } else if (element.localName === "prose-mirror") {
          data[element.name] = (element as any).value ?? "";
        } else if (element.type === "textarea") {
          data[element.name] = element.value;
        } else {
          data[element.name] = element.value;
        }
      }
    }
    return data;
  }

  /** the icon selects: a button with a popup list, the value lives in a hidden input */
  closeSelects = () => {};

  handleSelects() {
    // the open list lives in <body>: inside the sheet it would be cut off by the scrolling area,
    // and the sheet's container query makes "position: fixed" relative to the sheet instead of the screen
    const closeAll = () => {
      $("body > .brs-portal").each((i, portal) => {
        const pop = $(portal).children(".pop");
        const select = pop.data("brsSelect");
        if (select?.length && document.contains(select[0])) select.append(pop);
        select?.removeClass("open");
        $(portal).remove();
      });
    };
    this.recipeElement.find(".brs-sel-btn").on("click", e => {
      e.preventDefault();
      const select = $(e.currentTarget).closest(".brs-sel");
      const wasOpen = select.hasClass("open");
      closeAll();
      if (wasOpen || !this.editable) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const dark = this.recipeElement.find(".brs").hasClass("dark") ? " dark" : "";
      const portal = $(`<div class="beavers-crafting brs brs-portal${dark}"></div>`).appendTo(document.body);
      const pop = select.find(".pop").data("brsSelect", select).appendTo(portal);
      const below = window.innerHeight - rect.bottom;
      pop.css({left: rect.left, minWidth: rect.width, top: "", bottom: ""});
      if (below < 260 && rect.top > below) pop.css({bottom: window.innerHeight - rect.top + 3});
      else pop.css({top: rect.bottom + 3});
      select.addClass("open");
      pop.find(".brs-opt").show();
      pop.find(".brs-filter input").val("").trigger("focus");
    });
    this.recipeElement.find(".brs-filter input").on("input", e => {
      const text = ($(e.currentTarget).val() as string).toLowerCase();
      $(e.currentTarget).closest(".pop").find(".brs-opt").each((i, opt) => {
        $(opt).toggle($(opt).text().toLowerCase().includes(text));
      });
    });
    this.recipeElement.find(".brs-opt").on("click", async e => {
      e.preventDefault();
      const select = $(e.currentTarget).closest(".pop").data("brsSelect") as JQuery;
      const value = $(e.currentTarget).attr("data-value") as string;
      closeAll();
      if (!select) return;
      const input = select.find("input[type=hidden]");
      if (input.val() === value) return;
      input.val(value);
      if (select.hasClass("test-type")) {
        const and = select.attr("data-step") as string, or = select.attr("data-check") as string;
        if (this.recipe.beaversTests?.ands[and]?.ors[or]) {
          this.recipe.beaversTests.ands[and].ors[or].type = value;
          this.recipe.beaversTests.ands[and].ors[or].data = {};
        }
        //first rerender so we get rid of the old data in form.
        await this.render();
      } else if (select.hasClass("currency")) {
        this._setCurrency(input.attr("name") as string, value);
      }
      await this.update();
    });
    $(document).off("mousedown.brs").on("mousedown.brs", e => {
      if (!$(e.target).closest(".brs-sel, .brs-portal").length) closeAll();
    });
    this.recipeElement.off("scroll.brs").on("scroll.brs", closeAll);
    this.closeSelects = closeAll;
  }

  /** a money component got another currency: keep name and image in line */
  _setCurrency(name: string, currencyId: string) {
    const currency = (beaversSystemInterface.configCurrencies || []).find(c => c.id === currencyId);
    const path = name.replace("flags.beavers-crafting.recipe.", "").replace(/\.id$/, "");
    const component = foundry.utils.getProperty(this.recipe, path);
    if (currency && component) {
      component.id = currency.id;
      component.name = currency.label;
      component.img = currency.component?.img || component.img;
    }
  }

  handleMainEvents() {
    if (!this.editable) {
      this.recipeElement.find(".open-sheet").on("click", e => this._openSheet(e));
      return;
    }
    this.recipeElement.find(".open-sheet").on("click", e => this._openSheet(e));
    // folder: shown as a path, the text field only while it is edited
    this.recipeElement.find(".brs-folder-show").on("click", e => {
      const folder = $(e.currentTarget).closest(".brs-folder").addClass("editing");
      folder.find(".brs-folder-in").trigger("focus").trigger("select");
    });
    this.recipeElement.find(".brs-folder-in")
      .on("blur", e => { $(e.currentTarget).closest(".brs-folder").removeClass("editing"); })
      .on("keydown", e => {
        if (e.key === "Escape") {
          $(e.currentTarget).val($(e.currentTarget).prop("defaultValue")).trigger("blur");
          e.preventDefault();
          e.stopPropagation();
        }
      });
    this.recipeElement.find(".macro-example").on("click", () => {
      this.recipe.macro = MACRO_EXAMPLE;
      this.recipeElement.find("textarea[name='flags.beavers-crafting.recipe.macro']").val(MACRO_EXAMPLE);
      void this.update();
    });
    this.recipeElement.find(".brs-craft").on("click", e => {
      e.stopPropagation();
      const {type, group, key} = e.currentTarget.dataset;
      const name = `${type}.${group}.${key}.flags.${Settings.NAMESPACE}.isCrafted`;
      foundry.utils.setProperty(this.recipe, name, foundry.utils.getProperty(this.recipe, name) ? null : true);
      void this.update();
    });
    this.recipeElement.find(".item-delete").on("click", async e => {
      const {type, group, key} = e.currentTarget.dataset;
      this.recipe._removeData(type as DataType, group, key);
      await this.render();
      void this.update();
    });
    this.recipeElement.find(".currency-delete").on("click", async () => {
      this.recipe.removeCurrency();
      await this.render();
      void this.update();
    });
    this.recipeElement.find(".add-money").on("click", e => {
      const {type, group} = e.currentTarget.dataset;
      this._onAddMoney(type as DataType, group || "");
    });
    this.recipeElement.find(".test-and").on("click", () => {
      this.recipe.addTestAnd();
      void this.update();
    });
    this.recipeElement.find(".test-or").on("click", async e => {
      this.recipe.addTestOr($(e.currentTarget).attr("data-step"));
      //first rerender so we get rid of the old data in form.
      await this.render();
      void this.update();
    });
    this.recipeElement.find(".test-delete").on("click", async e => {
      this.recipe.removeTestOr($(e.currentTarget).attr("data-step"), $(e.currentTarget).attr("data-check"));
      await this.render();
      void this.update();
    });
    this.recipeElement.find("input:not([type=hidden]):not(.brs-filter input), textarea, prose-mirror").on("change", () => {
      void this.update();
    });
    // highlight the drop target under the pointer
    this.recipeElement.find(".brs-target")
      .on("dragover", e => {
        const target = $(e.currentTarget);
        const zone = target.hasClass("brs-ent") ? target.find(".brs-ordrop") : target;
        this.recipeElement.find(".over").not(zone).removeClass("over");
        zone.addClass("over");
        e.stopPropagation();
      })
      .on("dragleave drop", e => {
        if (e.type === "drop" || !e.currentTarget.contains(e.relatedTarget as Node)) {
          $(e.currentTarget).find(".over").addBack(".over").removeClass("over");
        }
      });
  }

  _openSheet(e) {
    const uuid = $(e.currentTarget).data("uuid");
    if (uuid) {
      beaversSystemInterface.uuidToDocument(uuid).then(i => i?.sheet?.render(true));
    }
  }

  _onAddMoney(type: DataType, group: string) {
    const currencies = beaversSystemInterface.configCurrencies;
    if (!currencies || currencies.length === 0) return;
    // starts with the first currency, it can be changed in the line
    const currency = currencies[0];
    const component = beaversSystemInterface.componentCreate({
      id: currency.id,
      name: currency.label,
      img: currency.component?.img || COINS,
      type: "item",
      quantity: 1,
      flags: {
        "beavers-crafting": {
          "subtype": "money"
        }
      }
    });
    this.recipe._addData(type, component, component.id, group);
    void this.update();
  }

  async _onDropMain(e) {
    const target = $(e.target).closest(".brs-target");
    if (!target.length) {
      return;
    }
    const type = target.data("type") as DataType;
    //dropped on an entry: alternative of that entry, on the end zone: new entry
    const group = target.data("group") === undefined ? "" : target.data("group") + "";
    const data = getDataFrom(e);
    if (!data) return;

    // Macros can be results
    if (type === "output" && data.type === "Macro" && data.uuid) {
      const macroDoc: any = await fromUuid(data.uuid);
      if (macroDoc) {
        const component: any = {
          type: "Macro",
          uuid: data.uuid,
          name: macroDoc?.name || data.name || "Macro",
          img: macroDoc?.img || macroDoc?.icon || "icons/svg/dice-target.svg",
          quantity: 1,
        };
        this.recipe.addOutput(component, data.uuid, group);
        void this.update();
      }
      return;
    }

    if (data.type === "Item" || (type === "output" && data.type === "RollTable")) {
      const entity = await fromUuid(data.uuid);
      if (entity) {
        const component = beaversSystemInterface.componentFromEntity(entity);
        component.type = data.type;
        let keyid = data.uuid;
        if (AnyOf.isAnyOf(entity)) {
          component.type = Settings.ANYOF_SUBTYPE;
          keyid = foundry.utils.randomID();
        }
        this.recipe._addData(type, component, keyid, group);
        void this.update();
      }
    }
  }
}
