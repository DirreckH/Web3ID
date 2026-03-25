import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Clock3, LoaderCircle, ShieldAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { portfolioPositions } from "../data/demoData";
import type { TradeInstrument } from "../lib/dataGateway";
import { formatCurrency, formatQuantity, formatTokenPrice } from "../lib/format";
import {
  getHoldingImpact,
  getPurchaseEligibility,
  getPurchaseVerdict,
  getTrustSignals,
  type PurchaseVerdict,
} from "../lib/purchaseNarrative";

interface RWAPurchaseModalProps {
  asset: TradeInstrument | null;
  isOpen: boolean;
  onClose: () => void;
  side?: "buy" | "sell";
}

type Step = "ticket" | "review" | "processing" | "result";

interface ProcessingStage {
  id: string;
  title: string;
  statuses: string[];
  completeText: string;
}

function getToneClasses(verdict: PurchaseVerdict) {
  if (verdict === "approved") {
    return {
      badge: "bg-emerald-50 text-emerald-700",
      panel: "border-emerald-100 bg-emerald-50/70",
      title: "text-emerald-700",
      icon: "bg-emerald-100 text-emerald-600",
      progress: "bg-emerald-500",
    };
  }

  if (verdict === "review") {
    return {
      badge: "bg-amber-50 text-amber-700",
      panel: "border-amber-100 bg-amber-50/70",
      title: "text-amber-700",
      icon: "bg-amber-100 text-amber-600",
      progress: "bg-amber-500",
    };
  }

  return {
    badge: "bg-red-50 text-red-700",
    panel: "border-red-100 bg-red-50/70",
    title: "text-red-700",
    icon: "bg-red-100 text-red-600",
    progress: "bg-red-500",
  };
}

function getProcessingStages(verdict: PurchaseVerdict): ProcessingStage[] {
  const stages: ProcessingStage[] = [
    {
      id: "identity",
      title: "身份派生",
      statuses: ["身份派生中", "Root Identity 已建立", "RWA 子身份已绑定"],
      completeText: "身份链路准备完成",
    },
    {
      id: "credentials",
      title: "合规凭证",
      statuses: ["合规凭证校验中", "KYC 已验证", "AML 已验证"],
      completeText: "合规凭证已就绪",
    },
    {
      id: "payload",
      title: "购买载荷生成",
      statuses: ["载荷组装中", "零知识证明生成中", "持有者签名已附加"],
      completeText: "购买载荷已封装",
    },
    {
      id: "precheck",
      title: "策略与风险预检",
      statuses:
        verdict === "approved"
          ? ["策略服务响应中", "风险服务评估中", "预检结论：可继续购买"]
          : verdict === "review"
            ? ["策略服务响应中", "风险服务评估中", "预检结论：进入人工复核"]
            : ["策略服务响应中", "风险服务评估中", "预检结论：当前受限"],
      completeText: verdict === "approved" ? "预检通过" : verdict === "review" ? "预检已转入复核" : "预检已触发限制",
    },
  ];

  if (verdict === "approved") {
    stages.push({
      id: "execution",
      title: "链上执行",
      statuses: ["交易广播中", "等待区块确认", "链上执行完成"],
      completeText: "订单执行完成",
    });
  } else if (verdict === "review") {
    stages.push({
      id: "review-queue",
      title: "人工复核",
      statuses: ["提交复核队列", "记录复核建议", "复核申请已受理"],
      completeText: "人工复核已排队",
    });
  } else {
    stages.push({
      id: "restricted",
      title: "限制说明",
      statuses: ["记录限制原因", "生成缺口说明", "限制结论已留痕"],
      completeText: "限制说明已生成",
    });
  }

  stages.push({
    id: "evidence",
    title: "证据链与审计包",
    statuses: ["证据归档中", "审计索引生成中", "证据链记录完成"],
    completeText: "审计留痕已生成",
  });

  return stages;
}

export function RWAPurchaseModal({ asset, isOpen, onClose, side = "buy" }: RWAPurchaseModalProps) {
  const [step, setStep] = useState<Step>("ticket");
  const [quantity, setQuantity] = useState("1000");
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [activeStatusIndex, setActiveStatusIndex] = useState(0);
  const resolvedVerdict: PurchaseVerdict = asset ? getPurchaseVerdict(asset.type) : "approved";
  const processingStages = useMemo(() => (side === "buy" ? getProcessingStages(resolvedVerdict) : []), [side, resolvedVerdict]);

  useEffect(() => {
    if (isOpen) {
      setStep("ticket");
      setQuantity("1000");
      setActiveStageIndex(0);
      setActiveStatusIndex(0);
    }
  }, [isOpen, asset?.id, side]);

  const numericQuantity = Number(quantity) || 0;

  useEffect(() => {
    if (!asset || !isOpen || side !== "buy" || step !== "processing") return;

    const currentStage = processingStages[activeStageIndex];
    if (!currentStage) {
      const doneTimer = window.setTimeout(() => setStep("result"), 600);
      return () => window.clearTimeout(doneTimer);
    }

    const isLastStatus = activeStatusIndex >= currentStage.statuses.length - 1;
    const isLastStage = activeStageIndex >= processingStages.length - 1;

    const timer = window.setTimeout(
      () => {
        if (!isLastStatus) {
          setActiveStatusIndex((value) => value + 1);
          return;
        }

        if (isLastStage) {
          setStep("result");
          return;
        }

        setActiveStageIndex((value) => value + 1);
        setActiveStatusIndex(0);
      },
      isLastStatus ? 780 : 680,
    );

    return () => window.clearTimeout(timer);
  }, [activeStageIndex, activeStatusIndex, asset, isOpen, processingStages, side, step]);

  const progressRatio = side === "buy" && processingStages.length > 0
    ? ((activeStageIndex + activeStatusIndex / 3) / processingStages.length) * 100
    : 0;

  if (!asset) {
    return null;
  }

  const verdict = resolvedVerdict;
  const eligibility = getPurchaseEligibility(asset);
  const trustSignals = getTrustSignals(asset);
  const holdingImpact = getHoldingImpact(asset, numericQuantity, portfolioPositions);
  const estimatedTotal = numericQuantity * asset.price;
  const toneClasses = getToneClasses(verdict);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md overflow-hidden rounded-[30px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]"
            data-testid="trade-order-modal"
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{side === "buy" ? "purchase flow" : "sell ticket"}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {asset.name} ({asset.symbol})
                </h2>
              </div>
              <button className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200" onClick={onClose} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {step === "ticket" ? (
                <>
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Mark price</span>
                      <span className="font-semibold text-slate-900">${formatTokenPrice(asset.price)}</span>
                    </div>
                    <label className="mt-5 block">
                      <span className="text-sm font-medium text-slate-700">Order quantity</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500"
                        onChange={(event) => setQuantity(event.target.value)}
                        value={quantity}
                      />
                    </label>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                      <span>Estimated notional</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(estimatedTotal)}</span>
                    </div>
                    {side === "buy" ? (
                      <div className={`mt-5 rounded-2xl border px-4 py-3 ${toneClasses.panel}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClasses.badge}`}>{eligibility.badgeLabel}</span>
                          <span className="text-xs font-medium text-slate-500">{eligibility.nextAction}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{eligibility.reason}</div>
                      </div>
                    ) : null}
                  </div>
                  <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-semibold text-white transition hover:bg-slate-800" onClick={() => setStep("review")} type="button">
                    Continue
                  </button>
                </>
              ) : null}

              {step === "review" ? (
                <>
                  <div className={`rounded-3xl border p-5 text-sm ${side === "buy" ? toneClasses.panel : "border-blue-100 bg-blue-50"}`}>
                    <p className="font-semibold text-slate-950">{side === "buy" ? "订单确认" : "Review order ticket"}</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Side</span>
                        <span className="font-semibold uppercase text-slate-950">{side}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Quantity</span>
                        <span className="font-semibold text-slate-950">{formatQuantity(numericQuantity)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Mark price</span>
                        <span className="font-semibold text-slate-950">${formatTokenPrice(asset.price)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Estimated total</span>
                        <span className="font-semibold text-slate-950">{formatCurrency(estimatedTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {side === "buy" ? (
                    <>
                      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trust Signals</div>
                        <div className="space-y-3">
                          {trustSignals.map((signal) => (
                            <div key={signal.label} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                              <div className="text-sm font-semibold text-slate-900">{signal.label}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">{signal.detail}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Holding Impact</div>
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>Before</span>
                          <span className="font-semibold text-slate-900">{formatQuantity(holdingImpact.beforeQuantity)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                          <span>Delta</span>
                          <span className="font-semibold text-slate-900">{verdict === "approved" ? `+${formatQuantity(holdingImpact.deltaQuantity)}` : "0"}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                          <span>After</span>
                          <span className="font-semibold text-slate-900">{formatQuantity(holdingImpact.afterQuantity)}</span>
                        </div>
                        <div className="mt-3 text-xs leading-5 text-slate-500">{holdingImpact.summary}</div>
                      </div>
                    </>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <button className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-200" onClick={() => setStep("ticket")} type="button">
                      Edit
                    </button>
                    <button
                      className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
                      onClick={() => {
                        if (side === "buy") {
                          setActiveStageIndex(0);
                          setActiveStatusIndex(0);
                          setStep("processing");
                          return;
                        }
                        setStep("result");
                      }}
                      type="button"
                    >
                      Confirm
                    </button>
                  </div>
                </>
              ) : null}

              {step === "processing" ? (
                <div className="space-y-4" data-testid="trade-order-processing">
                  <div className={`rounded-3xl border px-5 py-4 ${toneClasses.panel}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${toneClasses.icon}`}>
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      </div>
                      <div>
                        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses.title}`}>Live Status</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{processingStages[activeStageIndex]?.statuses[activeStatusIndex]}</div>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                      <motion.div
                        animate={{ width: `${Math.min(progressRatio, 100)}%` }}
                        className={`h-full rounded-full ${toneClasses.progress}`}
                        transition={{ type: "spring", stiffness: 120, damping: 24 }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {processingStages.map((stage, index) => {
                      const completed = index < activeStageIndex;
                      const active = index === activeStageIndex;
                      return (
                        <motion.div
                          key={stage.id}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                          initial={{ opacity: 0, y: 10 }}
                        >
                          <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${completed ? toneClasses.icon : active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"}`}>
                            {completed ? <CheckCircle2 className="h-4 w-4" data-testid="trade-order-stage-complete" /> : active ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{stage.title}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              {completed ? stage.completeText : active ? stage.statuses[activeStatusIndex] : "等待执行"}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === "result" ? (
                <div className="space-y-4 text-center" data-testid="trade-order-result">
                  {side === "buy" && verdict === "approved" ? (
                    <div className="relative mx-auto h-20 w-20" data-testid="trade-order-success-celebration">
                      <motion.div animate={{ opacity: [0.16, 0.28, 0.1], scale: [0.8, 1.2, 1.45] }} className="absolute inset-0 rounded-full bg-emerald-200" transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, repeatType: "loop" }} />
                      <motion.div animate={{ opacity: [0.2, 0], scale: [0.9, 1.5] }} className="absolute inset-1 rounded-full border border-emerald-300" transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.4 }} />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                    </div>
                  ) : side === "buy" && verdict === "review" ? (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Clock3 className="h-8 w-8" />
                    </div>
                  ) : side === "buy" ? (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <ShieldAlert className="h-8 w-8" />
                    </div>
                  ) : (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                  )}

                  <div>
                    <h3 className="text-2xl font-semibold text-slate-950">
                      {side === "buy"
                        ? verdict === "approved"
                          ? "购买已完成"
                          : verdict === "review"
                            ? "购买已提交复核"
                            : "当前购买受限"
                        : "卖出指令已模拟"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {side === "buy"
                        ? verdict === "approved"
                          ? `${asset.symbol} 的购买已经完成，持仓和审计记录都已更新。`
                          : verdict === "review"
                            ? `${asset.symbol} 已进入人工复核队列，持仓暂不变更。`
                            : `${asset.symbol} 当前不满足购买条件，但限制原因与证据已留存。`
                        : `Your ${side} order for ${asset.symbol} was added to the demo activity feed.`}
                    </p>
                  </div>

                  {side === "buy" ? (
                    <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        Result Summary
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>Eligibility</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClasses.badge}`}>{eligibility.badgeLabel}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>Estimated total</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(estimatedTotal)}</span>
                      </div>
                      <div className="text-xs leading-5 text-slate-500">{holdingImpact.summary}</div>
                    </div>
                  ) : null}

                  <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800" onClick={onClose} type="button">
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
