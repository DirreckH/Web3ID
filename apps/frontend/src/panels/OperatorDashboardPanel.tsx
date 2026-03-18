import type { OperatorDashboardViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid, TimelineList } from "./PanelPrimitives";

type Props = {
  model: OperatorDashboardViewModel;
  identityReady: boolean;
  selectedSubIdentityId: string | null;
  manualReleaseReasonCode: string;
  manualReleaseEvidence: string;
  manualReleaseNote: string;
  manualListName: "watchlist" | "restricted_list" | "blacklist_or_frozen_list";
  manualListAction: "add" | "remove";
  manualListReasonCode: string;
  manualListEvidence: string;
  manualListExpiresAt: string;
  watchScope: "identity" | "root";
  watchRecentBlocks: string;
  watchPollIntervalMs: string;
  onBindRootController: () => void;
  onBindSelectedSubIdentity: () => void;
  onBindSameRootExtension: () => void;
  onWatch: (action: "refresh" | "start" | "stop") => void;
  onApplySignal: (signalKey: "new_wallet_observation" | "negative_risk_flag" | "sanction_hit" | "governance_participation" | "good_standing") => void;
  onManualReleaseReasonCodeChange: (value: string) => void;
  onManualReleaseEvidenceChange: (value: string) => void;
  onManualReleaseNoteChange: (value: string) => void;
  onManualListNameChange: (value: "watchlist" | "restricted_list" | "blacklist_or_frozen_list") => void;
  onManualListActionChange: (value: "add" | "remove") => void;
  onManualListReasonCodeChange: (value: string) => void;
  onManualListEvidenceChange: (value: string) => void;
  onManualListExpiresAtChange: (value: string) => void;
  onWatchScopeChange: (value: "identity" | "root") => void;
  onWatchRecentBlocksChange: (value: string) => void;
  onWatchPollIntervalMsChange: (value: string) => void;
  onManualRelease: () => void;
  onManualListUpdate: () => void;
};

export function OperatorDashboardPanel(props: Props) {
  return (
    <article className="panel">
      <h2>Operator Dashboard</h2>
      <p className="panel-copy">Low-level controls are intentionally isolated here so the rest of the console can stay summary-first and scenario-driven.</p>
      <MetricGrid items={props.model.metrics} />
      <div className="matrix-grid">
        <div className="info-card">
          <h3>Bindings & Watch Controls</h3>
          <div className="actions">
            <button disabled={!props.identityReady} onClick={props.onBindRootController} type="button">
              Create Root Binding
            </button>
            <button disabled={!props.identityReady || !props.selectedSubIdentityId} onClick={props.onBindSelectedSubIdentity} type="button">
              Create Sub Binding
            </button>
            <button disabled={!props.identityReady} onClick={props.onBindSameRootExtension} type="button">
              Create Same Root Extension
            </button>
          </div>
          <label>
            Watch Scope
            <select value={props.watchScope} onChange={(event) => props.onWatchScopeChange(event.target.value as "identity" | "root")}>
              <option value="identity">Selected Identity</option>
              <option value="root">Root Identity</option>
            </select>
          </label>
          <label>
            Recent Blocks
            <input value={props.watchRecentBlocks} onChange={(event) => props.onWatchRecentBlocksChange(event.target.value)} />
          </label>
          <label>
            Poll Interval (ms)
            <input value={props.watchPollIntervalMs} onChange={(event) => props.onWatchPollIntervalMsChange(event.target.value)} />
          </label>
          <div className="actions">
            <button disabled={!props.identityReady} onClick={() => props.onWatch("start")} type="button">
              Start Watch
            </button>
            <button disabled={!props.identityReady} onClick={() => props.onWatch("refresh")} type="button">
              Refresh Watch
            </button>
            <button disabled={!props.identityReady} onClick={() => props.onWatch("stop")} type="button">
              Stop Watch
            </button>
          </div>
        </div>
        <div className="info-card">
          <h3>Positive Signals</h3>
          <p className="hint">Positive signal thresholds are demo defaults and stay configurable in the runtime config.</p>
          <div className="actions">
            <button disabled={!props.selectedSubIdentityId} onClick={() => props.onApplySignal("new_wallet_observation")} type="button">
              Observe New Wallet
            </button>
            <button disabled={!props.selectedSubIdentityId} onClick={() => props.onApplySignal("negative_risk_flag")} type="button">
              Apply Risk Flag
            </button>
            <button disabled={!props.selectedSubIdentityId} onClick={() => props.onApplySignal("sanction_hit")} type="button">
              Freeze
            </button>
            <button disabled={!props.selectedSubIdentityId} onClick={() => props.onApplySignal("governance_participation")} type="button">
              Governance Boost
            </button>
            <button disabled={!props.selectedSubIdentityId} onClick={() => props.onApplySignal("good_standing")} type="button">
              Recovery Signal
            </button>
          </div>
        </div>
      </div>
      <div className="matrix-grid">
        <div className="info-card">
          <h3>Manual Release</h3>
          <label>
            Reason Code
            <input value={props.manualReleaseReasonCode} onChange={(event) => props.onManualReleaseReasonCodeChange(event.target.value)} />
          </label>
          <label>
            Evidence Refs
            <input value={props.manualReleaseEvidence} onChange={(event) => props.onManualReleaseEvidenceChange(event.target.value)} />
          </label>
          <label>
            Note
            <input value={props.manualReleaseNote} onChange={(event) => props.onManualReleaseNoteChange(event.target.value)} />
          </label>
          <button disabled={!props.selectedSubIdentityId} onClick={props.onManualRelease} type="button">
            Apply Manual Release
          </button>
        </div>
        <div className="info-card">
          <h3>Manual List Override</h3>
          <label>
            List Name
            <select value={props.manualListName} onChange={(event) => props.onManualListNameChange(event.target.value as "watchlist" | "restricted_list" | "blacklist_or_frozen_list")}>
              <option value="watchlist">watchlist</option>
              <option value="restricted_list">restricted_list</option>
              <option value="blacklist_or_frozen_list">blacklist_or_frozen_list</option>
            </select>
          </label>
          <label>
            Action
            <select value={props.manualListAction} onChange={(event) => props.onManualListActionChange(event.target.value as "add" | "remove")}>
              <option value="add">add</option>
              <option value="remove">remove</option>
            </select>
          </label>
          <label>
            Reason Code
            <input value={props.manualListReasonCode} onChange={(event) => props.onManualListReasonCodeChange(event.target.value)} />
          </label>
          <label>
            Evidence Refs
            <input value={props.manualListEvidence} onChange={(event) => props.onManualListEvidenceChange(event.target.value)} />
          </label>
          <label>
            Expires At (ISO, optional)
            <input value={props.manualListExpiresAt} onChange={(event) => props.onManualListExpiresAtChange(event.target.value)} placeholder="2026-03-30T00:00:00.000Z" />
          </label>
          <button disabled={!props.selectedSubIdentityId} onClick={props.onManualListUpdate} type="button">
            Apply Manual List Override
          </button>
        </div>
      </div>
      <TimelineList items={props.model.recentEvents} empty="No operator events recorded yet." />
      <BulletList items={props.model.notes} empty="No operator notes yet." />
      <JsonSectionStack sections={props.model.jsonSections} />
    </article>
  );
}
