import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type Lang, getLang, setLang as saveLang } from './i18n';

interface LangCtx {
  lang: Lang;
  toggleLang: () => void;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'en', toggleLang: () => {}, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);

  const setLang = useCallback((l: Lang) => {
    saveLang(l);
    setLangState(l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'zh' : 'en');
  }, [lang, setLang]);

  return <Ctx.Provider value={{ lang, toggleLang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
