import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { deriveRootIdentity, listDefaultSubIdentities, SubIdentityType, createSameRootProof } from './packages/identity/src/index.js';
import { POLICY_IDS } from './packages/policy/src/index.js';
import { computeSubjectBinding } from './packages/credential/src/index.js';
import { getIdentityStateSnapshotV2, identityStateRegistryAbi } from './packages/sdk/src/index.js';

const ROOT = 'E:/Web3ID';
const STORE_PATH = 'E:/Web3ID/.web3id/analyzer-store.demo.json';
const ANALYZER = 'http://127.0.0.1:4200';
const POLICY = 'http://127.0.0.1:4300';
const ISSUER = 'http://127.0.0.1:4100';
const RPC = 'http://127.0.0.1:8545';
const DEFAULT_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const DEFAULT_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const WRONG_PK = '0x59c6995e998f97a5a0044966f0945384d7d0f5fb8f7c8d17826dfec353bbf4d6';
const account = privateKeyToAccount(DEFAULT_PK as `0x${string}`);
const wrongAccount = privateKeyToAccount(WRONG_PK as `0x${string}`);
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
const root = deriveRootIdentity(DEFAULT_ACCOUNT as `0x${string}`, 31337);
const subs = listDefaultSubIdentities(root);
const rwa = subs.find((item) => item.type === SubIdentityType.RWA_INVEST)!;
const payments = subs.find((item) => item.type === SubIdentityType.PAYMENTS)!;
const social = subs.find((item) => item.type === SubIdentityType.SOCIAL)!;
const anonymous = subs.find((item) => item.type === SubIdentityType.ANONYMOUS_LOWRISK)!;
const UNKNOWN_A = '0x00000000000000000000000000000000000000f1';
const UNKNOWN_B = '0x00000000000000000000000000000000000000f2';
const UNKNOWN_C = '0x00000000000000000000000000000000000000f3';
const HIGH_RISK = '0x00000000000000000000000000000000000000c1';
const MIXER = '0x00000000000000000000000000000000000000a1';
const SANCTIONED = '0x00000000000000000000000000000000000000b1';
const E2E_PROOF_POINTS = [
  '13122372145947736466215110589086593424969819421568502311814817140510255388779',
  '11787358258584064952942909854067898297594773774633455905750490717289687803437',
  '14107949736790722902603583410399654372709982465456445450719954945915678412459',
  '9785936997078988836922225143728102757907830846656362841118139076774926239364',
  '8040581014653838442221190141950333874040576881913776978408098382742702200161',
  '13923702086693704559744298793842223172811566886326384347643412351152431201826',
  '3142118871755198499349118933991585226890346794618921237576094869922164069639',
  '9128433068517416820211289626332730482933802718411124296238631767069737268345',
];
const E2E_PUBLIC_SIGNALS = ['4269565614499353667294251126978624193695206283651045130337043166278272242393'];

function readStore() {
  return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${res.status} ${url} -> ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

async function postJson(url: string, body: any): Promise<any> {
  return fetchJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function rpc(method: string, params: any[] = []) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || method);
  return json.result;
}

async function waitFor(predicate: () => Promise<boolean>, label: string, timeoutMs = 45000, intervalMs = 1000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function getPendingAnchorsFor(identityId: string) {
  const store = readStore();
  return Object.values(store.anchorQueue ?? {}).filter((entry: any) => entry.identityId === identityId && entry.status === 'PENDING');
}

function getEventCount() {
  const store = readStore();
  return Object.keys(store.events ?? {}).length;
}

async function getRisk(identityId: string) {
  return fetchJson(`${ANALYZER}/identities/${identityId}/risk-context`);
}

function getAnalyzerPid() {
  const out = execSync('cmd /c netstat -ano | findstr :4200', { encoding: 'utf8' });
  const listen = out.split(/\r?\n/).find((line) => line.includes('LISTENING'));
  if (!listen) throw new Error('No analyzer listener on 4200');
  const parts = listen.trim().split(/\s+/);
  return Number(parts[parts.length - 1]);
}

async function restartAnalyzer(stateRegistryAddress: string) {
  const oldPid = getAnalyzerPid();
  process.kill(oldPid, 'SIGTERM');
  await waitFor(async () => {
    try {
      await fetch(`${ANALYZER}/health`);
      return false;
    } catch {
      return true;
    }
  }, 'analyzer shutdown', 15000, 500);

  const child = spawn('cmd.exe', ['/c', 'pnpm --filter @web3id/analyzer-service dev'], {
    cwd: ROOT,
    env: {
      ...process.env,
      ANALYZER_DATA_FILE: STORE_PATH,
      STATE_REGISTRY_ADDRESS: stateRegistryAddress,
      ANVIL_RPC_URL: RPC,
      RISK_MANAGER_PRIVATE_KEY: DEFAULT_PK,
      ISSUER_API_URL: ISSUER,
      VITE_CHAIN_ID: '31337',
      ANALYZER_RECENT_BLOCKS: '8',
    },
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  await waitFor(async () => {
    try {
      const health = await fetchJson(`${ANALYZER}/health`);
      return health.ok === true || health.port === 4200;
    } catch {
      return false;
    }
  }, 'analyzer restart', 30000, 1000);
  return child.pid;
}

async function issueRwaBundle() {
  return postJson(`${ISSUER}/credentials/issue`, {
    holder: root.didLikeId,
    holderIdentityId: rwa.identityId,
    subjectAddress: DEFAULT_ACCOUNT,
    credentialKind: 'kycAml',
    claimSet: {
      amlPassed: true,
      nonUSResident: true,
      accreditedInvestor: true,
    },
    policyHints: [POLICY_IDS.RWA_BUY_V2],
  });
}

function buildRwaPayload(bundle: any) {
  const subjectBinding = bundle.attestation.subjectBinding;
  return {
    identityId: rwa.identityId,
    credentialAttestations: [bundle.attestation],
    zkProof: {
      proofPoints: E2E_PROOF_POINTS,
      publicSignals: E2E_PUBLIC_SIGNALS,
    },
    policyVersion: 1,
    holderAuthorization: {
      identityId: rwa.identityId,
      subjectBinding,
      policyId: POLICY_IDS.RWA_BUY_V2,
      requestHash: '0x' + '11'.repeat(32),
      chainId: 31337,
      nonce: '1',
      deadline: String(Math.floor(Date.now() / 1000) + 900),
      signature: '0x' + '22'.repeat(65),
    },
  };
}

async function evaluateAccess(input: any) {
  return postJson(`${POLICY}/policies/access/evaluate`, input);
}

async function evaluateWarning(identityId: string) {
  return postJson(`${POLICY}/policies/warning/evaluate`, { identityId, policyId: 'COUNTERPARTY_WARNING_V1', policyVersion: 1 });
}

const result: any = { watcher: {}, anchoring: {}, stateSeparation: {}, binding: {}, accessPolicy: {}, extraFindings: [] };

// baseline
const analyzerHealth = await fetchJson(`${ANALYZER}/health`);
const stateRegistryAddress = analyzerHealth.stateRegistryAddress;
result.runtime = { stateRegistryAddress };

// 5. AccessPolicy baseline normal before risking RWA
const bundleRecord = await issueRwaBundle();
const payload = buildRwaPayload(bundleRecord.bundle);
result.accessPolicy.subjectBindingMatches = String(BigInt(payload.holderAuthorization.subjectBinding)) === E2E_PUBLIC_SIGNALS[0];
result.accessPolicy.case_invalidCredential = await evaluateAccess({
  identityId: rwa.identityId,
  policyId: POLICY_IDS.RWA_BUY_V2,
  policyVersion: 1,
  payload,
});
result.accessPolicy.case_validNormal = await evaluateAccess({
  identityId: rwa.identityId,
  policyId: POLICY_IDS.RWA_BUY_V2,
  policyVersion: 1,
  payload,
  credentialBundles: [bundleRecord.bundle],
});

// 1 + 2(obs) social watcher and observed-only anchoring boundary
const socialAnchorCountBefore = getPendingAnchorsFor(social.identityId).length;
const socialWatchStart = await postJson(`${ANALYZER}/scan/watch`, { identityId: social.identityId, action: 'start', recentBlocks: 8, pollIntervalMs: 5000 });
const socialEventCountBefore = getEventCount();
for (const [i, to] of [UNKNOWN_A, UNKNOWN_B, UNKNOWN_C].entries()) {
  await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to, data: `0x12${i+1}4`, value: '0x0' }]);
}
await waitFor(async () => {
  const status = await fetchJson(`${ANALYZER}/scan/watch/status?identityId=${social.identityId}`);
  const item = status.items?.[0];
  const currentCount = getEventCount();
  return item?.status === 'ACTIVE' && currentCount >= socialEventCountBefore + 3;
}, 'social watcher auto-ingest', 30000, 1000);
let socialRisk = await getRisk(social.identityId);
if ((socialRisk.summary?.storedState ?? 1) < 2) {
  for (const [i, to] of [UNKNOWN_A, UNKNOWN_B, UNKNOWN_C].entries()) {
    await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to, data: `0xab${i+1}c`, value: '0x0' }]);
  }
  await waitFor(async () => (await getRisk(social.identityId)).summary?.storedState === 2, 'social observed state', 30000, 1000);
  socialRisk = await getRisk(social.identityId);
}
const socialWarningBeforeAnchor = getPendingAnchorsFor(social.identityId).length;
const socialWarning = await evaluateWarning(social.identityId);
const socialAnchorAfterWarning = getPendingAnchorsFor(social.identityId).length;
result.watcher.startResponse = socialWatchStart;
result.watcher.socialAutoEventIncrease = { before: socialEventCountBefore, after: getEventCount() };
result.watcher.socialRisk = {
  storedState: socialRisk.summary?.storedState,
  effectiveState: socialRisk.summary?.effectiveState,
  watchStatus: socialRisk.summary?.watchStatus,
};
result.anchoring.observed = {
  socialStoredState: socialRisk.summary?.storedState,
  socialAnchorCountBefore,
  socialAnchorCountAfter: getPendingAnchorsFor(social.identityId).length,
  socialWarningDecision: socialWarning.decision,
  socialAnchorAfterWarning,
  socialWarningNoAnchorDelta: socialAnchorAfterWarning === socialWarningBeforeAnchor,
};

// 1 restart watcher persistence
const lastScanBeforeRestart = socialRisk.summary?.watchStatus?.items?.[0]?.lastScanCompletedAt ?? null;
const analyzerPidBeforeRestart = getAnalyzerPid();
const restartedPid = await restartAnalyzer(stateRegistryAddress);
const watchStatusAfterRestart = await fetchJson(`${ANALYZER}/scan/watch/status?identityId=${social.identityId}`);
const eventCountBeforeRestartTx = getEventCount();
await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to: UNKNOWN_A, data: '0x7777', value: '0x0' }]);
await waitFor(async () => getEventCount() >= eventCountBeforeRestartTx + 1, 'post-restart watcher auto-ingest', 30000, 1000);
const socialRiskAfterRestart = await getRisk(social.identityId);
result.watcher.persistence = {
  analyzerPidBeforeRestart,
  analyzerPidAfterRestart: restartedPid,
  lastScanBeforeRestart,
  restoredStatus: watchStatusAfterRestart.items?.[0]?.status,
  restoredPollIntervalMs: watchStatusAfterRestart.items?.[0]?.pollIntervalMs,
  eventCountBeforeRestartTx,
  eventCountAfterRestartTx: getEventCount(),
  lastScanAfterRestart: socialRiskAfterRestart.summary?.watchStatus?.items?.[0]?.lastScanCompletedAt ?? null,
};

// 4 binding proof enforcement
const noSigChallenge = await postJson(`${ANALYZER}/bindings/challenge`, {
  bindingType: 'root_controller',
  candidateAddress: root.controllerAddress,
  rootIdentityId: root.identityId,
});
try {
  await postJson(`${ANALYZER}/bindings`, { challengeId: noSigChallenge.challengeId });
  result.binding.noChallengeSignature = { accepted: true };
} catch (error: any) {
  result.binding.noChallengeSignature = { accepted: false, error: String(error.message) };
}
const wrongSignerChallenge = await postJson(`${ANALYZER}/bindings/challenge`, {
  bindingType: 'root_controller',
  candidateAddress: root.controllerAddress,
  rootIdentityId: root.identityId,
});
const wrongSignature = await wrongAccount.signMessage({ message: wrongSignerChallenge.challengeMessage });
try {
  await postJson(`${ANALYZER}/bindings`, { challengeId: wrongSignerChallenge.challengeId, candidateSignature: wrongSignature });
  result.binding.wrongSigner = { accepted: true };
} catch (error: any) {
  result.binding.wrongSigner = { accepted: false, error: String(error.message) };
}
const sameRootChallenge = await postJson(`${ANALYZER}/bindings/challenge`, {
  bindingType: 'same_root_extension',
  candidateAddress: root.controllerAddress,
  rootIdentityId: root.identityId,
});
const candidateSignature = await account.signMessage({ message: sameRootChallenge.challengeMessage });
try {
  await postJson(`${ANALYZER}/bindings`, {
    challengeId: sameRootChallenge.challengeId,
    candidateSignature,
    sameRootProof: createSameRootProof(root, subs.slice(0, 2)),
  });
  result.binding.sameRootMissingAuthorizer = { accepted: true };
} catch (error: any) {
  result.binding.sameRootMissingAuthorizer = { accepted: false, error: String(error.message) };
}

// 2 critical anchors + 3 stored/effective separation
await postJson(`${ANALYZER}/scan/watch`, { identityId: rwa.identityId, action: 'start', recentBlocks: 8, pollIntervalMs: 5000 });
await postJson(`${ANALYZER}/scan/watch`, { identityId: payments.identityId, action: 'start', recentBlocks: 8, pollIntervalMs: 5000 });
const rwaChainBefore = await getIdentityStateSnapshotV2(publicClient as any, stateRegistryAddress, rwa.identityId as `0x${string}`);
await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to: HIGH_RISK, value: '0x1' }]);
await waitFor(async () => (await getRisk(rwa.identityId)).summary?.storedState === 3, 'rwa restricted state', 30000, 1000);
const rootRiskAfterRestricted = await getRisk(root.identityId);
const rwaRiskAfterRestricted = await getRisk(rwa.identityId);
const paymentsRiskAfterRestricted = await getRisk(payments.identityId);
const socialRiskAfterRestricted = await getRisk(social.identityId);
const anonRiskAfterRestricted = await getRisk(anonymous.identityId);
const rwaPendingAnchors = getPendingAnchorsFor(rwa.identityId);
const rootPendingAnchors = getPendingAnchorsFor(root.identityId);
const socialPendingAnchors = getPendingAnchorsFor(social.identityId);
const paymentsPendingAnchors = getPendingAnchorsFor(payments.identityId);
const rwaChainAfterRestricted = await getIdentityStateSnapshotV2(publicClient as any, stateRegistryAddress, rwa.identityId as `0x${string}`);

await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to: MIXER, value: '0x1' }]);
await waitFor(async () => (await getRisk(payments.identityId)).summary?.storedState === 4, 'payments high risk state', 30000, 1000);
const paymentsRiskAfterHighRisk = await getRisk(payments.identityId);
const paymentsHighRiskAnchors = getPendingAnchorsFor(payments.identityId);

await rpc('eth_sendTransaction', [{ from: DEFAULT_ACCOUNT, to: SANCTIONED, value: '0x1' }]);
await waitFor(async () => (await getRisk(payments.identityId)).summary?.storedState === 5, 'payments frozen state', 30000, 1000);
const paymentsRiskAfterFrozen = await getRisk(payments.identityId);
const paymentsFrozenAnchors = getPendingAnchorsFor(payments.identityId);

result.anchoring.restricted = {
  queueEntries: rwaPendingAnchors.map((entry: any) => ({ storedState: entry.storedState, effectiveState: entry.effectiveState, status: entry.status })),
  rootQueueEntries: rootPendingAnchors.map((entry: any) => ({ storedState: entry.storedState, effectiveState: entry.effectiveState, status: entry.status })),
  socialQueueEntries: socialPendingAnchors.length,
  paymentsQueueEntries: paymentsPendingAnchors.length,
  chainBefore: rwaChainBefore,
  chainAfterWithoutFlush: rwaChainAfterRestricted,
};
result.anchoring.highRisk = {
  queueEntries: paymentsHighRiskAnchors.map((entry: any) => ({ storedState: entry.storedState, effectiveState: entry.effectiveState, status: entry.status })),
  summaryState: paymentsRiskAfterHighRisk.summary?.storedState,
};
result.anchoring.frozen = {
  queueEntries: paymentsFrozenAnchors.map((entry: any) => ({ storedState: entry.storedState, effectiveState: entry.effectiveState, status: entry.status })),
  summaryState: paymentsRiskAfterFrozen.summary?.storedState,
};
result.stateSeparation = {
  root: { storedState: rootRiskAfterRestricted.summary?.storedState, effectiveState: rootRiskAfterRestricted.summary?.effectiveState },
  rwa: { storedState: rwaRiskAfterRestricted.summary?.storedState, effectiveState: rwaRiskAfterRestricted.summary?.effectiveState },
  payments: { storedState: paymentsRiskAfterRestricted.summary?.storedState, effectiveState: paymentsRiskAfterRestricted.summary?.effectiveState, warnings: paymentsRiskAfterRestricted.summary?.warnings },
  social: { storedState: socialRiskAfterRestricted.summary?.storedState, effectiveState: socialRiskAfterRestricted.summary?.effectiveState, warnings: socialRiskAfterRestricted.summary?.warnings },
  anonymous: { storedState: anonRiskAfterRestricted.summary?.storedState, effectiveState: anonRiskAfterRestricted.summary?.effectiveState, warnings: anonRiskAfterRestricted.summary?.warnings },
};

// 5 case 2 after restricted risk
result.accessPolicy.case_validRestricted = await evaluateAccess({
  identityId: rwa.identityId,
  policyId: POLICY_IDS.RWA_BUY_V2,
  policyVersion: 1,
  payload,
  credentialBundles: [bundleRecord.bundle],
});

// extra finding: events endpoint serialization
try {
  await fetchJson(`${ANALYZER}/identities/${social.identityId}/events`);
} catch (error: any) {
  result.extraFindings.push({ endpoint: '/identities/:id/events', error: String(error.message) });
}

writeFileSync('E:/Web3ID/.codex-acceptance-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
