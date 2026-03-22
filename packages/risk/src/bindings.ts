import { Buffer } from "node:buffer";
import { ed25519 } from "@noble/curves/ed25519.js";
import { base58 } from "@scure/base";
import { Verifier as Bip322Verifier } from "bip322-js";
import * as bitcoinMessage from "bitcoinjs-message";
import { recoverMessageAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import {
  buildControllerChallengeFields,
  buildControllerChallengeMessage,
  deriveRootIdentity,
  normalizeControllerRef,
  verifySubIdentityLinkProof,
  type ChainControllerRef,
  type ChainControllerRefInput,
  type RootIdentity,
  type SameRootProof,
  type SubIdentity,
  type SubIdentityLinkProof,
} from "../../identity/src/index.js";
import type { BindingChallenge, BindingType, BehaviorBinding } from "./types.js";

export function buildBindingChallengeMessage(challenge: BindingChallenge) {
  return buildControllerChallengeMessage(challenge.challengeFields);
}

export function createBindingChallenge(input: {
  bindingType: BindingType;
  controllerRef: ChainControllerRef | ChainControllerRefInput;
  rootIdentityId?: Hex;
  subIdentityId?: Hex;
  subjectAggregateId?: string;
  createdAt?: string;
  expiresInMinutes?: number;
  nonce?: string;
}): BindingChallenge {
  const controllerRef = normalizeControllerRef(input.controllerRef);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(createdAt) + (input.expiresInMinutes ?? 10) * 60 * 1000).toISOString();
  const challengeId = crypto.randomUUID();
  const nonce = input.nonce ?? challengeId;
  const challengeFields = buildControllerChallengeFields({
    bindingType: input.bindingType,
    controllerRef,
    rootIdentityId: input.rootIdentityId,
    subjectAggregateId: input.subjectAggregateId,
    nonce,
    issuedAt: createdAt,
    expiresAt,
  });
  const challengeMessage = buildBindingChallengeMessage({
    challengeId,
    challengeHash: `0x${"0".repeat(64)}` as Hex,
    challengeMessage: "",
    challengeFields,
    bindingType: input.bindingType,
    candidateAddress: controllerRef.chainFamily === "evm" ? (controllerRef.normalizedAddress as Address) : undefined,
    controllerRef,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    subjectAggregateId: input.subjectAggregateId,
    replayKey: "",
    createdAt,
    expiresAt,
  });
  const challengeHash = keccak256(stringToHex(challengeMessage));
  const replayKey = keccak256(stringToHex([challengeFields.replayScope, challengeFields.nonce].join(":")));

  return {
    challengeId,
    challengeHash,
    challengeMessage,
    challengeFields,
    bindingType: input.bindingType,
    candidateAddress: controllerRef.chainFamily === "evm" ? (controllerRef.normalizedAddress as Address) : undefined,
    controllerRef,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    subjectAggregateId: input.subjectAggregateId,
    replayKey,
    createdAt,
    expiresAt,
  };
}

export function buildSameRootAuthorizationMessage(input: {
  challengeHash: Hex;
  candidateAddress: Address;
  rootIdentityId: Hex;
  authorizerAddress: Address;
}) {
  return [
    "Web3ID Same Root Authorization",
    `challengeHash: ${input.challengeHash}`,
    `candidateAddress: ${input.candidateAddress}`,
    `rootIdentityId: ${input.rootIdentityId}`,
    `authorizerAddress: ${input.authorizerAddress}`,
  ].join("\n");
}

function sameRootProofLooksConsistent(proof: SameRootProof, rootIdentity: RootIdentity) {
  return proof.rootCommitment === keccak256(rootIdentity.rootId) && proof.subIdentityIds.length > 0;
}

function getActiveBindingAddress(binding: BehaviorBinding) {
  return binding.controllerRef.normalizedAddress.toLowerCase();
}

async function verifyEvmChallenge(input: { challenge: BindingChallenge; candidateSignature: string }) {
  const recoveredSigner = await recoverMessageAddress({
    message: input.challenge.challengeMessage,
    signature: input.candidateSignature as Hex,
  });
  if (recoveredSigner.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Controller signature does not match the normalized EVM address.");
  }
  return recoveredSigner;
}

function verifySolanaChallenge(input: { challenge: BindingChallenge; candidateSignature: string }) {
  const signature = Buffer.from(input.candidateSignature, "base64");
  const publicKey = base58.decode(input.challenge.controllerRef.normalizedAddress);
  const message = new TextEncoder().encode(input.challenge.challengeMessage);
  if (!ed25519.verify(signature, message, publicKey)) {
    throw new Error("Solana controller signature is invalid.");
  }
  return input.challenge.controllerRef.normalizedAddress;
}

function verifyBitcoinChallenge(input: { challenge: BindingChallenge; candidateSignature: string }) {
  const address = input.challenge.controllerRef.normalizedAddress;
  const message = input.challenge.challengeMessage;
  const verified =
    input.challenge.controllerRef.proofType === "bitcoin_legacy"
      ? bitcoinMessage.verify(message, address, input.candidateSignature)
      : Bip322Verifier.verifySignature(address, message, input.candidateSignature);
  if (!verified) {
    throw new Error("Bitcoin controller signature is invalid.");
  }
  return address;
}

export async function verifyControllerChallenge(input: {
  challenge: BindingChallenge;
  candidateSignature: string;
  consumedReplayKeys?: Set<string>;
}) {
  if (Date.parse(input.challenge.expiresAt) < Date.now()) {
    throw new Error("Binding challenge expired.");
  }
  if (input.consumedReplayKeys?.has(input.challenge.replayKey)) {
    throw new Error("Binding challenge replay detected.");
  }

  let normalizedSigner = input.challenge.controllerRef.normalizedAddress;
  switch (input.challenge.controllerRef.chainFamily) {
    case "evm":
      normalizedSigner = await verifyEvmChallenge(input);
      break;
    case "solana":
      normalizedSigner = verifySolanaChallenge(input);
      break;
    case "bitcoin":
      normalizedSigner = verifyBitcoinChallenge(input);
      break;
  }

  const derivedRootIdentity = deriveRootIdentity(input.challenge.controllerRef);
  const proofHash = keccak256(
    stringToHex([
      input.challenge.controllerRef.proofType,
      input.challenge.challengeHash,
      input.candidateSignature,
    ].join(":")),
  );

  return {
    normalizedSigner,
    derivedRootIdentity,
    proofHash,
    evidenceRefs: [
      `challenge:${input.challenge.challengeHash}`,
      `replay:${input.challenge.replayKey}`,
      `signer:${normalizedSigner}`,
      `proof:${proofHash}`,
    ],
  };
}

export async function verifyBindingSubmission(input: {
  challenge: BindingChallenge;
  candidateSignature: string;
  rootIdentity?: RootIdentity;
  subIdentity?: SubIdentity;
  linkProof?: SubIdentityLinkProof;
  sameRootProof?: SameRootProof;
  authorizerAddress?: Address;
  authorizerSignature?: string;
  activeBindings?: BehaviorBinding[];
  consumedReplayKeys?: Set<string>;
}): Promise<{
  bindingHash: Hex;
  proofHash: Hex;
  evidenceRefs: string[];
  recoveredSigner: string;
  derivedRootIdentity: RootIdentity;
}> {
  const verification = await verifyControllerChallenge({
    challenge: input.challenge,
    candidateSignature: input.candidateSignature,
    consumedReplayKeys: input.consumedReplayKeys,
  });
  const rootIdentity = input.rootIdentity ?? verification.derivedRootIdentity;
  const evidenceRefs = [...verification.evidenceRefs];

  if (input.challenge.bindingType === "root_controller") {
    if (input.challenge.rootIdentityId && verification.derivedRootIdentity.identityId !== input.challenge.rootIdentityId) {
      throw new Error("Root controller signature does not match the target root identity.");
    }
  }

  if (input.challenge.bindingType === "sub_identity_link") {
    if (!input.subIdentity || !input.linkProof || !input.rootIdentity) {
      throw new Error("Sub-identity link bindings require a sub identity and link proof.");
    }
    if (verification.normalizedSigner.toLowerCase() !== input.rootIdentity.primaryControllerRef.normalizedAddress.toLowerCase()) {
      throw new Error("Sub-identity link bindings must be signed by the root controller.");
    }
    if (!verifySubIdentityLinkProof(input.linkProof, input.rootIdentity, input.subIdentity)) {
      throw new Error("Invalid sub identity link proof.");
    }
    evidenceRefs.push(`link-proof:${input.linkProof.commitment}`);
  }

  if (input.challenge.bindingType === "same_root_extension") {
    if (!input.sameRootProof || !input.authorizerAddress || !input.authorizerSignature || !input.rootIdentity) {
      throw new Error("Same-root extension bindings require same-root proof and authorizer signature.");
    }
    if (!input.challenge.rootIdentityId || !input.challenge.candidateAddress) {
      throw new Error("Same-root extension bindings require an EVM root target.");
    }
    if (!sameRootProofLooksConsistent(input.sameRootProof, input.rootIdentity)) {
      throw new Error("Same-root proof is inconsistent with the target root identity.");
    }
    evidenceRefs.push(`same-root-proof:${input.sameRootProof.commitment}`);

    const activeAuthorizer = (input.activeBindings ?? []).find(
      (binding) => binding.status === "ACTIVE" && getActiveBindingAddress(binding) === input.authorizerAddress!.toLowerCase(),
    );
    if (!activeAuthorizer) {
      throw new Error("Same-root extension requires an already active authorizer binding.");
    }

    const authorizationMessage = buildSameRootAuthorizationMessage({
      challengeHash: input.challenge.challengeHash,
      candidateAddress: input.challenge.candidateAddress,
      rootIdentityId: input.challenge.rootIdentityId,
      authorizerAddress: input.authorizerAddress,
    });
    const recoveredAuthorizer = await recoverMessageAddress({
      message: authorizationMessage,
      signature: input.authorizerSignature as Hex,
    });
    if (recoveredAuthorizer.toLowerCase() !== input.authorizerAddress.toLowerCase()) {
      throw new Error("Same-root authorizer signature is invalid.");
    }
    evidenceRefs.push(`authorizer:${recoveredAuthorizer}`);
  }

  if (input.challenge.bindingType === "subject_aggregate_link") {
    if (input.challenge.rootIdentityId && verification.derivedRootIdentity.identityId !== input.challenge.rootIdentityId) {
      throw new Error("Aggregate link signature does not match the target root identity.");
    }
    if (!input.challenge.subjectAggregateId) {
      throw new Error("Aggregate link bindings require a subject aggregate target.");
    }
  }

  const bindingHash = keccak256(stringToHex([input.challenge.challengeHash, verification.normalizedSigner].join(":")));
  evidenceRefs.push(`binding:${bindingHash}`);

  return {
    bindingHash,
    proofHash: verification.proofHash,
    evidenceRefs,
    recoveredSigner: verification.normalizedSigner,
    derivedRootIdentity: rootIdentity,
  };
}
