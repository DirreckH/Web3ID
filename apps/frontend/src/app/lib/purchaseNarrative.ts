import type { PortfolioPosition } from "../data/demoData";
import type { AssetType } from "./assetMeta";

export type PurchaseVerdict = "approved" | "review" | "restricted";
export type PurchaseTone = "emerald" | "amber" | "red";
export type TrustSignalStatus = "verified" | "review" | "restricted";
export type HoldingImpactState = "approved" | "pending-review" | "blocked";

export interface NarrativeAsset {
  id: string;
  name: string;
  symbol?: string;
  type: AssetType;
  price: number;
  apy: number;
  available: number;
  underlyingId?: string;
  productType?: string;
}

export interface PurchaseEligibility {
  verdict: PurchaseVerdict;
  reason: string;
  missingStep?: string;
  summary: string;
  ctaLabel: string;
  tone: PurchaseTone;
  badgeLabel: string;
  listSummary: string;
  nextAction: string;
}

export interface TrustSignal {
  label: string;
  status: TrustSignalStatus;
  detail: string;
}

export interface HoldingImpact {
  beforeQuantity: number;
  deltaQuantity: number;
  afterQuantity: number;
  state: HoldingImpactState;
  summary: string;
}

const REVIEW_TYPES: AssetType[] = ["equity", "ip-royalties", "luxury-goods", "carbon-credits", "carbon-assets"];

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  "real-estate": "房地产",
  art: "艺术品",
  bonds: "债券",
  commodities: "大宗商品",
  equity: "股权",
  "private-credit": "私募信贷",
  "carbon-assets": "碳资产",
  infrastructure: "基础设施",
  "precious-metals": "贵金属",
  "ip-royalties": "IP 版权",
  "carbon-credits": "碳信用",
  "luxury-goods": "奢侈品",
  restricted: "受限资产",
};

function getBaseName(assetName: string) {
  return assetName.replace(/\s+(Spot|Futures|Index|ETF)$/, "");
}

function getBaseSymbol(asset: NarrativeAsset) {
  if (!asset.symbol) return "";
  if (!asset.productType || asset.productType === "spot") return asset.symbol;
  return asset.symbol.slice(0, -1);
}

function findMatchingPosition(asset: NarrativeAsset, positions: PortfolioPosition[]) {
  const baseName = getBaseName(asset.name);
  const baseSymbol = getBaseSymbol(asset);

  return positions.find(
    (position) =>
      (asset.underlyingId ? position.id.startsWith(asset.underlyingId) : false) ||
      position.symbol === baseSymbol ||
      position.name === baseName,
  );
}

export function getPurchaseVerdict(assetType: AssetType): PurchaseVerdict {
  if (assetType === "restricted") return "restricted";
  if (REVIEW_TYPES.includes(assetType)) return "review";
  return "approved";
}

export function getPurchaseEligibility(asset: Pick<NarrativeAsset, "type" | "name">): PurchaseEligibility {
  const verdict = getPurchaseVerdict(asset.type);
  const typeLabel = ASSET_TYPE_LABELS[asset.type];

  if (verdict === "approved") {
    return {
      verdict,
      reason: `${typeLabel}额度与合规凭证已经满足发行方策略，可直接继续购买。`,
      missingStep: "确认金额并授权执行",
      summary: "你现在可以继续完成本次购买。",
      ctaLabel: "立即购买",
      tone: "emerald",
      badgeLabel: "可购买",
      listSummary: "已满足发行方策略与合规校验。",
      nextAction: "确认金额后直接提交链上执行",
    };
  }

  if (verdict === "review") {
    return {
      verdict,
      reason: `${typeLabel}需要增强尽调与适当性复核，自动校验后还需人工确认。`,
      missingStep: "提交购买申请并等待人工复核",
      summary: "你可以提交申请，但不会立即成交。",
      ctaLabel: "提交购买并进入复核",
      tone: "amber",
      badgeLabel: "需复核",
      listSummary: "自动校验已通过，待人工复核后继续。",
      nextAction: "先提交购买申请，再进入人工复核队列",
    };
  }

  return {
    verdict,
    reason: `${typeLabel}需要更高阶的司法辖区或白名单资质，当前身份暂不满足。`,
    missingStep: "补充高阶准入资质后才可继续",
    summary: "当前无法直接购买，但你仍可查看限制原因与审计材料。",
    ctaLabel: "查看限制原因",
    tone: "red",
    badgeLabel: "限制购买",
    listSummary: "当前身份层级尚未满足策略门槛。",
    nextAction: "先查看限制依据与缺口，再补充所需资质",
  };
}

export function getTrustSignals(asset: Pick<NarrativeAsset, "type">): TrustSignal[] {
  const verdict = getPurchaseVerdict(asset.type);

  return [
    {
      label: "Web3ID 子身份已绑定",
      status: "verified",
      detail: "本次购买会绑定独立 RWA 子身份，凭证与风险记录会跟随身份留存。",
    },
    {
      label: "KYC / AML 已验证",
      status: "verified",
      detail: "实名、居住地与 AML 检查已通过，可作为本次购买的合规基础。",
    },
    {
      label: "发行方策略已校验",
      status: verdict === "approved" ? "verified" : verdict === "review" ? "review" : "restricted",
      detail:
        verdict === "approved"
          ? "发行方策略与风险阈值允许直接执行本次订单。"
          : verdict === "review"
            ? "自动预检已完成，当前进入动态监管层等待人工复核。"
            : "策略阻断已命中，当前身份尚未满足更高阶准入条件。",
    },
  ];
}

export function getHoldingImpact(
  asset: NarrativeAsset,
  quantity: number,
  positions: PortfolioPosition[],
): HoldingImpact {
  const verdict = getPurchaseVerdict(asset.type);
  const position = findMatchingPosition(asset, positions);
  const beforeQuantity = position?.amount ?? 0;
  const normalizedQuantity = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const deltaQuantity = verdict === "approved" ? normalizedQuantity : 0;
  const afterQuantity = beforeQuantity + deltaQuantity;

  if (verdict === "approved") {
    return {
      beforeQuantity,
      deltaQuantity,
      afterQuantity,
      state: "approved",
      summary:
        beforeQuantity > 0
          ? `本次购买完成后，你的持仓预计从 ${beforeQuantity} 份提升到 ${afterQuantity} 份。`
          : `本次购买完成后，将新增 ${deltaQuantity} 份持仓。`,
    };
  }

  if (verdict === "review") {
    return {
      beforeQuantity,
      deltaQuantity: 0,
      afterQuantity: beforeQuantity,
      state: "pending-review",
      summary: "本次申请进入人工复核前，持仓暂不发生变更。",
    };
  }

  return {
    beforeQuantity,
    deltaQuantity: 0,
    afterQuantity: beforeQuantity,
    state: "blocked",
    summary: "当前购买已被限制，持仓不会发生变化。",
  };
}
