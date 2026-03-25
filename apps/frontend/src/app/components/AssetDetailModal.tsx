import { AnimatePresence, motion } from "motion/react";
import {
  portfolioPositions,
  type TradeInstrument,
  type TradeProductType,
} from "../data/demoData";
import {
  getHoldingImpact,
  getPurchaseEligibility,
  getPurchaseVerdict,
  getTrustSignals,
  type PurchaseEligibility,
  type PurchaseVerdict,
  type TrustSignalStatus,
} from "../lib/purchaseNarrative";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Fingerprint,
  Link2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AssetType } from "../lib/assetMeta";
import type { RegulatoryConsequenceType, RegulatoryStatus } from "../lib/identityRegulation";
import { chromeSpring, modalRevealMotion, pressDown } from "../lib/uiPresets";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface MarketAsset {
  id: string;
  name: string;
  symbol?: string;
  type: AssetType;
  underlyingId?: string;
  productType?: TradeProductType;
  image: string;
  price: number;
  apy: number;
  totalValue: number;
  available: number;
  location?: string;
  status: string;
  description?: string;
}

interface AssetDetailModalProps {
  asset: MarketAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete: (assetId: string, quantity: number, total: number) => void;
  flowOnly?: boolean;
}

type PurchaseOutcome = PurchaseVerdict;
type PurchaseStep = "detail" | "quantity" | "confirm" | "identity" | "credentials" | "payload" | "precheck" | "execution" | "review" | "restricted" | "evidence" | "result";
type AutoPurchaseStep = "identity" | "credentials" | "payload" | "precheck" | "execution" | "review" | "restricted" | "evidence";
type Tone = "blue" | "emerald" | "amber" | "red";

interface FlowContext {
  startedAt: string;
  walletAddress: string;
  rootIdentityId: string;
  rwaIdentityId: string;
  issuerCredentialId: string;
  payloadHash: string;
  proofId: string;
  signatureId: string;
  auditId: string;
  txHash?: string;
  reviewTicket?: string;
}

interface EvidenceRecord {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  status: RegulatoryStatus;
  consequenceType?: RegulatoryConsequenceType;
}

interface StepStatus {
  label: string;
  detail: string;
}

const PRICE_HISTORY = [
  { date: "Mon", price: 240 },
  { date: "Tue", price: 245 },
  { date: "Wed", price: 250 },
  { date: "Thu", price: 248 },
  { date: "Fri", price: 255 },
  { date: "Sat", price: 260 },
];

const CARD_SPRING = { type: "spring" as const, stiffness: 300, damping: 28 };
const TYPE_LABELS: Record<AssetType, string> = {
  "real-estate": "房地产",
  art: "艺术品",
  bonds: "债券",
  commodities: "大宗商品",
  equity: "股权",
  "private-credit": "私募信贷",
  "carbon-assets": "碳资产",
  infrastructure: "基础设施",
  "precious-metals": "贵金属",
  "ip-royalties": "IP 版税",
  "carbon-credits": "碳信用",
  "luxury-goods": "奢侈品",
  restricted: "受限资产",
};
const OUTCOME_LABELS: Record<PurchaseOutcome, string> = { approved: "可购买", review: "需复核", restricted: "限制购买" };
const OUTCOME_BADGES: Record<PurchaseOutcome, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  review: "bg-amber-50 text-amber-700",
  restricted: "bg-red-50 text-red-700",
};
const FLOW_ORDER: Record<PurchaseOutcome, PurchaseStep[]> = {
  approved: ["quantity", "confirm", "identity", "credentials", "payload", "precheck", "execution", "evidence", "result"],
  review: ["quantity", "confirm", "identity", "credentials", "payload", "precheck", "review", "evidence", "result"],
  restricted: ["quantity", "confirm", "identity", "credentials", "payload", "precheck", "restricted", "evidence", "result"],
};
const AUTO_MS: Record<AutoPurchaseStep, number> = {
  identity: 1200,
  credentials: 1200,
  payload: 1400,
  precheck: 1600,
  execution: 1800,
  review: 1500,
  restricted: 1400,
  evidence: 1200,
};
const STEP_STATUS: Record<AutoPurchaseStep, StepStatus[]> = {
  identity: [
    { label: "身份派生中", detail: "正在从连接钱包派生 Root Identity。" },
    { label: "Root Identity 已建立", detail: "主身份锚点已经生成，准备挂接受控购买上下文。" },
    { label: "RWA 子身份已绑定", detail: "本次购买使用独立 RWA 子身份承接合规记录。" },
  ],
  credentials: [
    { label: "合规凭证校验中", detail: "发行方凭证服务正在验证身份绑定关系。" },
    { label: "KYC 已验证", detail: "实名与居住地信息已通过发行方校验。" },
    { label: "AML 已验证", detail: "AML 与适当性策略已经附着到该子身份。" },
  ],
  payload: [
    { label: "载荷组装中", detail: "正在装配可验证的购买载荷。" },
    { label: "零知识证明生成中", detail: "凭证证明已进入零知识包装阶段。" },
    { label: "持有者签名已附加", detail: "购买授权签名完成，可提交到预检层。" },
  ],
  precheck: [
    { label: "策略服务响应中", detail: "正在比对发行方白名单与购买约束。" },
    { label: "风险服务评估中", detail: "正在计算额度、适当性与动态监管建议。" },
    { label: "预检结论已返回", detail: "当前购买结论已经生成，正在准备下一阶段。" },
  ],
  execution: [
    { label: "交易广播中", detail: "buyRwa(payload, amount) 调用已广播到链上。" },
    { label: "等待区块确认", detail: "网络正在确认交易并汇总执行证据。" },
    { label: "链上执行完成", detail: "执行记录已确认，证据链正在写入最终索引。" },
  ],
  review: [
    { label: "复核队列创建中", detail: "动态监管层正在创建人工复核任务。" },
    { label: "复核材料整理中", detail: "购买载荷、凭证与风险摘要正在汇总。" },
    { label: "复核请求已入队", detail: "人工复核单已经生成，等待进一步尽调。" },
  ],
  restricted: [
    { label: "限制规则命中中", detail: "策略阻断规则正在生成本次限制依据。" },
    { label: "阻断说明整理中", detail: "司法辖区与白名单限制已加入审计上下文。" },
    { label: "限制购买已记录", detail: "阻断结论已经固化到本次证据链中。" },
  ],
  evidence: [
    { label: "证据归档中", detail: "凭证、风控结论与执行记录正在聚合。" },
    { label: "审计包索引生成中", detail: "审计材料正在生成导出索引与引用关系。" },
    { label: "证据链完成", detail: "本次流程的可验证证据链已经完整写入。" },
  ],
};
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function hashText(seed: string, length = 16) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let out = "";
  while (out.length < length) {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    out += Math.abs(hash >>> 0).toString(16);
  }
  return out.slice(0, length);
}

function getStatus(outcome: PurchaseOutcome): RegulatoryStatus {
  if (outcome === "review") return "OBSERVED";
  if (outcome === "restricted") return "RESTRICTED";
  return "NORMAL";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function stamp(dateLike: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(dateLike));
}

function assetImage(image: string) {
  return image.startsWith("http") ? image : `https://source.unsplash.com/1200x900/?${image}`;
}

function reveal(delay = 0.05) {
  return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...CARD_SPRING, delay } };
}

function isAutoStep(step: PurchaseStep): step is AutoPurchaseStep {
  return Object.prototype.hasOwnProperty.call(AUTO_MS, step);
}

function getTrustSignalClasses(status: TrustSignalStatus) {
  if (status === "verified") {
    return {
      panel: "border-emerald-100 bg-emerald-50/80",
      badge: "bg-emerald-100 text-emerald-700",
      icon: "text-emerald-600",
    };
  }

  if (status === "review") {
    return {
      panel: "border-amber-100 bg-amber-50/80",
      badge: "bg-amber-100 text-amber-700",
      icon: "text-amber-600",
    };
  }

  return {
    panel: "border-red-100 bg-red-50/80",
    badge: "bg-red-100 text-red-700",
    icon: "text-red-600",
  };
}

function getEligibilityShell(eligibility: PurchaseEligibility) {
  if (eligibility.tone === "emerald") {
    return {
      panel: "border-emerald-100 bg-emerald-50/80",
      badge: "bg-emerald-100 text-emerald-700",
      title: "text-emerald-700",
      softText: "text-emerald-700/80",
    };
  }

  if (eligibility.tone === "amber") {
    return {
      panel: "border-amber-100 bg-amber-50/80",
      badge: "bg-amber-100 text-amber-700",
      title: "text-amber-700",
      softText: "text-amber-700/80",
    };
  }

  return {
    panel: "border-red-100 bg-red-50/80",
    badge: "bg-red-100 text-red-700",
    title: "text-red-700",
    softText: "text-red-700/80",
  };
}

function getNextStep(step: AutoPurchaseStep, outcome: PurchaseOutcome): PurchaseStep | null {
  if (step === "identity") return "credentials";
  if (step === "credentials") return "payload";
  if (step === "payload") return "precheck";
  if (step === "precheck") return outcome === "approved" ? "execution" : outcome === "review" ? "review" : "restricted";
  if (step === "execution" || step === "review" || step === "restricted") return "evidence";
  if (step === "evidence") return "result";
  return null;
}

function getTone(autoStep: AutoPurchaseStep, outcome: PurchaseOutcome): Tone {
  if (autoStep === "review") return "amber";
  if (autoStep === "restricted") return "red";
  if (autoStep === "execution") return "emerald";
  if (autoStep === "evidence") {
    if (outcome === "review") return "amber";
    if (outcome === "restricted") return "red";
    return "emerald";
  }
  return "blue";
}

function getToneClasses(tone: Tone) {
  if (tone === "emerald") {
    return {
      panel: "border-emerald-100 bg-emerald-50/80",
      label: "text-emerald-700",
      text: "text-emerald-900",
      subtext: "text-emerald-700/80",
      dot: "bg-emerald-500",
      soft: "bg-emerald-100 text-emerald-700",
      bar: "from-emerald-500 to-teal-500",
      ring: "ring-emerald-200",
    };
  }
  if (tone === "amber") {
    return {
      panel: "border-amber-100 bg-amber-50/80",
      label: "text-amber-700",
      text: "text-amber-900",
      subtext: "text-amber-700/80",
      dot: "bg-amber-500",
      soft: "bg-amber-100 text-amber-700",
      bar: "from-amber-500 to-orange-500",
      ring: "ring-amber-200",
    };
  }
  if (tone === "red") {
    return {
      panel: "border-red-100 bg-red-50/80",
      label: "text-red-700",
      text: "text-red-900",
      subtext: "text-red-700/80",
      dot: "bg-red-500",
      soft: "bg-red-100 text-red-700",
      bar: "from-red-500 to-rose-500",
      ring: "ring-red-200",
    };
  }
  return {
    panel: "border-blue-100 bg-blue-50/80",
    label: "text-blue-700",
    text: "text-blue-900",
    subtext: "text-blue-700/80",
    dot: "bg-blue-500",
    soft: "bg-blue-100 text-blue-700",
    bar: "from-blue-500 to-indigo-500",
    ring: "ring-blue-200",
  };
}

function LoadingPulse({ tone }: { tone: Tone }) {
  const styles = getToneClasses(tone);

  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.05, 0.85] }}
          className={`h-2.5 w-2.5 rounded-full ${styles.dot}`}
          transition={{ duration: 0.9, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, delay: index * 0.12 }}
        />
      ))}
    </div>
  );
}

export function AssetDetailModal({ asset, isOpen, onClose, onPurchaseComplete, flowOnly = false }: AssetDetailModalProps) {
  const [step, setStep] = useState<PurchaseStep>("detail");
  const [quantity, setQuantity] = useState(1);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [liveStatusIndex, setLiveStatusIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timerId) => window.clearTimeout(timerId));
    timers.current = [];
  }, []);

  const queueStep = useCallback((callback: () => void, delay: number) => {
    const timerId = window.setTimeout(callback, delay);
    timers.current.push(timerId);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(flowOnly ? "quantity" : "detail");
      setQuantity(1);
      setStartedAt(flowOnly ? new Date().toISOString() : null);
      setLiveStatusIndex(0);
      setStepComplete(false);
      setShowAuditDetails(false);
      clearTimers();
    }
  }, [asset?.id, clearTimers, flowOnly, isOpen]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    clearTimers();
    setLiveStatusIndex(0);
    setStepComplete(false);
    if (!isOpen || !asset || !isAutoStep(step)) return;

    const duration = AUTO_MS[step];
    const statuses = STEP_STATUS[step];
    const slice = duration / statuses.length;

    statuses.slice(1).forEach((_, index) => {
      queueStep(() => setLiveStatusIndex(index + 1), Math.round(slice * (index + 1)));
    });

    queueStep(() => setStepComplete(true), Math.max(duration - 320, Math.round(duration * 0.74)));

    const nextStep = getNextStep(step, getPurchaseVerdict(asset.type));
    if (nextStep) {
      queueStep(() => setStep(nextStep), duration);
    }
    return clearTimers;
  }, [asset, clearTimers, isOpen, queueStep, step]);

  if (!asset) return null;

  const outcome = getPurchaseVerdict(asset.type);
  const eligibility = getPurchaseEligibility(asset);
  const trustSignals = getTrustSignals(asset);
  const holdingImpact = getHoldingImpact(asset, quantity, portfolioPositions);
  const eligibilityShell = getEligibilityShell(eligibility);
  const order = FLOW_ORDER[outcome];
  const total = asset.price * quantity;
  const estimatedReturn = total * (asset.apy / 100);
  const sessionStartedAt = startedAt ?? new Date().toISOString();
  const reasons = [eligibility.reason, eligibility.missingStep ? `还差哪一步: ${eligibility.missingStep}` : `下一步: ${eligibility.nextAction}`];
  const stepIndex = Math.max(order.indexOf(step) + 1, 0);
  const canGoBack = step === "quantity" || step === "confirm";
  const currentStatus = isAutoStep(step) ? STEP_STATUS[step][Math.min(liveStatusIndex, STEP_STATUS[step].length - 1)] : null;
  const footerTone = isAutoStep(step) ? getTone(step, outcome) : null;
  const footerToneClasses = footerTone ? getToneClasses(footerTone) : null;
  const phaseProgress =
    isAutoStep(step) && currentStatus
      ? (Math.min(liveStatusIndex + (stepComplete ? 1 : 0.62), STEP_STATUS[step].length) / STEP_STATUS[step].length) * 100
      : 0;
  const seed = `${asset.id}:${sessionStartedAt}:${quantity}:${outcome}`;
  const context: FlowContext = {
    startedAt: sessionStartedAt,
    walletAddress: `0x${hashText(`${seed}:wallet`, 40)}`,
    rootIdentityId: `RID-${hashText(`${seed}:root`, 10).toUpperCase()}`,
    rwaIdentityId: `RWA-${asset.type.toUpperCase().replace(/-/g, "")}-${hashText(`${seed}:lane`, 6).toUpperCase()}`,
    issuerCredentialId: `cred_${hashText(`${seed}:issuer`, 12)}`,
    payloadHash: `0x${hashText(`${seed}:payload`, 24)}`,
    proofId: `zk_${hashText(`${seed}:proof`, 10)}`,
    signatureId: `sig_${hashText(`${seed}:signature`, 12)}`,
    auditId: `audit_${hashText(`${seed}:audit`, 14)}`,
    txHash: outcome === "approved" ? `0x${hashText(`${seed}:tx`, 28)}` : undefined,
    reviewTicket: outcome === "review" ? `REV-${hashText(`${seed}:review`, 8).toUpperCase()}` : undefined,
  };
  const evidence: EvidenceRecord[] = [
    { id: "identity", title: "Root Identity 与 RWA 子身份派生完成", detail: `${context.rootIdentityId} -> ${context.rwaIdentityId}`, timestamp: sessionStartedAt, status: "NORMAL" },
    { id: "credential", title: "KYC / AML 合规凭证已绑定至子身份", detail: `Issuer credential ${context.issuerCredentialId} 已写入购买上下文`, timestamp: new Date(new Date(sessionStartedAt).getTime() + 1000).toISOString(), status: "NORMAL" },
    { id: "payload", title: "购买载荷已组装", detail: `credential proof + zk proof + holder signature -> ${context.payloadHash}`, timestamp: new Date(new Date(sessionStartedAt).getTime() + 2200).toISOString(), status: "NORMAL" },
    { id: "precheck", title: "策略与风险预检完成", detail: `${OUTCOME_LABELS[outcome]}，${reasons[0]}`, timestamp: new Date(new Date(sessionStartedAt).getTime() + 3800).toISOString(), status: getStatus(outcome), consequenceType: outcome === "approved" ? undefined : outcome === "review" ? "review" : "restriction" },
    { id: "result", title: outcome === "approved" ? "链上执行完成" : outcome === "review" ? "人工复核已入队" : "策略阻断已记录", detail: outcome === "approved" ? `buyRwa(payload, amount) -> ${context.txHash}` : outcome === "review" ? `manualReview.enqueue -> ${context.reviewTicket}` : "policy.block -> restricted-purchase", timestamp: new Date(new Date(sessionStartedAt).getTime() + 5600).toISOString(), status: getStatus(outcome), consequenceType: outcome === "approved" ? undefined : outcome === "review" ? "review" : "restriction" },
  ];
  const auditPack = {
    auditId: context.auditId,
    exportedAt: new Date().toISOString(),
    asset: { id: asset.id, name: asset.name, type: asset.type, quantity, unitPrice: asset.price, totalPrice: total, apy: asset.apy },
    web3id: { walletAddress: context.walletAddress, rootIdentityId: context.rootIdentityId, rwaIdentityId: context.rwaIdentityId },
    credentials: [
      { id: context.issuerCredentialId, name: "KYC Credential", issuer: "Global Compliance Issuer", boundTo: context.rwaIdentityId, status: "verified" },
      { id: `aml_${hashText(`${context.auditId}:aml`, 10)}`, name: "AML Screening Pass", issuer: "Issuer Policy Network", boundTo: context.rwaIdentityId, status: "verified" },
    ],
    payload: { credentialProof: `credProof:${context.issuerCredentialId}`, zkProof: context.proofId, holderSignature: context.signatureId, payloadHash: context.payloadHash },
    precheck: { outcome, regulatoryStatus: getStatus(outcome), summary: OUTCOME_LABELS[outcome], reasons },
    execution: { status: outcome === "approved" ? "submitted" : outcome === "review" ? "queued" : "blocked", method: outcome === "approved" ? "buyRwa(payload, amount)" : outcome === "review" ? "manualReview.enqueue" : "policy.block", reference: outcome === "approved" ? context.txHash : outcome === "review" ? context.reviewTicket : "restricted-purchase" },
    evidenceChain: evidence,
  };
  const evidenceTimeline = [
    {
      id: "eligibility",
      title: "资格判断",
      detail: `${eligibility.badgeLabel}: ${eligibility.reason}`,
      state: outcome,
    },
    {
      id: "risk",
      title: "风险结论",
      detail: outcome === "approved" ? "自动校验通过，可直接继续执行。" : outcome === "review" ? "自动预检已完成，需进入人工复核。" : "策略阻断已命中，当前不能直接购买。",
      state: outcome,
    },
    {
      id: "action",
      title: outcome === "approved" ? "执行动作" : outcome === "review" ? "复核动作" : "限制动作",
      detail:
        outcome === "approved"
          ? `已准备提交 buyRwa(payload, amount)，交易引用 ${context.txHash}`
          : outcome === "review"
            ? `已创建人工复核单 ${context.reviewTicket}，等待补充尽调。`
            : "已记录策略阻断与限制依据，持仓不会变化。",
      state: outcome,
    },
    {
      id: "audit",
      title: "审计留痕",
      detail: `审计包 ${context.auditId} 已生成，可导出并复核证明细节。`,
      state: outcome,
    },
  ];
  const auditDetails = [
    { label: "Root Identity", value: context.rootIdentityId },
    { label: "RWA 子身份", value: context.rwaIdentityId },
    { label: "Credential ID", value: context.issuerCredentialId },
    { label: "Payload Hash", value: context.payloadHash },
    { label: "ZK Proof", value: context.proofId },
    { label: "Signature ID", value: context.signatureId },
    { label: outcome === "approved" ? "Tx 引用" : outcome === "review" ? "Review Ticket" : "Policy Reference", value: outcome === "approved" ? context.txHash ?? "-" : outcome === "review" ? context.reviewTicket ?? "-" : "restricted-purchase" },
  ];

  const closeModal = () => {
    clearTimers();
    setStep("detail");
    setQuantity(1);
    setStartedAt(null);
    setLiveStatusIndex(0);
    setStepComplete(false);
    setShowAuditDetails(false);
    onClose();
  };

  const exportAuditPack = () => {
    const blob = new Blob([JSON.stringify(auditPack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${context.auditId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startPurchase = () => {
    clearTimers();
    setStartedAt(new Date().toISOString());
    setStep("quantity");
  };

  const goBack = () => {
    clearTimers();
    if (step === "confirm") setStep("quantity");
    if (step === "quantity") {
      if (flowOnly) closeModal();
      else setStep("detail");
    }
  };

  const finishFlow = () => {
    if (outcome === "approved") onPurchaseComplete(asset.id, quantity, total);
    closeModal();
  };

  const flowMeta =
    step === "quantity"
      ? { title: "购买参数", description: "先确认你当前的购买资格、订单金额与持仓影响。", testId: "purchase-card-quantity" }
      : step === "confirm"
        ? { title: "订单确认", description: "确认本次订单是否可继续、收益预期与执行动作。", testId: "purchase-card-confirm" }
        : step === "identity"
          ? { title: "身份派生", description: "为本次购买建立可验证的 Web3ID 身份上下文。", testId: "purchase-card-identity" }
          : step === "credentials"
            ? { title: "合规凭证", description: "确认 KYC / AML 与发行方规则已绑定到该购买身份。", testId: "purchase-card-credentials" }
            : step === "payload"
              ? { title: "购买载荷生成", description: "把合规证明与授权组装为本次购买可验证的执行载荷。", testId: "purchase-card-payload" }
              : step === "precheck"
                ? { title: "策略与风险预检", description: "给出本次购买是否可继续、是否需复核的准入结论。", testId: "purchase-card-precheck" }
                : step === "execution"
                  ? { title: "链上执行", description: "执行本次购买，并把结果写入链上与审计记录。", testId: "purchase-card-execution" }
                  : step === "review"
                    ? { title: "人工复核", description: "动态监管层已接管本次申请，等待人工补充尽调。", testId: "purchase-card-review" }
                    : step === "restricted"
                      ? { title: "限制说明", description: "当前购买被限制，但限制依据与证据链已完整保留。", testId: "purchase-card-restricted" }
                      : step === "evidence"
                        ? { title: "证据链与审计包", description: "把资格判断、风险结论与执行结果串成可追溯证据链。", testId: "purchase-card-evidence" }
                        : step === "result"
                          ? { title: outcome === "approved" ? "购买成功" : outcome === "review" ? "待人工复核" : "限制购买", description: outcome === "approved" ? "本次购买已执行完成，并生成完整审计材料与持仓变化预览。" : outcome === "review" ? "本次申请已进入人工复核队列，持仓暂不变更。": "本次申请已被限制，持仓保持不变，但证据可继续导出。", testId: outcome === "approved" ? "purchase-card-result-approved" : outcome === "review" ? "purchase-card-result-review" : "purchase-card-result-restricted" }
                          : null;

  const renderStatusPanel = (autoStep: AutoPurchaseStep, title: string, subtitle?: string) => {
    const tone = getTone(autoStep, outcome);
    const styles = getToneClasses(tone);
    const statuses = STEP_STATUS[autoStep];

    return (
      <motion.div {...reveal(0.04)} className={`rounded-2xl border p-4 shadow-sm ${styles.panel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${styles.label}`}>{title}</div>
            <div className={`mt-2 text-lg font-semibold ${styles.text}`}>{currentStatus?.label}</div>
            <div className={`mt-1 text-sm ${styles.subtext}`}>{subtitle ?? currentStatus?.detail}</div>
          </div>
          <div className="shrink-0 pt-1">
            {stepComplete ? (
              <motion.div animate={{ opacity: 1, scale: 1 }} className={`rounded-full p-2 shadow-sm ring-4 ${styles.soft} ${styles.ring}`} initial={{ opacity: 0, scale: 0.8 }} transition={CARD_SPRING}>
                <CheckCircle2 className="h-5 w-5" />
              </motion.div>
            ) : (
              <LoadingPulse tone={tone} />
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
            <span>阶段进度</span>
            <span>
              {Math.min(liveStatusIndex + 1, statuses.length)} / {statuses.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((status, index) => {
              const complete = index < liveStatusIndex || (stepComplete && index <= liveStatusIndex);
              const active = index === liveStatusIndex && !stepComplete;
              return (
                <div key={status.label} className="rounded-xl bg-white/70 px-3 py-2 text-left">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${complete || active ? styles.dot : "bg-gray-300"}`} />
                    <span className="text-[11px] font-semibold text-gray-500">0{index + 1}</span>
                  </div>
                  <div className={`text-xs font-medium ${complete || active ? styles.text : "text-gray-500"}`}>{status.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTrustSignals = (signals = trustSignals) => (
    <div className="space-y-3" data-testid="purchase-trust-signals">
      {signals.map((signal, index) => {
        const classes = getTrustSignalClasses(signal.status);
        return (
          <motion.div
            key={signal.label}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-4 shadow-sm ${classes.panel}`}
            data-testid={`purchase-trust-signal-${index}`}
            initial={{ opacity: 0, y: 16 }}
            transition={{ ...CARD_SPRING, delay: 0.05 + index * 0.07 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{signal.label}</div>
                <div className="mt-1 text-sm text-gray-600">{signal.detail}</div>
              </div>
              <div className={`rounded-full p-2 ${classes.badge}`}>
                <ShieldCheck className={`h-4 w-4 ${classes.icon}`} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  const renderHoldingImpactCard = () => (
    <motion.div
      {...reveal(0.08)}
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      data-testid="purchase-holding-impact"
    >
      <div className="mb-3 flex items-center gap-2 text-gray-900">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <span className="font-semibold">持仓变化</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">购买前</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{holdingImpact.beforeQuantity}</div>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">本次变化</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">
            {holdingImpact.deltaQuantity > 0 ? `+${holdingImpact.deltaQuantity}` : "0"}
          </div>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">购买后</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{holdingImpact.afterQuantity}</div>
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-600">{holdingImpact.summary}</div>
    </motion.div>
  );

  const renderAuditDetails = () => (
    <motion.div {...reveal(0.18)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        data-testid="purchase-audit-details-toggle"
        onClick={() => setShowAuditDetails((current) => !current)}
        type="button"
      >
        <div>
          <div className="font-semibold text-gray-900">查看证明详情</div>
          <div className="mt-1 text-sm text-gray-500">展开原始 ID、ticket、hash 与执行引用。</div>
        </div>
        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {showAuditDetails ? "收起" : "展开"}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {showAuditDetails ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            data-testid="purchase-audit-details-panel"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="mt-4 grid gap-3">
              {auditDetails.map((item) => (
                <div key={item.label} className="rounded-2xl bg-gray-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                  <div className="mt-2 break-all font-mono text-sm text-gray-900">{item.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );

  const detailPanel = (
    <motion.div animate={{ opacity: 1, y: 0 }} className="elevated-panel fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md overflow-hidden rounded-t-3xl" data-testid="asset-detail-modal" exit={{ opacity: 0, y: "100%" }} initial={{ opacity: 0, y: "100%" }} style={{ maxHeight: "90vh" }} transition={chromeSpring}>
      <div className="spotlight-bg sticky top-0 z-10 flex items-center justify-between border-b stage-divider bg-white/88 px-6 py-4 backdrop-blur-xl">
        <div className="h-8 w-8" />
        <h2 className="flex-1 text-center text-xl font-semibold text-gray-900">资产详情</h2>
        <button className="glass-button flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/82" onClick={closeModal} type="button">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 140px)" }}>
        <div className="relative h-64 bg-gray-200">
          <ImageWithFallback alt={asset.name} className="h-full w-full object-cover" src={assetImage(asset.image)} />
          <div className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm ${eligibility.tone === "red" ? "bg-red-500/90" : eligibility.tone === "amber" ? "bg-amber-500/90" : "bg-emerald-500/90"}`}>
            {eligibility.badgeLabel}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <h3 className="mb-2 text-2xl font-semibold text-gray-900">{asset.name}</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="rounded-full bg-gray-100 px-3 py-1">{TYPE_LABELS[asset.type]}</span>
              {asset.location ? <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{asset.location}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-blue-50 p-4"><div className="mb-1 text-sm text-gray-600">单价</div><div className="text-2xl font-semibold text-gray-900">{money.format(asset.price)}</div></div>
            <div className="rounded-2xl bg-green-50 p-4"><div className="mb-1 text-sm text-gray-600">年化收益</div><div className="flex items-center gap-1 text-2xl font-semibold text-green-600">{asset.apy}%<TrendingUp className="h-5 w-5" /></div></div>
            <div className="rounded-2xl bg-purple-50 p-4"><div className="mb-1 text-sm text-gray-600">总价值</div><div className="text-xl font-semibold text-gray-900">{money.format(asset.totalValue)}</div></div>
            <div className="rounded-2xl bg-orange-50 p-4"><div className="mb-1 text-sm text-gray-600">可购买份额</div><div className="text-xl font-semibold text-gray-900">{asset.available} 份</div></div>
          </div>

          <div>
            <h4 className="mb-3 text-lg font-semibold text-gray-900">价格走势</h4>
            <div className="rounded-2xl bg-gray-50 p-4">
              <ResponsiveContainer height={200} width="100%">
                <LineChart data={PRICE_HISTORY}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Line dataKey="price" dot={{ fill: "#3b82f6" }} stroke="#3b82f6" strokeWidth={2} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-lg font-semibold text-gray-900">资产描述</h4>
            <p className="leading-relaxed text-gray-600">{asset.description ?? "该资产已完成代币化映射，可通过 Web3ID 购买流程完成身份校验、合规预检与链上执行。"}</p>
          </div>

          <div className={`rounded-2xl border p-4 ${eligibilityShell.panel}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${eligibilityShell.title}`}>准入结论</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{eligibility.summary}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${eligibilityShell.badge}`}>{eligibility.badgeLabel}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">{eligibility.reason}</div>
            <div className={`mt-2 text-xs ${eligibilityShell.softText}`}>还差哪一步: {eligibility.missingStep ?? "当前可直接确认金额并执行"}</div>
          </div>

          <div>
            <h4 className="mb-3 text-lg font-semibold text-gray-900">相关文件</h4>
            <div className="space-y-2">
              {["资产评估报告", "发行说明书"].map((doc) => (
                <button key={doc} className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 transition-colors hover:bg-gray-100" type="button">
                  <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-blue-500" /><span className="font-medium">{doc}</span></div>
                  <span className="text-sm text-gray-500">PDF</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t stage-divider bg-white/84 px-6 py-4 backdrop-blur-xl">
        <motion.button className="accent-action flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition-all" data-testid="detail-buy-button" onClick={startPurchase} type="button" whileTap={pressDown}>
          <ShoppingCart className="h-5 w-5" />{eligibility.ctaLabel}
        </motion.button>
      </div>
    </motion.div>
  );

  const renderFlowBody = () => {
    if (step === "quantity") {
      return (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-4 ${eligibilityShell.panel}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${eligibilityShell.title}`}>购买资格</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{eligibility.summary}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${eligibilityShell.badge}`}>{eligibility.badgeLabel}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">{eligibility.reason}</div>
            <div className={`mt-2 text-xs ${eligibilityShell.softText}`}>下一步: {eligibility.nextAction}</div>
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">购买数量</label>
            <div className="flex items-center gap-4">
              <button className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold transition-colors hover:bg-gray-300" onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button">-</button>
              <input className="flex-1 rounded-2xl bg-gray-50 py-3 text-center text-2xl font-semibold outline-none" onChange={(event) => setQuantity(Math.max(1, Math.min(asset.available, Number.parseInt(event.target.value, 10) || 1)))} type="number" value={quantity} />
              <button className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold transition-colors hover:bg-gray-300" onClick={() => setQuantity(Math.min(asset.available, quantity + 1))} type="button">+</button>
            </div>
            <div className="mt-2 text-center text-sm text-gray-500">最多可购买 {asset.available} 份</div>
          </div>
          <div className="space-y-3 rounded-2xl bg-blue-50 p-4">
            <div className="flex items-center justify-between"><span className="text-gray-600">购买资产</span><span className="font-semibold text-gray-900">{asset.name}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">订单金额</span><span className="font-semibold">{money.format(total)}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">购买数量</span><span className="font-semibold">x {quantity}</span></div>
            <div className="flex items-center justify-between border-t border-blue-200 pt-3"><span className="font-medium text-gray-900">预估年化收益</span><span className="text-2xl font-semibold text-blue-600">{money.format(estimatedReturn)}</span></div>
            <div className="text-sm text-gray-600">购买决策会先确认资格，再进入执行或复核分支。</div>
          </div>
          {renderHoldingImpactCard()}
        </div>
      );
    }

    if (step === "confirm") {
      return (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-4 ${eligibilityShell.panel}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${eligibilityShell.title}`}>准入结论</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{eligibility.badgeLabel}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${eligibilityShell.badge}`}>{eligibility.badgeLabel}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">{eligibility.reason}</div>
            <div className={`mt-2 text-xs ${eligibilityShell.softText}`}>还差哪一步: {eligibility.missingStep ?? "确认金额后即可继续执行"}</div>
          </div>
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
            <h4 className="font-semibold text-gray-900">订单概览</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span>资产名称</span><span className="font-medium text-gray-900">{asset.name}</span></div>
              <div className="flex justify-between"><span>订单金额</span><span className="font-medium text-gray-900">{money.format(total)}</span></div>
              <div className="flex justify-between"><span>购买数量</span><span className="font-medium text-gray-900">{quantity} 份</span></div>
              <div className="flex justify-between"><span>预估年化</span><span className="font-medium text-gray-900">{asset.apy}%</span></div>
            </div>
          </div>
          {renderHoldingImpactCard()}
          {renderTrustSignals()}
        </div>
      );
    }

    if (step === "identity") {
      return (
        <div className="space-y-5">
          {renderStatusPanel("identity", "身份建立状态", "本次购买正在建立可验证、可留痕的身份上下文。")}
          <motion.div {...reveal(0.05)} className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300"><Wallet className="h-4 w-4" />Connected Wallet</div>
            <div className="text-lg font-semibold">{shortAddress(context.walletAddress)}</div>
            <div className="mt-2 text-sm text-slate-300">你的钱包会衍生出专门用于本次 RWA 购买的身份上下文。</div>
          </motion.div>
          <motion.div {...reveal(0.15)} className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">身份已准备就绪</div>
            <div className="mt-2 text-lg font-semibold text-gray-900">Web3ID 子身份已绑定本次购买</div>
            <div className="mt-1 text-sm text-gray-600">后续的合规凭证、风险判断与审计记录都会跟随这条身份链路保存。</div>
          </motion.div>
          {renderTrustSignals(trustSignals.slice(0, 1))}
          {renderAuditDetails()}
        </div>
      );
    }

    if (step === "credentials") {
      return (
        <div className="space-y-4">
          {renderStatusPanel("credentials", "合规验证状态", "凭证与身份绑定已经完成，购买可信度建立完成。")}
          {renderTrustSignals(trustSignals.slice(0, 2))}
          <motion.div {...reveal(0.2)} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
            <div className="font-semibold text-gray-900">凭证已经绑定到本次购买身份</div>
            <div className="mt-1 text-sm text-gray-600">
              发行方签发的 KYC / AML 凭证会与 RWA 子身份绑定，避免裸地址直接购买，也让后续审计可以回溯到同一条身份链路。
            </div>
          </motion.div>
        </div>
      );
    }

    if (step === "payload") {
      return (
        <div className="space-y-5">
          {renderStatusPanel("payload", "执行载荷装配状态", "本次购买所需的证明与授权正在被整理成可验证载荷。")}
          <div className="grid gap-3">
            {[
              { title: "凭证证明已附加", detail: "证明你当前使用的身份已经绑定到有效合规凭证。", delay: 0.05 },
              { title: "零知识证明已生成", detail: "可在不暴露原始隐私字段的前提下验证资格。", delay: 0.14 },
              { title: "持有者授权已完成", detail: "本次购买金额与执行动作已经获得你的授权签名。", delay: 0.23 },
            ].map((item) => (
              <motion.div key={item.title} {...reveal(item.delay)} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                <div className="font-semibold text-gray-900">{item.title}</div>
                <div className="mt-1 text-sm text-gray-600">{item.detail}</div>
              </motion.div>
            ))}
          </div>
          <motion.div animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 p-5 text-white shadow-lg shadow-blue-500/20" initial={{ opacity: 0, scale: 0.97 }} transition={{ ...CARD_SPRING, delay: 0.35 }}>
            <div className="flex items-center gap-2 text-sm text-white/80"><Zap className="h-4 w-4" />购买载荷已完成</div>
            <div className="mt-3 text-lg font-semibold">本次订单现在可进入准入预检</div>
            <div className="mt-2 text-sm text-white/80">这份载荷可验证、可审计、可复用，但原始证明细节不会抢占主流程视线。</div>
          </motion.div>
          {renderAuditDetails()}
        </div>
      );
    }

    if (step === "precheck") {
      return (
        <div className="space-y-4">
          {renderStatusPanel("precheck", "准入预检状态", "系统正在判断这笔订单是否能直接购买、是否需要复核。")}
          {[
            { title: "发行方策略", detail: "正在核对该资产的可购范围、白名单与司法辖区规则。", icon: ShieldCheck, delay: 0.05 },
            { title: "风险校验", detail: "正在判断额度、适当性与动态监管建议。", icon: AlertCircle, delay: 0.14 },
            { title: "监管建议", detail: "若需要人工复核或限制购买，会在这里明确给出原因。", icon: Fingerprint, delay: 0.23 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" initial={{ opacity: 0, x: 18 }} transition={{ ...CARD_SPRING, delay: item.delay }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-50 p-2 text-blue-600"><Icon className="h-4 w-4" /></div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{item.detail}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          <motion.div animate={{ opacity: stepComplete ? 1 : 0.7, scale: stepComplete ? 1 : 0.98 }} className={`rounded-2xl border p-4 ${eligibilityShell.panel}`} initial={{ opacity: 0, scale: 0.95 }} transition={CARD_SPRING}>
            <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${eligibilityShell.title}`}>准入结论</div>
            <div className="mt-2 text-xl font-semibold text-gray-900">{eligibility.badgeLabel}</div>
            <div className="mt-2 text-sm text-gray-600">{eligibility.reason}</div>
            <div className={`mt-2 text-xs ${eligibilityShell.softText}`}>下一步: {eligibility.nextAction}</div>
          </motion.div>
        </div>
      );
    }

    if (step === "execution") {
      const executionTone = getToneClasses("emerald");
      const executionStages = STEP_STATUS.execution;
      return (
        <div className="space-y-5">
          {renderStatusPanel("execution", "链上执行状态", "本次订单正在完成最终执行并生成成交留痕。")}
          <motion.div {...reveal(0.05)} className="rounded-2xl bg-slate-900 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RWA Gate</div>
            <div className="mt-2 text-lg font-semibold">订单已经进入执行阶段</div>
            <div className="mt-2 text-sm text-slate-300">系统正在提交购买动作，并把结果与证据同步到审计链路。</div>
          </motion.div>
          <div className="grid gap-3 sm:grid-cols-2">
            <motion.div {...reveal(0.14)} className="rounded-2xl bg-gray-50 p-4"><div className="text-sm text-gray-500">订单金额</div><div className="mt-2 text-2xl font-semibold text-gray-900">{money.format(total)}</div></motion.div>
            <motion.div {...reveal(0.22)} className="rounded-2xl bg-gray-50 p-4"><div className="text-sm text-gray-500">预估年化</div><div className="mt-2 text-2xl font-semibold text-gray-900">{asset.apy}%</div></motion.div>
          </div>
          <motion.div {...reveal(0.28)} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-gray-900">执行阶段</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${executionTone.soft}`}>{currentStatus?.label}</span></div>
            <div className="space-y-3">
              {executionStages.map((status, index) => {
                const completed = index < liveStatusIndex || (stepComplete && index <= liveStatusIndex);
                const active = index === liveStatusIndex && !stepComplete;
                return (
                  <div key={status.label} className="flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-3">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                      {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : active ? <motion.div animate={{ rotate: 360 }} className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 border-t-transparent" transition={{ duration: 0.9, ease: "linear", repeat: Number.POSITIVE_INFINITY }} /> : <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{status.label}</div>
                      <div className="mt-1 text-sm text-gray-500">{status.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      );
    }

    if (step === "review" || step === "restricted") {
      const blocked = step === "restricted";
      return (
        <div className="space-y-5">
          {renderStatusPanel(step, blocked ? "限制状态" : "复核状态", blocked ? "系统正在整理限制依据与缺口说明。" : "系统正在整理复核理由与后续动作。")}
          <motion.div animate={{ opacity: 1, scale: 1 }} className={`rounded-2xl ${blocked ? "bg-red-50" : "bg-amber-50"} p-5`} initial={{ opacity: 0, scale: 0.97 }} transition={{ ...CARD_SPRING, delay: 0.05 }}>
            <div className={`flex items-center gap-2 ${blocked ? "text-red-700" : "text-amber-700"}`}>
              {blocked ? <ShieldAlert className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span className="font-semibold">{blocked ? "当前不能直接购买" : "本次申请已进入人工复核"}</span>
            </div>
            <div className={`mt-2 text-sm ${blocked ? "text-red-800" : "text-amber-800"}`}>{eligibility.reason}</div>
            <div className={`mt-2 text-sm ${blocked ? "text-red-800" : "text-amber-800"}`}>下一步: {eligibility.nextAction}</div>
            {blocked ? null : <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 font-mono text-sm text-amber-900">{context.reviewTicket}</div>}
          </motion.div>
          <div className="space-y-3">
            <motion.div {...reveal(0.12)} className={`rounded-2xl border bg-white p-4 shadow-sm ${blocked ? "border-red-100" : "border-amber-100"}`}>
              <div className="font-semibold text-gray-900">{blocked ? "限制原因" : "复核原因"}</div>
              <div className="mt-1 text-sm text-gray-600">{eligibility.reason}</div>
            </motion.div>
            <motion.div {...reveal(0.18)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="font-semibold text-gray-900">当前状态</div>
              <div className="mt-1 text-sm text-gray-600">{blocked ? "系统已经阻断该购买申请，但会完整保存本次限制依据。" : "动态监管层已经接管本次申请，审核通过后才会继续执行。"}</div>
            </motion.div>
            <motion.div {...reveal(0.24)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="font-semibold text-gray-900">下一步说明</div>
              <div className="mt-1 text-sm text-gray-600">{eligibility.missingStep ?? eligibility.nextAction}</div>
            </motion.div>
          </div>
          {renderHoldingImpactCard()}
          {renderAuditDetails()}
        </div>
      );
    }

    if (step === "evidence") {
      return (
        <div className="space-y-4">
          {renderStatusPanel("evidence", "证据链写入状态", "资格、风险与执行结果正在被整理成可追溯时间线。")}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="purchase-evidence-timeline">
            <div className="mb-4 flex items-center gap-2 text-gray-900">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">证据链时间线</span>
            </div>
            <div className="space-y-4">
              {evidenceTimeline.map((item, index) => (
                <motion.div key={item.id} animate={{ opacity: 1, x: 0 }} className="relative pl-8" initial={{ opacity: 0, x: 14 }} transition={{ ...CARD_SPRING, delay: 0.05 + index * 0.08 }}>
                  {index < evidenceTimeline.length - 1 ? <div className="absolute left-[9px] top-6 h-full w-px bg-gray-200" /> : null}
                  <div className={`absolute left-0 top-1 h-5 w-5 rounded-full ${outcome === "approved" ? "bg-emerald-100" : outcome === "review" ? "bg-amber-100" : "bg-red-100"} flex items-center justify-center`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${outcome === "approved" ? "bg-emerald-500" : outcome === "review" ? "bg-amber-500" : "bg-red-500"}`} />
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{item.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          {renderAuditDetails()}
        </div>
      );
    }

    if (step === "result") {
      const resultTheme =
        outcome === "approved"
          ? {
              shell: "bg-gradient-to-b from-emerald-50 via-white to-white",
              icon: "bg-emerald-500",
              glow: "bg-emerald-300/40",
              ring: "border-emerald-300/70",
              particle: "bg-emerald-400/80",
            }
          : outcome === "review"
            ? {
                shell: "bg-gradient-to-b from-amber-50 via-white to-white",
                icon: "bg-amber-500",
                glow: "bg-amber-300/35",
                ring: "border-amber-300/70",
                particle: "bg-amber-400/80",
              }
            : {
                shell: "bg-gradient-to-b from-red-50 via-white to-white",
                icon: "bg-red-500",
                glow: "bg-red-300/35",
                ring: "border-red-300/70",
                particle: "bg-red-400/80",
              };

      return (
        <div className="space-y-6">
          <div className={`relative overflow-hidden rounded-[28px] ${resultTheme.shell} px-4 py-2`}>
            <div className="pointer-events-none absolute inset-0" data-testid="purchase-result-effect">
              <motion.div
                animate={{ opacity: [0.18, 0.28, 0.18], scale: [0.9, 1.08, 0.96] }}
                className={`absolute left-1/2 top-10 h-32 w-32 -translate-x-1/2 rounded-full ${resultTheme.glow} blur-3xl`}
                transition={{ duration: 2.6, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
              />
              <motion.div
                animate={{ opacity: [0, 0.4, 0], scale: [0.6, 1.15, 1.35] }}
                className={`absolute left-1/2 top-16 h-28 w-28 -translate-x-1/2 rounded-full border ${resultTheme.ring}`}
                transition={{ duration: 1.8, ease: "easeOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.7 }}
              />
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const left = [20, 32, 44, 56, 68, 80][index];
                const top = [84, 72, 68, 74, 86, 78][index];
                const delay = index * 0.12;
                return (
                  <motion.span
                    key={index}
                    animate={{ opacity: [0, 0.6, 0], y: [0, -18, -30], scale: [0.8, 1.1, 0.9] }}
                    className={`absolute h-2 w-2 rounded-full ${resultTheme.particle}`}
                    style={{ left: `${left}%`, top: `${top}px` }}
                    transition={{ duration: 1.9, ease: "easeOut", repeat: Number.POSITIVE_INFINITY, delay }}
                  />
                );
              })}
            </div>
            {outcome === "approved" ? <div className="pointer-events-none absolute inset-0" data-testid="purchase-success-celebration" /> : null}
            <div className="relative space-y-6">
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${resultTheme.icon} shadow-lg`}
                data-testid={outcome === "approved" ? "purchase-result-check" : undefined}
                initial={{ opacity: 0, scale: 0.7 }}
                transition={{ ...CARD_SPRING, delay: 0.05 }}
              >
                {outcome === "approved" ? (
                  <span data-testid="purchase-step-complete">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </span>
                ) : outcome === "review" ? (
                  <Fingerprint className="h-10 w-10 text-white" />
                ) : (
                  <ShieldAlert className="h-10 w-10 text-white" />
                )}
              </motion.div>
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-gray-900">{outcome === "approved" ? "购买已提交成功" : outcome === "review" ? "购买等待人工复核" : "本次购买已被限制"}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {outcome === "approved"
                    ? "购买结果、合规凭证与风险记录已经归档，可导出审计包。"
                    : outcome === "review"
                      ? "主流程已完成留痕，待审核通过后才会继续链上执行。"
                      : "策略阻断不会影响证据链完整性，你仍可以导出本次审计包。"}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <motion.div {...reveal(0.1)} className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">订单金额</div>
              <div className="mt-2 text-xl font-semibold text-gray-900">{money.format(total)}</div>
            </motion.div>
            <motion.div {...reveal(0.16)} className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">审计包 ID</div>
              <div className="mt-2 font-mono text-sm text-gray-900">{context.auditId}</div>
            </motion.div>
          </div>
          {renderHoldingImpactCard()}
          <motion.div {...reveal(0.22)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="purchase-evidence-timeline">
            <div className="mb-3 flex items-center gap-2 text-gray-900">
              <Link2 className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">结果时间线</span>
            </div>
            <div className="space-y-3">
              {evidenceTimeline.map((item) => (
                <div key={item.id} className="rounded-2xl bg-gray-50 px-4 py-3">
                  <div className="font-semibold text-gray-900">{item.title}</div>
                  <div className="mt-1 text-sm text-gray-600">{item.detail}</div>
                </div>
              ))}
            </div>
          </motion.div>
          {renderAuditDetails()}
        </div>
      );
    }

    return null;
  };

  const flowFooter = step === "quantity" ? (
    <motion.button className="accent-action w-full rounded-2xl py-3.5 font-semibold text-white transition-all" data-testid="purchase-flow-next" onClick={() => setStep("confirm")} type="button" whileTap={pressDown}>下一步</motion.button>
  ) : step === "confirm" ? (
    <motion.button className="accent-action w-full rounded-2xl py-3.5 font-semibold text-white transition-all" data-testid="purchase-flow-start" onClick={() => setStep("identity")} type="button" whileTap={pressDown}>{eligibility.ctaLabel}</motion.button>
  ) : step === "result" ? (
    <div className="space-y-3"><button className="glass-button flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-gray-900 transition-all hover:bg-white/82" data-testid="purchase-export-audit-pack" onClick={exportAuditPack} type="button"><Download className="h-5 w-5" />导出审计包</button><motion.button className={`w-full rounded-2xl py-3.5 font-semibold text-white shadow-lg transition-all ${outcome === "approved" ? "bg-gradient-to-r from-gray-900 to-gray-800 shadow-gray-900/20 hover:from-black hover:to-gray-900" : outcome === "review" ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600" : "bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/20 hover:from-red-600 hover:to-rose-700"}`} data-testid={outcome === "approved" ? "purchase-flow-complete" : "purchase-flow-close"} onClick={finishFlow} type="button" whileTap={pressDown}>{outcome === "approved" ? "完成购买" : "返回浏览"}</motion.button></div>
  ) : (
    <div className="space-y-3"><div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-gray-400"><span>Auto Progress</span><span>{isAutoStep(step) ? `${(AUTO_MS[step] / 1000).toFixed(1)}s` : ""}</span></div>{currentStatus && footerTone && footerToneClasses ? <div className={`rounded-2xl border px-4 py-3 ${footerToneClasses.panel}`}><div className="flex items-center justify-between gap-3"><div><div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${footerToneClasses.label}`}>实时状态</div><div className={`mt-1 text-sm font-semibold ${footerToneClasses.text}`} data-testid="purchase-live-status">{currentStatus.label}</div><div className={`mt-1 text-xs ${footerToneClasses.subtext}`}>{currentStatus.detail}</div></div><div className="shrink-0">{stepComplete ? <motion.div animate={{ opacity: 1, scale: 1 }} className={`rounded-full p-2 shadow-sm ring-4 ${footerToneClasses.soft} ${footerToneClasses.ring}`} data-testid="purchase-step-complete" initial={{ opacity: 0, scale: 0.8 }} transition={CARD_SPRING}><CheckCircle2 className="h-4 w-4" /></motion.div> : <LoadingPulse tone={footerTone} />}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70"><motion.div animate={{ width: `${phaseProgress}%` }} className={`h-full rounded-full bg-gradient-to-r ${footerToneClasses.bar}`} initial={{ width: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} /></div></div> : null}</div>
  );

  const flowPanel = flowMeta ? (
    <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="web3id-purchase-flow" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
      <motion.div animate={modalRevealMotion.animate} className="elevated-panel w-full max-w-xl overflow-hidden rounded-3xl" data-testid={flowMeta.testId} exit={modalRevealMotion.exit} initial={modalRevealMotion.initial} onClick={(event) => event.stopPropagation()} transition={chromeSpring}>
        <div className="spotlight-bg flex items-center justify-between border-b stage-divider bg-white/88 px-6 py-4 backdrop-blur-xl">
          {canGoBack ? <button className="glass-button flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/82" onClick={goBack} type="button"><ArrowLeft className="h-5 w-5" /></button> : <div className="h-10 w-10" />}
          <div className="flex-1 px-3 text-center"><div className="stage-eyebrow text-[10px] font-semibold uppercase">Step {stepIndex} / {order.length}</div><h2 className="stage-title mt-1 text-xl font-semibold text-gray-900">{flowMeta.title}</h2><p className="mt-1 text-sm text-gray-500">{flowMeta.description}</p></div>
          <button className="glass-button flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/82" onClick={closeModal} type="button"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-6 py-6">{renderFlowBody()}</div>
        <div className="border-t stage-divider bg-white/84 px-6 py-4 backdrop-blur-xl">{flowFooter}</div>
      </motion.div>
    </motion.div>
  ) : null;

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.28)] backdrop-blur-md" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={closeModal} />
          <AnimatePresence initial={false} mode="wait">{step === "detail" ? detailPanel : flowPanel}</AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  );
}
