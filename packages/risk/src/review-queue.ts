import { keccak256, stringToHex, type Hex } from "viem";
import { buildReviewQueueExplanation } from "./explanation.js";
import type { AiSuggestion, ReviewQueueItem } from "./types.js";

export function queueSuggestionForReview(suggestion: AiSuggestion, expiresInDays = 7): ReviewQueueItem | null {
  if (suggestion.recommendedAction !== "review") {
    return null;
  }
  const createdAt = suggestion.createdAt;
  return {
    reviewItemId: keccak256(stringToHex([suggestion.id, createdAt].join(":"))),
    identityId: suggestion.identityId,
    rootIdentityId: suggestion.rootIdentityId,
    subIdentityId: suggestion.subIdentityId,
    sourceSuggestionId: suggestion.id,
    status: "PENDING_REVIEW",
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    evidenceRefs: suggestion.evidenceRefs,
    explanation: buildReviewQueueExplanation({
      reviewItemId: keccak256(stringToHex([suggestion.id, createdAt].join(":"))),
      status: "PENDING_REVIEW",
      evidenceRefs: suggestion.evidenceRefs,
      sourceSuggestionId: suggestion.id,
    }),
  };
}

export function expireReviewQueue(queue: ReviewQueueItem[], now = new Date().toISOString()) {
  return queue.map((item) =>
    item.status === "PENDING_REVIEW" && item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(now)
      ? {
          ...item,
          status: "EXPIRED" as const,
          expiredAt: now,
          explanation: buildReviewQueueExplanation({
            reviewItemId: item.reviewItemId,
            status: "EXPIRED",
            evidenceRefs: item.evidenceRefs,
            sourceSuggestionId: item.sourceSuggestionId,
            reason: item.reason,
          }),
        }
      : item,
  );
}

export function confirmReviewItem(queue: ReviewQueueItem[], reviewItemId: string, actor: string, reason?: string) {
  return queue.map((item) =>
    item.reviewItemId === reviewItemId
      ? {
          ...item,
          status: "CONFIRMED_SIGNAL" as const,
          confirmedAt: new Date().toISOString(),
          confirmedBy: actor,
          reason,
          explanation: buildReviewQueueExplanation({
            reviewItemId: item.reviewItemId,
            status: "CONFIRMED_SIGNAL",
            evidenceRefs: item.evidenceRefs,
            sourceSuggestionId: item.sourceSuggestionId,
            reason,
            actor,
          }),
        }
      : item,
  );
}

export function dismissReviewItem(queue: ReviewQueueItem[], reviewItemId: string, actor: string, reason?: string) {
  return queue.map((item) =>
    item.reviewItemId === reviewItemId
      ? {
          ...item,
          status: "DISMISSED" as const,
          dismissedAt: new Date().toISOString(),
          dismissedBy: actor,
          reason,
          explanation: buildReviewQueueExplanation({
            reviewItemId: item.reviewItemId,
            status: "DISMISSED",
            evidenceRefs: item.evidenceRefs,
            sourceSuggestionId: item.sourceSuggestionId,
            reason,
            actor,
          }),
        }
      : item,
  );
}

export function getOpenReviewItems(queue: ReviewQueueItem[], identityId?: Hex) {
  return queue.filter((item) => item.status === "PENDING_REVIEW" && (!identityId || item.identityId === identityId));
}
