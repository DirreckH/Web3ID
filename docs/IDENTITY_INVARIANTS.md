# Identity Invariants

本页冻结 `packages/identity` 的核心语义。补充文档请回看 `docs/PLATFORM_BASELINE.md`。

## Root Identity

- `rootId = keccak256("did:pkh:eip155:<chainId>:<checksumAddress>")`。
- `identityId = keccak256(rootId)`。
- 对同一 `chainId + controllerAddress`，Root Identity 唯一且不可变。
- Root Identity 表示控制权根，不等于永久 mode 标签。

## Sub Identity

- `scope` 先做 normalize，再参与 `subIdentityId` 派生。
- `subIdentityId = keccak256(rootId + normalizedScope + subIdentityType)`。
- `identityId = keccak256(subIdentityId)`。
- 一旦派生完成，`normalizedScope` 视为 immutable 语义，不允许在同一 identityId 上改写 scope 含义。

## Capability-First

- identity 表达的是能力，不是 policy requirement。
- 核心能力字段：
  `supportsHolderBinding`
  `supportsIssuerValidation`
  `hasLinkedCredentials`
  `supportedProofKinds`
  `preferredMode`
- `preferredMode` 是 identity 的倾向。
- `effectiveMode` 是在某条 policy 上结合 `allowedModes`、`requiresComplianceMode` 和 linked credentials 之后得出的实际路径。

## preferredMode 与 effectiveMode

- `preferredMode`
  来源于 identity capabilities 或 sub-identity 默认 profile。
- `effectiveMode`
  来源于 `resolveEffectiveMode(identity, policy, { linkedCredentialTypes })`。
- 如果 policy 要求 compliance 但 identity 没有 linked credentials，则 `effectiveMode` 为 `null`。

## supportsPolicy 判定口径

- `supportsPolicy` 必须同时考虑：
  policy `allowedModes`
  policy `requiresComplianceMode`
  identity capabilities
  linked credentials
- `supportsPolicy` 返回的是该 identity 是否可在当前 policy 上找到合法 `effectiveMode`。

## 子身份权限冻结

### `riskIsolationLevel`
- `LOW`
  风险隔离最弱，通常用于社交类默认路径。
- `MEDIUM`
  中等隔离，用于允许合规升级但不要求最高隔离的路径。
- `HIGH`
  高隔离，用于支付、匿名低风险等更强调边界的路径。

### `linkabilityLevel`
- `NONE`
  不允许同根可链接。
- `SAME_SCOPE`
  只允许同 scope class 的有限关联。
- `ROOT_LINKABLE`
  允许在合规或治理边界下追溯到 root。

### `canEscalateToRoot`
- `true`
  允许 root escalation 规则生效。
- `false`
  子身份风险默认不向 root 上卷。

### `inheritsRootRestrictions`
- `true`
  root stored state 会通过 overlay 影响 child effective state。
- `false`
  child effective state 不继承 root restriction floor。

## default path 与 compliance path

- 只能走 default path：
  identity 仅支持 `holder_bound_proof`
  或 policy 仅允许 `DEFAULT_BEHAVIOR_MODE`
  或 identity 没有 issuer validation / linked credentials。
- 可以进入 compliance path：
  policy 允许 `COMPLIANCE_MODE`
  identity 支持 `credential_bound_proof`
  identity 支持 issuer validation
  存在 linked credentials。

## 当前子身份基线

- `SOCIAL`
  default-only，`allowRootLink=false`，`canEscalateToRoot=false`。
- `ANONYMOUS_LOWRISK`
  default-only，`allowRootLink=false`，`inheritsRootRestrictions=false`。
- `RWA_INVEST`
  compliance-first，允许 linked credentials 和 root escalation。
- `PAYMENTS`
  compliance-first，允许 linked credentials 和 root escalation。
