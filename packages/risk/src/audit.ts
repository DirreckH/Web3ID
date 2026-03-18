import { keccak256, stringToHex, type Hex } from "viem";
import type { AuditRecord, AuditAction } from "./types.js";

export function createAuditRecord(input: {
  identityId: Hex;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  action: AuditAction;
  actor: string;
  ruleIds?: string[];
  evidenceRefs?: string[];
  policyVersion?: number;
  registryVersion?: number;
  aiSuggestionId?: string;
  reviewItemId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}): AuditRecord {
  const timestamp = input.timestamp ?? new Date().toISOString();
  return {
    auditId: keccak256(stringToHex([input.identityId, input.action, timestamp, input.actor].join(":"))),
    identityId: input.identityId,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    action: input.action,
    timestamp,
    actor: input.actor,
    ruleIds: input.ruleIds ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    policyVersion: input.policyVersion,
    registryVersion: input.registryVersion,
    aiSuggestionId: input.aiSuggestionId,
    reviewItemId: input.reviewItemId,
    metadata: input.metadata,
  };
}

export function appendAudit(records: AuditRecord[], ...next: AuditRecord[]) {
  return [...records, ...next].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

export function filterAuditByIdentity(records: AuditRecord[], identityId: Hex) {
  return records.filter((record) => record.identityId === identityId || record.rootIdentityId === identityId);
}

export function exportAuditBundle(records: AuditRecord[], identityId: Hex) {
  const filtered = filterAuditByIdentity(records, identityId);
  return {
    identityId,
    generatedAt: new Date().toISOString(),
    count: filtered.length,
    records: filtered,
  };
}
