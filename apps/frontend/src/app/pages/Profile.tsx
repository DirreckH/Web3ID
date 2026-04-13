import { AnimatePresence, motion } from "motion/react";
import { Briefcase, Camera, ChevronRight, CircleCheck, Clock3, EyeOff, FileCheck, Fingerprint, Globe, History, LockKeyhole, LogOut, QrCode, Settings, Shield, ShieldCheck, Sparkles, UserPlus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CardData } from "../components/AddCardModal";
import { IdentityTreeView } from "../components/IdentityTreeView";
import { LanguageModal } from "../components/LanguageModal";
import { useLanguage } from "../contexts/LanguageContext";

interface MenuItem {
  icon: typeof Fingerprint;
  label: string;
  iconBg: string;
  onClick?: () => void;
  rightLabel?: string;
  testId?: string;
}

interface MenuSection {
  id: number;
  title: string;
  items: MenuItem[];
}

export function Profile() {
  const { t, language } = useLanguage();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isComplianceReportOpen, setIsComplianceReportOpen] = useState(false);
  const [isZkpPrivacyOpen, setIsZkpPrivacyOpen] = useState(false);
  const navigate = useNavigate();

  const complianceReportCard: CardData = {
    id: "profile-compliance-report",
    address: "0x7Aa5C0fFEE8B45A6C4E5D9cF8f4A1F7E9d2C3B10",
    network: "hashkey-testnet",
    chainId: "133",
    signature: "signed",
  };

  const languageNames = {
    en: "English",
    "zh-CN": "\u7b80\u4f53\u4e2d\u6587",
    "zh-TW": "\u7e41\u9ad4\u4e2d\u6587",
  } as const;

  const privacyStatusItems = [
    "\u9690\u79c1\u9a8c\u8bc1\u5df2\u542f\u7528",
    "\u5f53\u524d\u6a21\u5f0f\uff1a\u6700\u5c0f\u62ab\u9732",
    "\u8bc1\u660e\u72b6\u6001\uff1a\u6709\u6548",
  ];

  const provenConditionItems = [
    "\u5df2\u901a\u8fc7\u8eab\u4efd\u6821\u9a8c",
    "\u6ee1\u8db3 RWA \u51c6\u5165\u6761\u4ef6",
    "\u98ce\u9669\u72b6\u6001\u5904\u4e8e\u53ef\u9a8c\u8bc1\u8303\u56f4",
    "\u8d2d\u4e70\u8d44\u683c\u5df2\u5b8c\u6210\u6761\u4ef6\u8bc1\u660e",
  ];

  const undisclosedItems = [
    "\u672a\u66b4\u9732\u5b8c\u6574 KYC \u6587\u4ef6",
    "\u672a\u66b4\u9732\u539f\u59cb\u8eab\u4efd\u6750\u6599",
    "\u672a\u66b4\u9732\u5168\u90e8\u94fe\u4e0a\u5173\u8054\u5173\u7cfb",
    "\u4ec5\u8bc1\u660e\u6761\u4ef6\u6210\u7acb",
  ];

  const privacyProofActivity = [
    {
      title: "\u6700\u8fd1\u4e00\u6b21\u7528\u4e8e RWA \u51c6\u5165",
      value: "HashKey RWA Growth Note \u8d2d\u4e70\u9884\u68c0",
      detail: "\u7528\u4e8e\u8d2d\u4e70\u8d44\u683c\u3001\u5408\u89c4\u6761\u4ef6\u548c\u98ce\u9669\u8303\u56f4\u7684\u9690\u79c1\u8bc1\u660e\u6821\u9a8c",
      icon: Briefcase,
      tone: "from-amber-500/15 to-orange-500/10 border-amber-100 text-amber-600",
    },
    {
      title: "\u8bc1\u660e\u751f\u6210\u65f6\u95f4",
      value: "2026-04-13 14:32 UTC+8",
      detail: "\u6700\u65b0\u8bc1\u660e\u5df2\u751f\u6210\u5e76\u5904\u4e8e\u6709\u6548\u72b6\u6001\uff0c\u53ef\u76f4\u63a5\u7528\u4e8e\u5f53\u524d\u51c6\u5165\u6d41\u7a0b",
      icon: Clock3,
      tone: "from-sky-500/15 to-cyan-500/10 border-sky-100 text-sky-600",
    },
  ] as const;

  const menuSections: MenuSection[] = [
    {
      id: 1,
      title: t("profile.identityCompliance"),
      items: [
        { icon: Fingerprint, label: t("profile.rootIdentity"), iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600", rightLabel: t("profile.rootIdentityStatus") },
        { icon: ShieldCheck, label: t("profile.kycAmlStatus"), iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600", rightLabel: t("profile.kycLevel") },
        { icon: UserPlus, label: t("profile.subIdentities"), iconBg: "bg-gradient-to-br from-purple-500 to-violet-600", rightLabel: t("profile.subIdentitiesCount") },
      ],
    },
    {
      id: 2,
      title: t("profile.assetsActivity"),
      items: [
        { icon: Briefcase, label: t("profile.rwaPortfolio"), iconBg: "bg-gradient-to-br from-orange-500 to-amber-600", onClick: () => navigate("/portfolio") },
        { icon: History, label: t("profile.transactionHistory"), iconBg: "bg-gradient-to-br from-blue-400 to-blue-500", onClick: () => navigate("/history") },
        { icon: FileCheck, label: t("profile.complianceReports"), iconBg: "bg-gradient-to-br from-cyan-500 to-sky-600", onClick: () => setIsComplianceReportOpen(true) },
      ],
    },
    {
      id: 3,
      title: t("profile.securitySystem"),
      items: [
        { icon: Wallet, label: t("profile.connectedWallets"), iconBg: "bg-gradient-to-br from-gray-700 to-gray-900", rightLabel: t("profile.connectedWallet") },
        { icon: Shield, label: t("profile.zkpPrivacy"), iconBg: "bg-gradient-to-br from-rose-500 to-red-600", onClick: () => setIsZkpPrivacyOpen(true) },
        { icon: Globe, label: t("profile.language"), iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600", rightLabel: languageNames[language], onClick: () => setIsLanguageModalOpen(true), testId: "profile-language-button" },
        { icon: Settings, label: t("profile.systemSettings"), iconBg: "bg-gradient-to-br from-slate-400 to-slate-500" },
      ],
    },
  ];

  return (
    <div className="min-h-full bg-gray-50 pb-24 font-sans lg:rounded-[34px] lg:border lg:border-white/70 lg:bg-white/92 lg:pb-32 lg:shadow-[0_32px_84px_rgba(15,23,42,0.08)]" data-testid="profile-page">
      <div className="border-b border-gray-100 bg-white px-6 pb-6 pt-12">
        <div className="flex items-center justify-between">
          <motion.button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors hover:bg-gray-200" type="button" whileTap={{ scale: 0.95 }}>
            <QrCode className="h-5 w-5 text-gray-700" strokeWidth={2} />
          </motion.button>

          <h1 className="text-lg font-bold tracking-tight text-gray-900">{t("profile.title")}</h1>

          <motion.button className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800" type="button" whileTap={{ scale: 0.95 }}>
            {t("profile.edit")}
          </motion.button>
        </div>
      </div>

      <div className="px-6 pb-6 pt-8">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="h-28 w-28 rotate-3 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-1">
              <div className="flex h-full w-full -rotate-3 items-center justify-center overflow-hidden rounded-[22px] bg-white">
                <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-3xl font-bold text-white">DG</div>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full border-4 border-gray-50 bg-emerald-500 p-1.5 shadow-lg">
              <CircleCheck className="h-4 w-4 text-white" strokeWidth={3} />
            </div>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-gray-900">Guo Dayou</h2>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-400">@guodayou.web3id</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">{t("profile.rootIdentityActive")}</span>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 px-6">
        <motion.button className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm transition-all hover:bg-gray-50" type="button" whileTap={{ scale: 0.98 }}>
          <Camera className="h-6 w-6 text-blue-500" strokeWidth={2} />
          <span className="text-xs font-bold text-gray-900">{t("profile.updateAvatar")}</span>
        </motion.button>
        <motion.button className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm transition-all hover:bg-gray-50" type="button" whileTap={{ scale: 0.98 }}>
          <ShieldCheck className="h-6 w-6 text-emerald-500" strokeWidth={2} />
          <span className="text-xs font-bold text-gray-900">{t("profile.verifyKYC")}</span>
        </motion.button>
      </div>

      <div className="space-y-8 px-6">
        {menuSections.map((section) => (
          <div key={section.id}>
            <h3 className="mb-3 ml-2 text-xs font-bold uppercase tracking-widest text-gray-400">{section.title}</h3>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.label}
                    className={`flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${index !== section.items.length - 1 ? "border-b border-gray-50" : ""}`}
                    data-testid={item.testId}
                    onClick={item.onClick}
                    type="button"
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg} shadow-md`}>
                      <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>

                    <span className="flex-1 text-left text-base font-semibold text-gray-800">{item.label}</span>

                    {item.rightLabel ? (
                      <div className="mr-1 flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">{item.rightLabel}</span>
                      </div>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={3} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-12 pt-10">
        <motion.button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-4 text-sm font-bold text-red-500 shadow-sm transition-colors hover:bg-red-50" type="button" whileTap={{ scale: 0.98 }}>
          <LogOut className="h-5 w-5" strokeWidth={2} />
          {t("profile.disconnectWallet")}
        </motion.button>
        <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">{t("profile.securedBy")}</p>
      </div>

      <AnimatePresence>
        {isZkpPrivacyOpen ? (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setIsZkpPrivacyOpen(false)}
            />

            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[88vh] max-w-2xl -translate-y-1/2 overflow-hidden rounded-[32px] bg-white shadow-[0_32px_100px_rgba(15,23,42,0.24)]"
              data-testid="zkp-privacy-modal"
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-600 px-6 pb-7 pt-8">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-3xl" />
                <div className="absolute -bottom-12 left-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />

                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                      <ShieldCheck className="h-7 w-7 text-white" strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">privacy proof center</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">ZKP 隐私证明</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
                        在 RWA 准入与身份验证流程中，仅证明你满足条件，而不直接暴露完整原始身份信息。
                      </p>
                    </div>
                  </div>

                  <motion.button
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/16 text-white transition-colors hover:bg-white/24"
                    onClick={() => setIsZkpPrivacyOpen(false)}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                  >
                    <X className="h-5 w-5" strokeWidth={2.2} />
                  </motion.button>
                </div>

                <div className="relative z-10 mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white/90">隐私验证已启用</span>
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white/90">最小披露模式</span>
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white/90">证明状态有效</span>
                </div>
              </div>

              <div className="max-h-[calc(88vh-220px)] space-y-5 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-6 py-6">
                <div className="grid gap-3 lg:grid-cols-2">
                  {privacyProofActivity.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className={`rounded-[28px] border bg-gradient-to-br ${item.tone} p-5 shadow-[0_18px_36px_rgba(15,23,42,0.06)]`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                            <Icon className="h-6 w-6" strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.title}</p>
                            <p className="mt-2 text-base font-semibold text-slate-900">{item.value}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_18px_36px_rgba(16,185,129,0.08)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Sparkles className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">1. 当前隐私状态</h3>
                      <p className="mt-1 text-sm text-slate-500">当前账户已启用隐私验证能力，系统仅校验条件成立，不额外拉取完整敏感资料。</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {privacyStatusItems.map((item) => (
                      <div key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                        <div className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
                          <span className="text-sm font-semibold text-emerald-800">{item}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_18px_36px_rgba(59,130,246,0.08)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <LockKeyhole className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">2. 你已证明的条件</h3>
                      <p className="mt-1 text-sm text-slate-500">这些条件会被用于购买准入、合规验证与风险判断，但只输出条件结论，不展示原始证明材料。</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {provenConditionItems.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" strokeWidth={2.5} />
                        <span className="text-sm font-semibold text-slate-800">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-violet-100 bg-white p-5 shadow-[0_18px_36px_rgba(139,92,246,0.08)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <EyeOff className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">3. 你未暴露的原始信息</h3>
                      <p className="mt-1 text-sm text-slate-500">平台只接收验证结果与必要的审计留痕，不直接暴露你的完整原始身份材料。</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {undisclosedItems.map((item) => (
                      <div key={item} className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" strokeWidth={2.4} />
                          <span className="text-sm font-semibold text-slate-800">{item}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <LanguageModal isOpen={isLanguageModalOpen} onClose={() => setIsLanguageModalOpen(false)} />
      <IdentityTreeView card={complianceReportCard} isOpen={isComplianceReportOpen} onClose={() => setIsComplianceReportOpen(false)} />
    </div>
  );
}
