import { keccak256, stringToHex, type Hex } from "viem";
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
  };
}

export function expireReviewQueue(queue: ReviewQueueItem[], now = new Date().toISOString()) {
  return queue.map((item) =>
    item.status === "PENDING_REVIEW" && item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(now)
      ? { ...item, status: "EXPIRED" as const, expiredAt: now }
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
        }
      : item,
  );
}

export function getOpenReviewItems(queue: ReviewQueueItem[], identityId?: Hex) {
  return queue.filter((item) => item.status === "PENDING_REVIEW" && (!identityId || item.identityId === identityId));
}
