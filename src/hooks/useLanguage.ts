import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'ar' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ar',
      setLanguage: (lang: Language) => {
        set({ language: lang });
        // Update HTML dir and lang attributes
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      },
      toggleLanguage: () =>
        set((state) => {
          const newLang: Language = state.language === 'ar' ? 'en' : 'ar';
          document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = newLang;
          return { language: newLang };
        }),
    }),
    {
      name: 'language-storage',
    }
  )
);
