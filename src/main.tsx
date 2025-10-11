// CRITICAL: Clean URL BEFORE React loads
const isCapacitorApp = 
  window.location.protocol === 'capacitor:' || 
  window.location.protocol === 'ionic:' ||
  !!(typeof window !== 'undefined' && (window as any).Capacitor);

if (!isCapacitorApp && window.location.hash) {
  // Force redirect without hash
  const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
  window.location.replace(cleanUrl);
  // Stop execution until redirect completes
  throw new Error('Redirecting to clean URL...');
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
