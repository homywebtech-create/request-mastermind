// CRITICAL: Clean URL BEFORE React loads
const isCapacitorApp = 
  window.location.protocol === 'capacitor:' || 
  window.location.protocol === 'ionic:' ||
  !!(typeof window !== 'undefined' && (window as any).Capacitor);

// In web environment, completely block and redirect any hash URLs
if (!isCapacitorApp) {
  const currentHash = window.location.hash;
  if (currentHash) {
    console.log('🔴 Hash detected in web environment:', currentHash);
    // Force hard redirect without hash
    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
    window.location.href = cleanUrl;
    // Throw error to stop React from loading
    throw new Error('Redirecting to clean URL...');
  }
  
  // Also block specialist routes completely in web
  const path = window.location.pathname;
  if (path.includes('specialist-auth') || path.includes('specialist-orders') || path.includes('order-tracking')) {
    console.log('🔴 Specialist route blocked in web environment');
    window.location.href = window.location.origin + '/auth';
    throw new Error('Redirecting from specialist route...');
  }
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
