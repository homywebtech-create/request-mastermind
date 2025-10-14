import { ar } from './ar';
import { en } from './en';

export type Language = 'ar' | 'en';

export const translations = {
  ar,
  en,
};

export function useTranslation(lang: Language) {
  return translations[lang];
}
