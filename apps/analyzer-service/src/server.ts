import cors from "cors";
import express from "express";
import { z } from "zod";
import { getAddress, type Hex } from "viem";
import { analyzerConfig } from "./config.js";
import {
  applyManualListAction,
  applyManualRelease,
  backfillScan,
  confirmReview,
  createBindingChallengeRecord,
  dismissReview,
  exportIdentityAudit,
  flushAnchorQueue,
  getIdentityEvents,
  getRiskContext,
  getWatchStatus,
  initializeAnalyzerWatchers,
  listReviewQueue,
  manageWatchScan,
  recomputeIdentity,
  registerIdentityTree,
  submitBinding,
} from "./service.js";
import { IdentityState } from "../../../packages/state/src/index.js";

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => getAddress(value));
const stateSchema = z.nativeEnum(IdentityState);

const registerTreeRequestSchema = z.object({
  rootIdentity: z.object({
    rootId: hex32Schema,
    identityId: hex32Schema,
    controllerAddress: addressSchema,
    didLikeId: z.string(),
    chainId: z.number().int().positive(),
    createdAt: z.string(),
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

const bindingChallengeSchema = z.object({
  bindingType: z.enum(["root_controller", "sub_identity_link", "same_root_extension"]),
  candidateAddress: addressSchema,
  rootIdentityId: hex32Schema,
  subIdentityId: hex32Schema.optional(),
});

const submitBindingSchema = z.object({
  challengeId: z.string().min(1),
  candidateSignature: hexSchema,
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
  authorizerSignature: hexSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
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

const app = express();
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

app.listen(analyzerConfig.port, () => {
  console.log(`Web3ID analyzer service listening on http://127.0.0.1:${analyzerConfig.port}`);
});

void initializeAnalyzerWatchers().catch((error) => {
  console.error("Failed to initialize analyzer watchers", error);
});

