import cors from "cors";
import express, { type Express } from "express";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getAddress, type Hex } from "viem";
import { analyzerConfig } from "./config.js";
import { controllerProofEnvelopeSchema } from "../../../packages/identity/src/index.js";
import {
  applyManualListAction,
  applyManualRelease,
  backfillScan,
  consumeCrossChainMessage,
  confirmReview,
  createSubjectAggregate,
  createApprovalTicket,
  createBindingChallengeRecord,
  createCrossChainMessageRecord,
  createRecoveryCaseRecord,
  decideApprovalTicket,
  dismissReview,
  exportIdentityAudit,
  exportStructuredAudit,
  flushAnchorQueue,
  getIdentityEvents,
  getOperatorDashboard,
  getRiskContext,
  getSubjectAggregate,
  getRuntimeMetrics,
  getWatchStatus,
  ingestCrossChainMessage,
  initializeAnalyzerWatchers,
  diffIdentityReplay,
  listSubjectAggregateControllers,
  listSubjectAggregateRoots,
  listApprovalTickets,
  listCrossChainInbox,
  listRiskHistory,
  listRecoveryCases,
  listWebhookOutbox,
  listReviewQueue,
  manageWatchScan,
  recomputeIdentity,
  replayIdentity,
  appendRecoveryCaseEvidence,
  recordPolicyDecisionSnapshot,
  recordRecoveryCaseDecision,
  registerIdentityTree,
  submitBinding,
  executeRecoveryCase,
} from "./service.js";
import { IdentityState } from "../../../packages/state/src/index.js";

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => getAddress(value));
const stateSchema = z.nativeEnum(IdentityState);
const chainFamilySchema = z.enum(["evm", "solana", "bitcoin", "tron", "ton", "cosmos", "aptos", "sui"]);
const controllerProofTypeSchema = z.enum([
  "eip191",
  "solana_ed25519",
  "bitcoin_bip322",
  "bitcoin_legacy",
  "tron_signed_message_v2",
  "ton_proof_v2",
  "cosmos_adr036_direct",
  "cosmos_adr036_legacy_amino",
  "aptos_sign_message",
  "aptos_siwa",
  "sui_personal_message_ed25519",
  "sui_personal_message_secp256k1",
  "sui_personal_message_secp256r1",
]);
export const controllerRefSchema = z.object({
  chainFamily: chainFamilySchema,
  networkId: z.union([z.string().min(1), z.number().int().nonnegative()]),
  address: z.string().min(1),
  normalizedAddress: z.string().min(1).optional(),
  proofType: controllerProofTypeSchema.optional(),
  publicKeyHint: z.string().optional(),
  chainNamespace: z.string().optional(),
  bech32Prefix: z.string().optional(),
  chainId: z.union([z.number().int().nonnegative(), z.string().min(1)]).optional(),
  walletStateInit: z.string().optional(),
  workchain: z.number().int().optional(),
  signatureScheme: z.enum(["ed25519", "secp256k1", "secp256r1"]).optional(),
  capabilityFlags: z.object({
    supportsAddressRecovery: z.boolean(),
    requiresPublicKeyHint: z.boolean(),
    supportsOfflineVerification: z.boolean(),
    supportsRpcFallback: z.boolean(),
    supportsStructuredProofPayload: z.boolean(),
    reservedMultiSig: z.boolean(),
  }).optional(),
  didLikeId: z.string().optional(),
  controllerVersion: z.string().optional(),
});

const registerTreeRequestSchema = z.object({
  rootIdentity: z.object({
    rootId: hex32Schema,
    identityId: hex32Schema,
    controllerAddress: addressSchema.optional(),
    legacyControllerAddress: addressSchema.optional(),
    didLikeId: z.string(),
    chainId: z.number().int().positive().optional(),
    primaryControllerRef: controllerRefSchema.extend({
      normalizedAddress: z.string().min(1),
      proofType: controllerProofTypeSchema,
      didLikeId: z.string(),
      controllerVersion: z.string(),
    }),
    subjectAggregateId: z.string().optional(),
    schemaVersion: z.string().optional(),
    createdAt: z.string(),
    guardianSetRef: z.string().optional(),
    recoveryPolicySlotId: z.string().optional(),
    capabilities: z.object({
      supportsHolderBinding: z.boolean(),
      supportsIssuerValidation: z.boolean(),
      hasLinkedCredentials: z.boolean(),
      supportedProofKinds: z.array(z.string()),
      preferredMode: z.string(),
    }),
  }),
  subIdentities: z.array(z.object({
    subIdentityId: hex32Schema,
    identityId: hex32Schema,
    rootId: hex32Schema,
    rootIdentityId: hex32Schema,
    scope: z.string(),
    type: z.string(),
    createdAt: z.string(),
    permissions: z.object({
      allowedCredentialTypes: z.array(hex32Schema),
      allowedProofTypes: z.array(z.string()),
      supportedProofKinds: z.array(z.string()),
      allowRootLink: z.boolean(),
      riskIsolationLevel: z.string(),
      linkabilityLevel: z.string(),
      canEscalateToRoot: z.boolean(),
      inheritsRootRestrictions: z.boolean(),
    }),
    capabilities: z.object({
      supportsHolderBinding: z.boolean(),
      supportsIssuerValidation: z.boolean(),
      hasLinkedCredentials: z.boolean(),
      supportedProofKinds: z.array(z.string()),
      preferredMode: z.string(),
    }),
  })),
});

export const bindingChallengeSchema = z.object({
  bindingType: z.enum(["root_controller", "sub_identity_link", "same_root_extension", "subject_aggregate_link"]),
  controllerRef: controllerRefSchema.optional(),
  candidateAddress: addressSchema.optional(),
  rootIdentityId: hex32Schema.optional(),
  subIdentityId: hex32Schema.optional(),
  subjectAggregateId: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.controllerRef && !value.candidateAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either controllerRef or candidateAddress is required.",
      path: ["controllerRef"],
    });
  }
  if (value.bindingType === "sub_identity_link" && (!value.rootIdentityId || !value.subIdentityId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "sub_identity_link requires both rootIdentityId and subIdentityId.",
      path: ["subIdentityId"],
    });
  }
  if (value.bindingType === "same_root_extension" && !value.rootIdentityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "same_root_extension requires rootIdentityId.",
      path: ["rootIdentityId"],
    });
  }
  if (value.bindingType === "subject_aggregate_link" && !value.subjectAggregateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "subject_aggregate_link requires subjectAggregateId.",
      path: ["subjectAggregateId"],
    });
  }
});

export const submitBindingSchema = z.object({
  challengeId: z.string().min(1),
  candidateSignature: z.string().min(1).optional(),
  candidateProof: controllerProofEnvelopeSchema.optional(),
  linkProof: z.object({
    proofType: z.literal("SUB_IDENTITY_LINK_V1"),
    rootIdentityId: hex32Schema,
    subIdentityId: hex32Schema,
    scope: z.string(),
    subIdentityType: z.string(),
    commitment: hex32Schema,
  }).optional(),
  sameRootProof: z.object({
    proofType: z.literal("SAME_ROOT_V1"),
    rootCommitment: hex32Schema,
    subIdentityIds: z.array(hex32Schema),
    commitment: hex32Schema,
  }).optional(),
  authorizerAddress: addressSchema.optional(),
  authorizerSignature: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.candidateSignature && !value.candidateProof) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either candidateSignature or candidateProof is required.",
      path: ["candidateSignature"],
    });
  }
});
const createSubjectAggregateSchema = z.object({
  subjectAggregateId: z.string().optional(),
  actor: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  auditBundleRef: z.string().optional(),
  status: z.enum(["ACTIVE", "REVIEW_REQUIRED", "SUSPENDED"]).optional(),
});

const scanRequestSchema = z.object({
  rootIdentityId: hex32Schema.optional(),
  identityId: hex32Schema.optional(),
  fromBlock: z.coerce.bigint().optional(),
  toBlock: z.coerce.bigint().optional(),
  recentBlocks: z.number().int().positive().optional(),
});
const watchScanRequestSchema = scanRequestSchema.extend({
  action: z.enum(["refresh", "start", "stop"]).optional(),
  pollIntervalMs: z.number().int().positive().optional(),
});

const manualListSchema = z.object({
  identityId: hex32Schema,
  rootIdentityId: hex32Schema,
  subIdentityId: hex32Schema.optional(),
  listName: z.enum(["watchlist", "restricted_list", "blacklist_or_frozen_list"]),
  actor: z.string().min(1),
  action: z.enum(["add", "remove"]),
  reasonCode: z.string().min(1),
  evidenceRefs: z.array(z.string()).min(1),
  expiresAt: z.string().optional(),
});

const reviewConfirmSchema = z.object({
  actor: z.string().min(1),
  requestedState: stateSchema.optional(),
  reasonCode: z.string().optional(),
  note: z.string().optional(),
});
const reviewDismissSchema = z.object({ actor: z.string().min(1), reason: z.string().optional() });
const manualReleaseSchema = z.object({
  identityId: hex32Schema,
  actor: z.string().min(1),
  reasonCode: z.string().min(1),
  evidenceRefs: z.array(z.string()).min(1),
  note: z.string().optional(),
});
const recomputeSchema = z.object({ identityId: hex32Schema });
const anchorFlushSchema = z.object({ identityId: hex32Schema.optional() });
const auditExportSchema = z.object({
  identityId: hex32Schema.optional(),
  rootIdentityId: hex32Schema.optional(),
  subIdentityId: hex32Schema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  policyId: z.string().optional(),
  policyKind: z.enum(["access", "warning"]).optional(),
});
const listHistorySchema = z.object({
  identityId: hex32Schema.optional(),
  rootIdentityId: hex32Schema.optional(),
  subIdentityId: hex32Schema.optional(),
  listName: z.enum(["watchlist", "restricted_list", "blacklist_or_frozen_list"]).optional(),
  action: z.enum(["auto_added", "manually_added", "removed", "expired"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
const policyDecisionSnapshotSchema = z.object({
  kind: z.enum(["access", "warning"]),
  identityId: hex32Schema,
  rootIdentityId: hex32Schema,
  subIdentityId: hex32Schema.optional(),
  policyId: z.string().min(1),
  policyLabel: z.string().min(1),
  policyVersion: z.number().int().positive(),
  modePath: z.enum(["DEFAULT_BEHAVIOR_MODE", "COMPLIANCE_MODE", "UNRESOLVED"]),
  decision: z.enum(["allow", "restrict", "deny", "info", "warn", "high_warn"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  auditRecordIds: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
});
const versionEnvelopeSchema = z.object({
  schemaVersion: z.string(),
  systemModelVersion: z.string(),
  explanationSchemaVersion: z.string(),
  policyVersion: z.number().int().positive().optional(),
  registryVersion: z.number().int().positive().optional(),
  auditBundleVersion: z.string().optional(),
});
const recoveryCaseSchema = z.object({
  rootIdentityId: hex32Schema,
  targetIdentityId: hex32Schema.optional(),
  targetSubIdentityId: hex32Schema.optional(),
  action: z.enum(["rebind", "capability_restore", "consequence_release", "access_path_unlock"]),
  requestedBy: z.string().min(1),
  scope: z.enum(["selected_sub_identity", "capability", "consequence", "access_path"]),
  breakGlassAction: z.enum(["queue_unblock", "temporary_release", "consequence_rollback"]).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const recoveryEvidenceSchema = z.object({
  actor: z.string().min(1),
  actorRole: z.enum(["requester", "guardian", "operator", "governance_reviewer", "auditor"]),
  kind: z.enum(["binding_proof", "guardian_attestation", "policy_basis", "audit_ref", "manual_note"]),
  summary: z.string().min(1),
  evidenceRefs: z.array(z.string()).min(1),
  idempotencyKey: z.string().min(1).optional(),
});
const recoveryDecisionSchema = z.object({
  actor: z.string().min(1),
  actorRole: z.enum(["guardian", "operator", "governance_reviewer", "auditor"]),
  outcome: z.enum(["approved", "rejected", "revoked"]),
  reasonCode: z.string().min(1),
  explanation: z.string().min(1),
  evidenceRefs: z.array(z.string()).min(1),
  idempotencyKey: z.string().min(1).optional(),
});
const recoveryExecutionSchema = z.object({
  actor: z.string().min(1),
  action: z.enum(["rebind", "capability_restore", "consequence_release", "access_path_unlock"]),
  breakGlassAction: z.enum(["queue_unblock", "temporary_release", "consequence_rollback"]).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const approvalTicketSchema = z.object({
  action: z.enum(["recovery_execution", "break_glass", "positive_uplift", "policy_exception", "cross_chain_consume"]),
  rootIdentityId: hex32Schema,
  identityId: hex32Schema.optional(),
  requiredRoles: z.array(z.enum(["viewer", "analyst", "operator", "recovery_operator", "governance_reviewer", "auditor", "admin"])).min(1),
  requiredApprovals: z.number().int().positive(),
  reasonCode: z.string().min(1),
  explanation: z.string().min(1),
  beforeSnapshot: z.record(z.unknown()).optional(),
  afterSnapshot: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const approvalDecisionSchema = z.object({
  actor: z.string().min(1),
  decision: z.enum(["approve", "reject", "cancel"]),
  idempotencyKey: z.string().min(1).optional(),
});
const crossChainMessageSchema = z.object({
  messageId: z.string().min(1),
  sourceChainId: z.number().int().positive(),
  targetChainId: z.number().int().positive(),
  rootIdentityId: hex32Schema,
  subIdentityId: hex32Schema.optional(),
  snapshotRef: z.string().min(1),
  commitmentRef: z.string().min(1).optional(),
  messageType: z.enum(["state_sync", "freeze_notice", "restriction_notice"]),
  payloadHash: z.string().min(1),
  createdAt: z.string(),
  guardrails: z.object({
    defaultMode: z.literal("default_off"),
    lifecycle: z.literal("hook_only"),
    safety: z.literal("mock_safe"),
    writesState: z.literal(false),
    policyFactSource: z.literal(false),
  }),
  versionEnvelope: versionEnvelopeSchema,
  sourceDomain: z.string().min(1),
  targetDomain: z.string().min(1),
  snapshotDigest: z.string().min(1),
  attestor: z.string().min(1),
  trustProfile: z.enum(["local_demo", "attested_sync"]),
  attestationIssuedAt: z.string(),
  attestationExpiresAt: z.string().optional(),
  attestationProof: z.string().min(1),
  ttlSeconds: z.number().int().positive(),
  expiresAt: z.string().optional(),
  replayProtectionKey: z.string().min(1),
  consumerPolicyHint: z.enum(["warning_hint", "review_trigger", "risk_hint", "eligibility_signal"]),
});
const crossChainCreateSchema = z.object({
  identityId: hex32Schema,
  targetChainId: z.number().int().positive(),
  sourceDomain: z.string().min(1).optional(),
  targetDomain: z.string().min(1).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  consumerPolicyHint: z.enum(["warning_hint", "review_trigger", "risk_hint", "eligibility_signal"]).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const crossChainIngestSchema = z.object({
  message: crossChainMessageSchema,
  idempotencyKey: z.string().min(1).optional(),
});
const crossChainConsumeSchema = z.object({
  actor: z.string().min(1),
  effect: z.enum(["hint_recorded", "review_recommended", "eligibility_noted"]).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const replaySchema = z.object({
  identityId: hex32Schema,
  asOf: z.string().optional(),
});
const diffSchema = z.object({
  identityId: hex32Schema,
  from: z.string(),
  to: z.string(),
});

export const app: Express = express();
app.set("json replacer", (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, port: analyzerConfig.port, rpcUrl: analyzerConfig.rpcUrl, stateRegistryAddress: analyzerConfig.stateRegistryAddress });
});

app.post("/identities/register-tree", async (req, res) => {
  try { res.json(await registerIdentityTree(registerTreeRequestSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/bindings/challenge", async (req, res) => {
  try { res.json(await createBindingChallengeRecord(bindingChallengeSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/bindings", async (req, res) => {
  try { res.json(await submitBinding(submitBindingSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/subject-aggregates", async (req, res) => {
  try { res.json(await createSubjectAggregate(createSubjectAggregateSchema.parse(req.body ?? {}) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/subject-aggregates/:id", async (req, res) => {
  try { res.json(await getSubjectAggregate(req.params.id)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/subject-aggregates/:id/roots", async (req, res) => {
  try { res.json({ items: await listSubjectAggregateRoots(req.params.id) }); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/subject-aggregates/:id/controllers", async (req, res) => {
  try { res.json({ items: await listSubjectAggregateControllers(req.params.id) }); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/scan/backfill", async (req, res) => {
  try { res.json(await backfillScan(scanRequestSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/scan/watch", async (req, res) => {
  try { res.json(await manageWatchScan(watchScanRequestSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/scan/watch/status", async (req, res) => {
  try {
    res.json(await getWatchStatus({
      identityId: typeof req.query.identityId === "string" ? (req.query.identityId as Hex) : undefined,
      rootIdentityId: typeof req.query.rootIdentityId === "string" ? (req.query.rootIdentityId as Hex) : undefined,
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" });
  }
});
app.get("/identities/:id/risk-context", async (req, res) => {
  try { res.json(await getRiskContext(req.params.id as Hex)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/identities/:id/events", async (req, res) => {
  try { res.json({ items: await getIdentityEvents(req.params.id as Hex) }); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/identities/:id/audit/export", async (req, res) => {
  try { res.json(await exportIdentityAudit(req.params.id as Hex)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/audit/export", async (req, res) => {
  try { res.json(await exportStructuredAudit(auditExportSchema.parse(req.body ?? {}) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/identities/:id/recompute", async (req, res) => {
  try {
    const body = recomputeSchema.parse({ identityId: req.params.id });
    res.json(await recomputeIdentity(body as any));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/lists/manual", async (req, res) => {
  try { res.json(await applyManualListAction(manualListSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/lists/history", async (req, res) => {
  try {
    res.json({
      items: await listRiskHistory(listHistorySchema.parse({
        identityId: typeof req.query.identityId === "string" ? req.query.identityId : undefined,
        rootIdentityId: typeof req.query.rootIdentityId === "string" ? req.query.rootIdentityId : undefined,
        subIdentityId: typeof req.query.subIdentityId === "string" ? req.query.subIdentityId : undefined,
        listName: typeof req.query.listName === "string" ? req.query.listName : undefined,
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      }) as any),
    });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/review-queue", async (req, res) => {
  try { res.json({ items: await listReviewQueue(req.query.identityId as Hex | undefined) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/review-queue/:id/confirm", async (req, res) => {
  try { res.json(await confirmReview(req.params.id, reviewConfirmSchema.parse(req.body))); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/review-queue/:id/dismiss", async (req, res) => {
  try {
    const body = reviewDismissSchema.parse(req.body);
    res.json(await dismissReview(req.params.id, body.actor, body.reason));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/manual-release", async (req, res) => {
  try { res.json(await applyManualRelease(manualReleaseSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/anchors/flush", async (req, res) => {
  try { res.json(await flushAnchorQueue(anchorFlushSchema.parse(req.body ?? {}) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/operator/dashboard", async (_req, res) => {
  try { res.json(await getOperatorDashboard()); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/recovery/cases", async (req, res) => {
  try {
    res.json({
      items: await listRecoveryCases({
        rootIdentityId: typeof req.query.rootIdentityId === "string" ? (req.query.rootIdentityId as Hex) : undefined,
        identityId: typeof req.query.identityId === "string" ? (req.query.identityId as Hex) : undefined,
      }),
    });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/recovery/cases", async (req, res) => {
  try { res.json(await createRecoveryCaseRecord(recoveryCaseSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/recovery/cases/:id/evidence", async (req, res) => {
  try { res.json(await appendRecoveryCaseEvidence({ caseId: req.params.id, ...recoveryEvidenceSchema.parse(req.body) } as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/recovery/cases/:id/decision", async (req, res) => {
  try { res.json(await recordRecoveryCaseDecision({ caseId: req.params.id, ...recoveryDecisionSchema.parse(req.body) } as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/recovery/cases/:id/execute", async (req, res) => {
  try { res.json(await executeRecoveryCase({ caseId: req.params.id, ...recoveryExecutionSchema.parse(req.body) } as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/approvals", async (req, res) => {
  try {
    res.json({
      items: await listApprovalTickets({
        rootIdentityId: typeof req.query.rootIdentityId === "string" ? (req.query.rootIdentityId as Hex) : undefined,
        identityId: typeof req.query.identityId === "string" ? (req.query.identityId as Hex) : undefined,
      }),
    });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/approvals", async (req, res) => {
  try { res.json(await createApprovalTicket(approvalTicketSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/approvals/:id/decision", async (req, res) => {
  try { res.json(await decideApprovalTicket({ ticketId: req.params.id, ...approvalDecisionSchema.parse(req.body) } as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/cross-chain/messages/create", async (req, res) => {
  try { res.json(await createCrossChainMessageRecord(crossChainCreateSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/cross-chain/inbox/ingest", async (req, res) => {
  try { res.json(await ingestCrossChainMessage(crossChainIngestSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/cross-chain/inbox", async (req, res) => {
  try {
    res.json({
      items: await listCrossChainInbox({
        rootIdentityId: typeof req.query.rootIdentityId === "string" ? (req.query.rootIdentityId as Hex) : undefined,
        identityId: typeof req.query.identityId === "string" ? (req.query.identityId as Hex) : undefined,
      }),
    });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/cross-chain/inbox/:id/consume", async (req, res) => {
  try { res.json(await consumeCrossChainMessage({ inboxId: req.params.id, ...crossChainConsumeSchema.parse(req.body) } as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/metrics", async (_req, res) => {
  try { res.json(await getRuntimeMetrics()); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.get("/webhooks/outbox", async (_req, res) => {
  try { res.json({ items: await listWebhookOutbox() }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/replay", async (req, res) => {
  try { res.json(await replayIdentity(replaySchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/diff", async (req, res) => {
  try { res.json(await diffIdentityReplay(diffSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});
app.post("/policy-decisions", async (req, res) => {
  try { res.json(await recordPolicyDecisionSnapshot(policyDecisionSnapshotSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown analyzer error" }); }
});

export async function startAnalyzerServer() {
  const server = app.listen(analyzerConfig.port, () => {
    console.log(`Web3ID analyzer service listening on http://127.0.0.1:${analyzerConfig.port}`);
  });

  await initializeAnalyzerWatchers().catch((error) => {
    console.error("Failed to initialize analyzer watchers", error);
  });

  return server;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entrypoint && import.meta.url === entrypoint) {
  void startAnalyzerServer();
}

