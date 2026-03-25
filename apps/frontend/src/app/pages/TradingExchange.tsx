import { motion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Clock,
  Filter,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RWAPurchaseModal } from "../components/RWAPurchaseModal";
import {
  createOrderBook,
  createPriceSeries,
  createRecentTrades,
  tradeInstruments,
  type ChartTimeframe,
  type TradeInstrument,
  type TradeProductType,
} from "../data/demoData";
import { getAssetMeta, type AssetType } from "../lib/assetMeta";
import { formatCompactNumber, formatPercent, formatTokenPrice } from "../lib/format";
import { getPurchaseEligibility } from "../lib/purchaseNarrative";

type TradeAssetFilter =
  | "all"
  | Extract<
      AssetType,
      | "real-estate"
      | "bonds"
      | "commodities"
      | "equity"
      | "private-credit"
      | "carbon-assets"
      | "infrastructure"
      | "precious-metals"
      | "art"
      | "ip-royalties"
      | "luxury-goods"
      | "restricted"
    >;
type ViewMode = "trade" | "positions";
type OrderType = "limit" | "market";
type Side = "buy" | "sell";

const assetTabs: ReadonlyArray<{ id: TradeAssetFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "restricted", label: "受限资产" },
  { id: "real-estate", label: "REITs/房地产" },
  { id: "bonds", label: "国债债券" },
  { id: "commodities", label: "大宗商品" },
  { id: "equity", label: "股权" },
  { id: "private-credit", label: "私募信贷" },
  { id: "carbon-assets", label: "碳资产" },
  { id: "infrastructure", label: "基础设施" },
  { id: "precious-metals", label: "贵金属" },
  { id: "art", label: "艺术品" },
  { id: "ip-royalties", label: "IP版权" },
  { id: "luxury-goods", label: "奢侈品" },
];

const productTabs: ReadonlyArray<{ id: TradeProductType; label: string }> = [
  { id: "spot", label: "现货" },
  { id: "futures", label: "期货" },
  { id: "index", label: "指数" },
  { id: "etf", label: "ETF" },
];

const productLabels: Record<TradeProductType, string> = {
  spot: "现货",
  futures: "期货",
  index: "指数",
  etf: "ETF",
};

function matchesAssetFilter(filter: TradeAssetFilter, type: AssetType) {
  if (filter === "all") return true;
  if (filter === "carbon-assets") return type === "carbon-assets" || type === "carbon-credits";
  return type === filter;
}

function getAssetTabStateClasses(entryId: TradeAssetFilter, activeFilter: TradeAssetFilter) {
  const isActive = activeFilter === entryId;
  const isRestricted = entryId === "restricted";

  if (isRestricted) {
    return isActive ? "text-red-600" : "text-red-400";
  }

  return isActive ? "text-gray-900" : "text-gray-400";
}

function getEligibilityClasses(tone: "emerald" | "amber" | "red") {
  if (tone === "emerald") {
    return {
      badge: "bg-emerald-50 text-emerald-700",
      panel: "border-emerald-100 bg-emerald-50/80",
      title: "text-emerald-800",
      detail: "text-emerald-700",
      accent: "text-emerald-600",
    };
  }

  if (tone === "amber") {
    return {
      badge: "bg-amber-50 text-amber-700",
      panel: "border-amber-100 bg-amber-50/80",
      title: "text-amber-800",
      detail: "text-amber-700",
      accent: "text-amber-600",
    };
  }

  return {
    badge: "bg-red-50 text-red-700",
    panel: "border-red-100 bg-red-50/80",
    title: "text-red-800",
    detail: "text-red-700",
    accent: "text-red-600",
  };
}

function createTradePositions() {
  return tradeInstruments
    .filter((instrument) => instrument.productType === "spot")
    .slice(0, 4)
    .map((instrument, index) => {
      const amountHeld = (index + 1) * 900;
      const avgPrice = instrument.price * (1 - (index === 1 ? -0.08 : 0.05));
      const currentValue = amountHeld * instrument.price;
      const pnl = currentValue - amountHeld * avgPrice;
      const pnlPercent = (pnl / (amountHeld * avgPrice)) * 100;
      return { ...instrument, amountHeld, avgPrice, currentValue, pnl, pnlPercent };
    });
}

export function TradingExchange() {
  const [viewMode, setViewMode] = useState<ViewMode>("trade");
  const [selected, setSelected] = useState<TradeInstrument | null>(null);
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<TradeAssetFilter>("all");
  const [productType, setProductType] = useState<TradeProductType>("spot");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);

  const instruments = useMemo(
    () =>
      tradeInstruments.filter((instrument) => {
        const matchesQuery =
          query === "" ||
          `${instrument.symbol} ${instrument.name} ${instrument.description}`.toLowerCase().includes(query.toLowerCase());
        const matchesAsset = matchesAssetFilter(assetFilter, instrument.type);
        return matchesQuery && matchesAsset && instrument.productType === productType;
      }),
    [assetFilter, productType, query],
  );

  const positions = useMemo(() => createTradePositions(), []);
  const totalCurrent = positions.reduce((sum, position) => sum + position.currentValue, 0);
  const totalCost = positions.reduce((sum, position) => sum + position.amountHeld * position.avgPrice, 0);
  const totalPnl = totalCurrent - totalCost;
  const totalPnlPercent = totalCost === 0 ? 0 : (totalPnl / totalCost) * 100;

  if (!selected) {
    return (
      <div className="spotlight-bg min-h-full pb-24" data-testid="trade-page">
        <div className="relative z-10 rounded-b-3xl bg-white/78 px-6 pb-6 pt-12 shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <div className="flex gap-1 rounded-full bg-gray-100 p-1.5 shadow-inner">
              <button
                className={`rounded-full px-8 py-2.5 text-sm font-bold ${viewMode === "trade" ? "bg-white text-gray-900 shadow-md" : "text-gray-500"}`}
                onClick={() => setViewMode("trade")}
                type="button"
              >
                Trade
              </button>
              <button
                className={`rounded-full px-8 py-2.5 text-sm font-bold ${viewMode === "positions" ? "bg-white text-gray-900 shadow-md" : "text-gray-500"}`}
                onClick={() => setViewMode("positions")}
                type="button"
              >
                Positions
              </button>
            </div>
          </div>

          {viewMode === "trade" ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-2xl border border-white/70 bg-white/72 py-3.5 pl-12 pr-4 text-sm outline-none backdrop-blur-xl focus:border-[var(--accent-blue-soft)] focus:bg-white"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索 RWA 资产..."
                    type="text"
                    value={query}
                  />
                </div>
                <motion.button className="glass-button flex h-12 w-12 items-center justify-center rounded-2xl" type="button" whileTap={{ scale: 0.95 }}>
                  <Filter className="h-5 w-5 text-gray-600" />
                </motion.button>
              </div>

              <div className="scrollbar-hide mb-6 flex items-center gap-6 overflow-x-auto pb-2">
                {assetTabs.map((entry) => (
                  <button
                    key={entry.id}
                    className={`relative whitespace-nowrap pb-2 text-sm font-semibold transition-colors ${getAssetTabStateClasses(entry.id, assetFilter)}`}
                    data-accent={entry.id === "restricted" ? "danger" : "default"}
                    data-testid={`trade-asset-type-${entry.id}`}
                    onClick={() => setAssetFilter(entry.id)}
                    type="button"
                  >
                    {entry.label}
                    {assetFilter === entry.id ? (
                      <motion.div
                        className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${entry.id === "restricted" ? "bg-red-500" : "bg-blue-600"}`}
                        layoutId="tradeTab"
                      />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="mb-2 flex items-center gap-2">
                {productTabs.map((entry) => (
                  <button
                    key={entry.id}
                    className={`rounded-full px-4 py-2 text-xs font-medium ${productType === entry.id ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-gray-100 text-gray-600"}`}
                    data-testid={`trade-product-${entry.id}`}
                    onClick={() => setProductType(entry.id)}
                    type="button"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="pb-6 pt-2">
              <motion.div animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-gray-900 p-6 shadow-xl" initial={{ opacity: 0, y: 20 }}>
                <div className="absolute -mr-10 -mt-10 right-0 top-0 h-32 w-32 rounded-full bg-blue-500 opacity-20 blur-3xl" />
                <div className="absolute -mb-10 -ml-10 bottom-0 left-0 h-24 w-24 rounded-full bg-purple-500 opacity-20 blur-2xl" />
                <div className="relative z-10">
                  <div className="mb-2 text-sm font-medium text-gray-400">Total Equity (USDT)</div>
                  <div className="mb-4 flex items-baseline gap-1 text-4xl font-bold text-white">
                    <span className="text-2xl text-gray-400">$</span>
                    {totalCurrent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="mt-2 flex items-center gap-4 border-t border-gray-800 pt-4">
                    <div>
                      <div className="mb-1 text-[10px] uppercase text-gray-500">Total PnL</div>
                      <div className={`flex items-center gap-1 text-sm font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {totalPnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {totalPnl.toFixed(2)}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-800" />
                    <div>
                      <div className="mb-1 text-[10px] uppercase text-gray-500">Today's PnL</div>
                      <div className={`text-sm font-bold ${totalPnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>{totalPnlPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {viewMode === "trade" ? (
          <div className="mt-4 space-y-2 px-6">
            {instruments.length > 0 ? (
              instruments.map((instrument, index) => {
                const eligibility = getPurchaseEligibility(instrument);
                const eligibilityClasses = getEligibilityClasses(eligibility.tone);

                return (
                  <motion.button
                    key={instrument.id}
                    animate={{ opacity: 1, y: 0 }}
                    className="stage-surface panel-hover w-full rounded-2xl px-4 py-3 text-left"
                    data-testid={`trade-token-${instrument.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    onClick={() => {
                      setSelected(instrument);
                      setPrice("");
                      setAmount("");
                      setOrderOpen(false);
                    }}
                    transition={{ delay: index * 0.05 }}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-base font-bold text-gray-900">{instrument.symbol}</span>
                          <span className="text-xs text-gray-400">/USDT</span>
                          <span className="rounded bg-gradient-to-r from-blue-500 to-purple-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{instrument.leverage}</span>
                        </div>
                        <div className="mb-1 text-xs font-medium text-gray-400">{instrument.name}</div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${eligibilityClasses.badge}`}
                            data-testid={`trade-eligibility-badge-${instrument.id}`}
                          >
                            {eligibility.badgeLabel}
                          </span>
                          <span
                            className="text-[11px] font-medium text-gray-500"
                            data-testid={`trade-eligibility-reason-${instrument.id}`}
                          >
                            {eligibility.listSummary}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <div className="text-lg font-bold text-gray-900">${formatTokenPrice(instrument.price)}</div>
                          <div className="text-[10px] font-medium text-gray-400">Vol ${formatCompactNumber(instrument.volume24h)}</div>
                        </div>
                      </div>
                      <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${instrument.change24h >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                        {formatPercent(instrument.change24h)}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center shadow-sm">
                <p className="text-sm font-semibold text-gray-900">当前筛选下暂无资产</p>
                <p className="mt-1 text-xs text-gray-500">试试切换产品分类或修改搜索关键词。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4 px-6">
            {positions.map((position, index) => {
              const meta = getAssetMeta(position.type);
              const Icon = meta.Icon;

              return (
                <motion.div
                  key={position.id}
                  animate={{ opacity: 1, y: 0 }}
                  className="stage-surface panel-hover rounded-3xl p-5"
                  initial={{ opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{position.symbol}</span>
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{position.leverage}</span>
                        </div>
                        <div className="text-xs text-gray-500">{position.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">${position.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{position.amountHeld.toLocaleString()} {position.symbol}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 text-[10px] uppercase text-gray-400">Avg / Current Price</div>
                      <div className="text-sm font-semibold text-gray-900">
                        ${formatTokenPrice(position.avgPrice)} <span className="mx-1 text-gray-300">-&gt;</span> ${formatTokenPrice(position.price)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-1 text-[10px] uppercase text-gray-400">Unrealized PnL</div>
                      <div className={`text-sm font-bold ${position.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const series = createPriceSeries(selected, timeframe);
  const orderBook = createOrderBook(selected);
  const recentTrades = createRecentTrades(selected);
  const selectedEligibility = getPurchaseEligibility(selected);
  const selectedEligibilityClasses = getEligibilityClasses(selectedEligibility.tone);

  return (
    <div className="spotlight-bg min-h-full pb-24" data-testid="trade-page">
      <motion.div animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-20 border-b stage-divider bg-white/86 px-6 pb-4 pt-12 backdrop-blur-xl" initial={{ opacity: 0, y: -20 }}>
        <div className="flex items-center justify-between">
          <motion.button className="glass-button flex h-10 w-10 items-center justify-center rounded-full" onClick={() => setSelected(null)} type="button" whileTap={{ scale: 0.9 }}>
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </motion.button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-gray-900">{selected.name}</h1>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-500">{selected.symbol}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-500">{productLabels[selected.productType]}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-500">24h Vol ${formatCompactNumber(selected.volume24h)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-500">
              {selected.location ? (
                <>
                  <span>{selected.location}</span>
                  <span className="text-gray-300">|</span>
                </>
              ) : null}
              <span>APY {selected.apy}%</span>
              <span className="text-gray-300">|</span>
              <span>可购 {selected.available} 份</span>
            </div>
            <div
              className={`mx-auto mt-3 max-w-xl rounded-2xl border px-4 py-3 text-left shadow-sm ${selectedEligibilityClasses.panel}`}
              data-testid="trade-eligibility-summary"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedEligibilityClasses.badge}`}>
                  {selectedEligibility.badgeLabel}
                </span>
                <span className={`text-xs font-semibold ${selectedEligibilityClasses.title}`}>准入结论</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{selectedEligibility.reason}</div>
              <div className={`mt-1 text-[11px] ${selectedEligibilityClasses.detail}`}>
                还差哪一步: {selectedEligibility.missingStep ?? "当前无需补充步骤"}
              </div>
            </div>
          </div>
          <motion.button className="glass-button flex h-10 w-10 items-center justify-center rounded-full" onClick={() => setFavorite(!favorite)} type="button" whileTap={{ scale: 0.9 }}>
            <Star className={`h-5 w-5 ${favorite ? "fill-yellow-500 text-yellow-500" : "text-gray-400"}`} />
          </motion.button>
        </div>
      </motion.div>

      <div className="mb-4 px-6">
        <div className="stage-surface overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b stage-divider px-5 py-4">
            <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
              {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((entry) => (
                <button
                  key={entry}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold ${timeframe === entry ? "accent-action text-white" : "glass-button text-gray-500 hover:bg-white/82"}`}
                  data-testid={`trade-timeframe-${entry}`}
                  onClick={() => setTimeframe(entry)}
                  type="button"
                >
                  {entry}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className={`rounded-xl p-2.5 ${chartType === "line" ? "glass-button text-gray-900" : "text-gray-400"}`} onClick={() => setChartType("line")} type="button">
                <Activity className="h-4 w-4" />
              </button>
              <button className={`rounded-xl p-2.5 ${chartType === "candlestick" ? "glass-button text-gray-900" : "text-gray-400"}`} onClick={() => setChartType("candlestick")} type="button">
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-8" style={{ height: "320px" }}>
            <ResponsiveContainer height="100%" width="100%">
              {chartType === "line" ? (
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="tradeArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis axisLine={false} dataKey="time" tick={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={56} />
                  <Tooltip />
                  <Area dataKey="close" dot={false} fill="url(#tradeArea)" stroke="#3b82f6" strokeWidth={2.5} type="monotone" />
                </AreaChart>
              ) : (
                <BarChart data={series}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis axisLine={false} dataKey="time" tick={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={56} />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4 px-6">
        <div className="stage-surface rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">订单簿</h3>
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-1 text-xs">
            {orderBook.asks.map((ask, index) => (
              <div key={`ask-${index}`} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className="font-bold text-red-600">{formatTokenPrice(ask.price)}</div>
                <div className="text-right font-semibold text-gray-700">{ask.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{ask.total.toFixed(0)}</div>
              </div>
            ))}
            <div className={`my-3 rounded-xl px-4 py-3 text-center text-base font-bold ${selected.change24h >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{formatTokenPrice(selected.price)}</div>
            {orderBook.bids.map((bid, index) => (
              <div key={`bid-${index}`} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className="font-bold text-green-600">{formatTokenPrice(bid.price)}</div>
                <div className="text-right font-semibold text-gray-700">{bid.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{bid.total.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stage-surface rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">最近成交</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-1 text-xs">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className={`font-bold ${trade.side === "buy" ? "text-green-600" : "text-red-600"}`}>{formatTokenPrice(trade.price)}</div>
                <div className="text-right font-semibold text-gray-700">{trade.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{trade.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="stage-surface rounded-3xl p-6">
          <div className="mb-5 grid grid-cols-2 gap-3">
            <motion.button className={`rounded-2xl py-4 text-base font-bold ${side === "buy" ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-600"}`} data-testid="trade-side-buy" onClick={() => setSide("buy")} type="button" whileTap={{ scale: 0.98 }}>
              买入
            </motion.button>
            <motion.button className={`rounded-2xl py-4 text-base font-bold ${side === "sell" ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30" : "bg-gray-100 text-gray-600"}`} data-testid="trade-side-sell" onClick={() => setSide("sell")} type="button" whileTap={{ scale: 0.98 }}>
              卖出
            </motion.button>
          </div>

          {side === "buy" ? (
            <div
              className={`mb-5 rounded-2xl border px-4 py-4 shadow-sm ${selectedEligibilityClasses.panel}`}
              data-testid="trade-buy-eligibility-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${selectedEligibilityClasses.accent}`}>购买资格</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{selectedEligibility.summary}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedEligibilityClasses.badge}`}>
                  {selectedEligibility.badgeLabel}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">{selectedEligibility.reason}</div>
              <div className={`mt-2 text-[11px] ${selectedEligibilityClasses.detail}`}>
                下一步: {selectedEligibility.nextAction}
              </div>
            </div>
          ) : null}

          <div className="mb-5 flex gap-2 rounded-2xl bg-gray-100 p-1">
            <button className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${orderType === "limit" ? "bg-white text-gray-900 shadow-[var(--shadow-soft)]" : "text-gray-500"}`} onClick={() => setOrderType("limit")} type="button">
              限价单            </button>
            <button className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${orderType === "market" ? "bg-white text-gray-900 shadow-[var(--shadow-soft)]" : "text-gray-500"}`} onClick={() => setOrderType("market")} type="button">
              市价单            </button>
          </div>

          <div className="mb-5 space-y-4">
            {orderType === "limit" ? (
              <div>
                <div className="mb-2 text-xs font-bold text-gray-500">价格</div>
                <div className="relative">
                  <input
                    className="w-full rounded-2xl border border-white/70 bg-white/74 px-4 py-4 text-sm font-semibold outline-none backdrop-blur-xl focus:border-[var(--accent-blue-soft)] focus:bg-white"
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder={formatTokenPrice(selected.price)}
                    type="number"
                    value={price}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">USDT</span>
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-xs font-bold text-gray-500">数量</div>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-white/70 bg-white/74 px-4 py-4 text-sm font-semibold outline-none backdrop-blur-xl focus:border-[var(--accent-blue-soft)] focus:bg-white"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  type="number"
                  value={amount}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">{selected.symbol}</span>
              </div>
            </div>
          </div>

          <div className="soft-panel mb-5 flex items-center justify-between rounded-2xl px-5 py-4 text-xs">
            <div className="flex items-center gap-2 text-gray-500">
              <Wallet className="h-4 w-4" />
              <div>
                <div className="font-bold">可用余额</div>
                <div className="mt-1 text-[11px] text-gray-400">
                  APY {selected.apy}% · 可购 {selected.available} 份
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">10,000.00 USDT</div>
              {selected.location ? <div className="mt-1 text-[11px] text-gray-400">{selected.location}</div> : null}
            </div>
          </div>

          <motion.button
            className={`w-full rounded-2xl py-5 text-base font-bold text-white shadow-lg ${side === "buy" ? "bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/30" : "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-500/30"}`}
            data-testid="trade-buy-button"
            onClick={() => setOrderOpen(true)}
            type="button"
            whileTap={{ scale: 0.98 }}
          >
            {side === "buy" ? selectedEligibility.ctaLabel : "卖出"} {selected.symbol}
          </motion.button>
        </div>
      </div>

      <RWAPurchaseModal asset={selected} isOpen={orderOpen} onClose={() => setOrderOpen(false)} side={side} />
    </div>
  );
}



