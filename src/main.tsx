import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize language direction on first load
const storedLanguage = localStorage.getItem('language-storage');
if (storedLanguage) {
  try {
    const { state } = JSON.parse(storedLanguage);
    const lang = state?.language || 'ar';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  } catch (e) {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }
} else {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}

// Clean any hash from URL before React loads
if (window.location.hash) {
  const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
  window.location.href = cleanUrl;
}

createRoot(document.getElementById("root")!).render(<App />);
