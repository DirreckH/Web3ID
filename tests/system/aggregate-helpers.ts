import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { createSubIdentityLinkProof, deriveRootIdentity, listDefaultSubIdentities, SubIdentityType } from "../../packages/identity/src/index.js";
import type { ServiceHarness } from "../integration/service-harness.js";

export const PRIMARY_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const SECOND_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103e0a14158d1c3f28f1c0a4e22ea39bdeef3c4f5d" as const;

export const primaryAggregateAccount = privateKeyToAccount(PRIMARY_PRIVATE_KEY);
export const secondaryAggregateAccount = privateKeyToAccount(SECOND_PRIVATE_KEY);

export async function createSubjectAggregateRecord(harness: ServiceHarness, input: {
  subjectAggregateId?: string;
  actor?: string;
  evidenceRefs?: string[];
  auditBundleRef?: string;
  status?: "ACTIVE" | "REVIEW_REQUIRED" | "SUSPENDED";
} = {}) {
  return harness.postJson<any>(`${harness.urls.analyzer}/subject-aggregates`, input);
}

export async function linkRootToAggregate(
  harness: ServiceHarness,
  input: {
    account: ReturnType<typeof privateKeyToAccount>;
    subjectAggregateId: string;
    rootIdentityId?: Hex;
  },
) {
  const rootIdentity = deriveRootIdentity(input.account.address, 31337);
  const challenge = await harness.postJson<any>(`${harness.urls.analyzer}/bindings/challenge`, {
    bindingType: "subject_aggregate_link",
    controllerRef: rootIdentity.primaryControllerRef,
    rootIdentityId: input.rootIdentityId,
    subjectAggregateId: input.subjectAggregateId,
  });
  const binding = await harness.postJson<any>(`${harness.urls.analyzer}/bindings`, {
    challengeId: challenge.challengeId,
    candidateSignature: await input.account.signMessage({ message: challenge.challengeMessage }),
  });

  return {
    rootIdentity,
    challenge,
    binding,
  };
}

export async function registerIdentityTreeAndBindings(
  harness: ServiceHarness,
  account: ReturnType<typeof privateKeyToAccount>,
) {
  const rootIdentity = deriveRootIdentity(account.address, 31337);
  const subIdentities = listDefaultSubIdentities(rootIdentity);
  await harness.postJson(`${harness.urls.issuer}/identities/register-tree`, { rootIdentity, subIdentities });
  await harness.postJson(`${harness.urls.analyzer}/identities/register-tree`, { rootIdentity, subIdentities });

  const rootChallenge = await harness.postJson<any>(`${harness.urls.analyzer}/bindings/challenge`, {
    bindingType: "root_controller",
    controllerRef: rootIdentity.primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  await harness.postJson(`${harness.urls.analyzer}/bindings`, {
    challengeId: rootChallenge.challengeId,
    candidateSignature: await account.signMessage({ message: rootChallenge.challengeMessage }),
  });

  for (const subIdentity of subIdentities) {
    const subChallenge = await harness.postJson<any>(`${harness.urls.analyzer}/bindings/challenge`, {
      bindingType: "sub_identity_link",
      controllerRef: rootIdentity.primaryControllerRef,
      rootIdentityId: rootIdentity.identityId,
      subIdentityId: subIdentity.identityId,
    });
    await harness.postJson(`${harness.urls.analyzer}/bindings`, {
      challengeId: subChallenge.challengeId,
      candidateSignature: await account.signMessage({ message: subChallenge.challengeMessage }),
      linkProof: createSubIdentityLinkProof(rootIdentity, subIdentity),
    });
  }

  const rwaIdentity = subIdentities.find((item) => item.type === SubIdentityType.RWA_INVEST)!;

  return {
    rootIdentity,
    subIdentities,
    rwaIdentity,
  };
}
