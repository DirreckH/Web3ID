import { rm } from "node:fs/promises";
import { analyzerConfig } from "../../apps/analyzer-service/src/config.js";
import {
  createBindingChallengeRecord,
  createSubjectAggregate,
  getRiskContext,
  getSubjectAggregate,
  registerIdentityTree,
  shutdownAnalyzerWatchers,
  submitBinding,
} from "../../apps/analyzer-service/src/service.js";
import {
  deriveRootIdentity,
  type ChainControllerRef,
  type ChainControllerRefInput,
  type ControllerProofEnvelope,
} from "../../packages/identity/src/index.js";

export async function resetMainstreamAnalyzerState() {
  shutdownAnalyzerWatchers();
  await rm(analyzerConfig.dataFile, { force: true });
}

export async function registerAndBindControllerRoot(input: {
  controllerRef: ChainControllerRef | ChainControllerRefInput;
  candidateSignature?: string;
  candidateProof?: ControllerProofEnvelope;
  candidateSignatureFactory?: (challengeMessage: string) => Promise<string> | string;
  candidateProofFactory?: (challengeMessage: string) => Promise<ControllerProofEnvelope> | ControllerProofEnvelope;
}) {
  const rootIdentity = deriveRootIdentity(input.controllerRef);
  await registerIdentityTree({ rootIdentity, subIdentities: [] });
  const challenge = await createBindingChallengeRecord({
    bindingType: "root_controller",
    controllerRef: rootIdentity.primaryControllerRef,
    rootIdentityId: rootIdentity.identityId,
  });
  const binding = await submitBinding({
    challengeId: challenge.challengeId,
    candidateSignature: input.candidateSignature ?? await input.candidateSignatureFactory?.(challenge.challengeMessage),
    candidateProof: input.candidateProof ?? await input.candidateProofFactory?.(challenge.challengeMessage),
  });
  const riskContext = await getRiskContext(rootIdentity.identityId);
  return { rootIdentity, challenge, binding, riskContext };
}

export async function linkControllerRootToAggregate(input: {
  subjectAggregateId: string;
  controllerRef: ChainControllerRef | ChainControllerRefInput;
  rootIdentityId?: `0x${string}`;
  candidateSignature?: string;
  candidateProof?: ControllerProofEnvelope;
  candidateSignatureFactory?: (challengeMessage: string) => Promise<string> | string;
  candidateProofFactory?: (challengeMessage: string) => Promise<ControllerProofEnvelope> | ControllerProofEnvelope;
}) {
  const challenge = await createBindingChallengeRecord({
    bindingType: "subject_aggregate_link",
    controllerRef: input.controllerRef,
    rootIdentityId: input.rootIdentityId,
    subjectAggregateId: input.subjectAggregateId,
  });
  const binding = await submitBinding({
    challengeId: challenge.challengeId,
    candidateSignature: input.candidateSignature ?? await input.candidateSignatureFactory?.(challenge.challengeMessage),
    candidateProof: input.candidateProof ?? await input.candidateProofFactory?.(challenge.challengeMessage),
  });
  const aggregate = await getSubjectAggregate(input.subjectAggregateId);
  return { challenge, binding, aggregate };
}

export async function createAggregateRecord(actor = "risk-ops") {
  return createSubjectAggregate({
    actor,
    evidenceRefs: [`system:${actor}:aggregate:create`],
  });
}
