# Web3ID

[中文](./README.md) | English

[![Status](https://img.shields.io/badge/status-active_baseline-0A66C2?style=flat-square)](./README_EN.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?style=flat-square)](./LICENSE)

Demo entry: [中文 Demo](./DEMO.md) | [English Demo](./DEMO_EN.md) | [Live Demo](https://web3id-demo.vercel.app)
Presentation: [Chinese PDF deck](./docs/presentation/Web3ID-identity-new-order-zh.pdf)
Project intro video: [YouTube](https://youtu.be/WVd8Uq59klI?si=jzGVF9RF_bTfZXvm)

Web3ID is a Web3 identity baseline built for real systems. It brings programmable identity, proof-aware access, auditability, and governed risk into a single system chain that is explainable, verifiable, and governable.

It is not a wallet-login demo, nor a sample project that loosely stitches together signatures, credentials, risk controls, audit, and operator panels. This repository is about how system boundaries are made real: how identity is anchored, how state evolves, how policy constrains behavior, how audit forms a closed loop, and how AI is kept inside an advisory boundary.

## ✨ Features

### Identity And Control

- `RootIdentity` acts as a stable single-anchor identity derived from controller ownership, instead of scattering identity semantics across surrounding modules.
- `SubIdentity` handles scenario isolation, permission overlays, and risk layering without contaminating root semantics.
- `SubjectAggregate` is only used for explicit subject aggregation, indexing, governance, and audit; it does not act as the `formal state host`.
- `canonical challenge` connects challenge, binding, proof, and audit into one identity chain.
- The versioned `proof envelope` unifies controller proof input shapes so multi-chain verifiers do not drift independently.

### Multi-Chain Controller Support

- EVM controller support has been upgraded to a registry-based model covering `Ethereum Mainnet / BNB Chain / Arbitrum One / Base / OP Mainnet`.
- non-EVM controller families already cover `Solana / Bitcoin / TRON / TON / Cosmos / Aptos / Sui`.
- Multi-chain support consistently flows through the controller registry, `canonical challenge`, `proof envelope`, verifier dispatch, and the structured audit pipeline.
- Multiple roots can be aggregated into the same `SubjectAggregate` through challenge + control proof + audit, but silent merge is never allowed.

### Risk, Policy, And Audit

- The formal state chain is implemented as `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord`.
- `AccessPolicy` and `WarningPolicy` run on separate tracks, supporting dual default/compliance paths and aggregate-aware read context.
- AI review is inside the system, but remains strictly advisory-only; it requires human review and cannot write state directly.
- Structured audit export, replay guard, challenge digest, version replay, and diff-style capabilities are already supported.
- cross-chain input, external attestation, and AI suggestions can only become hints, triggers, or eligibility signals; they cannot bypass local formal semantics.

### Console And Demos

- The frontend console includes wallet, trading, portfolio, history, and profile pages, along with identity graph, inbox, and purchase-flow UI.
- The frontend EVM demo currently supports local Foundry / Anvil (`31337`) and `BNB Chain (56)` as runtime chain targets.
- The frontend supports `zh-CN / zh-TW / en` language switching.
- The frontend supports both `mock` and `api` data source modes for UI demos and external API integration.
- The repository keeps `stage1 / stage2 / stage3 / platform` demo scripts as different observation surfaces over the same baseline system.

## 🏗️ Technical Architecture

```text
Proof & Credential Inputs --> issuer-service --> analyzer-service --> policy-api --> frontend
Proof & Credential Inputs --> Core Packages  --> analyzer-service --> Audit & Replay
policy-api --> contracts
```

- Frontend: `React 19`, `Vite 6`, `React Router 7`, `React Query`, `Tailwind CSS 4`, `Recharts`, `wagmi`, `viem`
- Services: `Express`, `TypeScript`, `zod`
- Core packages: `credential`, `identity`, `policy`, `proof`, `risk`, `sdk`, `state`
- `Audit & Replay`: covers the audit, replay, and governance-oriented system paths
- Contracts: the Foundry contract workspace lives in [`contracts/`](./contracts) and carries verifier / gate / registry semantics
- Verification: `Vitest`, system acceptance gates, and Foundry contract tests

## 🔀 Runtime Modes

- `mock` mode: the frontend uses local demo data and does not depend on an external read-model API, which makes it suitable for UI browsing and static demos.
- `api` mode: when the frontend is configured with `VITE_DATA_SOURCE=api`, it reads from a compatible API surface through `VITE_API_BASE_URL`.
- `pnpm dev`: starts `issuer-service + frontend`, which is suitable for frontend work and minimal integration.
- `pnpm dev:stage3`: starts `issuer-service + analyzer-service + policy-api + frontend`, which is suitable for stage3 / system-baseline integration.

> Note: the current frontend `api` mode expects a compatible read-model API for `/trade/assets`, `/assets`, `/portfolio/positions`, `/history/transactions`, and `/purchases*`. The repository's `issuer-service / analyzer-service / policy-api` mainly expose core system and verification interfaces, and are not a ready-made marketplace or asset-page read-model backend.

## ⚙️ Requirements

- `Node.js 20+`
- `pnpm 10+`
- A local EVM RPC / Anvil instance
- `Foundry` is optional and only needed when running contract commands such as `pnpm contracts:test`

## 🔐 Environment Setup

1. Copy the environment template:

   ```powershell
   cp .env.example .env
   ```

2. Fill in RPC settings, private keys, issuer configuration, and contract addresses as needed.
3. If you want the frontend to switch to `api` mode, also set `VITE_DATA_SOURCE=api` and `VITE_API_BASE_URL`.

### Base Variables (`.env.example`)

| Variable | Description | Default / Notes |
| --- | --- | --- |
| `ANVIL_RPC_URL` | Local EVM RPC URL | `http://127.0.0.1:8545` |
| `PRIVATE_KEY` | Default signer / risk manager fallback private key | Local dev account; demo / dev use only |
| `ISSUER_PRIVATE_KEY` | Signing account private key for `issuer-service` | A local demo value is included in `.env.example` |
| `ISSUER_DID` | Issuer DID | Defaults to a value derived from `ISSUER_PRIVATE_KEY` |
| `ISSUER_ADDRESS` | Issuer address | Defaults to a value derived from `ISSUER_PRIVATE_KEY` |
| `COMPLIANCE_VERIFIER_ADDRESS` | Verifier / gate contract address | Zero-address placeholder by default |
| `RWA_GATE_ADDRESS` | Placeholder RWA gate contract address | Used by demo / contract paths |
| `MOCK_RWA_ASSET_ADDRESS` | Placeholder mock RWA asset contract address | Used by demo / contract paths |
| `VITE_CHAIN_ID` | Frontend chain ID | `31337` |
| `VITE_ANVIL_RPC_URL` | RPC URL used by the frontend | `http://127.0.0.1:8545` |
| `VITE_BNB_RPC_URL` | RPC URL used by the frontend when `VITE_CHAIN_ID=56` | Required for BNB mainnet demos |
| `VITE_ISSUER_API_URL` | `issuer-service` URL used by the frontend | `http://127.0.0.1:4100` |

> Frontend runtime currently supports `31337` for local Foundry / Anvil development and `56` for BNB Chain mainnet demos. The default local flow remains `31337`.

> `.env.example` still keeps `TRUST_REGISTRY_ADDRESS` as a placeholder variable for legacy contract-path compatibility, but the current core service configuration does not read it directly.

### Optional Variables

| Variable | Description | Default / Notes |
| --- | --- | --- |
| `STATE_REGISTRY_ADDRESS` | Shared state anchoring contract address for issuer / analyzer | Zero-address placeholder by default |
| `ISSUER_PORT` | `issuer-service` port | `4100` |
| `ANALYZER_PORT` | `analyzer-service` port | `4200` |
| `POLICY_API_PORT` | `policy-api` port | `4300` |
| `ISSUER_API_URL` | URL used by analyzer / policy-api to reach `issuer-service` | Falls back to `VITE_ISSUER_API_URL` or `http://127.0.0.1:4100` |
| `ANALYZER_API_URL` | URL used by `policy-api` to reach `analyzer-service` | `http://127.0.0.1:4200` |
| `ANALYZER_RECENT_BLOCKS` | Default analyzer backfill window | `250` |
| `OPENAI_API_KEY` | API key for analyzer AI review | Optional; external AI stays disabled if unset |
| `OPENAI_MODEL` | Model name for analyzer AI review | `gpt-4o-mini` |
| `VITE_DATA_SOURCE` | Frontend data source mode | `mock` or `api`, default is `mock` |
| `VITE_API_BASE_URL` | Compatible API base URL for frontend `api` mode | Required when `VITE_DATA_SOURCE=api` |
| `VITE_APP_ENV` | Frontend runtime environment | `development / test / production` |
| `VITE_ANALYZER_API_URL` | Analyzer URL fallback used by `policy-api` / compatibility layers | `http://127.0.0.1:4200` by default |
| `VITE_COMPLIANCE_VERIFIER_ADDRESS` | Vite-space fallback for the verifier address | Zero-address placeholder by default |
| `VITE_STATE_REGISTRY_ADDRESS` | Vite-space fallback for the state registry address | Zero-address placeholder by default |
| `VITE_ENABLE_ANALYTICS` | Frontend analytics toggle | Default is `false` |

## ⚡ Quick Start

### Fast Demo Path

If your goal is to bring up the system narrative and demo baseline as quickly as possible, start with:

```powershell
pnpm install
pnpm proof:setup
pnpm demo:platform
```

This path is best for quickly exploring the platform demo, proof baseline, and the main system narrative without understanding every service interface first.

### Local Development Path

If your goal is local development and service integration, start with:

```powershell
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts:

- `issuer-service`
- `frontend`

If you want to bring up the core service baseline in one shot, run:

```powershell
pnpm dev:stage3
```

`pnpm dev:stage3` starts:

- `issuer-service`
- `analyzer-service`
- `policy-api`
- `frontend`

Default local service URLs:

- `issuer-service`: `http://127.0.0.1:4100`
- `analyzer-service`: `http://127.0.0.1:4200`
- `policy-api`: `http://127.0.0.1:4300`
- `frontend`: `http://127.0.0.1:3000`

If your goal is not to run a demo immediately but to understand the system structure first, continue reading the system narrative below before diving into specific services.

## 🚩 Why This Repository Exists

Many Web3 identity solutions stop at the level of "can log in" or "can issue credentials", but once a system enters real operation, the questions become much harder:

- How does controller identity become a stable identity anchor?
- Which layer should formal state actually run on, instead of being silently replaced by policy or audit?
- How do consequence, policy, review, and audit stay layered without contaminating one another?
- How are cross-chain input, AI suggestions, and external attestations consumed without directly writing local formal state?

The goal of Web3ID is to turn those boundaries into a formal system instead of leaving them as documentation claims. Here:

- `policy is not state`
- `audit` is not after-the-fact supporting material
- AI is not the final decision-maker
- cross-chain input is not a shortcut around local formal semantics

## 🧭 System Claims

Web3ID is built on several system claims that are not allowed to drift.

- `RootIdentity` is a single-controller anchor. It is derived from the control of one address or controller and remains stable, lightweight, and verifiable.
- `SubjectAggregate` is only an explicit subject aggregation layer, not the `formal state host`. It handles binding, indexing, governance, and audit, but does not carry the formal state machine.
- Formal state continues to run on root/sub semantics instead of running on aggregates, audit snapshots, or policy snapshots.
- cross-chain, AI, and any external input can only provide hints, review triggers, or eligibility signals at most. They cannot bypass local challenge, proof, state, and audit boundaries.

That means Web3ID is not a system that first puts everything into one global subject and explains it later. It locks formal boundaries first, then extends capabilities on top of those boundaries.

## 🧩 How The System Is Organized

From a developer point of view, Web3ID is an explainable object chain rather than a flat pile of modules:

```text
Controller Proof
  -> RootIdentity
  -> SubIdentity
  -> RiskSignal
  -> RiskAssessment
  -> StateTransitionDecision
  -> ConsequenceRecord
  -> PolicyDecisionRecord / AuditExportBundle

SubjectAggregate
  -> links multiple RootIdentity objects through explicit challenge + proof + audit
```

Responsibility is clearly split along that chain:

- `RootIdentity -> SubIdentity` provides a stable identity tree and isolates usage, permission, and state overlay layers.
- `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` is the frozen formal state chain.
- `PolicyDecisionRecord` records action-level decisions, but it is not a state fact source.
- `AuditExportBundle` turns explanation, traceability, and evidence continuity into an exportable audit loop.
- `SubjectAggregate` only adds explicit binding and aggregation above roots. It cannot absorb `stored state`, `effective state`, replay facts, or consequence ownership.

## ✨ What Web3ID Has Already Implemented

The following are not future plans. They are capabilities that already exist in this repository and are part of the current system narrative.

### 🔐 Identity And Control

- `RootIdentity` already supports stable derivation from controller ownership and preserves single-anchor semantics.
- `SubIdentity` already exists as a scenario isolation layer that carries permissions and state overlays without polluting root semantics.
- The system already has a unified `canonical challenge` that connects challenge, binding, proof, and audit into one chain.
- Verifier input has already converged on a versioned `proof envelope`, avoiding incompatible proof shapes drifting across chains.

### 🌐 Multi-Chain Controller Support

- The legacy EVM path remains compatible and has been upgraded to registry-based support covering `Ethereum Mainnet / BNB Chain / Arbitrum One / Base / OP Mainnet`.
- non-EVM controller families already cover `Solana / Bitcoin / TRON / TON / Cosmos / Aptos / Sui`.
- Multi-chain support consistently flows through the controller registry, `canonical challenge`, `proof envelope`, verifier dispatch, and the structured audit pipeline.
- Multiple roots can be explicitly aggregated into the same `SubjectAggregate` through challenge + control proof + audit, but silent merge never exists.

### 🧠 Risk, State, And Governance

- The formal state chain `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` is already implemented.
- The system already separates `stored state` from `effective state`, and keeps consequence as an independent layer instead of rewriting facts.
- `AccessPolicy` and `WarningPolicy` are already separated, supporting dual default/compliance paths and aggregate-aware read context.
- AI review is already inside the system, but still remains advisory-only, requires human review, and cannot directly become a state writer.

### 🛡️ Audit, Replay, And Boundary Protection

- Structured audit export is already supported and can export signals, decisions, bindings, proofs, aggregates, and review context.
- Replay guard, challenge digest, version replay, and diff-style capabilities are already in place to help verify whether a chain can be reconstructed.
- The attested cross-domain inbox / cross-chain hint path is already present, but those inputs are consumed locally and do not directly rewrite formal state.
- The system already has a baseline for privacy-capable proof descriptors, recovery / governance hooks, and runtime reliability / outbox capabilities.

Some of these capabilities primarily live in the backend / SDK / analyzer / audit chain rather than being fully represented in the frontend wallet experience. The repository already implements the system foundation, but does not claim that every chain already has a complete dedicated wallet-connect UI.

## 🌐 Multi-Chain Controller Identity Layer

Web3ID already has a registry-backed multi-chain controller identity foundation. The point is not simply "how many chains are supported", but that multi-chain control is placed inside one unified identity abstraction:

- EVM backward compatibility remains unchanged
- All families share the same `canonical challenge` envelope
- All verifier input shares the same versioned `proof envelope`
- All aggregate membership must be established through challenge / proof / audit
- All controller families enter the same audit metadata and replay protection model

The current support matrix is:

- EVM presets: `Ethereum Mainnet`, `BNB Chain`, `Arbitrum One`, `Base`, `OP Mainnet`
- non-EVM families: `Solana`, `Bitcoin`, `TRON`, `TON`, `Cosmos`, `Aptos`, `Sui`

This wave of multi-chain capability mainly lands in the backend / SDK / analyzer / verifier / audit stack. It does not mean the frontend already provides complete wallet-connect and signing UI for every family. What is already surfaced in the frontend EVM demo is local Foundry / Anvil (`31337`) plus `BNB Chain (56)`. That boundary is intentional.

## 🎯 Primary System Entry Points

Although the repository still keeps `stage1 / stage2 / stage3 / platform` demo scripts, it is now better to understand them through the system narrative rather than as unrelated mini-examples.

- `RWA Access`
  - This is the entry point with the strongest compliance constraints. It focuses on how credentials, proofs, and access policy work together with formal state and audit.
- `Enterprise / Audit`
  - This is the entry point with the heaviest audit and operator constraints. It focuses on operator traceability, decision snapshots, evidence continuity, and export.
- `Social Governance`
  - This is the entry point where default paths and governance boundaries are most visible. It focuses on warning policy, state propagation, the AI review boundary, and coexistence with human intervention.

These three entry points are not three separate products. They are three observation surfaces over the same system from different business perspectives.

## 🗂️ Repository Structure

```text
Web3ID/
├─ apps/
│  ├─ frontend/           # React + Vite console
│  ├─ issuer-service/     # Credential issuance, identity registration, state-entry service
│  ├─ analyzer-service/   # Risk analysis, binding, audit, replay, recovery, cross-domain
│  └─ policy-api/         # access / warning policy evaluation
├─ packages/
│  ├─ credential/         # Credential types and issuance-related capabilities
│  ├─ identity/           # RootIdentity / SubIdentity / SubjectAggregate
│  ├─ policy/             # policy IDs and policy model
│  ├─ proof/              # proof runtime, descriptors, helpers
│  ├─ risk/               # risk rules, AI review, audit normalization
│  ├─ sdk/                # family-aware API and system model surface
│  └─ state/              # formal state chain and replay / explanation
├─ contracts/             # Foundry contract workspace
├─ docs/                  # system model, invariants, Phase4 docs
├─ scripts/               # demos, baseline verification, helper scripts
├─ tests/                 # integration / system acceptance tests
└─ README.md
```

By responsibility:

- `apps/` contains concrete services and the console.
- `packages/` contains the system model and reusable semantics.
- `contracts/` contains verifier / registry / gate contract capabilities.
- `docs/` defines frozen boundaries, architecture invariants, and next-stage plans.
- `scripts/` and `tests/` together form the repository's demo narrative and merge gates.

## 🧪 Common Commands

| Category | Command | Description |
| --- | --- | --- |
| Build | `pnpm -r build` | Build workspace packages and apps |
| Static checks | `pnpm -r lint` | Run TypeScript `noEmit` checks |
| Proof smoke | `pnpm proof:smoke` | Verify the proof baseline |
| Integration | `pnpm test:integration` | Core integration path |
| System smoke | `pnpm test:system:smoke` | Main system smoke gate |
| System full | `pnpm test:system` | Main system acceptance gate |
| Mainstream smoke | `pnpm test:system:mainstream:smoke` | Mainstream-chain controller smoke baseline |
| Mainstream full | `pnpm test:system:mainstream` | Mainstream-chain full suite |
| Phase4 smoke | `pnpm test:phase4:smoke` | recovery / cross-domain / privacy smoke |
| Phase4 full | `pnpm test:phase4` | Phase4 acceptance gates |
| Baseline verify | `pnpm verify:baseline:phase4` | Verify the Phase4 baseline |
| Demo | `pnpm demo:stage1` | Stage1 demo |
| Demo | `pnpm demo:stage2` | Stage2 demo |
| Demo | `pnpm demo:stage3` | Stage3 demo |
| Demo | `pnpm demo:platform` | Platform-level demo |
| Contracts | `pnpm contracts:test` | Run Foundry contract tests |

## ✅ Verification And Regression

For a developer-first repository, commands are part of the narrative. They decide which capabilities are just prose and which boundaries are actually enforced by tests and gates.

### 🧪 Workspace Sanity

```powershell
pnpm -r build
pnpm -r lint
pnpm proof:smoke
pnpm test:integration
```

This command set primarily answers whether the workspace can build, lint, run through the proof baseline, and keep the core integration path healthy.

### 🚦 System Gates

```powershell
pnpm test:system:smoke
pnpm test:system:multichain
pnpm test:system:mainstream:smoke
pnpm test:system:mainstream
pnpm test:system
pnpm test:phase4:smoke
pnpm test:phase4
pnpm verify:baseline:phase4
```

These gates are best interpreted as follows:

- `test:system:multichain`
  - Verifies the original multichain root + `SubjectAggregate` baseline.
- `test:system:mainstream:smoke`
  - The merge gate for mainstream-chain controller expansion, emphasizing offline-first, speed, and stability.
- `test:system:mainstream`
  - A more complete full suite that covers more `proofType` variants and deeper structured audit export scenarios.
- `test:system`
  - The main system acceptance gate, which already includes multichain and mainstream smoke coverage.
- `test:phase4`
  - Verifies frozen boundaries such as recovery, cross-domain hints, privacy modes, replay, governance control, and runtime reliability.

### 🖥️ Demos

```powershell
pnpm demo:stage1
pnpm demo:stage2
pnpm demo:stage3
pnpm demo:platform
```

These demos still matter, but they are better treated as different observation surfaces over one baseline system rather than independent examples with split semantics.

## 📌 Current Status

Web3ID is no longer just a proof-of-concept demo repo. It is an evolving system-grade identity baseline.

The repository already has:

- an active, test-gated main system baseline
- multi-chain controller expansion across backend / SDK / analyzer / audit paths
- aggregate-aware identity binding
- a governed recovery baseline, replay-aware auditability, and privacy-capable proof modes
- operator-facing review, traceability, and structured audit export

It is equally important that the repository is explicit about what it does **not** claim:

- `SubjectAggregate` is still not the `formal state host`
- policy does not become a state fact writer
- AI is still advisory rather than the final decision-maker
- cross-chain input is still locally consumed under boundary constraints
- mainstream-chain support at this stage is a backend / SDK / analyzer expansion, not a promise of fully complete per-chain wallet UI

## 🗺️ Roadmap

The roadmap below follows [`docs/PHASE4_IMPLEMENTATION_PLAN.md`](./docs/PHASE4_IMPLEMENTATION_PLAN.md). It clearly separates completed baselines from next-stage planned work and does not present planned work as current state.

### ✅ Completed Baselines

- Multi-chain controller registry and shared proof envelope baseline
- Explicit binding, aggregation, and audit paths for `SubjectAggregate`
- The `RiskSignal -> RiskAssessment -> StateTransitionDecision -> ConsequenceRecord` formal state chain
- Dual `AccessPolicy / WarningPolicy` tracks with aggregate-aware read context
- The AI advisory boundary and human review flow
- replay, audit export, structured explanation, and baseline verification gates

### ⏭️ In Progress / Next Stage

- recovery closed loop
- attested cross-domain state sync
- privacy-capable proof pipeline
- versioning / replay / diff and compatibility layers
- governance & operator control plane
- runtime reliability, repair/backfill, and external integration

## 📚 Further Reading

The README establishes the main narrative. The following documents define the more stable system contracts behind it.

### System Model

- [WHAT_IS_WEB3ID](./docs/WHAT_IS_WEB3ID.md)
- [SYSTEM_MODEL](./docs/SYSTEM_MODEL.md)
- [PLATFORM_BASELINE](./docs/PLATFORM_BASELINE.md)

### Multi-Chain And Subject Aggregation

- [MULTICHAIN_SUBJECT_AGGREGATE](./docs/MULTICHAIN_SUBJECT_AGGREGATE.md)
- [MAINSTREAM_CHAIN_EXPANSION](./docs/MAINSTREAM_CHAIN_EXPANSION.md)
- [CHAIN_FAMILY_MATRIX](./docs/CHAIN_FAMILY_MATRIX.md)

### Recovery, Cross-Domain Input, And Privacy

- [RECOVERY_SYSTEM](./docs/RECOVERY_SYSTEM.md)
- [CROSS_CHAIN_SYNC](./docs/CROSS_CHAIN_SYNC.md)
- [PRIVACY_PROOF_MODES](./docs/PRIVACY_PROOF_MODES.md)

### Runtime, Governance, And Demo Matrix

- [RUNTIME_AND_INTEGRATION](./docs/RUNTIME_AND_INTEGRATION.md)
- [GOVERNANCE_CONTROL_PLANE](./docs/GOVERNANCE_CONTROL_PLANE.md)
- [VERSIONING_AND_REPLAY](./docs/VERSIONING_AND_REPLAY.md)
- [DEMO_MATRIX](./docs/DEMO_MATRIX.md)

### Phase History

- [PHASE3_REPORT](./docs/phases/PHASE3_REPORT.md)
- [README_PHASE3](./docs/phases/README_PHASE3.md)

## 📄 License

Web3ID is licensed under the [Apache License 2.0](./LICENSE).
