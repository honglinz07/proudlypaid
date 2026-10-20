import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type Language = "en" | "zh";
type Locale = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (en: string, zh: string) => string;
};
const LocaleContext = createContext<Locale | null>(null);

function initialLanguage(): Language {
  try {
    return localStorage.getItem("closedsources-language") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("closedsources-language", language);
    } catch {
      // The interface still works when browser storage is unavailable.
    }
  }, [language]);
  return (
    <LocaleContext.Provider
      value={{ language, setLanguage, t: (en, zh) => (language === "en" ? en : zh) }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("useLocale must be used within LocaleProvider");
  return locale;
}
