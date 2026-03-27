# Web3ID for RWA Submission Draft

## Project Overview

Web3ID is a Web3 identity and compliance execution baseline designed for real systems. It combines programmable identity, proof-aware access, governed risk, and auditable state transitions into one explainable and verifiable system chain.

For the RWA sector, Web3ID is not another wallet login layer or a static whitelist tool. It is a rule-aware identity and compliance layer that determines whether a user, sub-identity, or subject state is currently eligible to access, purchase, hold, or transfer a regulated real-world asset.

## Problem Statement

RWA adoption is constrained by a structural contradiction:

- real-world assets require compliance restrictions, jurisdictional boundaries, investor qualification checks, and sanction screening
- on-chain assets are freely transferable by default

Most current RWA systems solve this contradiction through highly centralized custody, manual controls, address freezes, or rigid whitelists. That approach weakens on-chain liquidity and composability.

There are also three deeper problems:

1. Compliance is dynamic, but most systems validate only once at entry.
2. Cross-jurisdiction rules conflict, but blockchains are globally accessible.
3. Address-based whitelisting is too brittle for privacy-preserving, multi-context identity use.

## Our Solution

Web3ID shifts the model from a whitelisted address to a whitelisted state.

Traditional logic:

```text
if address in whitelist:
  allow transfer
```

Web3ID logic:

```text
if verify(Web3ID proof, rule_set):
  allow transfer
```

This change matters because:

- compliance is tied to verifiable state, not to a single forever-whitelisted address
- users can prove eligibility without exposing all identity details
- rule updates can be applied continuously
- RWA circulation can remain compliant without collapsing fully into manual custodial control

## Core Technical Design

### 1. Proof-aware transfer gating

Sensitive actions such as RWA purchase, transfer, or position expansion are evaluated through proof-aware access instead of static access lists. Eligibility depends on the current rule set, proof validity, and policy context.

### 2. Dynamic compliance

Web3ID treats compliance as an ongoing condition. At action time, the system can re-check:

- current compliance status
- current risk level
- credential validity
- jurisdiction-specific policy constraints

This addresses expired qualifications, changing regulations, contaminated addresses, and shifting risk conditions.

### 3. Layered identity and sub-identity isolation

Web3ID separates:

- `RootIdentity` for anchored control
- `SubIdentity` for scenario isolation and risk partitioning
- `SubjectAggregate` for explicit merge, indexing, governance, and audit only

For RWA, this creates cleaner isolation across assets, compliance scopes, and operational lanes without forcing all regulated activity into one monolithic wallet identity.

### 4. Cross-jurisdiction rule execution

Different asset categories and jurisdictions can map to different `rule_set` definitions. The user does not need to manually understand every rule. The system verifies proofs against the active rule set and either allows, queues for review, or restricts the action while preserving audit evidence.

### 5. Auditable governance boundary

Web3ID does not stop at front-end gating. It connects signals, assessments, policy decisions, consequences, and audit outputs into one system chain. AI can assist explanation and review, but it remains advisory-only and cannot directly write formal state.

## Why This Matters for RWA

RWA infrastructure needs more than tokenized asset pages. It needs an execution layer that can sustain compliant liquidity over time.

Web3ID addresses that need by enabling:

- continuous compliance rather than one-time onboarding
- rule-based eligibility instead of centralized ad hoc release
- scenario-specific identity isolation instead of single-address overloading
- cross-jurisdiction policy execution without fully exposing user identity
- stronger auditability for issuers, operators, and institutional participants

## Prototype and Demo

The project already has a public prototype and supporting materials:

- Live Demo: `https://web3id-demo.vercel.app`
- GitHub Repository: `https://github.com/DirreckH/Web3ID`
- Public Presentation Deck: `https://github.com/DirreckH/Web3ID/blob/main/docs/presentation/Web3ID-identity-new-order-zh.pdf`

The current prototype demonstrates:

- wallet and identity tree views
- RWA trading and purchase flow
- approved / review / restricted purchase outcomes
- compliance-aware interaction paths
- history and audit-oriented UI surfaces

## Non-token Economic Design

This project does not rely on a token issuance narrative. For this submission, the `tokenomics` section is expressed as a non-token economic design and business model.

### Revenue layers

1. Issuer onboarding and compliance configuration fees  
   RWA issuers can pay for identity rule configuration, eligibility policy setup, and compliance-aware issuance support.

2. Verification and execution service fees  
   Platforms can pay for proof verification, policy evaluation, audit packaging, and rule execution infrastructure.

3. Enterprise SaaS and governance tooling  
   Institutional users can subscribe to dashboards, audit exports, policy orchestration, operator workflows, and governance control surfaces.

### Value flow

- issuers reduce compliance operating friction
- platforms gain programmable and explainable eligibility infrastructure
- investors receive a lower-friction but still compliant access path
- audit and compliance stakeholders gain a cleaner evidence chain

### Incentive structure

The system is designed to align participants through utility and workflow efficiency rather than token speculation:

- better compliant liquidity for issuers
- lower manual review cost for platforms
- more portable, privacy-aware access proofs for users
- better traceability for compliance and audit partners

## Team

Team details should be filled with real information before submission.

Please add:


- team name
- founders or core members
- role allocation
- relevant background
- DoraHacks contact information

## Roadmap

### Current stage

- public demo and GitHub materials are live
- RWA purchase flows are visualized through approved / review / restricted outcomes
- identity layering, compliance mode, and audit-aware system modeling are already implemented at prototype level

### Next stage

- formalize jurisdiction-specific RWA rule modules
- extend the prototype from showcase mode to richer API-backed flows
- deepen issuer / operator / compliance workbench surfaces
- adapt the execution layer to BNB Chain-oriented RWA deployment scenarios

## BNB Chain Alignment

The current submission should position Web3ID as an enabling layer for BNB Chain based RWA scenarios, not as a finished BNB Chain production rollout unless that becomes factually true before final submission.

Recommended wording:

> Web3ID is building the identity, proof verification, and rule execution layer that can support BNB Chain based RWA issuance, access control, and compliant circulation.

## Early-stage Statement

Please confirm the following statements before final submission:

- `No token has been issued.`
- `Fundraising has not yet been completed.`

If both are accurate, keep them in the final form submission and deck.

## Submission Close

Web3ID is an RWA-relevant infrastructure project focused on sustainable compliant liquidity, dynamic rule execution, and auditable access control. It is already demonstrable as a prototype and is positioned to evolve into a practical execution layer for real-world asset participation and circulation.



