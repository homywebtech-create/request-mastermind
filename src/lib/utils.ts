import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { countries, getCountryByDialCode, type Country } from "@/data/countries";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get country information from dial code (e.g., "+974" -> Qatar info)
 */
export function getCountryFromDialCode(dialCode: string): Country | undefined {
  return getCountryByDialCode(dialCode);
}

/**
 * Get currency symbol from dial code
 */
export function getCurrencySymbolFromDialCode(dialCode: string): string {
  const country = getCountryByDialCode(dialCode);
  return country?.currencySymbol || 'ر.س'; // Default to SAR
}

/**
 * Get currency code from dial code
 */
export function getCurrencyFromDialCode(dialCode: string): string {
  const country = getCountryByDialCode(dialCode);
  return country?.currency || 'SAR'; // Default to SAR
}

/**
 * Format price with appropriate currency based on dial code
 */
export function formatPriceWithCurrency(price: number | string, dialCode: string): string {
  const currencySymbol = getCurrencySymbolFromDialCode(dialCode);
  return `${price} ${currencySymbol}`;
}

/**
 * Format duration in hours to display as hours or minutes
 * @param hours - Duration in hours
 * @param language - Language for display ('ar' or 'en')
 * @returns Formatted duration string
 */
export function formatDuration(hours: number | null | undefined, language: 'ar' | 'en' = 'en'): string {
  if (!hours || hours === 0) {
    return language === 'ar' ? 'غير محدد' : 'N/A';
  }

  // If less than 1 hour, show in minutes
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `⏰ ${minutes} ${language === 'ar' ? 'دقيقة' : 'min'}`;
  }

  // If 1 hour or more, show in hours
  // Format to remove unnecessary decimals (e.g., 2.0 -> 2, 2.5 -> 2.5)
  const formattedHours = hours % 1 === 0 ? Math.round(hours) : hours;
  return `⏰ ${formattedHours} ${language === 'ar' ? 'ساعة' : 'h'}`;
}
