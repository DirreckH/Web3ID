import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowLeft, ArrowUpDown, BarChart3, Building2, Clock, FileText, Filter, Package, Search, Sparkles, Star, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RWAPurchaseModal } from "../components/RWAPurchaseModal";
import { listTradeInstruments, type TradeInstrument } from "../lib/dataGateway";

type ViewMode = "trade" | "positions";
type OrderType = "limit" | "market";
type Side = "buy" | "sell";
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const iconFor = (type: TradeInstrument["type"]) => {
  switch (type) {
    case "real-estate":
      return <Building2 className="h-5 w-5" />;
    case "art":
      return <Sparkles className="h-5 w-5" />;
    case "bonds":
      return <FileText className="h-5 w-5" />;
    case "commodities":
      return <Package className="h-5 w-5" />;
  }
};

const makeSeries = (seed: string, timeframe: Timeframe) =>
  Array.from({ length: 36 }, (_, index) => {
    const base = seed.length * 13 + index * 7 + timeframe.length * 11;
    return {
      id: `${seed}-${timeframe}-${index}`,
      time: `${index}`,
      close: 2200 + Math.sin(base / 8) * 80 + index * 2.5,
      volume: 120000 + (index % 7) * 28000 + base * 13,
    };
  });

const makeBook = (price: number) => ({
  asks: Array.from({ length: 5 }, (_, index) => ({ price: price + (index + 1) * 0.5, amount: 1.4 + index * 0.9, total: (price + (index + 1) * 0.5) * (1.4 + index * 0.9) })),
  bids: Array.from({ length: 5 }, (_, index) => ({ price: price - (index + 1) * 0.5, amount: 1.8 + index * 0.7, total: (price - (index + 1) * 0.5) * (1.8 + index * 0.7) })),
});

const makeTrades = () =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `trade-${index}`,
    price: 2456.78 + (index % 2 === 0 ? 1 : -1) * (index + 1),
    amount: 0.6 + index * 0.22,
    time: `09:${String(index * 3).padStart(2, "0")}:12`,
    side: index % 2 === 0 ? "buy" : "sell",
  }));

export function TradingExchange() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("trade");
  const [selected, setSelected] = useState<TradeInstrument | null>(null);
  const [allTokens, setAllTokens] = useState<TradeInstrument[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"\u5168\u90e8" | "\u623f\u5730\u4ea7" | "\u827a\u672f\u6536\u85cf" | "\u503a\u5238" | "\u5927\u5b97\u5546\u54c1">("\u5168\u90e8");
  const [category, setCategory] = useState<"\u73b0\u8d27" | "\u671f\u8d27" | "\u6307\u6570" | "ETF">("\u73b0\u8d27");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    let active = true;

    void listTradeInstruments().then((entries) => {
      if (active) {
        setAllTokens(entries);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const tokens = useMemo(
    () =>
      allTokens.filter((token) => {
        const matchesQuery = query === "" || `${token.symbol} ${token.name}`.toLowerCase().includes(query.toLowerCase());
        const matchesTab =
          tab === "\u5168\u90e8" ||
          (tab === "\u623f\u5730\u4ea7" && token.type === "real-estate") ||
          (tab === "\u827a\u672f\u6536\u85cf" && token.type === "art") ||
          (tab === "\u503a\u5238" && token.type === "bonds") ||
          (tab === "\u5927\u5b97\u5546\u54c1" && token.type === "commodities");
        return matchesQuery && matchesTab;
      }),
    [allTokens, query, tab],
  );

  const positions = allTokens.slice(0, 3).map((token, index) => {
    const amountHeld = (index + 1) * 1000;
    const avgPrice = token.price * (1 - (index === 1 ? -0.1 : 0.05));
    const currentValue = amountHeld * token.price;
    const pnl = currentValue - amountHeld * avgPrice;
    const pnlPercent = (pnl / (amountHeld * avgPrice)) * 100;
    return { ...token, amountHeld, avgPrice, currentValue, pnl, pnlPercent };
  });

  const totalCurrent = positions.reduce((sum, position) => sum + position.currentValue, 0);
  const totalCost = positions.reduce((sum, position) => sum + position.amountHeld * position.avgPrice, 0);
  const totalPnl = totalCurrent - totalCost;
  const totalPnlPercent = (totalPnl / totalCost) * 100;

  if (!selected) {
    return (
      <div className="min-h-full bg-gray-50 pb-24" data-testid="trade-page">
        <div className="relative z-10 rounded-b-3xl bg-white px-6 pb-6 pt-12 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex gap-1 rounded-full bg-gray-100 p-1.5 shadow-inner">
              <button className={`rounded-full px-8 py-2.5 text-sm font-bold ${viewMode === "trade" ? "bg-white text-gray-900 shadow-md" : "text-gray-500"}`} onClick={() => setViewMode("trade")} type="button">
                Trade
              </button>
              <button className={`rounded-full px-8 py-2.5 text-sm font-bold ${viewMode === "positions" ? "bg-white text-gray-900 shadow-md" : "text-gray-500"}`} onClick={() => setViewMode("positions")} type="button">
                Positions
              </button>
            </div>
          </div>

          {viewMode === "trade" ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white" onChange={(event) => setQuery(event.target.value)} placeholder="\u641c\u7d22 RWA \u8d44\u4ea7..." type="text" value={query} />
                </div>
                <motion.button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50" type="button" whileTap={{ scale: 0.95 }}>
                  <Filter className="h-5 w-5 text-gray-600" />
                </motion.button>
              </div>

              <div className="scrollbar-hide mb-6 flex items-center gap-6 overflow-x-auto pb-2">
                {(["\u5168\u90e8", "\u623f\u5730\u4ea7", "\u827a\u672f\u6536\u85cf", "\u503a\u5238", "\u5927\u5b97\u5546\u54c1"] as const).map((entry) => (
                  <button key={entry} className={`relative whitespace-nowrap pb-2 text-sm font-semibold ${tab === entry ? "text-gray-900" : "text-gray-400"}`} onClick={() => setTab(entry)} type="button">
                    {entry}
                    {tab === entry ? <motion.div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-blue-600" layoutId="tradeTab" /> : null}
                  </button>
                ))}
              </div>

              <div className="mb-2 flex items-center gap-2">
                {(["\u73b0\u8d27", "\u671f\u8d27", "\u6307\u6570", "ETF"] as const).map((entry) => (
                  <button key={entry} className={`rounded-full px-4 py-2 text-xs font-medium ${category === entry ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-gray-100 text-gray-600"}`} onClick={() => setCategory(entry)} type="button">
                    {entry}
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
            {tokens.map((token, index) => (
              <motion.button
                key={token.id}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm"
                data-testid={`trade-token-${token.id}`}
                initial={{ opacity: 0, y: 20 }}
                onClick={() => setSelected(token)}
                type="button"
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{token.symbol}</span>
                      <span className="text-xs text-gray-400">/USDT</span>
                      <span className="rounded bg-gradient-to-r from-blue-500 to-purple-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{token.leverage}</span>
                    </div>
                    <div className="mb-1.5 text-xs font-medium text-gray-400">{token.name}</div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-lg font-bold text-gray-900">${token.price.toFixed(token.price < 1 ? 5 : 2)}</div>
                      <div className="text-[10px] font-medium text-gray-400">Vol ${(token.volume24h / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                  <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${token.change24h >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                    +{token.change24h.toFixed(2)}%
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-4 px-6">
            {positions.map((position, index) => (
              <motion.div key={position.id} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]" initial={{ opacity: 0, y: 20 }} transition={{ delay: index * 0.1 }}>
                <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">{iconFor(position.type)}</div>
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
                    <div className="text-sm font-semibold text-gray-900">${position.avgPrice.toFixed(4)} <span className="mx-1 text-gray-300">→</span> ${position.price.toFixed(4)}</div>
                  </div>
                  <div className="text-right">
                    <div className="mb-1 text-[10px] uppercase text-gray-400">Unrealized PnL</div>
                    <div className={`text-sm font-bold ${position.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>{position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const series = makeSeries(selected.id, timeframe);
  const orderBook = makeBook(selected.price);
  const recentTrades = makeTrades();

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white pb-24" data-testid="trade-page">
      <motion.div animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-20 border-b border-gray-100/50 bg-white/90 px-6 pb-4 pt-12 backdrop-blur-xl" initial={{ opacity: 0, y: -20 }}>
        <div className="flex items-center justify-between">
          <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100" onClick={() => setSelected(null)} type="button" whileTap={{ scale: 0.9 }}>
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </motion.button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-gray-900">{selected.name}</h1>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-500">{selected.symbol}</span>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-500">24h\u91cf ${(selected.volume24h / 1000000).toFixed(1)}M</span>
            </div>
          </div>
          <motion.button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100" onClick={() => setFavorite(!favorite)} type="button" whileTap={{ scale: 0.9 }}>
            <Star className={`h-5 w-5 ${favorite ? "fill-yellow-500 text-yellow-500" : "text-gray-400"}`} />
          </motion.button>
        </div>
      </motion.div>

      <div className="mb-4 px-6">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
              {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((entry) => (
                <button key={entry} className={`rounded-xl px-4 py-2 text-xs font-semibold ${timeframe === entry ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-gray-500 hover:bg-gray-100"}`} data-testid={`trade-timeframe-${entry}`} onClick={() => setTimeframe(entry)} type="button">
                  {entry}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className={`rounded-xl p-2.5 ${chartType === "line" ? "bg-gray-100 text-gray-900" : "text-gray-400"}`} onClick={() => setChartType("line")} type="button">
                <Activity className="h-4 w-4" />
              </button>
              <button className={`rounded-xl p-2.5 ${chartType === "candlestick" ? "bg-gray-100 text-gray-900" : "text-gray-400"}`} onClick={() => setChartType("candlestick")} type="button">
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
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">{"\u8ba2\u5355\u7c3f"}</h3>
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-1 text-xs">
            {orderBook.asks.map((ask, index) => (
              <div key={`ask-${index}`} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className="font-bold text-red-600">{ask.price.toFixed(2)}</div>
                <div className="text-right font-semibold text-gray-700">{ask.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{ask.total.toFixed(0)}</div>
              </div>
            ))}
            <div className={`my-3 rounded-xl px-4 py-3 text-center text-base font-bold ${selected.change24h >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{selected.price.toFixed(selected.price < 1 ? 5 : 2)}</div>
            {orderBook.bids.map((bid, index) => (
              <div key={`bid-${index}`} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className="font-bold text-green-600">{bid.price.toFixed(2)}</div>
                <div className="text-right font-semibold text-gray-700">{bid.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{bid.total.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">{"\u6700\u8fd1\u6210\u4ea4"}</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-1 text-xs">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="grid grid-cols-3 gap-3 rounded-xl py-2">
                <div className={`font-bold ${trade.side === "buy" ? "text-green-600" : "text-red-600"}`}>{trade.price.toFixed(2)}</div>
                <div className="text-right font-semibold text-gray-700">{trade.amount.toFixed(4)}</div>
                <div className="text-right font-medium text-gray-500">{trade.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-3">
            <motion.button className={`rounded-2xl py-4 text-base font-bold ${side === "buy" ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-600"}`} onClick={() => setSide("buy")} type="button" whileTap={{ scale: 0.98 }}>
              {"\u4e70\u5165"}
            </motion.button>
            <motion.button className={`rounded-2xl py-4 text-base font-bold ${side === "sell" ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30" : "bg-gray-100 text-gray-600"}`} onClick={() => setSide("sell")} type="button" whileTap={{ scale: 0.98 }}>
              {"\u5356\u51fa"}
            </motion.button>
          </div>

          <div className="mb-5 flex gap-2 rounded-2xl bg-gray-100 p-1">
            <button className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${orderType === "limit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`} onClick={() => setOrderType("limit")} type="button">
              {"\u9650\u4ef7\u5355"}
            </button>
            <button className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${orderType === "market" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`} onClick={() => setOrderType("market")} type="button">
              {"\u5e02\u4ef7\u5355"}
            </button>
          </div>

          <div className="mb-5 space-y-4">
            {orderType === "limit" ? (
              <div>
                <div className="mb-2 text-xs font-bold text-gray-500">{"\u4ef7\u683c"}</div>
                <div className="relative">
                  <input className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white" onChange={(event) => setPrice(event.target.value)} placeholder={selected.price.toFixed(selected.price < 1 ? 5 : 2)} type="number" value={price} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">USDT</span>
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-xs font-bold text-gray-500">{"\u6570\u91cf"}</div>
              <div className="relative">
                <input className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" type="number" value={amount} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">{selected.symbol}</span>
              </div>
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-xs">
            <div className="flex items-center gap-2 text-gray-500">
              <Wallet className="h-4 w-4" />
              <span className="font-bold">{"\u53ef\u7528\u4f59\u989d"}</span>
            </div>
            <span className="text-sm font-bold text-gray-900">10,000.00 USDT</span>
          </div>

          <motion.button
            className={`w-full rounded-2xl py-5 text-base font-bold text-white shadow-lg ${side === "buy" ? "bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/30" : "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-500/30"}`}
            data-testid="trade-buy-button"
            onClick={() => side === "buy" && setOrderOpen(true)}
            type="button"
            whileTap={{ scale: 0.98 }}
          >
            {side === "buy" ? "\u4e70\u5165" : "\u5356\u51fa"} {selected.symbol}
          </motion.button>
        </div>
      </div>

      <RWAPurchaseModal
        asset={{
          id: selected.id,
          symbol: selected.symbol,
          name: selected.name,
          type: selected.type,
          price: selected.price,
          change24h: selected.change24h,
          volume24h: selected.volume24h,
          marketCap: selected.marketCap,
          leverage: selected.leverage,
          description: `${selected.name} RWA asset`,
        }}
        isOpen={orderOpen}
        onClose={() => setOrderOpen(false)}
        side={side}
      />
    </div>
  );
}
