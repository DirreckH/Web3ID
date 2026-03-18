import { IdentityState } from "@web3id/state";
import type { AiReviewViewModel } from "../console/view-models";
import { BulletList, JsonSectionStack, MetricGrid, TimelineList } from "./PanelPrimitives";

type Props = {
  model: AiReviewViewModel;
  phase3Actor: string;
  reviewNote: string;
  reviewReasonCode: string;
  reviewRequestedState: number;
  onActorChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onReviewReasonCodeChange: (value: string) => void;
  onReviewRequestedStateChange: (value: number) => void;
  reviewQueue: Array<any>;
  onConfirmReview: (reviewItemId: string) => void;
  onDismissReview: (reviewItemId: string) => void;
};

export function AiReviewPanel(props: Props) {
  return (
    <article className="panel">
      <h2>AI & Review</h2>
      <p className="panel-copy">AI stays off-chain and advisory. Human review is the only bridge from suggestion to an explicit manual-review signal.</p>
      <MetricGrid items={props.model.reviewMetrics} />
      <div className="matrix-grid">
        <div className="info-card">
          <h3>AI Boundary Notes</h3>
          <BulletList items={props.model.boundaryNotes} empty="No AI boundary notes loaded." />
        </div>
        <div className="info-card">
          <h3>Review Controls</h3>
          <label>
            Actor
            <input value={props.phase3Actor} onChange={(event) => props.onActorChange(event.target.value)} />
          </label>
          <label>
            Requested State
            <select value={String(props.reviewRequestedState)} onChange={(event) => props.onReviewRequestedStateChange(Number(event.target.value))}>
              <option value={String(IdentityState.OBSERVED)}>OBSERVED</option>
              <option value={String(IdentityState.RESTRICTED)}>RESTRICTED</option>
              <option value={String(IdentityState.HIGH_RISK)}>HIGH_RISK</option>
              <option value={String(IdentityState.FROZEN)}>FROZEN</option>
            </select>
          </label>
          <label>
            Review Reason Code
            <input value={props.reviewReasonCode} onChange={(event) => props.onReviewReasonCodeChange(event.target.value)} />
          </label>
          <label>
            Review Note
            <input value={props.reviewNote} onChange={(event) => props.onReviewNoteChange(event.target.value)} />
          </label>
        </div>
      </div>
      <TimelineList items={props.model.reviewItems} empty="No review items queued yet." />
      {props.reviewQueue.length ? (
        <div className="review-list">
          {props.reviewQueue.map((item) => (
            <div className="review-item" key={item.reviewItemId}>
              <strong>{item.status}</strong>
              <p>{item.reviewItemId}</p>
              <div className="actions">
                <button disabled={item.status !== "PENDING_REVIEW"} onClick={() => props.onConfirmReview(item.reviewItemId)} type="button">
                  Confirm Review
                </button>
                <button disabled={item.status !== "PENDING_REVIEW"} onClick={() => props.onDismissReview(item.reviewItemId)} type="button">
                  Dismiss Review
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <JsonSectionStack sections={props.model.jsonSections} />
    </article>
  );
}
