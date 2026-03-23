import { AnimatePresence, motion } from "motion/react";
import { Check, Globe, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage, type Language } from "../contexts/LanguageContext";

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguageModal({ isOpen, onClose }: LanguageModalProps) {
  const { language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  useEffect(() => {
    if (isOpen) {
      setSelectedLanguage(language);
    }
  }, [isOpen, language]);

  const languages: { code: Language; label: string; nativeLabel: string }[] = [
    { code: "en", label: t("languageModal.english"), nativeLabel: "English" },
    { code: "zh-CN", label: t("languageModal.simplifiedChinese"), nativeLabel: "\u7b80\u4f53\u4e2d\u6587" },
    { code: "zh-TW", label: t("languageModal.traditionalChinese"), nativeLabel: "\u7e41\u9ad4\u4e2d\u6587" },
  ];

  const handleConfirm = () => {
    setLanguage(selectedLanguage);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed inset-x-6 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl"
            data-testid="language-modal"
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 px-6 pb-6 pt-8">
              <div className="absolute -mr-10 -mt-10 right-0 top-0 h-32 w-32 rounded-full bg-white opacity-10 blur-3xl" />
              <div className="absolute -mb-10 -ml-10 bottom-0 left-0 h-24 w-24 rounded-full bg-white opacity-10 blur-2xl" />

              <div className="relative z-10 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <Globe className="h-6 w-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{t("languageModal.title")}</h2>
                    <p className="mt-0.5 text-sm text-white/80">{t("languageModal.subtitle")}</p>
                  </div>
                </div>
                <motion.button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30" onClick={onClose} type="button" whileTap={{ scale: 0.9 }}>
                  <X className="h-5 w-5 text-white" strokeWidth={2} />
                </motion.button>
              </div>
            </div>

            <div className="space-y-3 p-6">
              {languages.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <motion.button
                    key={lang.code}
                    className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${isSelected ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/20" : "border-gray-100 bg-gray-50 hover:bg-gray-100"}`}
                    onClick={() => setSelectedLanguage(lang.code)}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`mb-0.5 text-base font-bold ${isSelected ? "text-blue-600" : "text-gray-900"}`}>{lang.nativeLabel}</div>
                        <div className={`text-sm ${isSelected ? "text-blue-500" : "text-gray-500"}`}>{lang.label}</div>
                      </div>

                      <AnimatePresence>
                        {isSelected ? (
                          <motion.div
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500"
                            exit={{ scale: 0, opacity: 0 }}
                            initial={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <Check className="h-5 w-5 text-white" strokeWidth={3} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-2">
              <motion.button className="rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200" data-testid="language-cancel" onClick={onClose} type="button" whileTap={{ scale: 0.98 }}>
                {t("languageModal.cancel")}
              </motion.button>
              <motion.button className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600" data-testid="language-confirm" onClick={handleConfirm} type="button" whileTap={{ scale: 0.98 }}>
                {t("languageModal.confirm")}
              </motion.button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
