import cors from "cors";
import express from "express";
import { z } from "zod";
import type { Hex } from "viem";
import { policyApiConfig } from "./config.js";
import { evaluateAccessDecision, evaluateWarningDecision, getIdentitySignals, getIdentityState, getRiskSummary } from "./service.js";

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const bigNumberishSchema = z.union([z.number(), z.bigint(), z.string().regex(/^\d+$/)]);
const accessPayloadSchema = z.object({
  identityId: hex32Schema,
  credentialAttestations: z.array(z.object({
    credentialType: hex32Schema,
    credentialHash: hex32Schema,
    revocationId: hex32Schema,
    subjectBinding: hex32Schema,
    issuer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    expiration: bigNumberishSchema,
    claimsHash: hex32Schema,
    policyHintsHash: hex32Schema,
    policyHints: z.array(hex32Schema),
    signature: hexSchema,
  })),
  zkProof: z.object({
    proofPoints: z.array(bigNumberishSchema),
    publicSignals: z.array(bigNumberishSchema),
  }),
  policyVersion: z.number().int().positive(),
  holderAuthorization: z.object({
    identityId: hex32Schema,
    subjectBinding: hex32Schema,
    policyId: hex32Schema,
    requestHash: hex32Schema,
    chainId: z.number().int().positive(),
    nonce: bigNumberishSchema,
    deadline: bigNumberishSchema,
    signature: hexSchema,
  }),
});
const accessDecisionSchema = z.object({
  identityId: hex32Schema,
  policyId: hex32Schema,
  policyVersion: z.number().int().positive(),
  payload: accessPayloadSchema.optional(),
  credentialBundles: z.array(z.unknown()).optional(),
  verifierAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});
const warningDecisionSchema = z.object({
  identityId: hex32Schema,
  policyId: z.string().min(1),
  policyVersion: z.number().int().positive(),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, port: policyApiConfig.port, analyzerApiUrl: policyApiConfig.analyzerApiUrl, verifierAddress: policyApiConfig.verifierAddress });
});
app.get("/identities/:id/state", async (req, res) => {
  try { res.json(await getIdentityState(req.params.id as Hex)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown policy-api error" }); }
});
app.get("/identities/:id/signals", async (req, res) => {
  try { res.json(await getIdentitySignals(req.params.id as Hex)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown policy-api error" }); }
});
app.get("/identities/:id/risk-summary", async (req, res) => {
  try { res.json(await getRiskSummary(req.params.id as Hex)); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Unknown policy-api error" }); }
});
app.post("/policies/access/evaluate", async (req, res) => {
  try { res.json(await evaluateAccessDecision(accessDecisionSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown policy-api error" }); }
});
app.post("/policies/warning/evaluate", async (req, res) => {
  try { res.json(await evaluateWarningDecision(warningDecisionSchema.parse(req.body) as any)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unknown policy-api error" }); }
});

app.listen(policyApiConfig.port, () => {
  console.log(`Web3ID policy-api listening on http://127.0.0.1:${policyApiConfig.port}`);
});
