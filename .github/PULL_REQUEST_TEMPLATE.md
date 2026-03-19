## System Gate Checklist

- [ ] If this PR changes frozen semantics, I updated the baseline docs, invariants, and related tests.
- [ ] If this PR changes stable interfaces, I updated docs, demo-facing entry points, and tests.
- [ ] If this PR changes reserved extensions, I stated whether they are still `hook_only`.
- [ ] If this PR touches `policy / state / consequence / audit / reserved hooks`, I ran `pnpm test:system`.

## Phase4 Change Checklist

- [ ] I stated the affected domains: `identity / state / consequence / policy / audit / recovery / cross-chain / proof / frontend / operator / reliability / integration`.
- [ ] I stated whether frozen semantics changed. If yes, I updated baseline docs and acceptance coverage.
- [ ] I stated whether stable interfaces changed. If yes, I updated SDK/API/docs/demo entry points.
- [ ] If this PR touches reserved hook descendants, I stated whether they are still `default-off / controlled-on`.
- [ ] If this PR introduces break-glass behavior, it is limited to `queue_unblock`, `temporary_release`, or `consequence_rollback`, and does not raw-write state.
- [ ] If this PR introduces positive uplift behavior, it is explanation-first and audit-linked.

## Notes

- System model impact:
- Explanation / audit chain impact:
- Reserved guardrail impact:
- Milestone gate impact:
- Phase4 affected domains:
