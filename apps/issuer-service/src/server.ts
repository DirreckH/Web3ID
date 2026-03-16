import express from "express";
import cors from "cors";
import { z } from "zod";
import { deriveRootIdentity } from "@web3id/identity";
import { POLICY_IDS } from "@web3id/policy";
import { issuerConfig } from "./config.js";
import {
  applyIdentitySignal,
  getCredentialStatus,
  getStoredIdentityContext,
  issueCompatibilityCredential,
  issueCredential,
  listDemoSignals,
  registerIdentityTree,
  resolveCredentialPreset,
  reissueCredential,
  revokeCredential,
  verifyIssuedCredential,
} from "./service.js";

const compatibilityRequestSchema = z.object({
  subjectDid: z.string(),
  subjectAddress: z.string(),
  claimOverrides: z
    .object({
      amlPassed: z.boolean().optional(),
      nonUSResident: z.boolean().optional(),
      accreditedInvestor: z.boolean().optional(),
      expirationDate: z.number().int().positive().optional(),
    })
    .optional(),
});

const issueRequestSchema = z.object({
  holder: z.string(),
  holderIdentityId: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  subjectAddress: z.string(),
  credentialKind: z.enum(["kycAml", "accreditedInvestor", "entity"]),
  claimSet: z.record(z.unknown()),
  policyHints: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)).default([POLICY_IDS.RWA_BUY_V2]),
  evidenceRef: z.string().optional(),
  expiry: z.number().int().positive().optional(),
});

const reissueRequestSchema = z.object({
  credentialId: z.string(),
  claimSet: z.record(z.unknown()).optional(),
  expiry: z.number().int().positive().optional(),
});

const revokeRequestSchema = z.object({
  credentialId: z.string(),
  reason: z.string().min(1),
});

const verifyRequestSchema = z.object({
  bundle: z.unknown(),
});

const registerTreeRequestSchema = z.object({
  rootIdentity: z.object({
    rootId: z.string(),
    identityId: z.string(),
    controllerAddress: z.string(),
    didLikeId: z.string(),
    chainId: z.number(),
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
    subIdentityId: z.string(),
    identityId: z.string(),
    rootId: z.string(),
    rootIdentityId: z.string(),
    scope: z.string(),
    type: z.string(),
    createdAt: z.string(),
    permissions: z.object({
      allowedCredentialTypes: z.array(z.string()),
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

const applySignalRequestSchema = z.object({
  signalKey: z.enum([
    "new_wallet_observation",
    "negative_risk_flag",
    "sanction_hit",
    "manual_review_fail",
    "trusted_usage",
    "governance_participation",
    "good_standing",
  ]),
  actor: z.string().optional(),
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    issuerAddress: issuerConfig.issuerAddress,
    complianceVerifierAddress: issuerConfig.complianceVerifierAddress,
  });
});

app.get("/issuer", (_req, res) => {
  res.json({
    issuerDid: issuerConfig.issuerDid,
    issuerAddress: issuerConfig.issuerAddress,
    chainId: issuerConfig.chainId,
    credentialDomain: {
      name: "Web3ID Credential",
      version: "2",
      verifyingContract: issuerConfig.complianceVerifierAddress,
    },
  });
});

app.get("/signals", (_req, res) => {
  res.json({ items: listDemoSignals() });
});

app.post("/credentials/issue", async (req, res) => {
  try {
    if ("subjectDid" in req.body) {
      const input = compatibilityRequestSchema.parse(req.body);
      const record = await issueCompatibilityCredential({
        subjectDid: input.subjectDid,
        subjectAddress: input.subjectAddress as `0x${string}`,
        claimOverrides: input.claimOverrides,
      });
      return res.json(record.bundle);
    }

    const input = issueRequestSchema.parse(req.body);
    const preset = resolveCredentialPreset(input.credentialKind);
    const holderIdentityId =
      input.holderIdentityId ??
      deriveRootIdentity(input.subjectAddress as `0x${string}`, issuerConfig.chainId).identityId;
    const record = await issueCredential({
      holder: input.holder,
      holderIdentityId: holderIdentityId as `0x${string}`,
      subjectAddress: input.subjectAddress as `0x${string}`,
      credentialType: preset.credentialType,
      credentialTypeLabel: preset.credentialTypeLabel,
      claimSet: input.claimSet,
      policyHints: input.policyHints as `0x${string}`[],
      evidenceRef: input.evidenceRef,
      expiry: input.expiry,
    });

    res.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.post("/credentials/reissue", async (req, res) => {
  try {
    const input = reissueRequestSchema.parse(req.body);
    const record = await reissueCredential(input);
    res.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.post("/credentials/revoke", async (req, res) => {
  try {
    const input = revokeRequestSchema.parse(req.body);
    const status = await revokeCredential(input);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.get("/credentials/:id/status", async (req, res) => {
  try {
    const status = await getCredentialStatus(req.params.id);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(404).json({ error: message });
  }
});

app.post("/credentials/verify", async (req, res) => {
  try {
    const input = verifyRequestSchema.parse(req.body);
    const result = await verifyIssuedCredential(input.bundle as any);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.post("/identities/register-tree", async (req, res) => {
  try {
    const input = registerTreeRequestSchema.parse(req.body);
    const result = await registerIdentityTree(input as any);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.get("/identities/:id/context", async (req, res) => {
  try {
    const context = await getStoredIdentityContext(req.params.id as `0x${string}`);
    res.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(404).json({ error: message });
  }
});

app.post("/identities/:id/signals", async (req, res) => {
  try {
    const input = applySignalRequestSchema.parse(req.body);
    const result = await applyIdentitySignal({
      identityId: req.params.id as `0x${string}`,
      signalKey: input.signalKey,
      actor: input.actor,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown issuer error";
    res.status(400).json({ error: message });
  }
});

app.listen(issuerConfig.port, () => {
  console.log(
    `Web3ID issuer service listening on http://127.0.0.1:${issuerConfig.port} (${issuerConfig.issuerDid})`,
  );
});
