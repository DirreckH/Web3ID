import type { EnterpriseAction, Scenario, SocialAction } from "../console/types";
import type { PlatformOverviewViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

type Props = {
  model: PlatformOverviewViewModel;
  scenario: Scenario;
  enterpriseAction: EnterpriseAction;
  socialAction: SocialAction;
  onScenarioChange: (scenario: Scenario) => void;
  onEnterpriseActionChange: (action: EnterpriseAction) => void;
  onSocialActionChange: (action: SocialAction) => void;
};

export function PlatformOverviewPanel({
  model,
  scenario,
  enterpriseAction,
  socialAction,
  onScenarioChange,
  onEnterpriseActionChange,
  onSocialActionChange,
}: Props) {
  return (
    <article className="panel">
      <h2>System Entry</h2>
      <p className="panel-copy">{model.scenarioSummary}</p>
      <div className="pill-grid">
        {model.badges.map((badge) => (
          <span className="hero-pill subtle-pill" key={badge}>
            {badge}
          </span>
        ))}
      </div>
      <div className="scenario-grid">
        {model.scenarioCards.map((card) => (
          <button
            className={`scenario-card ${card.active ? "active" : ""}`}
            key={card.id}
            onClick={() => onScenarioChange(card.id)}
            type="button"
          >
            <strong>{card.label}</strong>
            <span>{card.description}</span>
            <span>{card.policyPath}</span>
            <span>Best for: {card.recommendedDemo}</span>
          </button>
        ))}
      </div>
      {scenario === "enterprise" ? (
        <div className="segmented compact">
          <button className={enterpriseAction === "payment" ? "active" : ""} onClick={() => onEnterpriseActionChange("payment")} type="button">
            Payment
          </button>
          <button className={enterpriseAction === "audit" ? "active" : ""} onClick={() => onEnterpriseActionChange("audit")} type="button">
            Audit
          </button>
        </div>
      ) : null}
      {scenario === "social" ? (
        <div className="segmented compact">
          <button className={socialAction === "vote" ? "active" : ""} onClick={() => onSocialActionChange("vote")} type="button">
            Vote
          </button>
          <button className={socialAction === "airdrop" ? "active" : ""} onClick={() => onSocialActionChange("airdrop")} type="button">
            Airdrop
          </button>
          <button className={socialAction === "post" ? "active" : ""} onClick={() => onSocialActionChange("post")} type="button">
            Post
          </button>
        </div>
      ) : null}
      <MetricGrid items={model.metrics} />
      <div className="info-card">
        <h3>System Map</h3>
        <BulletList items={model.systemMap} empty="System map will appear after the baseline loads." />
      </div>
      <BulletList items={model.guardrails} empty="No platform guardrails loaded." />
      <JsonSectionStack sections={model.jsonSections} />
    </article>
  );
}
