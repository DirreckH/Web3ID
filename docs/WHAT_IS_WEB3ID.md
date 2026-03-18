# WHAT IS WEB3ID

Web3ID 不是一个单点产品名词。

它不是“只做 VC 的库”，不是“只做 KYC 的网关”，也不是“只做 RWA 放行”或“只做黑名单风控”的一段流程。Web3ID 在这个仓库里的定义，是一套把身份、凭证、证明、状态、后果、策略、治理、审计、AI 辅助放进同一平台语义里的控制平面。

## Web3ID 是什么

Web3ID 是一个 capability-first 的 identity platform：

- `identity`
  Root / Sub identity 负责主体建模、隔离和 root 关系。
- `credential`
  凭证负责把可验证资格、属性、角色或合规事实绑定到 identity。
- `proof`
  proof 负责证明“可证明事实”，不负责替 AI 或 policy 下结论。
- `state`
  state 负责记录风险或观察结果的本地事实。
- `consequence`
  consequence 负责限制、放宽、unlock、badge 等运营处置。
- `policy`
  policy 负责针对具体 action 做 allow / restrict / deny / warn 评估。
- `governance`
  governance 负责平台级例外与全局收口，例如 `GLOBAL_LOCKDOWN`。
- `audit`
  audit 负责把 signals / assessments / decisions / consequences / policy snapshots / anchors 串成可追溯证据。
- `ai-assistant`
  AI 只做 suggestion / explanation / review hint，不是 final decision maker。

## Web3ID 不是什么

- 不是“identity = permanent mode label”
  identity 不自带永久 `default` 或 `compliance` 标签，mode 通过 capability、policy、credential、proof、risk state 联合解析。
- 不是“policy decision = state fact”
  policy decision 只是 action-level audit snapshot，不能回写 identity state。
- 不是“positive signal = 无条件恢复”
  正向行为可以帮助恢复和解释，但不能绕过 `deny`、`freeze`、manual release floor 或 compliance 硬要求。
- 不是“AI 评估 = risk engine”
  AI 结果不能直接 freeze、不能直接写 state、不能绕过 review queue。

## 三类场景怎么落在同一平台上

- `RWA Access`
  代表 compliance-first access path，强调 credential + proof + policy allow/deny。
- `Enterprise / Audit`
  代表 enterprise payment / audit export path，强调 policy snapshot、audit bundle、operator traceability。
- `Social Governance`
  代表 default-only path，强调 default behavior、warning、governance participation、AI suggestion 边界。

这三类场景不是三套系统，而是一套平台在不同 policy path 下的不同入口。

## 为什么 P1 改成 scenario-first

P0 阶段重点是把平台语义冻结下来。P1 阶段的目标不是再新增一套 stage，而是把用户理解路径从“先记住 stage1 / stage2 / stage3”改成“先理解平台场景，再选择最合适的 demo 入口”。

所以在 P1：

- README 先解释 Web3ID 是什么
- demo matrix 先按场景组织
- frontend 先展示平台 overview，再展示 operator controls

## 进一步阅读

- `docs/PLATFORM_BASELINE.md`
- `docs/SYSTEM_INVARIANTS.md`
- `docs/IDENTITY_INVARIANTS.md`
- `docs/STATE_SYSTEM_INVARIANTS.md`
- `docs/BOUNDARIES.md`
- `docs/DEMO_MATRIX.md`
