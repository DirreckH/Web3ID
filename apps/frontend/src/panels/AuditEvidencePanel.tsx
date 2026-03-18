import type { AuditTargetScope, ListHistoryActionFilter, ListHistoryNameFilter, PolicyKindFilter } from "../console/types";
import type { AuditEvidenceViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

type Props = {
  model: AuditEvidenceViewModel;
  auditTarget: AuditTargetScope;
  auditFrom: string;
  auditTo: string;
  auditPolicyId: string;
  auditPolicyKind: PolicyKindFilter;
  listTarget: AuditTargetScope;
  listName: ListHistoryNameFilter;
  listAction: ListHistoryActionFilter;
  listFrom: string;
  listTo: string;
  onAuditTargetChange: (value: AuditTargetScope) => void;
  onAuditFromChange: (value: string) => void;
  onAuditToChange: (value: string) => void;
  onAuditPolicyIdChange: (value: string) => void;
  onAuditPolicyKindChange: (value: PolicyKindFilter) => void;
  onListTargetChange: (value: AuditTargetScope) => void;
  onListNameChange: (value: ListHistoryNameFilter) => void;
  onListActionChange: (value: ListHistoryActionFilter) => void;
  onListFromChange: (value: string) => void;
  onListToChange: (value: string) => void;
  onRunAuditExport: () => void;
  onRefreshListHistory: () => void;
};

export function AuditEvidencePanel(props: Props) {
  return (
    <article className="panel">
      <h2>Audit & Evidence</h2>
      <p className="panel-copy">Structured export and list history stay focused on traceability: evidence, policy snapshots, anchors, and operator-visible transitions.</p>
      <div className="matrix-grid">
        <div className="info-card">
          <h3>Audit Export</h3>
          <label>
            Target
            <select value={props.auditTarget} onChange={(event) => props.onAuditTargetChange(event.target.value as AuditTargetScope)}>
              <option value="selected_sub">Selected Sub Identity</option>
              <option value="root">Root Identity</option>
            </select>
          </label>
          <label>
            From (ISO, optional)
            <input value={props.auditFrom} onChange={(event) => props.onAuditFromChange(event.target.value)} placeholder="2026-03-01T00:00:00.000Z" />
          </label>
          <label>
            To (ISO, optional)
            <input value={props.auditTo} onChange={(event) => props.onAuditToChange(event.target.value)} placeholder="2026-03-31T23:59:59.000Z" />
          </label>
          <label>
            Policy Id (optional)
            <input value={props.auditPolicyId} onChange={(event) => props.onAuditPolicyIdChange(event.target.value)} placeholder="RWA_BUY_V2" />
          </label>
          <label>
            Policy Kind
            <select value={props.auditPolicyKind} onChange={(event) => props.onAuditPolicyKindChange(event.target.value as PolicyKindFilter)}>
              <option value="">All</option>
              <option value="access">access</option>
              <option value="warning">warning</option>
            </select>
          </label>
          <button onClick={props.onRunAuditExport} type="button">
            Export Structured Audit Bundle
          </button>
        </div>
        <div className="info-card">
          <h3>Risk List History</h3>
          <label>
            Target
            <select value={props.listTarget} onChange={(event) => props.onListTargetChange(event.target.value as AuditTargetScope)}>
              <option value="selected_sub">Selected Sub Identity</option>
              <option value="root">Root Identity</option>
            </select>
          </label>
          <label>
            List Name
            <select value={props.listName} onChange={(event) => props.onListNameChange(event.target.value as ListHistoryNameFilter)}>
              <option value="">All</option>
              <option value="watchlist">watchlist</option>
              <option value="restricted_list">restricted_list</option>
              <option value="blacklist_or_frozen_list">blacklist_or_frozen_list</option>
            </select>
          </label>
          <label>
            Action
            <select value={props.listAction} onChange={(event) => props.onListActionChange(event.target.value as ListHistoryActionFilter)}>
              <option value="">All</option>
              <option value="auto_added">auto_added</option>
              <option value="manually_added">manually_added</option>
              <option value="removed">removed</option>
              <option value="expired">expired</option>
            </select>
          </label>
          <label>
            From (ISO, optional)
            <input value={props.listFrom} onChange={(event) => props.onListFromChange(event.target.value)} placeholder="2026-03-01T00:00:00.000Z" />
          </label>
          <label>
            To (ISO, optional)
            <input value={props.listTo} onChange={(event) => props.onListToChange(event.target.value)} placeholder="2026-03-31T23:59:59.000Z" />
          </label>
          <button onClick={props.onRefreshListHistory} type="button">
            Refresh List History
          </button>
        </div>
      </div>
      <MetricGrid items={props.model.exportMetrics} />
      <MetricGrid items={props.model.historyMetrics} />
      <BulletList items={props.model.notes} empty="No audit notes yet." />
      <JsonSectionStack sections={props.model.jsonSections} />
    </article>
  );
}
