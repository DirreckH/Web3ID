import type { RecoveryHooksViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

export function RecoveryHooksPanel({ model }: { model: RecoveryHooksViewModel }) {
  return (
    <article className="panel">
      <h2>Recovery Hooks</h2>
      <p className="panel-copy">Recovery is now a governed Phase4 workflow: hooks, approvals, execution traces, and cross-chain hints all stay visible without bypassing the frozen semantics.</p>
      <MetricGrid items={model.metrics} />
      <BulletList items={model.notes} empty="No recovery notes yet." />
      <JsonSectionStack sections={model.jsonSections} />
    </article>
  );
}
