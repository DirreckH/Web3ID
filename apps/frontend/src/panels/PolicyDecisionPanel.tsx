import type { EnterpriseAction, Scenario, SocialAction } from "../console/types";
import type { PolicyDecisionViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid } from "./PanelPrimitives";

type Props = {
  model: PolicyDecisionViewModel;
  scenario: Scenario;
  enterpriseAction: EnterpriseAction;
  socialAction: SocialAction;
  payloadReady: boolean;
  isSubmitting: boolean;
  rwaGateAddress: string;
  enterpriseGateAddress: string;
  socialGateAddress: string;
  assetAddress: string;
  rwaAmount: string;
  paymentAmount: string;
  beneficiary: string;
  paymentRef: string;
  auditRef: string;
  proposalId: string;
  airdropRoundId: string;
  postRef: string;
  onRwaGateChange: (value: string) => void;
  onEnterpriseGateChange: (value: string) => void;
  onSocialGateChange: (value: string) => void;
  onAssetChange: (value: string) => void;
  onRwaAmountChange: (value: string) => void;
  onPaymentAmountChange: (value: string) => void;
  onBeneficiaryChange: (value: string) => void;
  onPaymentRefChange: (value: string) => void;
  onAuditRefChange: (value: string) => void;
  onProposalIdChange: (value: string) => void;
  onAirdropRoundIdChange: (value: string) => void;
  onPostRefChange: (value: string) => void;
  onBuildPayload: () => void;
  onSubmitRwa: () => void;
  onSubmitEnterprisePayment: () => void;
  onExportAudit: () => void;
  onSubmitSocialAction: () => void;
};

export function PolicyDecisionPanel(props: Props) {
  return (
    <article className="panel">
      <h2>Policy Decisions</h2>
      <p className="panel-copy">Mode resolution, proof readiness, access/warning decisions, and policy snapshots all stay visible without letting policy become a state fact source.</p>
      <MetricGrid items={props.model.policyMetrics} />
      <MetricGrid items={props.model.decisionMetrics} />
      <BulletList items={props.model.notes} empty="No policy notes yet." />
      <div className="info-card">
        <h3>Scenario Action Builder</h3>
        <button onClick={props.onBuildPayload} type="button">
          Build Access Payload
        </button>
        {props.scenario === "rwa" ? (
          <>
            <label>
              RWA Gate Address
              <input value={props.rwaGateAddress} onChange={(event) => props.onRwaGateChange(event.target.value)} />
            </label>
            <label>
              Asset Address
              <input value={props.assetAddress} onChange={(event) => props.onAssetChange(event.target.value)} />
            </label>
            <label>
              Amount
              <input value={props.rwaAmount} onChange={(event) => props.onRwaAmountChange(event.target.value)} />
            </label>
            <button disabled={!props.payloadReady || props.isSubmitting} onClick={props.onSubmitRwa} type="button">
              {props.isSubmitting ? "Submitting..." : "Submit buyRwa"}
            </button>
          </>
        ) : null}
        {props.scenario === "enterprise" && props.enterpriseAction === "payment" ? (
          <>
            <label>
              Enterprise Gate Address
              <input value={props.enterpriseGateAddress} onChange={(event) => props.onEnterpriseGateChange(event.target.value)} />
            </label>
            <label>
              Beneficiary
              <input value={props.beneficiary} onChange={(event) => props.onBeneficiaryChange(event.target.value)} />
            </label>
            <label>
              Amount
              <input value={props.paymentAmount} onChange={(event) => props.onPaymentAmountChange(event.target.value)} />
            </label>
            <label>
              Payment Ref
              <input value={props.paymentRef} onChange={(event) => props.onPaymentRefChange(event.target.value)} />
            </label>
            <button disabled={!props.payloadReady || props.isSubmitting} onClick={props.onSubmitEnterprisePayment} type="button">
              {props.isSubmitting ? "Submitting..." : "Submit Payment"}
            </button>
          </>
        ) : null}
        {props.scenario === "enterprise" && props.enterpriseAction === "audit" ? (
          <>
            <label>
              Enterprise Gate Address
              <input value={props.enterpriseGateAddress} onChange={(event) => props.onEnterpriseGateChange(event.target.value)} />
            </label>
            <label>
              Audit Ref
              <input value={props.auditRef} onChange={(event) => props.onAuditRefChange(event.target.value)} />
            </label>
            <button disabled={!props.payloadReady || props.isSubmitting} onClick={props.onExportAudit} type="button">
              {props.isSubmitting ? "Submitting..." : "Export Audit Record"}
            </button>
          </>
        ) : null}
        {props.scenario === "social" ? (
          <>
            <label>
              Social Gate Address
              <input value={props.socialGateAddress} onChange={(event) => props.onSocialGateChange(event.target.value)} />
            </label>
            {props.socialAction === "vote" ? (
              <label>
                Proposal Id
                <input value={props.proposalId} onChange={(event) => props.onProposalIdChange(event.target.value)} />
              </label>
            ) : null}
            {props.socialAction === "airdrop" ? (
              <label>
                Round Id
                <input value={props.airdropRoundId} onChange={(event) => props.onAirdropRoundIdChange(event.target.value)} />
              </label>
            ) : null}
            {props.socialAction === "post" ? (
              <label>
                Post Ref
                <input value={props.postRef} onChange={(event) => props.onPostRefChange(event.target.value)} />
              </label>
            ) : null}
            <button disabled={!props.payloadReady || props.isSubmitting} onClick={props.onSubmitSocialAction} type="button">
              {props.isSubmitting ? "Submitting..." : "Submit Social Action"}
            </button>
          </>
        ) : null}
      </div>
      <JsonSectionStack sections={props.model.jsonSections} />
    </article>
  );
}
