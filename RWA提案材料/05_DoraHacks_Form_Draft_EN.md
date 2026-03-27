# DoraHacks Form Draft EN

This file is a ready-to-adapt English draft for likely DoraHacks or external application form fields.

## Project Name

Web3ID for RWA

## One-line Summary

Web3ID is an identity, proof verification, and compliance execution layer for sustainable compliant liquidity in real-world asset ecosystems.

## Project Category / RWA Relevance

Web3ID is directly focused on the RWA sector because it addresses one of the core bottlenecks of tokenized real-world assets: how to maintain compliant participation and circulation without collapsing entirely into static address whitelists or centralized manual controls.

## Problem Statement

RWA systems face a structural contradiction. Real-world assets require investor qualification checks, jurisdictional restrictions, sanction screening, and ongoing compliance, while blockchain assets are freely transferable by default. Most current solutions rely on centralized custody or static whitelists, which reduce liquidity, composability, and long-term scalability.

## Solution

Web3ID replaces the whitelisted address model with a whitelisted state model. Instead of checking whether an address is permanently approved, the system verifies whether a user or sub-identity can prove eligibility against an active rule set at action time. This enables privacy-aware, dynamic, and auditable access control for RWA participation.

## What Makes This Technically Unique

- proof-aware transfer gating
- dynamic compliance checks at action time
- layered identity design with `RootIdentity`, `SubIdentity`, and `SubjectAggregate`
- jurisdiction-aware rule execution
- audit and governance boundary built into the system model
- AI constrained to an advisory-only role

## Current Prototype

We already have a public prototype and supporting materials:

- Live Demo: `https://web3id-demo.vercel.app`
- GitHub Repository: `https://github.com/DirreckH/Web3ID`
- Public Presentation Deck: `https://github.com/DirreckH/Web3ID/blob/main/docs/presentation/Web3ID-identity-new-order-zh.pdf`

The prototype currently demonstrates wallet identity views, RWA purchase flows, approved/review/restricted outcomes, and audit-oriented system surfaces.

## Product Stage

Web3ID is currently in the prototype and public demo stage, with a working front-end prototype, public documentation, and a system-level design baseline for identity, compliance, audit, and policy execution.

## Early-stage Statement

Use the following only after confirming it is true:

No token has been issued, and fundraising has not yet been completed.

## Tokenomics / Business Model

Web3ID does not depend on a token issuance model. Its economic design is based on non-token infrastructure and service revenue:

- issuer onboarding and compliance configuration fees
- proof verification and rule execution service fees
- enterprise-grade audit, governance, and workflow tooling

The value flow is based on reducing compliance friction, improving traceability, and enabling more sustainable compliant liquidity for RWA platforms and issuers.

## Team

Replace this section with real information before submission.

Suggested short form:

`[Team name] is building Web3ID as an identity and compliance execution baseline for RWA. The team combines product, engineering, and domain knowledge across Web3 infrastructure, compliance-aware workflows, and system design.`

## Roadmap

Short version:

- current: public prototype, public documentation, live demo, purchase outcome flows
- next: richer rule modules, API-backed demo flows, issuer/operator workflows, and BNB Chain aligned RWA execution scenarios

## Why Now

RWA adoption is growing, but the infrastructure layer for sustainable compliant liquidity is still immature. The market needs systems that can combine identity, proof, dynamic compliance, and auditability rather than relying only on static onboarding and manual release.

## BNB Chain Alignment

Web3ID should be positioned as a compatible identity and rule execution layer for BNB Chain based RWA scenarios. Unless production deployment is completed, do not claim that BNB Chain integration is already live.

Recommended wording:

Web3ID is building an identity, proof verification, and rule execution layer that can support BNB Chain based RWA issuance, access control, and compliant circulation.

## Ask / Why We Are Applying

We are applying to RWA Demo Day to validate Web3ID as a foundational layer for compliant RWA participation, gain expert feedback, and connect with ecosystem partners who care about real deployment paths for compliant liquidity infrastructure.

