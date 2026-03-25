import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { LiquidGlassCard } from "../components/LiquidGlassButton";
import { portfolioPositions } from "../data/demoData";
import { useLanguage } from "../contexts/LanguageContext";
import { getAssetMeta } from "../lib/assetMeta";
import { formatCurrency, formatPercent, formatQuantity } from "../lib/format";

export function Portfolio() {
  const { t } = useLanguage();

  const totalValue = portfolioPositions.reduce((sum, position) => sum + position.totalValue, 0);
  const totalPnl = portfolioPositions.reduce((sum, position) => sum + position.pnl, 0);

  const grouped = new Map<string, number>();
  for (const position of portfolioPositions) {
    grouped.set(position.type, (grouped.get(position.type) ?? 0) + position.totalValue);
  }

  const sectorData = Array.from(grouped.entries()).map(([type, value]) => ({
    type,
    value,
    color: getAssetMeta(type as Parameters<typeof getAssetMeta>[0]).accentColor,
    label: getAssetMeta(type as Parameters<typeof getAssetMeta>[0]).label,
  }));

  return (
    <section className="spotlight-bg space-y-6 lg:space-y-8" data-testid="portfolio-page">
      <div>
        <p className="stage-eyebrow text-xs font-semibold uppercase">Portfolio analytics</p>
        <h1 className="stage-title mt-3 text-4xl font-semibold tracking-tight text-slate-950">{t("portfolio.title")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{t("portfolio.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Portfolio value</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(totalValue)}</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unrealized PnL</p>
          <p className={`mt-3 text-3xl font-semibold ${totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(totalPnl)}</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Holdings</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{portfolioPositions.length}</p>
        </LiquidGlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <LiquidGlassCard className="p-5 lg:p-6">
          <div className="mb-4">
            <p className="text-lg font-semibold text-slate-950">Allocation by sector</p>
            <p className="text-sm text-slate-500">A high-level split of your simulated RWA portfolio.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie data={sectorData} dataKey="value" innerRadius={72} outerRadius={118} paddingAngle={3}>
                  {sectorData.map((entry) => (
                    <Cell fill={entry.color} key={entry.type} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {sectorData.map((entry) => (
              <div key={entry.type} className="flex items-center justify-between rounded-2xl bg-white/72 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-700">{entry.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-950">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="p-5 lg:p-6">
          <div className="mb-4">
            <p className="text-lg font-semibold text-slate-950">Holdings overview</p>
            <p className="text-sm text-slate-500">Position values and live allocation percentage per asset.</p>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={portfolioPositions}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="symbol" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="totalValue" fill="#2563eb" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 space-y-3">
            {portfolioPositions.map((position) => {
              const meta = getAssetMeta(position.type);
              return (
                <div key={position.id} className="rounded-[28px] bg-white/72 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.chipClass}`}>{meta.label}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{position.symbol}</span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{position.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatQuantity(position.amount)} units</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-950">{formatCurrency(position.totalValue)}</p>
                      <p className={`mt-1 text-sm font-medium ${position.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatPercent(position.pnlPercent)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </LiquidGlassCard>
      </div>
    </section>
  );
}
