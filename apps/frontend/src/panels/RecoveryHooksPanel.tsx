import type { RecoveryHooksViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

export function RecoveryHooksPanel({ model }: { model: RecoveryHooksViewModel }) {
  return (
    <article className="panel">
      <h2>Recovery Hooks</h2>
      <p className="panel-copy">Reserved guardian and recovery-policy metadata. This panel is read-only in P2.</p>
      <MetricGrid items={model.metrics} />
      <BulletList items={model.notes} empty="No recovery notes yet." />
      <JsonSectionStack sections={model.jsonSections} />
    </article>
  );
}
