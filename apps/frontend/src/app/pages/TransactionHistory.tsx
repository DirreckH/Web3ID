import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { LiquidGlassCard } from "../components/LiquidGlassButton";
import { useLanguage } from "../contexts/LanguageContext";
import { listTransactionHistory, type HistoryRecord } from "../lib/dataGateway";
import { getAssetMeta } from "../lib/assetMeta";
import { formatCompactNumber, formatCurrency, formatQuantity } from "../lib/format";

const statusFilters = ["all", "completed", "pending", "failed"] as const;

export function TransactionHistory() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    let active = true;

    void listTransactionHistory().then((entries) => {
      if (active) {
        setRecords(entries);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const visibleTransactions = records.filter((record) => {
    const matchesStatus = status === "all" ? true : record.status === status;
    const haystack = `${record.assetName} ${record.assetSymbol} ${record.txHash}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const completedCount = records.filter((entry) => entry.status === "completed").length;
  const totalNotional = records.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <section className="space-y-6 lg:space-y-8" data-testid="history-page">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Activity ledger</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{t("history.title")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{t("history.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Transactions</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{records.length}</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-600">{completedCount}</p>
        </LiquidGlassCard>
        <LiquidGlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Notional</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCompactNumber(totalNotional)}</p>
        </LiquidGlassCard>
      </div>

      <LiquidGlassCard className="p-5 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by asset, symbol, or hash..."
              value={query}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((entry) => (
              <button
                key={entry}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${status === entry ? "bg-slate-950 text-white" : "bg-white/70 text-slate-500 hover:text-slate-950"}`}
                onClick={() => setStatus(entry)}
                type="button"
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {visibleTransactions.map((record) => {
            const meta = getAssetMeta(record.assetType);
            const statusClass =
              record.status === "completed"
                ? "bg-emerald-50 text-emerald-700"
                : record.status === "pending"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700";

            return (
              <div key={record.id} className="rounded-[28px] bg-white/72 px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.chipClass}`}>{meta.label}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClass}`}>{record.status}</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{record.type}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-950">
                      {record.assetName} ({record.assetSymbol})
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {record.date} {record.time}
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-400">{record.txHash}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Amount</p>
                      <p className="mt-2 font-semibold text-slate-950">{formatQuantity(record.amount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Price</p>
                      <p className="mt-2 font-semibold text-slate-950">{formatCurrency(record.price)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</p>
                      <p className="mt-2 font-semibold text-slate-950">{formatCurrency(record.total)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </LiquidGlassCard>
    </section>
  );
}
