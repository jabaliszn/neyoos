"use client";

import * as React from "react";
import { translate, type Lang } from "@/lib/i18n/dictionaries";

/**
 * Language context (A.15). Seeded from the user's saved language (no flash).
 * useT() returns a t() bound to the current language; setLang persists it.
 */
interface LangState {
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
}

const LangContext = React.createContext<LangState>({
  lang: "en",
  t: (k) => k,
  setLang: () => {},
});

export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = React.useState<Lang>(initialLang);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    // Persist on the server (best-effort) so it sticks across sessions.
    fetch("/api/me/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: l }),
    }).catch(() => {});
    try {
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>{children}</LangContext.Provider>
  );
}

export function useT() {
  return React.useContext(LangContext);
}
