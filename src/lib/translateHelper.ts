import { supabase } from "@/integrations/supabase/client";

interface TranslationCache {
  [key: string]: string;
}

// Persistent cache using localStorage with fallback to memory
const CACHE_KEY = 'translation_cache_v1';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

class TranslationCacheManager {
  private memoryCache: TranslationCache = {};
  
  constructor() {
    this.loadFromStorage();
  }
  
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const { cache, timestamp } = JSON.parse(stored);
        // Check if cache is still valid
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          this.memoryCache = cache;
          console.log('✅ [TRANSLATION] Loaded cache from storage:', Object.keys(cache).length, 'entries');
        } else {
          console.log('ℹ️ [TRANSLATION] Cache expired, clearing');
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('⚠️ [TRANSLATION] Failed to load cache from storage:', error);
    }
  }
  
  private saveToStorage() {
    try {
      const data = {
        cache: this.memoryCache,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('⚠️ [TRANSLATION] Failed to save cache to storage:', error);
    }
  }
  
  get(key: string): string | undefined {
    return this.memoryCache[key];
  }
  
  set(key: string, value: string) {
    this.memoryCache[key] = value;
    // Debounced save to storage (save every 10 entries)
    if (Object.keys(this.memoryCache).length % 10 === 0) {
      this.saveToStorage();
    }
  }
  
  flush() {
    this.saveToStorage();
  }
}

const cacheManager = new TranslationCacheManager();

export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage: string = 'ar'
): Promise<string> {
  // Return original if same language or empty text
  if (!text || sourceLanguage === targetLanguage) {
    return text;
  }

  // Check cache first
  const cacheKey = `${sourceLanguage}:${targetLanguage}:${text}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const { data, error } = await supabase.functions.invoke('translate-order', {
      body: { text, targetLanguage, sourceLanguage }
    });

    if (error) throw error;
    
    const translatedText = data.translatedText || text;
    
    // Cache the translation
    cacheManager.set(cacheKey, translatedText);
    
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    // Return original text on error
    return text;
  }
}

export async function translateOrderDetails(
  orderDetails: {
    serviceType?: string;
    notes?: string;
    area?: string;
    bookingType?: string;
    buildingInfo?: string;
  },
  targetLanguage: string
): Promise<typeof orderDetails> {
  if (!targetLanguage || targetLanguage === 'ar') {
    return orderDetails;
  }

  try {
    // Translate all fields in parallel for better performance
    const [serviceType, notes, area, bookingType, buildingInfo] = await Promise.all([
      orderDetails.serviceType ? translateText(orderDetails.serviceType, targetLanguage) : undefined,
      orderDetails.notes ? translateText(orderDetails.notes, targetLanguage) : undefined,
      orderDetails.area ? translateText(orderDetails.area, targetLanguage) : undefined,
      orderDetails.bookingType ? translateText(orderDetails.bookingType, targetLanguage) : undefined,
      orderDetails.buildingInfo ? translateText(orderDetails.buildingInfo, targetLanguage) : undefined,
    ]);

    return {
      ...orderDetails,
      ...(serviceType && { serviceType }),
      ...(notes && { notes }),
      ...(area && { area }),
      ...(bookingType && { bookingType }),
      ...(buildingInfo && { buildingInfo }),
    };
  } catch (error) {
    console.error('Error translating order details:', error);
    return orderDetails;
  }
}

// Flush cache when user closes the page
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cacheManager.flush();
  });
}