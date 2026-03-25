import { motion } from "motion/react";
import { Briefcase, Camera, ChevronRight, CircleCheck, FileCheck, Fingerprint, Globe, History, LogOut, QrCode, Settings, Shield, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const languageNames = {
    en: "English",
    "zh-CN": "\u7b80\u4f53\u4e2d\u6587",
    "zh-TW": "\u7e41\u9ad4\u4e2d\u6587",
  } as const;

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
        { icon: FileCheck, label: t("profile.complianceReports"), iconBg: "bg-gradient-to-br from-cyan-500 to-sky-600" },
      ],
    },
    {
      id: 3,
      title: t("profile.securitySystem"),
      items: [
        { icon: Wallet, label: t("profile.connectedWallets"), iconBg: "bg-gradient-to-br from-gray-700 to-gray-900", rightLabel: t("profile.connectedWallet") },
        { icon: Shield, label: t("profile.zkpPrivacy"), iconBg: "bg-gradient-to-br from-rose-500 to-red-600" },
        { icon: Globe, label: t("profile.language"), iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600", rightLabel: languageNames[language], onClick: () => setIsLanguageModalOpen(true), testId: "profile-language-button" },
        { icon: Settings, label: t("profile.systemSettings"), iconBg: "bg-gradient-to-br from-slate-400 to-slate-500" },
      ],
    },
  ];

  return (
    <div className="spotlight-bg min-h-full pb-24 font-sans" data-testid="profile-page">
      <div className="border-b stage-divider bg-white/76 px-6 pb-6 pt-12 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <motion.button className="glass-button flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-white/80" type="button" whileTap={{ scale: 0.95 }}>
            <QrCode className="h-5 w-5 text-gray-700" strokeWidth={2} />
          </motion.button>

          <h1 className="stage-title text-lg font-bold tracking-tight text-gray-900">{t("profile.title")}</h1>

          <motion.button className="accent-action h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors" type="button" whileTap={{ scale: 0.95 }}>
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
        <motion.button className="soft-panel panel-hover flex flex-col items-center gap-2 rounded-2xl px-4 py-4 transition-all" type="button" whileTap={{ scale: 0.98 }}>
          <Camera className="h-6 w-6 text-blue-500" strokeWidth={2} />
          <span className="text-xs font-bold text-gray-900">{t("profile.updateAvatar")}</span>
        </motion.button>
        <motion.button className="soft-panel panel-hover flex flex-col items-center gap-2 rounded-2xl px-4 py-4 transition-all" type="button" whileTap={{ scale: 0.98 }}>
          <ShieldCheck className="h-6 w-6 text-emerald-500" strokeWidth={2} />
          <span className="text-xs font-bold text-gray-900">{t("profile.verifyKYC")}</span>
        </motion.button>
      </div>

      <div className="space-y-8 px-6">
        {menuSections.map((section) => (
          <div key={section.id}>
            <h3 className="mb-3 ml-2 text-xs font-bold uppercase tracking-widest text-gray-400">{section.title}</h3>
            <div className="stage-surface overflow-hidden rounded-2xl">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.label}
                    className={`flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-white/72 ${index !== section.items.length - 1 ? "border-b stage-divider" : ""}`}
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
        <motion.button className="soft-panel panel-hover flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-red-500 transition-colors hover:bg-red-50/80" type="button" whileTap={{ scale: 0.98 }}>
          <LogOut className="h-5 w-5" strokeWidth={2} />
          {t("profile.disconnectWallet")}
        </motion.button>
        <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">{t("profile.securedBy")}</p>
      </div>

      <LanguageModal isOpen={isLanguageModalOpen} onClose={() => setIsLanguageModalOpen(false)} />
    </div>
  );
}
