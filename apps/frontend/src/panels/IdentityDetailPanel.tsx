import type { IdentityDetailViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

type Props = {
  model: IdentityDetailViewModel;
  address?: string;
  subIdentities: Array<{ id: string; label: string }>;
  selectedSubIdentityId: string;
  onSelectedSubIdentityChange: (value: string) => void;
  canConnect: boolean;
  isConnecting: boolean;
  identityReady: boolean;
  canIssueCredentials: boolean;
  onConnect: () => void;
  onDeriveIdentity: () => void;
  onIssueCredentials: () => void;
};

export function IdentityDetailPanel({
  model,
  address,
  subIdentities,
  selectedSubIdentityId,
  onSelectedSubIdentityChange,
  canConnect,
  isConnecting,
  identityReady,
  canIssueCredentials,
  onConnect,
  onDeriveIdentity,
  onIssueCredentials,
}: Props) {
  return (
    <article className="panel">
      <h2>Identity Detail</h2>
      <p className="panel-copy">{address ?? "Connect a wallet to derive the root and sub identity tree."}</p>
      <div className="actions">
        <button disabled={!canConnect || isConnecting} onClick={onConnect} type="button">
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
        <button disabled={!address} onClick={onDeriveIdentity} type="button">
          Sign Identity Challenge
        </button>
        <button disabled={!canIssueCredentials || !identityReady} onClick={onIssueCredentials} type="button">
          Issue Scenario Credential
        </button>
      </div>
      <label>
        Scenario Sub Identity
        <select value={selectedSubIdentityId} onChange={(event) => onSelectedSubIdentityChange(event.target.value)}>
          {subIdentities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <MetricGrid items={model.metrics} />
      <MetricGrid items={model.credentialMetrics} />
      <MetricGrid items={model.aggregateMetrics} />
      <BulletList items={model.notes} empty="No identity notes yet." />
      <JsonSectionStack sections={model.jsonSections} />
    </article>
  );
}
