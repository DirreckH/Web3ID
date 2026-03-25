import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  Fingerprint,
  MapPin,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface AssetDetailModalProps {
  asset: {
    id: string;
    name: string;
    type: string;
    image: string;
    price: number;
    apy: number;
    totalValue: number;
    available: number;
    location?: string;
    status: string;
    description?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete: (assetId: string, quantity: number, total: number) => void;
}

const PRICE_HISTORY = [
  { date: "1月", price: 240 },
  { date: "2月", price: 245 },
  { date: "3月", price: 250 },
  { date: "4月", price: 248 },
  { date: "5月", price: 255 },
  { date: "6月", price: 260 },
];

type PurchaseStep = "detail" | "quantity" | "confirm" | "payment" | "success" | "audit" | "audit_failed";

export function AssetDetailModal({ asset, isOpen, onClose, onPurchaseComplete }: AssetDetailModalProps) {
  const [step, setStep] = useState<PurchaseStep>("detail");
  const [quantity, setQuantity] = useState(1);
  const timeoutIds = useRef<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep("detail");
      setQuantity(1);
    }
  }, [asset?.id, isOpen]);

  useEffect(
    () => () => {
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.current = [];
    },
    [],
  );

  if (!asset) {
    return null;
  }

  const clearQueuedSteps = () => {
    timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.current = [];
  };

  const handleClose = () => {
    clearQueuedSteps();
    setStep("detail");
    setQuantity(1);
    onClose();
  };

  const handlePurchase = () => {
    if (asset.type === "restricted") {
      clearQueuedSteps();
      setStep("audit");
      timeoutIds.current.push(
        window.setTimeout(() => {
          setStep("audit_failed");
        }, 2500),
      );
      return;
    }

    setStep("quantity");
  };

  const handleConfirm = () => {
    setStep("confirm");
  };

  const handlePayment = () => {
    clearQueuedSteps();
    setStep("payment");
    timeoutIds.current.push(
      window.setTimeout(() => {
        setStep("success");
      }, 2000),
    );
  };

  const handleComplete = () => {
    onPurchaseComplete(asset.id, quantity, asset.price * quantity);
    handleClose();
  };

  const totalPrice = asset.price * quantity;
  const estimatedAnnualReturn = totalPrice * (asset.apy / 100);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            data-testid="asset-detail-modal"
            exit={{ opacity: 0, y: "100%" }}
            initial={{ opacity: 0, y: "100%" }}
            style={{ maxHeight: "90vh" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              {step !== "detail" && step !== "payment" && step !== "success" && step !== "audit" && step !== "audit_failed" ? (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
                  onClick={() => {
                    if (step === "quantity") {
                      setStep("detail");
                    } else if (step === "confirm") {
                      setStep("quantity");
                    }
                  }}
                  type="button"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="h-8 w-8" />
              )}

              <h2 className="flex-1 text-center text-xl font-semibold">
                {step === "detail" ? "资产详情" : null}
                {step === "quantity" ? "选择数量" : null}
                {step === "confirm" ? "确认订单" : null}
                {step === "payment" ? "处理支付" : null}
                {step === "success" ? "购买成功" : null}
                {step === "audit" ? "Web3ID 合规审计" : null}
                {step === "audit_failed" ? "监管限制" : null}
              </h2>

              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
                onClick={handleClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 140px)" }}>
              {step === "detail" ? (
                <div>
                  <div className="relative h-64 bg-gray-200">
                    <ImageWithFallback alt={asset.name} className="h-full w-full object-cover" src={asset.image} />
                    <div
                      className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm ${
                        asset.type === "restricted" ? "bg-red-500/90" : "bg-green-500/90"
                      }`}
                    >
                      {asset.type === "restricted" ? "受限资产" : "可购买"}
                    </div>
                  </div>

                  <div className="space-y-6 p-6">
                    <div>
                      <h3 className="mb-2 text-2xl font-semibold text-gray-900">{asset.name}</h3>
                      {asset.location ? (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="mr-1 h-4 w-4" />
                          {asset.location}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-blue-50 p-4">
                        <div className="mb-1 text-sm text-gray-600">单价</div>
                        <div className="text-2xl font-semibold text-gray-900">${(asset.price / 1000).toFixed(0)}K</div>
                      </div>
                      <div className="rounded-2xl bg-green-50 p-4">
                        <div className="mb-1 text-sm text-gray-600">年化收益</div>
                        <div className="flex items-center gap-1 text-2xl font-semibold text-green-600">
                          {asset.apy}%
                          <TrendingUp className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-purple-50 p-4">
                        <div className="mb-1 text-sm text-gray-600">总价值</div>
                        <div className="text-xl font-semibold text-gray-900">${(asset.totalValue / 1000000).toFixed(1)}M</div>
                      </div>
                      <div className="rounded-2xl bg-orange-50 p-4">
                        <div className="mb-1 text-sm text-gray-600">可购买</div>
                        <div className="text-xl font-semibold text-gray-900">{asset.available} 份</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 text-lg font-semibold">价格走势</h4>
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
                      <h4 className="mb-3 text-lg font-semibold">资产描述</h4>
                      <p className="leading-relaxed text-gray-600">
                        {asset.description ||
                          "这是一项优质的实物资产投资机会，经过严格的尽职调查和合规审核。资产已完成代币化，每个代币代表资产的所有权份额。投资者可以获得稳定的租金收益分配。"}
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-3 text-lg font-semibold">相关文档</h4>
                      <div className="space-y-2">
                        <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 transition-colors hover:bg-gray-100" type="button">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">资产评估报告</span>
                          </div>
                          <span className="text-sm text-gray-500">PDF</span>
                        </button>
                        <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 transition-colors hover:bg-gray-100" type="button">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">法律文件</span>
                          </div>
                          <span className="text-sm text-gray-500">PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === "quantity" ? (
                <div className="space-y-6 p-6">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="mb-1 text-sm text-gray-600">选择的资产</div>
                    <div className="font-semibold">{asset.name}</div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700">购买数量</label>
                    <div className="flex items-center gap-4">
                      <button
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold transition-colors hover:bg-gray-300"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        type="button"
                      >
                        −
                      </button>
                      <input
                        className="flex-1 rounded-2xl bg-gray-50 py-3 text-center text-2xl font-semibold outline-none"
                        onChange={(event) => setQuantity(Math.max(1, Math.min(asset.available, Number.parseInt(event.target.value, 10) || 1)))}
                        type="number"
                        value={quantity}
                      />
                      <button
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold transition-colors hover:bg-gray-300"
                        onClick={() => setQuantity(Math.min(asset.available, quantity + 1))}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-2 text-center text-sm text-gray-500">最多可购买 {asset.available} 份</div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">单价</span>
                      <span className="font-semibold">${(asset.price / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">数量</span>
                      <span className="font-semibold">× {quantity}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-blue-200 pt-3">
                      <span className="font-medium text-gray-900">总计</span>
                      <span className="text-2xl font-semibold text-blue-600">${(totalPrice / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="text-sm text-gray-600">预计年收益: ${(estimatedAnnualReturn / 1000).toFixed(1)}K</div>
                  </div>
                </div>
              ) : null}

              {step === "confirm" ? (
                <div className="space-y-6 p-6">
                  <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
                    <h4 className="font-semibold text-gray-900">订单详情</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">资产名称</span>
                        <span className="font-medium">{asset.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">购买数量</span>
                        <span className="font-medium">{quantity} 份</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">单价</span>
                        <span className="font-medium">${(asset.price / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-2">
                        <span className="font-semibold">总计</span>
                        <span className="text-xl font-semibold text-blue-600">${(totalPrice / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-5 w-5 text-green-600" />
                      <div>
                        <div className="mb-1 font-semibold text-gray-900">预计收益</div>
                        <div className="text-sm text-gray-600">
                          年化收益率: {asset.apy}%
                          <br />
                          预计年收益: ${(estimatedAnnualReturn / 1000).toFixed(1)}K
                          <br />
                          收益发放: 每季度
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>重要提示：</strong>购买后资产将在 24 小时内转入您的 Web3ID 钱包。请确保您已了解相关投资风险。
                    </p>
                  </div>
                </div>
              ) : null}

              {step === "payment" ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    className="mb-4 h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent"
                    transition={{ duration: 1, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
                  />
                  <p className="mb-2 text-lg font-semibold text-gray-900">正在处理支付</p>
                  <p className="text-sm text-gray-600">请稍候，正在与区块链网络通信...</p>
                </div>
              ) : null}

              {step === "success" ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
                  <motion.div
                    animate={{ scale: 1 }}
                    className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500"
                    initial={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                    </svg>
                  </motion.div>
                  <h3 className="mb-2 text-2xl font-semibold text-gray-900">购买成功！</h3>
                  <p className="mb-6 text-center text-gray-600">
                    您已成功购买 {quantity} 份 {asset.name}
                  </p>
                  <div className="w-full rounded-2xl bg-gray-50 p-4">
                    <div className="mb-1 text-sm text-gray-600">交易金额</div>
                    <div className="text-2xl font-semibold text-gray-900">${(totalPrice / 1000).toFixed(0)}K</div>
                  </div>
                </div>
              ) : null}

              {step === "audit" ? (
                <div className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden p-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white/50 backdrop-blur-xl" />
                  <motion.div animate={{ opacity: 1, y: 0 }} className="relative z-10 flex flex-col items-center" initial={{ opacity: 0, y: 20 }}>
                    <div className="relative mb-6">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                        className="absolute inset-0 rounded-full bg-blue-400 blur-xl"
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                        <Fingerprint className="h-12 w-12 text-white" strokeWidth={1.5} />
                      </div>
                      <motion.div
                        animate={{ top: ["0%", "100%", "0%"] }}
                        className="absolute left-0 right-0 z-20 h-1 bg-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                        transition={{ duration: 3, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
                      />
                    </div>
                    <h3 className="mb-2 text-xl font-bold tracking-tight text-gray-900">验证 Web3ID 资质</h3>
                    <p className="max-w-[260px] text-center text-sm text-gray-500">正在通过联邦协议验证您的 KYC/AML 状态与属地合规性...</p>
                  </motion.div>
                </div>
              ) : null}

              {step === "audit_failed" ? (
                <div className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden p-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-red-50/50 to-white/50 backdrop-blur-xl" />
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex w-full flex-col items-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30">
                      <ShieldAlert className="h-10 w-10 text-white" strokeWidth={1.5} />
                    </div>
                    <h3 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">不可购买</h3>
                    <p className="mb-6 max-w-[280px] text-center text-base text-gray-600">根据监管要求，您的 Web3ID 资质未满足该高风险资产的投资条件。</p>
                    <div className="w-full space-y-3 rounded-2xl border border-red-100 bg-white/80 p-4 shadow-sm backdrop-blur-md">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                        <div>
                          <div className="text-sm font-semibold text-gray-900">KYC 属地限制</div>
                          <div className="text-xs text-gray-500">该资产不支持您当前所在司法管辖区的投资者</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                        <div>
                          <div className="text-sm font-semibold text-gray-900">投资者认证</div>
                          <div className="text-xs text-gray-500">需要持有高级合格投资者(Accredited Investor)认证凭证</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </div>

            {step !== "payment" && step !== "audit" ? (
              <div className="border-t border-gray-200 bg-white px-6 py-4">
                {step === "detail" ? (
                  <motion.button
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white shadow-lg transition-all ${
                      asset.type === "restricted"
                        ? "bg-gradient-to-r from-gray-900 to-gray-800 shadow-gray-900/20 hover:from-black hover:to-gray-900"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/20 hover:from-blue-600 hover:to-blue-700"
                    }`}
                    onClick={handlePurchase}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    {asset.type === "restricted" ? (
                      <>
                        <ShieldAlert className="h-5 w-5" />
                        验证 Web3ID 购买
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        立即购买
                      </>
                    )}
                  </motion.button>
                ) : null}

                {step === "quantity" ? (
                  <motion.button
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-600 hover:to-blue-700"
                    onClick={handleConfirm}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    下一步
                  </motion.button>
                ) : null}

                {step === "confirm" ? (
                  <motion.button
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-600 hover:to-blue-700"
                    onClick={handlePayment}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    确认并支付
                  </motion.button>
                ) : null}

                {step === "success" ? (
                  <motion.button
                    className="w-full rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 py-3.5 font-semibold text-white shadow-lg shadow-gray-900/20 transition-all hover:from-black hover:to-gray-900"
                    onClick={handleComplete}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    完成
                  </motion.button>
                ) : null}

                {step === "audit_failed" ? (
                  <motion.button
                    className="w-full rounded-2xl bg-gray-100 py-3.5 font-semibold text-gray-900 transition-all hover:bg-gray-200"
                    onClick={handleClose}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    返回浏览
                  </motion.button>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
