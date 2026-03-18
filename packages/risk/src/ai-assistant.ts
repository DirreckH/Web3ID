import type { AiSuggestion, RiskSignal, RiskSummary } from "./types.js";
import { keccak256, stringToHex } from "viem";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const EXPLAINER_PROMPT_VERSION = "risk-explainer.v1";
const ANOMALY_PROMPT_VERSION = "anomaly-hint.v1";

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

  suggestions.push({
    id: keccak256(stringToHex([input.identityId, "explanation", now, ...input.summary.reasonCodes].join(":"))),
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    kind: "explanation",
    severity: input.summary.effectiveState >= 4 ? "high" : input.summary.effectiveState >= 3 ? "medium" : "low",
    summary: `Stored state is ${input.summary.storedState}, effective state is ${input.summary.effectiveState}. Key reasons: ${input.summary.reasonCodes.join(", ") || "none"}.`,
    evidenceRefs: input.summary.evidenceRefs,
    recommendedAction: "warn_only",
    modelInfo: {
      provider: "deterministic",
      model: "fallback-template",
      promptVersion: EXPLAINER_PROMPT_VERSION,
    },
    createdAt: now,
  });

  if (topNegative) {
    suggestions.push({
      id: keccak256(stringToHex([input.identityId, "risk_hint", topNegative.signalId, topNegative.ruleId].join(":"))),
      identityId: input.identityId,
      rootIdentityId: input.rootIdentityId,
      subIdentityId: input.subIdentityId,
      kind: "risk_hint",
      severity: topNegative.severity === "critical" || topNegative.severity === "high" ? "high" : "medium",
      summary: `Recent negative activity matched ${topNegative.ruleId} and should be monitored.`,
      evidenceRefs: topNegative.evidenceRefs,
      recommendedAction: topNegative.severity === "critical" || topNegative.severity === "high" ? "review" : "watch",
      modelInfo: {
        provider: "deterministic",
        model: "fallback-template",
        promptVersion: ANOMALY_PROMPT_VERSION,
      },
      createdAt: now,
      metadata: {
        sourceSignalId: topNegative.signalId,
      },
    });
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
            "You are an AI risk assistant for Web3ID. Only output JSON with an array named suggestions. Each suggestion must include kind, severity, summary, evidenceRefs, and recommendedAction. recommendedAction may only be watch, review, or warn_only.",
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
      recommendedAction?: AiSuggestion["recommendedAction"];
    }>;
  };

  return (parsed.suggestions ?? []).map((item) => ({
    id: keccak256(stringToHex([input.identityId, item.kind, item.summary, ...(item.evidenceRefs ?? [])].join(":"))),
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    kind: item.kind,
    severity: item.severity,
    summary: item.summary,
    evidenceRefs: item.evidenceRefs,
    recommendedAction: item.recommendedAction,
    modelInfo: {
      provider: "openai",
      model: input.model ?? DEFAULT_MODEL,
      promptVersion: `${EXPLAINER_PROMPT_VERSION}+${ANOMALY_PROMPT_VERSION}`,
    },
    createdAt: now,
  }));
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
