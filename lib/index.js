import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { LlmError, RetryPolicySchema, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { authContextFrom, credentialStoreFrom } from "@deepseek-ai/dsh-llm-pi-ai/src/auth.ts";
import { resolveProfiles } from "@deepseek-ai/dsh-llm-pi-ai/src/config.ts";
import { deepEqualJson } from "@deepseek-ai/dsh-util-values";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
//#region src/catalog.ts
/** Reasoning levels and OpenAI dispatch shared by the catalog's thinking models. */
const REASONING = {
	reasoningEfforts: {
		low: "low",
		medium: "medium",
		high: "high",
		xhigh: "xhigh",
		max: "max"
	},
	compat: {
		thinkingFormat: "openai",
		supportsReasoningEffort: true
	}
};
/** The fixed official model catalog, in desktop-client order. */
const TENCENT_CODEBUDDY_MODELS = [
	{
		id: "auto",
		name: "Auto",
		contextWindow: 168e3,
		maxTokens: 32e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "hy3-ioa",
		name: "Hy3",
		contextWindow: 192e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "hy3-preview-hr",
		name: "HR敏感数据（L4）专用模型",
		contextWindow: 192e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "echo",
		name: "Echo",
		contextWindow: 238e3,
		maxTokens: 24e3,
		reasoningEfforts: false
	},
	{
		id: "glm-5.2-ioa",
		name: "GLM-5.2",
		contextWindow: 1e6,
		maxTokens: 48e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "glm-5v-turbo-ioa",
		name: "GLM-5v-Turbo",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "kimi-k3-ioa",
		name: "Kimi-K3",
		contextWindow: 1e6,
		maxTokens: 32e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "kimi-k2.7-ioa",
		name: "Kimi-K2.7-Code",
		contextWindow: 256e3,
		maxTokens: 32e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "kimi-k2.6-ioa",
		name: "Kimi-K2.6",
		contextWindow: 256e3,
		maxTokens: 32e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "minimax-m3-ioa",
		name: "MiniMax-M3",
		contextWindow: 512e3,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-5",
		name: "Claude-Opus-5",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-sonnet-5",
		name: "Claude-Sonnet-5",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-sonnet-5-1m",
		name: "Claude-Sonnet-5-1M",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-4.8-1m",
		name: "Claude-Opus-4.8 (1M context)",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-4.8",
		name: "Claude-Opus-4.8",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-4.7-1m",
		name: "Claude-Opus-4.7 (1M context)",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-4.7",
		name: "Claude-Opus-4.7",
		contextWindow: 176e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "claude-opus-4.6-1m",
		name: "Claude-Opus-4.6 (1M context)",
		contextWindow: 1e6,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: false
	},
	{
		id: "claude-sonnet-4.6-1m",
		name: "Claude-Sonnet-4.6 (1M context)",
		contextWindow: 1e6,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: false
	},
	{
		id: "claude-opus-4.6",
		name: "Claude-Opus-4.6",
		contextWindow: 176e3,
		maxTokens: 24e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6-Sol",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6-Terra",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6-Luna",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		contextWindow: 1e6,
		maxTokens: 128e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		contextWindow: 272e3,
		maxTokens: 72e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gpt-5.3-codex",
		name: "GPT-5.3-Codex",
		contextWindow: 272e3,
		maxTokens: 72e3,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "gemini-3.5-flash",
		name: "Gemini-3.5-Flash",
		contextWindow: 1e6,
		maxTokens: 65536,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "deepseek-v4-flash-ioa",
		name: "Deepseek-V4-Flash",
		contextWindow: 1e6,
		maxTokens: 5e4,
		input: ["text", "image"],
		...REASONING
	},
	{
		id: "deepseek-v4-pro-ioa",
		name: "Deepseek-V4-Pro-0813",
		contextWindow: 1e6,
		maxTokens: 5e4,
		input: ["text", "image"],
		...REASONING
	}
];
//#endregion
//#region src/tt-switch-catalog.ts
/**
* Signed model catalog the tt-switch binary itself reads.
*
* tt-switch hardcodes one URL as the single source for the Tencent model list:
* a release file carrying a signed envelope — `schemaVersion`, `algorithm`
* (`HMAC-SHA256+BASE64-PAYLOAD`), a Base64 `payload` and its `signature`. The
* payload is the catalogue proper: `revision`, `updatedAt`, `models` (each with
* `displayName`, `maxInputTokens`, `maxOutputTokens`, `supportsReasoning`,
* `supportsImages`, `supportsTools`, `temperature`, `costMultiplier`, …), plus
* `managedModelIds` and `modelFallbacks`.
*
* Unlike `/v3/config` — which answers with `data.models: null` until a
* credential is stored — and unlike the desktop client's cache, which needs the
* client installed, this read needs nothing from this machine. It is the list
* the machine starts out with, so it outranks both and sits directly beneath a
* catalog the user edited by hand.
*
* `managedModelIds` and `modelFallbacks` travel with the result for
* diagnostics only. A curated whitelist and a retirement map are decisions for
* the deployment: a route has to keep serving whatever id the gateway still
* answers, and silently rewriting a model the user picked is worse than letting
* a retired id fail where the user can see it.
*
* The signature is checked only when a key is configured. The envelope says
* HMAC-SHA256 but the signing key is deployment-owned and this package ships
* none: with no key the read is trusted on the strength of HTTPS alone and
* {@link TtSwitchCatalog.signatureVerified} stays `undefined`, which the caller
* reports. With a key, a mismatch rejects the whole catalogue instead of
* serving a list that may have been altered. The signed bytes are taken to be
* the Base64 payload text — the only input both sides hold verbatim.
*
* Read failures never throw: an unreachable host, an unrecognized envelope, a
* bad signature or an empty list yields `undefined`, and the caller keeps its
* previous catalog.
*
* @module dsh-llm-tencent-codebuddy/tt-switch-catalog
*/
/** The single catalogue URL tt-switch hardcodes. */
const TT_SWITCH_CATALOG_URL = "https://cnb.woa.com/tt-switch/tt-switch/-/git/raw/master/releases/tencent_models.json";
/** How long one read may take before it is abandoned. */
const TT_SWITCH_TIMEOUT_MS = 15e3;
/** Output capability the gateway reports for provider-internal reasons beyond any chat ceiling. */
const MAX_OUTPUT_TOKENS = 128e3;
/** Output capability assumed when the catalogue names none. */
const DEFAULT_OUTPUT_TOKENS = 32768;
/** The reasoning ladder a reasoning-capable route advertises. */
const REASONING_EFFORTS = {
	reasoningEfforts: {
		low: "low",
		medium: "medium",
		high: "high",
		xhigh: "xhigh",
		max: "max"
	},
	compat: {
		thinkingFormat: "openai",
		supportsReasoningEffort: true
	}
};
/**
* Check the envelope signature.
* @param payload - the Base64 payload text, byte for byte as published.
* @param signature - the signature the envelope carries.
* @param key - HMAC key. `undefined`/empty means "no key": nothing is checked.
* @returns whether the signature matched, or `undefined` when nothing was checked.
*/
function verifySignature(payload, signature, key) {
	if (key === void 0 || key === "" || signature === "") return void 0;
	const expected = Buffer.from(signature, "base64");
	const actual = createHmac("sha256", key).update(payload).digest();
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
/** @param value - candidate JSON value. @returns the positive integer it holds, or undefined. */
function numberOf(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : void 0;
}
/** @param value - candidate JSON value. @returns the non-empty string it holds, or undefined. */
function textOf$1(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}
/**
* Read a field published as a number today but rendered as text, such as
* `costMultiplier` (`"1.33"`).
* @param value - candidate JSON value.
* @returns its text, a finite number rendered as text, or undefined.
*/
function textish(value) {
	const text = textOf$1(value);
	if (text !== void 0) return text;
	return typeof value === "number" && Number.isFinite(value) ? String(value) : void 0;
}
/**
* Project one catalogue entry.
* @param model - entry as the release file records it.
* @returns the chat-route profile, or undefined when the entry is not one.
*/
function profileOf(model) {
	const id = textOf$1(model.id);
	if (id === void 0) return void 0;
	if (model.supportsTools === false) return void 0;
	const contextWindow = numberOf(model.maxInputTokens);
	if (contextWindow === void 0) return void 0;
	const maxTokens = Math.min(numberOf(model.maxOutputTokens) ?? DEFAULT_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
	const multiplier = textish(model.costMultiplier);
	return {
		id,
		name: multiplier === void 0 ? textOf$1(model.displayName) ?? id : `${textOf$1(model.displayName) ?? id} (x${multiplier})`,
		contextWindow,
		maxTokens,
		input: model.supportsImages === true ? ["text", "image"] : ["text"],
		...model.supportsReasoning === true ? REASONING_EFFORTS : { reasoningEfforts: false }
	};
}
/**
* Project one signed release file.
* @param body - parsed response body.
* @param key - HMAC key; empty leaves the signature unchecked.
* @returns the projected catalogue, or undefined when nothing usable came down.
*/
function projectTtSwitchCatalog(body, key = "") {
	if (typeof body !== "object" || body === null) return void 0;
	const envelope = body;
	const payloadText = textOf$1(envelope.payload);
	if (payloadText === void 0) return void 0;
	const verified = verifySignature(payloadText, typeof envelope.signature === "string" ? envelope.signature : "", key);
	if (verified === false) return void 0;
	let payload;
	try {
		payload = JSON.parse(Buffer.from(payloadText, "base64").toString("utf8"));
	} catch {
		return;
	}
	if (typeof payload !== "object" || payload === null) return void 0;
	const raw = payload.models;
	if (!Array.isArray(raw)) return void 0;
	const models = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of raw) {
		if (typeof entry !== "object" || entry === null) continue;
		const profile = profileOf(entry);
		if (profile === void 0 || seen.has(profile.id)) continue;
		seen.add(profile.id);
		models.push(profile);
	}
	if (models.length === 0) return void 0;
	const source = payload;
	const fallbacks = {};
	if (typeof source.modelFallbacks === "object" && source.modelFallbacks !== null) {
		for (const [from, to] of Object.entries(source.modelFallbacks)) if (typeof to === "string" && to !== "") fallbacks[from] = to;
	}
	return {
		models,
		revision: numberOf(source.revision),
		updatedAt: textOf$1(source.updatedAt),
		managedModelIds: Array.isArray(source.managedModelIds) ? source.managedModelIds.filter((id) => typeof id === "string") : [],
		modelFallbacks: fallbacks,
		signatureVerified: verified
	};
}
/**
* Read the signed catalogue.
* @param options.key - HMAC key; empty leaves the signature unchecked.
* @param options.fetchImpl - fetch implementation, injectable for tests.
* @returns the projected catalogue, or undefined when the read yielded none.
*/
async function fetchTtSwitchCatalog(options = {}) {
	try {
		const response = await (options.fetchImpl ?? fetch)(TT_SWITCH_CATALOG_URL, {
			method: "GET",
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(TT_SWITCH_TIMEOUT_MS)
		});
		if (!response.ok) return void 0;
		return projectTtSwitchCatalog(await response.json(), options.key ?? "");
	} catch {
		return;
	}
}
//#endregion
//#region src/tencent-request.ts
/** Tencent CodeBuddy request headers and Chat Completions normalization. */
/** Tencent CodeBuddy API base used by the verified TT Switch integration. */
const TENCENT_CODEBUDDY_BASE_URL = "https://copilot.tencent.com/v2";
/** Minimum output limit accepted by the CodeBuddy Chat Completions endpoint. */
const MIN_MAX_TOKENS = 100;
/** Stable request headers required by the CodeBuddy CLI route. */
const ROUTE_HEADERS = {
	"user-agent": "CLI/2.113.0 CodeBuddy/2.113.0 CLI/2.113.0 CodeBuddy/2.113.0",
	"x-codebuddy-request": "1",
	"x-agent-intent": "craft",
	"x-agent-purpose": "conversation",
	"x-private-data": "false",
	"x-ide-type": "CLI",
	"x-ide-name": "CLI",
	"x-ide-version": "2.113.0"
};
function compactUuid() {
	return randomUUID().replaceAll("-", "");
}
/** Header-safe stable identity for one Harness Session. */
function conversationId(sessionId) {
	const value = sessionId === void 0 ? compactUuid() : String(sessionId);
	if (/^[\x21-\x7E]+$/.test(value)) return value;
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
/**
* Build one request's fixed and dynamic CodeBuddy headers.
* @param options - frozen Harness request facts.
* @returns headers whose conversation id is stable per Session and whose request ids are fresh per call.
*/
function tencentRequestHeaders(options) {
	return {
		...ROUTE_HEADERS,
		"x-conversation-id": conversationId(options.sessionId),
		"x-conversation-request-id": compactUuid(),
		"x-request-id": compactUuid(),
		"x-conversation-message-id": compactUuid()
	};
}
function textOf(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.flatMap((part) => {
		if (typeof part !== "object" || part === null) return [];
		const text = part.text;
		return typeof text === "string" ? [text] : [];
	}).join("\n");
}
function userContentParts(message) {
	if (typeof message !== "object" || message === null || Array.isArray(message)) return void 0;
	const row = message;
	if (row.role !== "user") return void 0;
	if (typeof row.content === "string") return [{
		type: "text",
		text: row.content
	}];
	return Array.isArray(row.content) ? row.content : void 0;
}
function hasImagePart(parts) {
	return parts.some((part) => {
		if (typeof part !== "object" || part === null || Array.isArray(part)) return false;
		return part.type === "image_url";
	});
}
function mergeAdjacentImageUsers(messages) {
	const output = [];
	for (let index = 0; index < messages.length;) {
		const first = messages[index];
		const firstParts = userContentParts(first);
		if (firstParts === void 0) {
			output.push(first);
			index += 1;
			continue;
		}
		let end = index + 1;
		const parts = [...firstParts];
		let containsImage = hasImagePart(firstParts);
		while (end < messages.length) {
			const nextParts = userContentParts(messages[end]);
			if (nextParts === void 0) break;
			parts.push(...nextParts);
			containsImage ||= hasImagePart(nextParts);
			end += 1;
		}
		if (containsImage && end > index + 1) output.push({
			...first,
			content: parts
		});
		else output.push(...messages.slice(index, end));
		index = end;
	}
	return output;
}
function stripCacheControl(value) {
	if (Array.isArray(value)) return value.map(stripCacheControl);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "cache_control").map(([key, child]) => [key, stripCacheControl(child)]));
}
function toolName(tool) {
	if (typeof tool !== "object" || tool === null) return void 0;
	const row = tool;
	const candidate = row.function?.name ?? row.name;
	return typeof candidate === "string" ? candidate : void 0;
}
function forcedToolName(choice) {
	if (typeof choice !== "object" || choice === null) return void 0;
	const row = choice;
	if (row.type !== "function" && row.type !== "tool") return void 0;
	const candidate = row.type === "function" ? row.function?.name : row.name;
	if (typeof candidate !== "string" || candidate.trim() === "") throw new Error("tencent-codebuddy: named tool_choice is missing a tool name");
	return candidate;
}
function normalizeToolChoice(body) {
	const choice = body.tool_choice;
	if (choice === void 0) return;
	const forced = forcedToolName(choice);
	if (forced !== void 0) {
		if (!Array.isArray(body.tools)) throw new Error(`tencent-codebuddy: tool_choice forces "${forced}", but the request has no tools`);
		const matches = body.tools.filter((tool) => toolName(tool) === forced);
		if (matches.length !== 1) throw new Error(`tencent-codebuddy: tool_choice forces ${matches.length === 0 ? "unknown" : "ambiguous"} tool "${forced}"`);
		body.tools = matches;
	}
	if (typeof choice === "string") {
		if (choice === "any") body.tool_choice = "required";
		return;
	}
	if (typeof choice !== "object" || choice === null) {
		body.tool_choice = "auto";
		return;
	}
	const kind = choice.type;
	body.tool_choice = kind === "auto" || kind === "none" ? kind : "required";
}
/**
* Normalize a pi-ai Chat Completions payload for Tencent CodeBuddy.
* @param payload - provider payload produced by pi-ai.
* @returns a detached payload with the CodeBuddy message and option requirements applied.
*/
function normalizeTencentPayload(payload) {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new Error("tencent-codebuddy: pi-ai produced a non-object request payload");
	const cleaned = stripCacheControl(payload);
	const input = Array.isArray(cleaned.messages) ? cleaned.messages : [];
	const systemParts = [];
	const messages = [];
	for (const message of input) {
		if (typeof message !== "object" || message === null) {
			messages.push(message);
			continue;
		}
		const role = message.role;
		if (role === "system" || role === "developer") {
			const text = textOf(message.content).trim();
			if (text !== "") systemParts.push(text);
			continue;
		}
		messages.push(message);
	}
	const system = systemParts.length === 0 ? "You are a helpful assistant." : systemParts.join("\n\n");
	messages.unshift({
		role: "system",
		content: system
	});
	if (messages[1]?.role !== "user") messages.splice(1, 0, {
		role: "user",
		content: "Hello"
	});
	cleaned.messages = mergeAdjacentImageUsers(messages);
	cleaned.stream = true;
	cleaned.stream_options = { include_usage: true };
	const requested = typeof cleaned.max_tokens === "number" ? cleaned.max_tokens : typeof cleaned.max_completion_tokens === "number" ? cleaned.max_completion_tokens : void 0;
	if (requested !== void 0) cleaned.max_tokens = Math.max(MIN_MAX_TOKENS, requested);
	delete cleaned.max_completion_tokens;
	normalizeToolChoice(cleaned);
	return cleaned;
}
//#endregion
//#region src/index.ts
const name = "llm-tencent-codebuddy";
const inject = ["llm"];
/** Provider route exposed to Harness model selectors. */
const TENCENT_CODEBUDDY_PROVIDER = "tencent-internal";
/** Default Tencent internal model selected by this bundle's profile patch. */
const TENCENT_CODEBUDDY_MODEL = "hy3-ioa";
/** Credential reference written by the Settings → CodeBuddy page for this route. */
const TENCENT_CODEBUDDY_API_KEY = "TENCENT_CODEBUDDY_API_KEY";
const NS = "llm-tencent-codebuddy";
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** The reasoning-effort dict schema, mirroring pi-ai's own profile schema. */
const reasoningEfforts = z.dict(z.union([z.string(), z.const(null)]), z.union([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
]));
/** One catalog entry's schema, typed like the DeepSeek adapter's `catalogModel`. */
const modelProfile = z.object({
	id: z.string().required(),
	name: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	input: z.array(z.union(["text", "image"])),
	reasoningEfforts: z.union([z.const(false), reasoningEfforts]),
	compat: z.object({
		thinkingFormat: z.union([
			"openai",
			"deepseek",
			"openrouter",
			"together",
			"zai",
			"qwen",
			"string-thinking",
			"ant-ling"
		]),
		supportsReasoningEffort: z.boolean()
	})
});
/** Runtime schema for {@link Config}. */
const Config = z.object({
	apiKeyEnv: z.string().role("credential-ref").default(TENCENT_CODEBUDDY_API_KEY).volatile(),
	models: z.array(modelProfile).default([...TENCENT_CODEBUDDY_MODELS]).volatile(),
	catalogSignatureKey: z.string().default(""),
	timeoutMs: z.natural(),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
	retryPolicy: RetryPolicySchema
});
/**
* Read one config field, resolving the live reference a volatile schema field
* wraps. Programmatic configs (tests, direct installs) pass plain values.
* @param value - configured value, volatile or plain.
* @returns the underlying value.
*/
function valueOf(value) {
	const reference = value;
	return typeof reference === "object" && reference !== null && typeof reference.get === "function" ? reference.get() : value;
}
/**
* Detach every field of a config so a live edit is observable by identity.
* @param config - plugin config, volatile fields included.
* @returns one plain config.
*/
function snapshotOf(config) {
	return {
		apiKeyEnv: valueOf(config.apiKeyEnv),
		models: valueOf(config.models),
		catalogSignatureKey: valueOf(config.catalogSignatureKey),
		timeoutMs: valueOf(config.timeoutMs),
		streamIdleTimeoutMs: valueOf(config.streamIdleTimeoutMs),
		retryPolicy: valueOf(config.retryPolicy)
	};
}
/**
* Choose the catalog this route serves.
*
* A list the user edited by hand wins: it is the only source that carries an
* explicit decision about this machine. Beneath it sits the signed tt-switch
* release, which needs nothing from this machine — no credential, no desktop
* client — and is therefore the list the machine starts out with; beneath that,
* the catalog checked in here, so a machine the release file never reached
* still has an answer.
* @param configured - `models` from the current config snapshot.
* @param ttSwitch - the last successful signed read, when there is one.
* @returns the models to register.
*/
function effectiveCatalog(configured, ttSwitch) {
	if (configured !== void 0 && !deepEqualJson(configured, TENCENT_CODEBUDDY_MODELS)) return configured;
	return ttSwitch ?? TENCENT_CODEBUDDY_MODELS;
}
function profileFrom(config, models) {
	return resolveProfiles({ [TENCENT_CODEBUDDY_PROVIDER]: {
		apiKeyEnv: config.apiKeyEnv ?? "TENCENT_CODEBUDDY_API_KEY",
		displayName: "Tencent CodeBuddy",
		api: "openai-completions",
		baseURL: TENCENT_CODEBUDDY_BASE_URL,
		models,
		...config.timeoutMs === void 0 ? {} : { timeoutMs: config.timeoutMs },
		streamIdleTimeoutMs: config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
		...config.retryPolicy === void 0 ? {} : { retryPolicy: config.retryPolicy }
	} });
}
/**
* Register the Tencent route with its fixed catalog and key-only settings namespace.
* @param ctx - Cordis context carrying `llm` and optional `settings`/`credentials`.
* @param config - schema-normalized plugin config.
* @returns nothing; registration lives on the fiber.
*/
function apply(ctx, config) {
	let current = () => config;
	let cached;
	let syncRegistration;
	let ttSwitch;
	let ttSwitchAt = 0;
	let ttSwitchPending = false;
	let ttSwitchAnnounced;
	let announced;
	const refreshTtSwitch = async () => {
		if (ttSwitchPending || Date.now() - ttSwitchAt < 6e5) return;
		ttSwitchPending = true;
		try {
			const catalog = await fetchTtSwitchCatalog({ key: snapshotOf(current()).catalogSignatureKey ?? "" });
			if (catalog === void 0) return;
			ttSwitch = catalog.models;
			const line = `llm-tencent-codebuddy: tt-switch catalog ${`revision ${String(catalog.revision ?? "?")} (${String(catalog.updatedAt ?? "undated")}), ${String(catalog.models.length)} models, ${String(catalog.managedModelIds.length)} managed, ${String(Object.keys(catalog.modelFallbacks).length)} fallbacks`}, signature ${catalog.signatureVerified === void 0 ? "unchecked: no catalogSignatureKey configured" : "verified"}`;
			if (line !== ttSwitchAnnounced) {
				ttSwitchAnnounced = line;
				ctx.logger.info(line);
			}
		} catch {} finally {
			ttSwitchAt = Date.now();
			ttSwitchPending = false;
		}
	};
	const profiles = () => {
		refreshTtSwitch();
		const snapshot = snapshotOf(current());
		const models = effectiveCatalog(snapshot.models, ttSwitch);
		if (models !== announced) {
			announced = models;
			const source = models === TENCENT_CODEBUDDY_MODELS ? "the shipped catalog" : models === ttSwitch ? "the signed tt-switch release" : "the configured list";
			ctx.logger.info(`llm-tencent-codebuddy: ${String(models.length)} models from ${source}`);
		}
		const key = [
			snapshot.apiKeyEnv,
			models,
			snapshot.timeoutMs,
			snapshot.streamIdleTimeoutMs,
			snapshot.retryPolicy,
			snapshot.catalogSignatureKey
		];
		const hit = cached;
		if (hit !== void 0 && hit.key.every((value, index) => value === key[index])) return hit.profiles;
		const next = profileFrom(snapshot, models);
		cached = {
			key,
			profiles: next
		};
		syncRegistration?.();
		return next;
	};
	profiles();
	const resolveApiKey = async (_provider, profile) => {
		const ref = profile.apiKeyEnv ?? credentialRef("TENCENT_CODEBUDDY_API_KEY");
		const credentials = ctx.get("credentials");
		const value = credentials === void 0 ? launchEnvironmentOf(ctx).get(ref)?.value : (await credentials.resolve(ref))?.value;
		if (value !== void 0 && value.length > 0) return assertUsableApiKey(value, "llm-tencent-codebuddy", ref);
		throw new LlmError(`llm-tencent-codebuddy: no API key for provider route "${TENCENT_CODEBUDDY_PROVIDER}"; store ${ref} through the credentials service or export it in the launching environment`, "MISSING_CREDENTIAL");
	};
	const adapter = new PiAiAdapter({
		profiles,
		resolveApiKey,
		auth: {
			credentials: credentialStoreFrom(ctx),
			authContext: authContextFrom(ctx)
		},
		resolveAttachments: () => ctx.get("attachments"),
		prepareRequest: ({ options }) => ({
			headers: tencentRequestHeaders(options),
			onPayload: normalizeTencentPayload
		})
	});
	const registration = ctx.llm.registerAdapter([TENCENT_CODEBUDDY_PROVIDER], adapter);
	let registeredPolicy = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy;
	syncRegistration = () => {
		const next = profiles().get(TENCENT_CODEBUDDY_PROVIDER)?.retryPolicy;
		if (deepEqualJson(next, registeredPolicy)) return;
		registration.replace([TENCENT_CODEBUDDY_PROVIDER]);
		registeredPolicy = next;
	};
	ctx.inject(["settings"], (settingsCtx) => {
		const settings = settingsCtx.settings;
		if (typeof settings.installSection === "function") {
			settings.installSection(ctx, NS, Config, config, {
				setSource: (source) => {
					current = source;
				},
				onChange: () => syncRegistration?.()
			});
			return;
		}
		settingsCtx.effect(() => settings.configure({ auto: false }, ctx.fiber));
	});
}
//#endregion
export { Config, TENCENT_CODEBUDDY_API_KEY, TENCENT_CODEBUDDY_BASE_URL, TENCENT_CODEBUDDY_MODEL, TENCENT_CODEBUDDY_PROVIDER, apply, inject, name, normalizeTencentPayload, tencentRequestHeaders };
