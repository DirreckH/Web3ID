# State System Invariants

本页冻结 `packages/state` 与 `packages/risk` 共用的状态主链路语义。

## 固定链路

状态链路顺序固定为：

`signal -> assessment -> decision -> state update -> consequence application -> recovery/propagation`

- `RiskSignal`
  风险输入和证据引用。
- `RiskAssessment`
  对 signal 的规则、人工或 AI 辅助评估。
- `StateTransitionDecision`
  合法状态变更的正式决策。
- `ConsequenceRecord`
  决策生效后的运营处置。
- `RecoveryRule`
  consequence 或 state 可恢复时的判定条件。

## 状态语义

- `stored state`
  identity 本地事实状态，是 replay 后的本体判断。
- `effective state`
  `stored state + propagated effect + root overlay` 的结果。
- `propagated effect`
  来自 sibling/root/governance 传播规则的叠加影响。
- `consequence`
  状态触发的限制或放宽动作，不等于状态本身。
- `reentry`
  通过 clean window、positive signals、manual release floor 等机制实现的恢复过程。

## 状态顺序

- `INIT=0`
- `NORMAL=1`
- `OBSERVED=2`
- `RESTRICTED=3`
- `HIGH_RISK=4`
- `FROZEN=5`

状态顺序是冻结语义，不允许改变。
