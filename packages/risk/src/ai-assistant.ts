import type { AiRecommendedAction, AiSuggestion, RiskSignal, RiskSummary } from "./types.js";
import { keccak256, stringToHex, type Hex } from "viem";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DEFAULT_MODEL_VERSION = process.env.OPENAI_MODEL_VERSION ?? "baseline";
const EXPLAINER_PROMPT_VERSION = "risk-explainer.v1";
const ANOMALY_PROMPT_VERSION = "anomaly-hint.v1";
export const ALLOWED_AI_RECOMMENDED_ACTIONS = ["watch", "review", "warn_only"] as const;

function clampConfidence(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeRecommendedAction(action: string | undefined): AiRecommendedAction {
  if (ALLOWED_AI_RECOMMENDED_ACTIONS.includes((action ?? "warn_only") as AiRecommendedAction)) {
    return (action ?? "warn_only") as AiRecommendedAction;
  }
  return "warn_only";
}

function computeAiInputHash(input: { summary: RiskSummary; signals: RiskSignal[] }) {
  return keccak256(
    stringToHex(
      JSON.stringify({
        summary: input.summary,
        signals: input.signals.slice(-10).map((signal) => ({
          signalId: signal.signalId,
          reasonCode: signal.reasonCode,
          severity: signal.severity,
          evidenceRefs: signal.evidenceRefs,
        })),
      }),
    ),
  );
}

export function assertAiSuggestionBoundary(suggestion: AiSuggestion) {
  if (!ALLOWED_AI_RECOMMENDED_ACTIONS.includes((suggestion.recommendedAction ?? "warn_only") as AiRecommendedAction)) {
    throw new Error(`Unsupported AI recommended action: ${suggestion.recommendedAction}`);
  }
  if (suggestion.audit.recommendedAction !== (suggestion.recommendedAction ?? "warn_only")) {
    throw new Error(`AI suggestion ${suggestion.id} has mismatched audit metadata.`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(suggestion.audit.inputHash)) {
    throw new Error(`AI suggestion ${suggestion.id} is missing a valid input hash.`);
  }
  if (suggestion.audit.confidence < 0 || suggestion.audit.confidence > 1) {
    throw new Error(`AI suggestion ${suggestion.id} has an invalid confidence score.`);
  }
}

export function normalizeAiSuggestion(input: {
  id: string;
  identityId: `0x${string}`;
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  kind: AiSuggestion["kind"];
  severity: AiSuggestion["severity"];
  summary: string;
  evidenceRefs: string[];
  recommendedAction?: string;
  createdAt: string;
  audit?: Partial<AiSuggestion["audit"]>;
  modelInfo?: AiSuggestion["modelInfo"];
  metadata?: Record<string, unknown>;
}) {
  const recommendedAction = normalizeRecommendedAction(input.recommendedAction ?? input.audit?.recommendedAction);
  const normalized: AiSuggestion = {
    id: input.id,
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    kind: input.kind,
    severity: input.severity,
    summary: input.summary,
    evidenceRefs: input.evidenceRefs,
    recommendedAction,
    audit: {
      provider: input.audit?.provider ?? input.modelInfo?.provider ?? "unknown",
      model: input.audit?.model ?? input.modelInfo?.model ?? "unknown",
      modelVersion: input.audit?.modelVersion ?? input.modelInfo?.model ?? DEFAULT_MODEL_VERSION,
      promptVersion: input.audit?.promptVersion ?? input.modelInfo?.promptVersion ?? EXPLAINER_PROMPT_VERSION,
      inputHash:
        input.audit?.inputHash ??
        (keccak256(stringToHex([input.id, input.summary, ...input.evidenceRefs].join(":"))) as Hex),
      evidenceRefs: input.audit?.evidenceRefs ?? input.evidenceRefs,
      outputSummary: input.audit?.outputSummary ?? input.summary,
      confidence: clampConfidence(input.audit?.confidence, 0.5),
      recommendedAction,
    },
    modelInfo: input.modelInfo,
    createdAt: input.createdAt,
    metadata: input.metadata,
  };

  assertAiSuggestionBoundary(normalized);
  return normalized;
}

function deterministicSuggestions(input: {
  identityId: `0x${string}`;
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  summary: RiskSummary;
  signals: RiskSignal[];
  now?: string;
}): AiSuggestion[] {
  const now = input.now ?? new Date().toISOString();
  const suggestions: AiSuggestion[] = [];
  const negativeSignals = input.signals.filter((signal) => signal.category === "negative");
  const topNegative = negativeSignals.sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0];
  const inputHash = computeAiInputHash({ summary: input.summary, signals: input.signals });

  suggestions.push(
    normalizeAiSuggestion({
      id: keccak256(stringToHex([input.identityId, "explanation", now, ...input.summary.reasonCodes].join(":"))),
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      kind: "explanation",
      severity: input.summary.effectiveState >= 4 ? "high" : input.summary.effectiveState >= 3 ? "medium" : "low",
      summary: `Stored state is ${input.summary.storedState}, effective state is ${input.summary.effectiveState}. Key reasons: ${input.summary.reasonCodes.join(", ") || "none"}.`,
      evidenceRefs: input.summary.evidenceRefs,
      recommendedAction: "warn_only",
      createdAt: now,
        audit: {
          provider: "deterministic",
          model: "fallback-template",
          modelVersion: "deterministic-v1",
          promptVersion: EXPLAINER_PROMPT_VERSION,
          inputHash,
          evidenceRefs: input.summary.evidenceRefs,
          outputSummary: `Stored state is ${input.summary.storedState}, effective state is ${input.summary.effectiveState}.`,
          confidence: 0.55,
          recommendedAction: "warn_only",
        },
      metadata: {
        boundary: "offchain-suggestion",
      },
    }),
  );

  if (topNegative) {
    suggestions.push(
      normalizeAiSuggestion({
        id: keccak256(stringToHex([input.identityId, "risk_hint", topNegative.signalId, topNegative.ruleId].join(":"))),
        identityId: input.identityId,
        rootIdentityId: input.rootIdentityId,
        subIdentityId: input.subIdentityId,
        kind: "risk_hint",
        severity: topNegative.severity === "critical" || topNegative.severity === "high" ? "high" : "medium",
        summary: `Recent negative activity matched ${topNegative.ruleId} and should be monitored.`,
        evidenceRefs: topNegative.evidenceRefs,
        recommendedAction: topNegative.severity === "critical" || topNegative.severity === "high" ? "review" : "watch",
        createdAt: now,
        audit: {
          provider: "deterministic",
          model: "fallback-template",
          modelVersion: "deterministic-v1",
          promptVersion: ANOMALY_PROMPT_VERSION,
          inputHash,
          evidenceRefs: topNegative.evidenceRefs,
          outputSummary: `Recent negative activity matched ${topNegative.ruleId}.`,
          confidence: topNegative.severity === "critical" || topNegative.severity === "high" ? 0.82 : 0.68,
          recommendedAction: topNegative.severity === "critical" || topNegative.severity === "high" ? "review" : "watch",
        },
        metadata: {
          sourceSignalId: topNegative.signalId,
          boundary: "offchain-suggestion",
        },
      }),
    );
  }

  return suggestions;
}

async function openAiSuggestions(input: {
  identityId: `0x${string}`;
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  summary: RiskSummary;
  signals: RiskSignal[];
  apiKey: string;
  model?: string;
  now?: string;
}): Promise<AiSuggestion[]> {
  const now = input.now ?? new Date().toISOString();
  const inputHash = computeAiInputHash({ summary: input.summary, signals: input.signals });
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model ?? DEFAULT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an AI risk assistant for Web3ID. Only output JSON with an array named suggestions. Each suggestion must include kind, severity, summary, evidenceRefs, recommendedAction, and confidence. recommendedAction may only be watch, review, or warn_only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            summary: input.summary,
            signals: input.signals.slice(-10),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return deterministicSuggestions(input);
  }

  const parsed = JSON.parse(content) as {
    suggestions?: Array<{
      kind: AiSuggestion["kind"];
      severity: AiSuggestion["severity"];
      summary: string;
      evidenceRefs: string[];
      recommendedAction?: string;
      confidence?: number;
    }>;
  };

  return (parsed.suggestions ?? []).map((item) =>
    normalizeAiSuggestion({
      id: keccak256(stringToHex([input.identityId, item.kind, item.summary, ...(item.evidenceRefs ?? [])].join(":"))),
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      kind: item.kind,
      severity: item.severity,
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      recommendedAction: item.recommendedAction,
      createdAt: now,
      audit: {
        provider: "openai",
        model: input.model ?? DEFAULT_MODEL,
        modelVersion: input.model ?? DEFAULT_MODEL,
        promptVersion: `${EXPLAINER_PROMPT_VERSION}+${ANOMALY_PROMPT_VERSION}`,
        inputHash,
        evidenceRefs: item.evidenceRefs,
        outputSummary: item.summary,
        confidence: clampConfidence(item.confidence, 0.7),
        recommendedAction: normalizeRecommendedAction(item.recommendedAction),
      },
      metadata: {
        boundary: "offchain-suggestion",
      },
    }),
  );
}

export async function generateAiSuggestions(input: {
  identityId: `0x${string}`;
  rootIdentityId: `0x${string}`;
  subIdentityId?: `0x${string}`;
  summary: RiskSummary;
  signals: RiskSignal[];
  apiKey?: string;
  model?: string;
  now?: string;
}): Promise<AiSuggestion[]> {
  try {
    if (input.apiKey) {
      return await openAiSuggestions(input as Parameters<typeof openAiSuggestions>[0]);
    }
  } catch {
    // Fall back to deterministic output for local demos and tests.
  }
  return deterministicSuggestions(input);
}
