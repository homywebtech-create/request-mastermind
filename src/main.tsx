import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clean any hash from URL before React loads
if (window.location.hash) {
  const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
  window.location.href = cleanUrl;
}

createRoot(document.getElementById("root")!).render(<App />);
