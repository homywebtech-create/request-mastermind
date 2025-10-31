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
