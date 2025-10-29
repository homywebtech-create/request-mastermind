import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();
const platform = () => Capacitor.getPlatform();

export async function openWhatsApp(phone: string, text?: string) {
  const clean = (phone || '').replace(/\D/g, '');
  const encodedText = text ? encodeURIComponent(text) : undefined;

  // Prefer native app schemes when running inside Capacitor
  if (isNative()) {
    const schemeUrl = `whatsapp://send?phone=${clean}${encodedText ? `&text=${encodedText}` : ''}`;
    try {
      await Browser.open({ url: schemeUrl });
      return;
    } catch (e) {
      // Fall through to web fallback
    }
  }

  // Web/PWA fallback
  const webUrl = `https://wa.me/${clean}${encodedText ? `?text=${encodedText}` : ''}`;
  window.location.href = webUrl;
}

export async function openMaps(lat: number, lng: number, label?: string) {
  if (lat == null || lng == null) return;

  if (isNative()) {
    try {
      const plt = platform();
      if (plt === 'ios') {
        const url = `maps://?q=${encodeURIComponent(label || 'Location')}&sll=${lat},${lng}`;
        await Browser.open({ url });
        return;
      }
      // android (geo:) or default
      const queryLabel = label ? `(${encodeURIComponent(label)})` : '';
      const url = `geo:${lat},${lng}?q=${lat},${lng}${queryLabel}`;
      await Browser.open({ url });
      return;
    } catch (e) {
      // Fall through to web fallback
    }
  }

  // Web fallback to Google Maps
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.location.href = mapsUrl;
}

export async function openUrlPreferApp(url: string) {
  if (isNative()) {
    try {
      await Browser.open({ url });
      return;
    } catch (e) {
      // ignore
    }
  }
  window.location.href = url;
}
