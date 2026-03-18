import type { StateConsequenceViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

export function StateConsequencePanel({ model }: { model: StateConsequenceViewModel }) {
  return (
    <article className="panel">
      <h2>State & Consequence</h2>
      <p className="panel-copy">Stored and effective state stay separate, while consequence and recovery explain what the platform is doing with that state.</p>
      <MetricGrid items={model.stateMetrics} />
      <MetricGrid items={model.consequenceMetrics} />
      <div className="matrix-grid">
        <div className="info-card">
          <h3>Recovery Progress</h3>
          <BulletList items={model.recoveryNotes} empty="No recovery progress yet." />
        </div>
        <div className="info-card">
          <h3>Propagation Overlay</h3>
          <BulletList items={model.propagationNotes} empty="No propagation overlay recorded." />
        </div>
      </div>
      <JsonSectionStack sections={model.jsonSections} />
    </article>
  );
}
