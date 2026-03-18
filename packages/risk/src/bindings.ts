import { recoverMessageAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { deriveRootIdentity, verifySubIdentityLinkProof, type RootIdentity, type SameRootProof, type SubIdentity, type SubIdentityLinkProof } from "../../identity/src/index.js";
import type { BindingChallenge, BindingType, BehaviorBinding } from "./types.js";

export function buildBindingChallengeMessage(challenge: BindingChallenge) {
  return [
    "Web3ID Binding Challenge",
    `challengeId: ${challenge.challengeId}`,
    `challengeHash: ${challenge.challengeHash}`,
    `bindingType: ${challenge.bindingType}`,
    `candidateAddress: ${challenge.candidateAddress}`,
    `rootIdentityId: ${challenge.rootIdentityId}`,
    `subIdentityId: ${challenge.subIdentityId ?? ""}`,
    `expiresAt: ${challenge.expiresAt}`,
  ].join("\n");
}

export function createBindingChallenge(input: {
  bindingType: BindingType;
  candidateAddress: Address;
  rootIdentityId: Hex;
  subIdentityId?: Hex;
  createdAt?: string;
  expiresInMinutes?: number;
}): BindingChallenge {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(createdAt) + (input.expiresInMinutes ?? 10) * 60 * 1000).toISOString();
  const challengeId = crypto.randomUUID();
  const challengeHash = keccak256(
    stringToHex([challengeId, input.bindingType, input.candidateAddress, input.rootIdentityId, input.subIdentityId ?? "", expiresAt].join(":")),
  );
  const challenge = {
    challengeId,
    challengeHash,
    challengeMessage: "",
    bindingType: input.bindingType,
    candidateAddress: input.candidateAddress,
    rootIdentityId: input.rootIdentityId,
    subIdentityId: input.subIdentityId,
    createdAt,
    expiresAt,
  } satisfies BindingChallenge;
  return {
    ...challenge,
    challengeMessage: buildBindingChallengeMessage(challenge),
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

export async function verifyBindingSubmission(input: {
  challenge: BindingChallenge;
  candidateSignature: Hex;
  rootIdentity: RootIdentity;
  subIdentity?: SubIdentity;
  linkProof?: SubIdentityLinkProof;
  sameRootProof?: SameRootProof;
  authorizerAddress?: Address;
  authorizerSignature?: Hex;
  activeBindings?: BehaviorBinding[];
}): Promise<{ bindingHash: Hex; evidenceRefs: string[]; recoveredSigner: Address }> {
  if (Date.parse(input.challenge.expiresAt) < Date.now()) {
    throw new Error("Binding challenge expired.");
  }

  const recoveredSigner = await recoverMessageAddress({
    message: input.challenge.challengeMessage,
    signature: input.candidateSignature,
  });
  const evidenceRefs = [
    `challenge:${input.challenge.challengeHash}`,
    `signer:${recoveredSigner}`,
  ];

  if (input.challenge.bindingType === "root_controller") {
    const derived = deriveRootIdentity(recoveredSigner, input.rootIdentity.chainId);
    if (derived.identityId !== input.challenge.rootIdentityId) {
      throw new Error("Root controller signature does not match the target root identity.");
    }
  }

  if (input.challenge.bindingType === "sub_identity_link") {
    if (!input.subIdentity || !input.linkProof) {
      throw new Error("Sub-identity link bindings require a sub identity and link proof.");
    }
    if (recoveredSigner.toLowerCase() !== input.rootIdentity.controllerAddress.toLowerCase()) {
      throw new Error("Sub-identity link bindings must be signed by the root controller address.");
    }
    if (!verifySubIdentityLinkProof(input.linkProof, input.rootIdentity, input.subIdentity)) {
      throw new Error("Invalid sub identity link proof.");
    }
    evidenceRefs.push(`link-proof:${input.linkProof.commitment}`);
  }

  if (input.challenge.bindingType === "same_root_extension") {
    if (!input.sameRootProof || !input.authorizerAddress || !input.authorizerSignature) {
      throw new Error("Same-root extension bindings require same-root proof and authorizer signature.");
    }
    if (!sameRootProofLooksConsistent(input.sameRootProof, input.rootIdentity)) {
      throw new Error("Same-root proof is inconsistent with the target root identity.");
    }
    evidenceRefs.push(`same-root-proof:${input.sameRootProof.commitment}`);

    const activeAuthorizer = (input.activeBindings ?? []).find(
      (binding) => binding.status === "ACTIVE" && binding.address.toLowerCase() === input.authorizerAddress!.toLowerCase(),
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
      signature: input.authorizerSignature,
    });
    if (recoveredAuthorizer.toLowerCase() !== input.authorizerAddress.toLowerCase()) {
      throw new Error("Same-root authorizer signature is invalid.");
    }
    evidenceRefs.push(`authorizer:${recoveredAuthorizer}`);
  }

  const bindingHash = keccak256(stringToHex([input.challenge.challengeHash, recoveredSigner].join(":")));
  evidenceRefs.push(`binding:${bindingHash}`);

  return {
    bindingHash,
    evidenceRefs,
    recoveredSigner,
  };
}
