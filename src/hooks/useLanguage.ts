import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Device } from '@capacitor/device';
import { supabase } from '@/integrations/supabase/client';

type Language = 'ar' | 'en';

interface LanguageState {
  language: Language;
  isInitialized: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  initializeLanguage: (userId?: string) => Promise<void>;
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'ar',
      isInitialized: false,
      setLanguage: async (lang: Language) => {
        set({ language: lang });
        // Update HTML dir and lang attributes
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        
        // Try to save to specialist's profile if logged in
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata?.phone) {
            await supabase
              .from('specialists')
              .update({ preferred_language: lang })
              .eq('phone', user.user_metadata.phone);
          }
        } catch (error) {
          console.error('Error saving language preference:', error);
        }
      },
      toggleLanguage: async () => {
        const state = get();
        const newLang: Language = state.language === 'ar' ? 'en' : 'ar';
        set({ language: newLang });
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = newLang;
        
        // Save to specialist's profile
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata?.phone) {
            await supabase
              .from('specialists')
              .update({ preferred_language: newLang })
              .eq('phone', user.user_metadata.phone);
            console.log('Language preference saved');
          }
        } catch (error) {
          console.error('Error saving language:', error);
        }
      },
      initializeLanguage: async (userId?: string) => {
        if (get().isInitialized) return;

        try {
          // First, try to get user's specialist profile if logged in
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user?.user_metadata?.phone) {
            const { data: specialists } = await supabase
              .from('specialists')
              .select('preferred_language')
              .eq('phone', user.user_metadata.phone)
              .limit(1);

            if (specialists && specialists.length > 0 && specialists[0].preferred_language) {
              const savedLang = specialists[0].preferred_language as Language;
              set({ language: savedLang, isInitialized: true });
              document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
              document.documentElement.lang = savedLang;
              return;
            }
          }

          // If no saved preference, try to detect device language (for mobile)
          try {
            const deviceInfo = await Device.getLanguageCode();
            const deviceLanguage: Language = deviceInfo.value?.startsWith('ar') ? 'ar' : 'en';
            
            console.log('Detected device language:', deviceLanguage);
            
            // Save this preference if user is a specialist
            if (user?.user_metadata?.phone) {
              await supabase
                .from('specialists')
                .update({ preferred_language: deviceLanguage })
                .eq('phone', user.user_metadata.phone);
            }
            
            set({ language: deviceLanguage, isInitialized: true });
            document.documentElement.dir = deviceLanguage === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = deviceLanguage;
          } catch (deviceError) {
            console.log('Device API not available (web browser), using stored preference');
            // For web browsers, use persisted value or default to Arabic
            const currentLang = get().language;
            set({ isInitialized: true });
            document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = currentLang;
          }
        } catch (error) {
          console.error('Error initializing language:', error);
          set({ isInitialized: true });
        }
      },
    }),
    {
      name: 'language-storage',
    }
  )
);
