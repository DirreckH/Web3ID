import { AnimatePresence, motion } from "motion/react";
import { Building2, Coins, Gamepad2, Shield, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getHighestRegulatoryStatus, type IdentityLaneState, type RegulatoryConsequence, type RegulatoryEvent, type RegulatoryStatus, type RiskSignal } from "../lib/identityRegulation";
import type { CardData } from "./AddCardModal";
import { LiquidGlassButton } from "./LiquidGlassButton";

interface IdentityTreeViewProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData | null;
}

interface IdentityLaneDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  state: IdentityLaneState;
}

const NETWORK_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum One",
  base: "Base",
  optimism: "OP Mainnet",
  solana: "Solana",
  bitcoin: "Bitcoin",
  tron: "TRON",
  ton: "TON",
};

const NETWORK_ACCENTS: Record<string, string> = {
  ethereum: "from-indigo-500/70 via-violet-500/55 to-fuchsia-500/55",
  arbitrum: "from-sky-500/70 via-blue-500/55 to-cyan-500/55",
  base: "from-blue-600/70 via-sky-500/60 to-cyan-400/50",
  optimism: "from-rose-500/70 via-red-500/55 to-orange-400/50",
  solana: "from-violet-500/70 via-fuchsia-500/55 to-cyan-400/50",
  bitcoin: "from-amber-400/75 via-orange-500/55 to-yellow-300/50",
  tron: "from-red-600/75 via-rose-500/55 to-red-400/50",
  ton: "from-cyan-500/70 via-sky-500/55 to-blue-500/55",
};

const STATUS_STYLES: Record<RegulatoryStatus, { badge: string; indicator: string }> = {
  NORMAL: { badge: "border-emerald-200/80 bg-emerald-50/90 text-emerald-700", indicator: "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]" },
  OBSERVED: { badge: "border-sky-200/80 bg-sky-50/90 text-sky-700", indicator: "bg-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.45)]" },
  RESTRICTED: { badge: "border-amber-200/90 bg-amber-50/95 text-amber-700", indicator: "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.45)]" },
  HIGH_RISK: { badge: "border-rose-200/90 bg-rose-50/95 text-rose-700", indicator: "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.45)]" },
  FROZEN: { badge: "border-slate-300/90 bg-slate-100/95 text-slate-700", indicator: "bg-slate-600 shadow-[0_0_14px_rgba(71,85,105,0.45)]" },
};

const SOURCE_STYLES: Record<RiskSignal["source"], string> = {
  onchain: "bg-violet-50 text-violet-700",
  sanctions: "bg-rose-50 text-rose-700",
  governance: "bg-amber-50 text-amber-700",
  advisor: "bg-cyan-50 text-cyan-700",
};

const SIGNAL_SEVERITY_STYLES: Record<RiskSignal["severity"], string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-rose-600",
};

function buildIdentityLanes(): IdentityLaneDefinition[] {
  return [
    {
      id: "rwa",
      name: "RWA Identity",
      description: "Issuer proofs, portfolio permissions, and regulated settlement windows.",
      icon: Building2,
      color: "from-orange-500 via-amber-500 to-yellow-400",
      state: {
        id: "rwa",
        name: "RWA Identity",
        description: "Issuer proofs, portfolio permissions, and regulated settlement windows.",
        status: "RESTRICTED",
        summary: "Settlement velocity and a monitored counterparty overlap pushed this lane into enhanced review.",
        trustScore: 62,
        riskSignals: [
          { id: "rwa-s1", source: "onchain", title: "Collateral routing velocity jumped across unfamiliar settlement clusters.", detail: "Transfers cleared faster than the lane's normal issuance rhythm.", severity: "high", timestamp: "02:14 UTC" },
          { id: "rwa-s2", source: "sanctions", title: "A screening sync matched one recipient to a monitored behavior list.", detail: "Minting and large actions stay gated until issuer evidence is refreshed.", severity: "high", timestamp: "02:17 UTC" },
        ],
        evaluation: "Policy scoring combined the routing anomaly with watchlist-adjacent exposure and escalated the lane into a restricted mode.",
        stateTransitions: [{ id: "rwa-t1", from: "OBSERVED", to: "RESTRICTED", reason: "Counterparty overlap and exposure cap triggered enhanced review.", timestamp: "02:18 UTC", actor: "Policy Engine" }],
        consequences: [
          { id: "rwa-c1", type: "restriction", title: "Large subscription actions are paused.", detail: "High-value minting and transfers now require clearance.", active: true },
          { id: "rwa-c2", type: "review", title: "Enhanced issuer packet requested.", detail: "Manual reviewers need refreshed beneficial-owner evidence.", active: true },
          { id: "rwa-c3", type: "trustAdjustment", title: "Lane trust score was reduced.", detail: "Trust weighting stays lower until the settlement path is cleared.", active: true },
        ],
        recovery: "Clear the monitored counterparty and upload the refreshed issuer packet to move back toward NORMAL.",
      },
    },
    {
      id: "defi",
      name: "DeFi Identity",
      description: "Liquidity, lending, and approved protocol actions anchored to the same root proof.",
      icon: Coins,
      color: "from-blue-500 via-cyan-500 to-sky-400",
      state: {
        id: "defi",
        name: "DeFi Identity",
        description: "Liquidity, lending, and approved protocol actions anchored to the same root proof.",
        status: "OBSERVED",
        summary: "The lane stays active, but leverage and bridge behavior are being watched after a rapid migration.",
        trustScore: 78,
        riskSignals: [
          { id: "defi-s1", source: "onchain", title: "Bridge volume spiked right after a lending position was unwound.", detail: "The change in velocity crossed the lane's observation threshold.", severity: "medium", timestamp: "01:41 UTC" },
          { id: "defi-s2", source: "advisor", title: "AI copilot suggested keeping leverage actions under observation.", detail: "The pattern resembles previously escalated bridge-and-borrow clusters.", severity: "medium", timestamp: "01:46 UTC" },
        ],
        evaluation: "Signals remain below the hard restriction threshold, so the lane stays open while scoring continues in observation mode.",
        stateTransitions: [{ id: "defi-t1", from: "NORMAL", to: "OBSERVED", reason: "Velocity anomaly on bridge and lending actions.", timestamp: "01:48 UTC", actor: "Risk Analyzer" }],
        consequences: [
          { id: "defi-c1", type: "review", title: "Large leverage moves require extra context capture.", detail: "High-notional actions generate an audit note for reviewers.", active: true },
          { id: "defi-c2", type: "trustAdjustment", title: "Confidence weighting softened slightly.", detail: "Trust stays conservative until behavior normalizes.", active: true },
        ],
        recovery: "If bridge velocity normalizes for the next window, the lane can return to NORMAL without manual intervention.",
      },
    },
    {
      id: "social",
      name: "Social Identity",
      description: "Governance, reputation, and community rights derived from the same root credentials.",
      icon: Users,
      color: "from-fuchsia-500 via-rose-500 to-pink-400",
      state: {
        id: "social",
        name: "Social Identity",
        description: "Governance, reputation, and community rights derived from the same root credentials.",
        status: "NORMAL",
        summary: "Reputation flows remain stable, with only routine governance checks in the audit trail.",
        trustScore: 91,
        riskSignals: [{ id: "social-s1", source: "governance", title: "Delegate activity matched the expected governance cadence.", detail: "Signals remain informational and support the lane's normal status.", severity: "low", timestamp: "00:32 UTC" }],
        evaluation: "No compounded risk was detected, so the lane remains fully open and contributes positive trust to the root identity.",
        stateTransitions: [{ id: "social-t1", from: "NORMAL", to: "NORMAL", reason: "Routine review confirmed stable delegate and reputation patterns.", timestamp: "00:33 UTC", actor: "Governance Monitor" }],
        consequences: [{ id: "social-c1", type: "restore", title: "No active restriction is applied.", detail: "This lane stays fully enabled and helps restore overall trust.", active: true }],
        recovery: "No action needed. This lane currently acts as a stabilizing signal for the root identity.",
      },
    },
    {
      id: "gaming",
      name: "Gaming Identity",
      description: "Game assets, tournament credentials, and achievement-linked permissions for metaverse flows.",
      icon: Gamepad2,
      color: "from-emerald-500 via-teal-500 to-cyan-400",
      state: {
        id: "gaming",
        name: "Gaming Identity",
        description: "Game assets, tournament credentials, and achievement-linked permissions for metaverse flows.",
        status: "HIGH_RISK",
        summary: "Tournament payouts and governance overrides stacked into a high-risk posture that now needs human confirmation.",
        trustScore: 48,
        riskSignals: [
          { id: "gaming-s1", source: "governance", title: "Emergency governance overrides changed payout routing before the last competition closed.", detail: "Policy exceptions were issued outside the normal review window.", severity: "high", timestamp: "02:03 UTC" },
          { id: "gaming-s2", source: "advisor", title: "Manual and AI advice aligned on a temporary containment recommendation.", detail: "The pattern matches fast reward cycling and abrupt credential reassignments.", severity: "high", timestamp: "02:06 UTC" },
        ],
        evaluation: "Because governance overrides and reward routing both escalated together, the lane moved past RESTRICTED into a high-risk state.",
        stateTransitions: [{ id: "gaming-t1", from: "RESTRICTED", to: "HIGH_RISK", reason: "Repeated override activity plus reward-cycling correlation.", timestamp: "02:08 UTC", actor: "Oversight Committee" }],
        consequences: [
          { id: "gaming-c1", type: "freeze", title: "Reward withdrawals are partially frozen.", detail: "Payout claims above the tournament threshold are held for review.", active: true },
          { id: "gaming-c2", type: "restriction", title: "Credential delegation is temporarily blocked.", detail: "New tournament credentials cannot be issued while the lane is escalated.", active: true },
          { id: "gaming-c3", type: "review", title: "Manual review is mandatory before recovery.", detail: "A human reviewer must approve the recovery path.", active: true },
        ],
        recovery: "Resolve the payout override incident and attach reviewer notes before stepping back through RESTRICTED.",
      },
    },
  ];
}

function StatusBadge({ status, testId }: { status: RegulatoryStatus; testId?: string }) {
  const { t } = useLanguage();
  const style = STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] ${style.badge}`} data-testid={testId}>
      <span className={`h-2 w-2 rounded-full ${style.indicator}`} />
      {t(`identityTree.statuses.${status}`)}
    </span>
  );
}

function SourceBadge({ source }: { source: RiskSignal["source"] }) {
  const { t } = useLanguage();

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${SOURCE_STYLES[source]}`}>{t(`identityTree.sources.${source}`)}</span>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/72 p-4 shadow-[0_16px_34px_rgba(148,163,184,0.12)] backdrop-blur-xl">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ConsequenceRow({ consequence }: { consequence: RegulatoryConsequence }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{consequence.title}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t(`identityTree.consequences.${consequence.type}`)}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{consequence.detail}</p>
    </div>
  );
}

function TransitionRow({ event }: { event: RegulatoryEvent }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{event.timestamp}</span>
        <span className="text-sm font-semibold text-slate-900">
          {t(`identityTree.statuses.${event.from}`)} {"->"} {t(`identityTree.statuses.${event.to}`)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{event.reason}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{event.actor}</p>
    </div>
  );
}

export function IdentityTreeView({ isOpen, onClose, card }: IdentityTreeViewProps) {
  const { t } = useLanguage();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const lanes = useMemo(() => buildIdentityLanes(), []);

  useEffect(() => {
    if (isOpen) {
      setActivePanel(null);
    }
  }, [card?.id, isOpen]);

  const rootSignals = useMemo<RiskSignal[]>(
    () => [
      { id: "root-s1", source: "onchain", title: "Cross-lane fund routing keeps moving faster than the root profile baseline.", detail: "The aggregated identity is seeing behavior shifts across settlement lanes.", severity: "high", timestamp: "02:21 UTC" },
      { id: "root-s2", source: "sanctions", title: "Watchlist sync still carries one unresolved counterparty relationship.", detail: "The root identity cannot fully normalize until the restricted lane clears exposure.", severity: "high", timestamp: "02:22 UTC" },
      { id: "root-s3", source: "governance", title: "Emergency governance overrides elevated the gaming lane's escalation weight.", detail: "Downstream permissions inherit the same proof base.", severity: "medium", timestamp: "02:23 UTC" },
      { id: "root-s4", source: "advisor", title: "Manual and AI recommendations aligned on active oversight.", detail: "The system keeps the full trail while waiting for reviewer sign-off.", severity: "medium", timestamp: "02:24 UTC" },
    ],
    [],
  );

  const rootState = useMemo<IdentityLaneState>(() => {
    const laneStates = lanes.map((lane) => lane.state);
    const trustScore = Math.max(38, Math.round(laneStates.reduce((sum, lane) => sum + lane.trustScore, 0) / laneStates.length) - 6);
    const activeConsequences = new Map<string, RegulatoryConsequence>();

    laneStates.forEach((lane) => {
      lane.consequences.forEach((consequence) => {
        if (consequence.active && !activeConsequences.has(consequence.type)) {
          activeConsequences.set(consequence.type, { ...consequence, id: `root-${consequence.type}` });
        }
      });
    });

    const status = getHighestRegulatoryStatus(["OBSERVED", ...laneStates.map((lane) => lane.status)]);

    return {
      id: "root",
      name: t("identityTree.rootIdentity"),
      description: "Root identity orchestrating the dynamic oversight posture across every derived lane.",
      status,
      summary: "Dynamic oversight stays light by default and only hardens when multiple signals stack across the derived identities.",
      trustScore,
      riskSignals: rootSignals,
      evaluation: "Risk scoring aggregates chain activity, watchlist findings, governance overrides, and human or AI recommendations before the root posture changes.",
      stateTransitions: [{ id: "root-t1", from: "OBSERVED", to: status, reason: "Compounded lane escalations kept the root identity under active oversight.", timestamp: "02:25 UTC", actor: "Dynamic Oversight Controller" }],
      consequences: Array.from(activeConsequences.values()),
      recovery: "Clear active lane reviews, resolve the monitored counterparty, and attach reviewer notes so the aggregate identity can step back down.",
    };
  }, [lanes, rootSignals, t]);

  if (!card) {
    return null;
  }

  const networkName = NETWORK_NAMES[card.network] ?? card.network;
  const networkAccent = NETWORK_ACCENTS[card.network] ?? NETWORK_ACCENTS.ethereum;

  const togglePanel = (panelId: string) => {
    setActivePanel((current) => (current === panelId ? null : panelId));
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-white/24 backdrop-blur-xl" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto p-4 lg:p-8"
            data-testid="identity-tree-modal"
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="mx-auto my-8 flex min-h-full w-full max-w-5xl items-start justify-center lg:my-0">
              <div className="relative w-full overflow-hidden rounded-[38px] border border-white/60 bg-white/38 p-5 shadow-[0_36px_120px_rgba(148,163,184,0.18)] backdrop-blur-[30px] lg:p-8">
                <div className="absolute inset-x-10 top-0 h-44 bg-gradient-to-r from-sky-200/35 via-white/20 to-rose-200/30 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t("identityTree.eyebrow")}</p>
                      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("identityTree.title")}</h2>
                    </div>

                    <LiquidGlassButton aria-label="Close identity tree" onClick={onClose} variant="default">
                      <X className="h-5 w-5 text-slate-700" />
                    </LiquidGlassButton>
                  </div>

                  <div className="mt-8 flex flex-col items-center">
                    <motion.div animate={{ y: [0, -6, 0] }} className="w-full max-w-3xl" transition={{ duration: 5.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}>
                      <motion.button
                        className="group relative w-full overflow-hidden rounded-[32px] border border-white/70 bg-white/56 p-6 text-left shadow-[0_24px_80px_rgba(99,102,241,0.16)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1"
                        data-testid="identity-root-card"
                        onClick={() => togglePanel("root")}
                        type="button"
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${networkAccent} opacity-22`} />
                        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/80 blur-3xl" />
                        <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/60 blur-3xl" />

                        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`inline-flex rounded-full bg-gradient-to-r ${networkAccent} px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-900/10`}>
                                {networkName}
                              </span>
                              <StatusBadge status={rootState.status} testId="identity-root-status" />
                            </div>
                            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{t("identityTree.rootIdentity")}</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{networkName} Root</p>
                            <p className="mt-2 font-mono text-sm text-slate-600">{card.address}</p>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{rootState.summary}</p>
                          </div>

                          <div className="flex items-center gap-4 self-start md:self-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-[28px] border border-white/70 bg-white/60 shadow-[0_16px_34px_rgba(148,163,184,0.16)]">
                              <Shield className="h-8 w-8 text-slate-700" />
                            </div>
                            <div className="rounded-[24px] border border-white/70 bg-white/70 px-4 py-3 shadow-[0_12px_28px_rgba(148,163,184,0.14)]">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("identityTree.trustScore")}</p>
                              <p className="mt-1 text-2xl font-semibold text-slate-900">{rootState.trustScore}</p>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    </motion.div>

                    <AnimatePresence initial={false}>
                      {activePanel === "root" ? (
                        <motion.div animate={{ opacity: 1, height: "auto", y: 0 }} className="mt-4 w-full max-w-3xl overflow-hidden" data-testid="identity-root-overview" exit={{ opacity: 0, height: 0, y: -12 }} initial={{ opacity: 0, height: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
                          <div className="rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_20px_40px_rgba(148,163,184,0.14)] backdrop-blur-2xl lg:p-5">
                            <div className="grid gap-3 lg:grid-cols-3">
                              <DetailSection title={t("identityTree.currentAggregateStatus")}><div className="flex items-center gap-3"><StatusBadge status={rootState.status} /></div></DetailSection>
                              <DetailSection title={t("identityTree.trustScore")}><p className="text-3xl font-semibold text-slate-900">{rootState.trustScore}</p></DetailSection>
                              <DetailSection title={t("identityTree.latestTransition")}><TransitionRow event={rootState.stateTransitions[0]} /></DetailSection>
                            </div>

                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <DetailSection title={t("identityTree.signalSources")}>
                                <div className="space-y-3">
                                  {rootState.riskSignals.map((signal) => (
                                    <div key={signal.id} className="rounded-2xl border border-slate-200/70 bg-white/82 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <SourceBadge source={signal.source} />
                                        <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${SIGNAL_SEVERITY_STYLES[signal.severity]}`}>{signal.timestamp}</span>
                                      </div>
                                      <p className="mt-2 text-sm font-semibold text-slate-900">{signal.title}</p>
                                      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
                                    </div>
                                  ))}
                                </div>
                              </DetailSection>

                              <div className="grid gap-3">
                                <DetailSection title={t("identityTree.activeConsequences")}><div className="space-y-3">{rootState.consequences.map((consequence) => <ConsequenceRow consequence={consequence} key={consequence.id} />)}</div></DetailSection>
                                <DetailSection title={t("identityTree.recoveryPath")}><p className="text-sm leading-6 text-slate-600">{rootState.recovery}</p></DetailSection>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div className="my-8 flex justify-center">
                    <div className="h-16 w-px bg-gradient-to-b from-slate-300/80 via-slate-200/50 to-transparent" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {lanes.map(({ id, name, description, icon: Icon, color, state }) => (
                      <motion.div className="flex flex-col" key={id} layout>
                        <motion.button className="group relative overflow-hidden rounded-[28px] p-5 text-left text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]" data-testid={`identity-lane-card-${id}`} onClick={() => togglePanel(id)} type="button" whileTap={{ scale: 0.99 }}>
                          <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.34),transparent_45%)] opacity-90" />
                          <div className="absolute inset-0 bg-black/5 transition-colors duration-300 group-hover:bg-black/0" />

                          <div className="relative">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/25 bg-white/18 backdrop-blur-md">
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <StatusBadge status={state.status} testId={`identity-status-${id}`} />
                            </div>
                            <h3 className="mt-5 text-xl font-semibold">{name}</h3>
                            <p className="mt-2 text-sm leading-6 text-white/84">{description}</p>
                            <p className="mt-4 text-sm leading-6 text-white/90">{state.summary}</p>
                            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/68">{t("identityTree.derivedFromRoot")}</p>
                          </div>
                        </motion.button>

                        <AnimatePresence initial={false}>
                          {activePanel === id ? (
                            <motion.div animate={{ opacity: 1, height: "auto", y: 0 }} className="mt-3 overflow-hidden" data-testid={`identity-regulation-detail-${id}`} exit={{ opacity: 0, height: 0, y: -10 }} initial={{ opacity: 0, height: 0, y: -10 }} transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1] }}>
                              <div className="rounded-[26px] border border-white/70 bg-white/72 p-4 shadow-[0_20px_38px_rgba(148,163,184,0.14)] backdrop-blur-2xl">
                                <div data-selected-panel={id} data-testid="identity-regulation-detail" />
                                <div className="grid gap-3">
                                  <DetailSection title={t("identityTree.riskSignals")}><div className="space-y-3">{state.riskSignals.map((signal) => <div key={signal.id} className="rounded-2xl border border-slate-200/70 bg-white/82 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><SourceBadge source={signal.source} /><span className={`text-xs font-semibold uppercase tracking-[0.14em] ${SIGNAL_SEVERITY_STYLES[signal.severity]}`}>{signal.timestamp}</span></div><p className="mt-2 text-sm font-semibold text-slate-900">{signal.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p></div>)}</div></DetailSection>
                                  <DetailSection title={t("identityTree.evaluationDecision")}><p className="text-sm leading-6 text-slate-600">{state.evaluation}</p></DetailSection>
                                  <DetailSection title={t("identityTree.stateTransition")}><div className="space-y-3">{state.stateTransitions.map((event) => <TransitionRow event={event} key={event.id} />)}</div></DetailSection>
                                  <DetailSection title={t("identityTree.regulatoryConsequences")}><div className="space-y-3">{state.consequences.map((consequence) => <ConsequenceRow consequence={consequence} key={consequence.id} />)}</div></DetailSection>
                                  <DetailSection title={t("identityTree.manualReviewRecovery")}><p className="text-sm leading-6 text-slate-600">{state.recovery}</p></DetailSection>
                                </div>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
