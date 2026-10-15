window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-llm-tencent-codebuddy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  CODEBUDDY_API_KEY_REF: () => CODEBUDDY_API_KEY_REF,
  CODEBUDDY_SETTINGS_NS: () => CODEBUDDY_SETTINGS_NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/CodeBuddySection.tsx
var import_react2 = require("react");

// src/client/apiKey.ts
var LEGAL_API_KEY = /^[\x21-\x7E]+$/;
var ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/;
function isQuoted(value) {
  const first = value[0];
  if (first !== '"' && first !== "'" && first !== "`") return false;
  return value.length > 1 && value.endsWith(first);
}
function apiKeyFailure(draft) {
  if (draft.length === 0) return void 0;
  const value = draft.trim();
  if (value.length === 0) return "keyBlank";
  if (ENV_LINE.test(value) || isQuoted(value)) return "keyIllegalCharacters";
  if (!LEGAL_API_KEY.test(value)) return "keyIllegalCharacters";
  return void 0;
}

// src/client/ModelsEditor.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/models.ts
var CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
var THOUSAND = 1e3;
var MILLION = 1e6;
function parseCapacity(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return void 0;
  const match = CAPACITY_PATTERN.exec(trimmed);
  if (match === null) return Number.NaN;
  const suffix = match[2]?.toLowerCase();
  const scale = suffix === "m" ? MILLION : suffix === "k" ? THOUSAND : 1;
  const scaled = Number(match[1]) * scale;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
}
function formatCapacity(value) {
  if (!Number.isInteger(value) || value <= 0) return String(value);
  if (value % MILLION === 0) return `${String(value / MILLION)}M`;
  if (value % THOUSAND === 0) return `${String(value / THOUSAND)}K`;
  return String(value);
}
function modelDrafts(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {});
}
function objectField(value, key) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  return value[key];
}
function userOwnsModels(user) {
  return typeof user === "object" && user !== null && !Array.isArray(user) && Object.hasOwn(user, "models");
}
function catalogPayload(models) {
  return JSON.parse(JSON.stringify(models));
}
function validateModels(value) {
  if (value === void 0) return void 0;
  const models = modelDrafts(value);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, model] of models.entries()) {
    const id = model["id"];
    const trimmed = typeof id === "string" ? id.trim() : void 0;
    if (trimmed === void 0 || trimmed.length === 0) return { index, key: "modelIdRequired" };
    if (seen.has(trimmed)) return { index, key: "modelIdDuplicate" };
    seen.add(trimmed);
    const name = model["name"];
    if (name !== void 0 && (typeof name !== "string" || name.length === 0)) {
      return { index, key: "modelNameInvalid" };
    }
    const contextWindow = model["contextWindow"];
    if (contextWindow !== void 0 && (typeof contextWindow !== "number" || !Number.isInteger(contextWindow) || contextWindow <= 0)) {
      return { index, key: "modelContextInvalid" };
    }
    const maxTokens = model["maxTokens"];
    if (maxTokens !== void 0 && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0)) {
      return { index, key: "modelMaxTokensInvalid" };
    }
  }
  return void 0;
}

// src/client/CodeBuddySection.module.css
var css = ".section {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  width: 100%;\n  max-width: 960px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.heading h2,\n.heading p,\n.status,\n.failure,\n.saved {\n  margin: 0;\n}\n\n.heading h2 {\n  font-size: 16px;\n  line-height: 24px;\n  font-weight: 500;\n}\n\n.heading p {\n  margin-top: 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.field {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.field input {\n  box-sizing: border-box;\n  width: 100%;\n  height: 34px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: 6px;\n  padding: 7px 9px;\n  outline: none;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n}\n\n.field input:focus {\n  border-color: var(--dsw-alias-state-business-primary);\n}\n\n.field input:disabled {\n  opacity: .45;\n}\n\n.status {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.failure {\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.saved {\n  color: var(--dsw-alias-state-success-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.primary {\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  height: 32px;\n  border: 0.5px solid transparent;\n  border-radius: 16px;\n  padding: 0 12px;\n  font: inherit;\n  font-size: 12px;\n  cursor: pointer;\n  background: var(--dsw-alias-button-primary-fill);\n  color: var(--dsw-alias-label-primary-foreground);\n}\n\n.primary:disabled,\n.linkButton:disabled,\n.addModelButton:disabled {\n  opacity: .45;\n  cursor: default;\n}\n\n.modelCatalog {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding-top: 12px;\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.modelListHead {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.modelCatalogHeading {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  margin: 0;\n}\n\n.modelCatalogTitle {\n  font-size: 12px;\n  line-height: 18px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.modelCatalogMeta,\n.modelEmpty {\n  margin: 0;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.linkButton {\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  height: 28px;\n  padding: 0 10px;\n  border: none;\n  border-radius: 14px;\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary);\n  font: inherit;\n  font-size: 12px;\n  line-height: 18px;\n  cursor: pointer;\n}\n\n.linkButton:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.modelEmpty {\n  padding: 12px;\n  border: 1px dashed var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  text-align: center;\n}\n\n.modelList {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.modelHeader,\n.modelRow {\n  display: grid;\n  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 120px 120px 28px;\n  align-items: center;\n  gap: 6px;\n}\n\n.modelHeader {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n  padding: 0 2px;\n}\n\n.input {\n  box-sizing: border-box;\n  width: 100%;\n  height: 32px;\n  padding: 0 10px;\n  border: 0.5px solid var(--dsw-alias-border-l4);\n  border-radius: 8px;\n  font: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n}\n\n.input:focus {\n  outline: none;\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.input::placeholder {\n  color: var(--dsw-alias-label-dimmed);\n}\n\n.input:disabled {\n  opacity: 0.6;\n  cursor: default;\n}\n\n.iconButton {\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary);\n  cursor: pointer;\n}\n\n.iconButton:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.iconButton:disabled {\n  cursor: default;\n  opacity: 0.4;\n}\n\n.iconButtonDanger:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover-danger);\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.addModelButton {\n  box-sizing: border-box;\n  align-self: flex-start;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  height: 28px;\n  padding: 0 10px;\n  border: 0.5px solid var(--dsw-alias-border-l3);\n  border-radius: 14px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 12px;\n  line-height: 18px;\n  cursor: pointer;\n}\n\n.addModelButton:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n";
var tagId = "@deepseek-ai/dsh-llm-tencent-codebuddy/CodeBuddySection.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@deepseek-ai/dsh-llm-tencent-codebuddy";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
var CodeBuddySection_default = { "section": "section", "heading": "heading", "status": "status", "failure": "failure", "saved": "saved", "field": "field", "actions": "actions", "primary": "primary", "linkButton": "linkButton", "addModelButton": "addModelButton", "modelCatalog": "modelCatalog", "modelListHead": "modelListHead", "modelCatalogHeading": "modelCatalogHeading", "modelCatalogTitle": "modelCatalogTitle", "modelCatalogMeta": "modelCatalogMeta", "modelEmpty": "modelEmpty", "modelList": "modelList", "modelHeader": "modelHeader", "modelRow": "modelRow", "input": "input", "iconButton": "iconButton", "iconButtonDanger": "iconButtonDanger" };

// src/client/ModelsEditor.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CAPACITY_FIELDS = ["contextWindow", "maxTokens"];
function bufferKey(field, index) {
  return `${field}#${String(index)}`;
}
function parseBufferKey(key) {
  const split = key.lastIndexOf("#");
  return { field: key.slice(0, split), index: Number(key.slice(split + 1)) };
}
function patchRow(models, index, field, value) {
  return models.map((model, at) => {
    if (at !== index) return { ...model };
    const copy = { ...model };
    if (value === void 0) Reflect.deleteProperty(copy, field);
    else copy[field] = value;
    return copy;
  });
}
function ModelsEditor(props) {
  const [buffers, setBuffers] = (0, import_react.useState)(() => /* @__PURE__ */ new Map());
  const commit = (next) => {
    props.onChange(next);
  };
  const dropRow = (removed) => {
    setBuffers((current) => {
      const next = /* @__PURE__ */ new Map();
      for (const [key, text] of current) {
        const parsed = parseBufferKey(key);
        if (parsed.index === removed) continue;
        const index = parsed.index > removed ? parsed.index - 1 : parsed.index;
        next.set(bufferKey(parsed.field, index), text);
      }
      return next;
    });
    commit(props.models.flatMap((model, at) => at === removed ? [] : [{ ...model }]));
  };
  const shownCapacity = (model, index, field) => {
    const typed = buffers.get(bufferKey(field, index));
    if (typed !== void 0) return typed;
    const stored = model[field];
    return typeof stored === "number" ? formatCapacity(stored) : "";
  };
  const finishCapacity = (index, field) => {
    const key = bufferKey(field, index);
    const typed = buffers.get(key);
    if (typed === void 0) return;
    const parsed = parseCapacity(typed);
    if (parsed !== void 0 && Number.isNaN(parsed)) return;
    setBuffers((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };
  const captions = [props.t("modelId"), props.t("modelName"), props.t("contextWindow"), props.t("maxTokens")];
  const restoreDefaults = () => {
    setBuffers(/* @__PURE__ */ new Map());
    props.onReset();
  };
  const appendBlank = () => {
    commit([...props.models.map((row) => ({ ...row })), { id: "" }]);
  };
  const status = props.overridden ? props.t("modelsCustomized") : props.t("modelsInherited");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: CodeBuddySection_default["modelCatalog"], "aria-label": props.t("models"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: CodeBuddySection_default["modelListHead"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: CodeBuddySection_default["modelCatalogHeading"], children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { className: CodeBuddySection_default["modelCatalogTitle"], children: props.t("models") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: CodeBuddySection_default["modelCatalogMeta"], children: status })
      ] }),
      props.overridden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: CodeBuddySection_default["linkButton"], disabled: props.disabled, onClick: restoreDefaults, children: props.t("resetModels") }) : null
    ] }),
    props.models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: CodeBuddySection_default["modelEmpty"], children: props.t("modelsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: CodeBuddySection_default["modelList"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: CodeBuddySection_default["modelHeader"], "aria-hidden": "true", children: [
        captions.map((caption) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: caption }, caption)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
      ] }),
      props.models.map((model, index) => {
        const idText = typeof model["id"] === "string" ? model["id"] : "";
        const nameText = typeof model["name"] === "string" ? model["name"] : "";
        const n = String(index + 1);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: CodeBuddySection_default["modelRow"], children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: CodeBuddySection_default["input"],
              type: "text",
              value: idText,
              placeholder: props.t("modelId"),
              "aria-label": `${props.t("modelId")} ${n}`,
              disabled: props.disabled,
              onChange: (event) => {
                commit(patchRow(props.models, index, "id", event.target.value));
              },
              onBlur: (event) => {
                const trimmed = event.target.value.trim();
                if (trimmed !== event.target.value) commit(patchRow(props.models, index, "id", trimmed));
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: CodeBuddySection_default["input"],
              type: "text",
              value: nameText,
              placeholder: props.t("modelNamePlaceholder"),
              "aria-label": `${props.t("modelName")} ${n}`,
              disabled: props.disabled,
              onChange: (event) => {
                commit(patchRow(props.models, index, "name", event.target.value === "" ? void 0 : event.target.value));
              }
            }
          ),
          CAPACITY_FIELDS.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: CodeBuddySection_default["input"],
              type: "text",
              inputMode: "numeric",
              value: shownCapacity(model, index, field),
              placeholder: props.t(field === "contextWindow" ? "contextWindowPlaceholder" : "maxTokensPlaceholder"),
              "aria-label": `${props.t(field)} ${n}`,
              disabled: props.disabled,
              onChange: (event) => {
                const text = event.target.value;
                setBuffers((current) => new Map(current).set(bufferKey(field, index), text));
                commit(patchRow(props.models, index, field, parseCapacity(text)));
              },
              onBlur: () => {
                finishCapacity(index, field);
              }
            },
            field
          )),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: `${CodeBuddySection_default["iconButton"]} ${CodeBuddySection_default["iconButtonDanger"]}`,
              "aria-label": `${props.t("removeModel")} ${n}`,
              title: props.t("removeModel"),
              disabled: props.disabled,
              onClick: () => {
                dropRow(index);
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
            }
          )
        ] }, index);
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: CodeBuddySection_default["addModelButton"], disabled: props.disabled, onClick: appendBlank, children: [
      props.t("addModel"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 })
    ] })
  ] });
}

// src/client/CodeBuddySection.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var CODEBUDDY_API_KEY_REF = "TENCENT_CODEBUDDY_API_KEY";
var CODEBUDDY_SETTINGS_NS = "llm-tencent-codebuddy";
function modelsOp(overridden, models) {
  if (!overridden) return { op: "unset", path: ["models"] };
  return {
    op: "set",
    path: ["models"],
    value: catalogPayload(models)
  };
}
function CodeBuddySection(props) {
  const { t, describeCredential, storeCredential, describeSettings, writeSettings } = props;
  const [keyDraft, setKeyDraft] = (0, import_react2.useState)("");
  const [keyState, setKeyState] = (0, import_react2.useState)(void 0);
  const [namespace, setNamespace] = (0, import_react2.useState)(void 0);
  const [settingsWritable, setSettingsWritable] = (0, import_react2.useState)(true);
  const [settingsReady, setSettingsReady] = (0, import_react2.useState)(false);
  const [settingsLoadFailed, setSettingsLoadFailed] = (0, import_react2.useState)(false);
  const [inherited, setInherited] = (0, import_react2.useState)([]);
  const [models, setModels] = (0, import_react2.useState)([]);
  const [overridden, setOverridden] = (0, import_react2.useState)(false);
  const [storedOverridden, setStoredOverridden] = (0, import_react2.useState)(false);
  const [modelsDirty, setModelsDirty] = (0, import_react2.useState)(false);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [failure, setFailure] = (0, import_react2.useState)(void 0);
  const [saved, setSaved] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    let stale = false;
    void Promise.all([describeCredential(CODEBUDDY_API_KEY_REF), describeSettings()]).then(([described, settings]) => {
      if (stale) return;
      setKeyState(described);
      if (settings === void 0) {
        setSettingsLoadFailed(true);
        setSettingsReady(true);
        return;
      }
      setSettingsWritable(settings.writable);
      setNamespace(settings.namespace);
      if (settings.namespace !== void 0) {
        const owned = userOwnsModels(settings.namespace.user);
        const effective = modelDrafts(objectField(settings.namespace.value, "models"));
        const fromBase = modelDrafts(objectField(settings.namespace.base, "models"));
        const fallback = fromBase.length > 0 ? fromBase : owned ? [] : effective;
        setInherited(fallback.map((model) => ({ ...model })));
        setModels(effective.map((model) => ({ ...model })));
        setOverridden(owned);
        setStoredOverridden(owned);
      }
      setSettingsReady(true);
    });
    return () => {
      stale = true;
    };
  }, [describeCredential, describeSettings]);
  const keyLocked = keyState?.writable === false;
  const keyFailure = apiKeyFailure(keyDraft);
  const modelFailure = overridden ? validateModels(models) : void 0;
  const placeholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true ? t("keyStored") : t("keyPlaceholder");
  const status = keyState?.configured === true ? t("keyStored") : t("keyMissing");
  const shownFailure = keyFailure === void 0 ? modelFailure === void 0 ? failure : `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}` : t(keyFailure);
  const canSaveKey = !keyLocked && keyFailure === void 0 && keyDraft.trim().length > 0;
  const canSaveModels = settingsWritable && modelsDirty && modelFailure === void 0;
  const catalogDisabled = busy || !settingsWritable;
  const save = async () => {
    const value = keyDraft.trim();
    setBusy(true);
    setFailure(void 0);
    setSaved(false);
    try {
      if (canSaveModels) {
        const written = await writeSettings([modelsOp(overridden, models)], namespace?.revision);
        if (written.kind === "refused") {
          setFailure(written.error);
          return;
        }
        setNamespace(written.view);
        setModelsDirty(false);
        setStoredOverridden(overridden);
      }
      if (canSaveKey) {
        const refused = await storeCredential(CODEBUDDY_API_KEY_REF, value);
        if (refused !== void 0) {
          setFailure(refused);
          return;
        }
        setKeyDraft("");
        setKeyState({ configured: true, writable: true, source: "file" });
      }
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };
  const catalog = !settingsReady ? null : settingsLoadFailed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: CodeBuddySection_default["status"], role: "status", children: t("catalogLoadFailed") }) : namespace === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: CodeBuddySection_default["status"], role: "status", children: t("catalogMissing") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    ModelsEditor,
    {
      models,
      overridden,
      t,
      disabled: catalogDisabled,
      onChange: (next) => {
        setOverridden(true);
        setModels(next);
        setModelsDirty(true);
        setSaved(false);
      },
      onReset: () => {
        setOverridden(false);
        setModels(inherited.map((model) => ({ ...model })));
        setModelsDirty(storedOverridden);
        setSaved(false);
      }
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: CodeBuddySection_default["section"], children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: CodeBuddySection_default["heading"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("intro") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: CodeBuddySection_default["field"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("keyInput") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "password",
          autoComplete: "off",
          value: keyDraft,
          placeholder,
          "aria-label": t("keyInput"),
          "aria-invalid": keyFailure !== void 0,
          disabled: busy || keyLocked,
          onChange: (event) => {
            setKeyDraft(event.target.value);
            setSaved(false);
            setFailure(void 0);
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: CodeBuddySection_default["status"], role: "status", children: status }),
    catalog,
    shownFailure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: CodeBuddySection_default["failure"], role: "alert", children: shownFailure }),
    saved ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: CodeBuddySection_default["saved"], role: "status", children: t("saved") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: CodeBuddySection_default["actions"], children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        type: "button",
        className: CodeBuddySection_default["primary"],
        disabled: busy || modelFailure !== void 0 || !canSaveKey && !canSaveModels,
        onClick: () => {
          void save();
        },
        children: t("apply")
      }
    ) })
  ] });
}

// src/client/locales.ts
var zh = {
  nav: "CodeBuddy",
  title: "Tencent CodeBuddy",
  intro: "\u5728\u6B64\u9875\u4FDD\u5B58 CodeBuddy API \u5BC6\u94A5\uFF0C\u5E76\u7F16\u8F91\u9002\u914D\u5668\u6301\u6709\u7684\u6A21\u578B\u76EE\u5F55\u3002\u9996\u6B21\u8FDB\u5165\u4E0D\u4F1A\u5F39\u51FA\u586B\u5199\u6846\u3002",
  keyInput: "API \u5BC6\u94A5",
  keyPlaceholder: "\u8F93\u5165 API \u5BC6\u94A5",
  keyStored: "\u5DF2\u914D\u7F6E\u2014\u2014\u8F93\u5165\u65B0\u503C\u53EF\u66FF\u6362",
  keyMissing: "\u5C1A\u672A\u914D\u7F6E\u5BC6\u94A5",
  keyEnvLocked: "\u7531\u542F\u52A8\u73AF\u5883\u63D0\u4F9B\uFF08\u53EA\u8BFB\uFF09",
  models: "\u6A21\u578B\u76EE\u5F55",
  modelsInherited: "\u6B63\u5728\u4F7F\u7528\u9002\u914D\u5668\u9ED8\u8BA4\u6A21\u578B",
  modelsCustomized: "\u5DF2\u81EA\u5B9A\u4E49\u6A21\u578B\u76EE\u5F55",
  resetModels: "\u6062\u590D\u9ED8\u8BA4\u6A21\u578B",
  model: "\u6A21\u578B",
  modelId: "\u6A21\u578B ID",
  modelName: "\u663E\u793A\u540D\u79F0",
  modelNamePlaceholder: "\u7559\u7A7A\u65F6\u4F7F\u7528\u6A21\u578B ID",
  contextWindow: "\u4E0A\u4E0B\u6587\u7A97\u53E3",
  contextWindowPlaceholder: "\u4F7F\u7528\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u503C",
  maxTokens: "\u6700\u5927\u8F93\u51FA token \u6570",
  maxTokensPlaceholder: "\u4F7F\u7528\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u503C",
  addModel: "\u6DFB\u52A0\u6A21\u578B",
  removeModel: "\u5220\u9664\u6A21\u578B",
  modelsEmpty: "\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u5C06\u4E0D\u663E\u793A\u4EFB\u4F55\u6A21\u578B\uFF1B\u76EE\u5F55\u5916 ID \u4ECD\u53EF\u76F4\u63A5\u53D1\u9001\u3002",
  catalogLoadFailed: "\u65E0\u6CD5\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u3002",
  catalogMissing: "Host \u5C1A\u672A\u6CE8\u518C\u8BE5\u9002\u914D\u5668\u7684 settings \u5206\u533A\u3002",
  apply: "\u4FDD\u5B58",
  saved: "\u5DF2\u4FDD\u5B58",
  keyBlank: "\u8BF7\u8F93\u5165 API \u5BC6\u94A5\uFF1B\u7559\u7A7A\u5219\u4FDD\u6301\u5DF2\u5B58\u50A8\u7684\u5BC6\u94A5\u3002",
  keyIllegalCharacters: "\u8BE5 API \u5BC6\u94A5\u683C\u5F0F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u3002",
  modelIdRequired: "\u6A21\u578B ID \u4E0D\u80FD\u4E3A\u7A7A\u3002",
  modelIdDuplicate: "\u6A21\u578B ID \u4E0D\u80FD\u91CD\u590D\u3002",
  modelNameInvalid: "\u663E\u793A\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u3002",
  modelContextInvalid: "\u4E0A\u4E0B\u6587\u7A97\u53E3\u5FC5\u987B\u662F\u6B63\u6570\uFF0C\u4F8B\u5982 131072\u3001256K \u6216 1M\u3002",
  modelMaxTokensInvalid: "\u6700\u5927\u8F93\u51FA token \u6570\u5FC5\u987B\u662F\u6B63\u6570\uFF0C\u4F8B\u5982 8192\u300164K \u6216 1M\u3002"
};
var en = {
  nav: "CodeBuddy",
  title: "Tencent CodeBuddy",
  intro: "Store the CodeBuddy API key on this page and edit the adapter-owned model catalog. First-run does not prompt for the key.",
  keyInput: "API key",
  keyPlaceholder: "Enter API key",
  keyStored: "Configured \u2014 type a new value to replace it",
  keyMissing: "No key configured",
  keyEnvLocked: "Provided by the launch environment (read-only)",
  models: "Models",
  modelsInherited: "Using the adapter defaults",
  modelsCustomized: "Customized model catalog",
  resetModels: "Restore defaults",
  model: "Model",
  modelId: "Model ID",
  modelName: "Display name",
  modelNamePlaceholder: "Uses the model ID when empty",
  contextWindow: "Context window",
  contextWindowPlaceholder: "Uses the provider default",
  maxTokens: "Max output tokens",
  maxTokensPlaceholder: "Uses the provider default",
  addModel: "Add model",
  removeModel: "Delete model",
  modelsEmpty: "No models will be shown in the selector. Unlisted IDs can still be sent directly.",
  catalogLoadFailed: "The model catalog could not be read.",
  catalogMissing: "The Host has not registered this adapter's settings section.",
  apply: "Save",
  saved: "Saved",
  keyBlank: "Enter the API key, or leave the field empty to keep the stored one.",
  keyIllegalCharacters: "This API key is not in a valid format. Please check it.",
  modelIdRequired: "Model ID is required.",
  modelIdDuplicate: "Model ID must be unique.",
  modelNameInvalid: "Display name cannot be empty.",
  modelContextInvalid: "Context window must be a positive count, like 131072, 256K, or 1M.",
  modelMaxTokensInvalid: "Max output tokens must be a positive count, like 8192, 64K, or 1M."
};

// src/client/index.ts
var NS = "settings.codebuddy";
var inject = ["slots", "locale", "remote", "remote.credentials", "remote.settings"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-tencent-codebuddy: dictionaries");
  const t = ctx.locale.bind(NS);
  const injected = () => ({
    describeCredential: async (ref) => {
      const response = await ctx.remote.credentials.describe([ref]);
      return response.ok ? response.value[ref] : void 0;
    },
    storeCredential: async (ref, value) => {
      const response = await ctx.remote.credentials.set(ref, value);
      return response.ok ? void 0 : response.error.message;
    },
    describeSettings: async () => {
      const response = await ctx.remote.settings.describe();
      if (!response.ok) return void 0;
      return {
        writable: response.value.writable,
        namespace: response.value.namespaces.find((item) => item.ns === CODEBUDDY_SETTINGS_NS)
      };
    },
    writeSettings: async (ops, expectedRevision) => {
      const response = await ctx.remote.settings.mutate(CODEBUDDY_SETTINGS_NS, ops, expectedRevision);
      if (response.ok) return { kind: "written", view: response.value };
      return { kind: "refused", error: response.error.message };
    }
  });
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "codebuddy",
    order: 12,
    label: () => t("nav"),
    locale: NS,
    inject: injected
  }, CodeBuddySection));
}

		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
