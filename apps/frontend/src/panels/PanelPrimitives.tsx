import type { JsonSection, MetricItem, TimelineItem } from "../console/view-models";

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div className="meta-grid">
      {items.map((item) => (
        <div key={item.label}>
          <strong>{item.label}</strong>
          <p>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <p className="hint">{empty}</p>;
  }

  return (
    <ul className="data-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function TimelineList({ items, empty }: { items: TimelineItem[]; empty: string }) {
  if (!items.length) {
    return <p className="hint">{empty}</p>;
  }

  return (
    <div className="timeline-list">
      {items.map((item) => (
        <div className="timeline-item" key={`${item.title}-${item.meta}`}>
          <strong>{item.title}</strong>
          <span>{item.meta}</span>
          <p>{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function JsonSectionStack({ sections }: { sections: JsonSection[] }) {
  return (
    <div className="json-stack">
      {sections.map((section) => (
        <div key={section.label}>
          <h3>{section.label}</h3>
          {section.value ? <pre>{section.value}</pre> : <p className="hint">{section.empty}</p>}
        </div>
      ))}
    </div>
  );
}
