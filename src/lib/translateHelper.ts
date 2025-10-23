import { supabase } from "@/integrations/supabase/client";

interface TranslationCache {
  [key: string]: string;
}

const translationCache: TranslationCache = {};

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
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    const { data, error } = await supabase.functions.invoke('translate-order', {
      body: { text, targetLanguage, sourceLanguage }
    });

    if (error) throw error;
    
    const translatedText = data.translatedText || text;
    
    // Cache the translation
    translationCache[cacheKey] = translatedText;
    
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
  },
  targetLanguage: string
): Promise<typeof orderDetails> {
  if (!targetLanguage || targetLanguage === 'ar') {
    return orderDetails;
  }

  try {
    const translated = { ...orderDetails };

    if (orderDetails.serviceType) {
      translated.serviceType = await translateText(orderDetails.serviceType, targetLanguage);
    }
    
    if (orderDetails.notes) {
      translated.notes = await translateText(orderDetails.notes, targetLanguage);
    }
    
    if (orderDetails.area) {
      translated.area = await translateText(orderDetails.area, targetLanguage);
    }
    
    if (orderDetails.bookingType) {
      translated.bookingType = await translateText(orderDetails.bookingType, targetLanguage);
    }

    return translated;
  } catch (error) {
    console.error('Error translating order details:', error);
    return orderDetails;
  }
}