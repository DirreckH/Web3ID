# State Attribution and Consequence Flow

This phase formalizes the state pipeline and keeps its execution order fixed.

## Fixed Order

`signal -> assessment -> decision -> state update -> consequence application`

## Semantic Roles

- `State` is the system judgment about current identity risk.
- `Consequence` is the operational treatment applied because of that judgment.
- Policy enforcement reads `state + consequence + effectiveMode + proof`.
- Recovery removes or relaxes consequences first and only changes state through a new decision.

## Off-Chain History, On-Chain Anchors

Complete attribution history stays off-chain in the state service.

Off-chain records include:

- signals
- assessments
- transition decisions
- recovery rules
- active and resolved consequences
- propagation decisions

`IdentityStateRegistry` stores only:

- current state
- minimal audit anchors such as `lastDecisionRef` and `lastEvidenceHash`
- event logs for reason and audit references

The registry is not a full decision-history database.

## Social Signal Sources

The Social Governance demo only uses deterministic and mockable signal sources in this phase.

Allowed examples:

- fixture wallet-age observations
- mock governance participation
- mock trusted usage
- mock negative risk flags
- simple counters derived from local test-chain interactions

Not allowed in this phase:

- external indexers
- mainnet historical profiling
- third-party risk APIs
- complex multi-chain behavior scoring

## Positive Signals

Positive signals exist only as lightweight demo features in this phase.

Examples:

- long-term good standing
- repeated governance participation
- trusted protocol usage

Positive consequences remain intentionally simple, such as limited access unlocks or trust badges.
