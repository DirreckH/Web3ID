import { z } from "zod";
import {
  CONTROLLER_PROOF_ENVELOPE_VERSION,
  type ChainControllerRef,
  type ControllerProofEnvelope,
  type ControllerProofEnvelopeSummary,
} from "./types.js";

const proofEnvelopeVersionSchema = z.literal(CONTROLLER_PROOF_ENVELOPE_VERSION);
const baseEnvelopeShape = {
  proofEnvelopeVersion: proofEnvelopeVersionSchema,
  signature: z.string().min(1),
  publicKey: z.string().min(1).optional(),
  signatureScheme: z.enum(["ed25519", "secp256k1", "secp256r1"]).optional(),
  walletStateInit: z.string().min(1).optional(),
  fullMessage: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
} as const;

const tonProofPayloadSchema = z.object({
  domain: z.string().min(1),
  payload: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  address: z.string().min(1),
  stateInitHash: z.string().min(1).optional(),
}).strict();

const cosmosProofPayloadBaseSchema = z.object({
  signerAddress: z.string().min(1),
  chainId: z.string().min(1),
  signDoc: z.string().min(1),
  signedBytes: z.string().min(1),
  bech32Prefix: z.string().min(1),
}).strict();

const aptosSignMessagePayloadSchema = z.object({
  address: z.string().min(1),
  application: z.string().min(1),
  chainId: z.number().int().nonnegative(),
  nonce: z.string().min(1),
  message: z.string().min(1),
  issuedAt: z.string().min(1).optional(),
  expirationTime: z.string().min(1).optional(),
  statement: z.string().min(1).optional(),
}).strict();

const suiProofPayloadSchema = z.object({
  address: z.string().min(1),
  messageBytes: z.string().min(1),
}).strict();

export const controllerProofEnvelopeSchemas = {
  eip191: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("eip191"),
  }).strict(),
  solana_ed25519: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("solana_ed25519"),
  }).strict(),
  bitcoin_bip322: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("bitcoin_bip322"),
  }).strict(),
  bitcoin_legacy: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("bitcoin_legacy"),
  }).strict(),
  tron_signed_message_v2: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("tron_signed_message_v2"),
  }).strict(),
  ton_proof_v2: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("ton_proof_v2"),
    proofPayload: tonProofPayloadSchema,
  }).strict(),
  cosmos_adr036_direct: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("cosmos_adr036_direct"),
    publicKey: z.string().min(1),
    proofPayload: cosmosProofPayloadBaseSchema.extend({
      signMode: z.literal("direct"),
    }).strict(),
  }).strict(),
  cosmos_adr036_legacy_amino: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("cosmos_adr036_legacy_amino"),
    publicKey: z.string().min(1),
    proofPayload: cosmosProofPayloadBaseSchema.extend({
      signMode: z.literal("legacy_amino"),
    }).strict(),
  }).strict(),
  aptos_sign_message: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("aptos_sign_message"),
    fullMessage: z.string().min(1),
    proofPayload: aptosSignMessagePayloadSchema,
  }).strict(),
  aptos_siwa: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("aptos_siwa"),
    fullMessage: z.string().min(1),
    proofPayload: aptosSignMessagePayloadSchema.extend({
      issuedAt: z.string().min(1),
    }).strict(),
  }).strict(),
  sui_personal_message_ed25519: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("sui_personal_message_ed25519"),
    publicKey: z.string().min(1),
    signatureScheme: z.literal("ed25519"),
    proofPayload: suiProofPayloadSchema,
  }).strict(),
  sui_personal_message_secp256k1: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("sui_personal_message_secp256k1"),
    publicKey: z.string().min(1),
    signatureScheme: z.literal("secp256k1"),
    proofPayload: suiProofPayloadSchema,
  }).strict(),
  sui_personal_message_secp256r1: z.object({
    ...baseEnvelopeShape,
    proofType: z.literal("sui_personal_message_secp256r1"),
    publicKey: z.string().min(1),
    signatureScheme: z.literal("secp256r1"),
    proofPayload: suiProofPayloadSchema,
  }).strict(),
} as const;

export const controllerProofEnvelopeSchema = z.discriminatedUnion("proofType", [
  controllerProofEnvelopeSchemas.eip191,
  controllerProofEnvelopeSchemas.solana_ed25519,
  controllerProofEnvelopeSchemas.bitcoin_bip322,
  controllerProofEnvelopeSchemas.bitcoin_legacy,
  controllerProofEnvelopeSchemas.tron_signed_message_v2,
  controllerProofEnvelopeSchemas.ton_proof_v2,
  controllerProofEnvelopeSchemas.cosmos_adr036_direct,
  controllerProofEnvelopeSchemas.cosmos_adr036_legacy_amino,
  controllerProofEnvelopeSchemas.aptos_sign_message,
  controllerProofEnvelopeSchemas.aptos_siwa,
  controllerProofEnvelopeSchemas.sui_personal_message_ed25519,
  controllerProofEnvelopeSchemas.sui_personal_message_secp256k1,
  controllerProofEnvelopeSchemas.sui_personal_message_secp256r1,
]);

export function parseControllerProofEnvelope(input: unknown): ControllerProofEnvelope {
  return controllerProofEnvelopeSchema.parse(input) as ControllerProofEnvelope;
}

export function normalizeLegacyCandidateSignature(
  controllerRef: Pick<ChainControllerRef, "proofType">,
  candidateSignature: string,
): ControllerProofEnvelope {
  switch (controllerRef.proofType) {
    case "eip191":
    case "solana_ed25519":
    case "bitcoin_bip322":
    case "bitcoin_legacy":
    case "tron_signed_message_v2":
      return parseControllerProofEnvelope({
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: controllerRef.proofType,
        signature: candidateSignature,
      });
    default:
      throw new Error(`Legacy candidateSignature is not supported for structured proof type ${controllerRef.proofType}.`);
  }
}

export function buildProofEnvelopeSummary(envelope: ControllerProofEnvelope): ControllerProofEnvelopeSummary {
  return {
    proofEnvelopeVersion: envelope.proofEnvelopeVersion,
    proofType: envelope.proofType,
    hasPublicKey: Boolean(envelope.publicKey),
    signatureScheme: envelope.signatureScheme,
    hasWalletStateInit: Boolean(envelope.walletStateInit),
    hasFullMessage: Boolean(envelope.fullMessage),
    proofPayloadKeys:
      "proofPayload" in envelope && envelope.proofPayload
        ? Object.keys(envelope.proofPayload as Record<string, unknown>).sort()
        : [],
    evidenceRefCount: envelope.evidenceRefs?.length ?? 0,
  };
}
