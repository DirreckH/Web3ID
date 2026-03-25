import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketToken } from "../data/demoData";
import { formatCurrency, formatQuantity, formatTokenPrice } from "../lib/format";

interface RWAPurchaseModalProps {
  asset: MarketToken | null;
  isOpen: boolean;
  onClose: () => void;
  side?: "buy" | "sell";
}

type Step = "ticket" | "review" | "success";

export function RWAPurchaseModal({ asset, isOpen, onClose, side = "buy" }: RWAPurchaseModalProps) {
  const [step, setStep] = useState<Step>("ticket");
  const [quantity, setQuantity] = useState("1000");

  useEffect(() => {
    if (isOpen) {
      setStep("ticket");
      setQuantity("1000");
    }
  }, [isOpen, asset?.id, side]);

  if (!asset) {
    return null;
  }

  const numericQuantity = Number(quantity) || 0;
  const estimatedTotal = numericQuantity * asset.price;

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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{side} ticket</p>
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
                  </div>
                  <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-semibold text-white transition hover:bg-slate-800" onClick={() => setStep("review")} type="button">
                    Continue
                  </button>
                </>
              ) : null}

              {step === "review" ? (
                <>
                  <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-700">
                    <p className="font-semibold text-slate-950">Review order ticket</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <button className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-200" onClick={() => setStep("ticket")} type="button">
                      Edit
                    </button>
                    <button className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700" onClick={() => setStep("success")} type="button">
                      Confirm
                    </button>
                  </div>
                </>
              ) : null}

              {step === "success" ? (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-950">Order simulated</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Your {side} order for {asset.symbol} was added to the demo activity feed.
                    </p>
                  </div>
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
