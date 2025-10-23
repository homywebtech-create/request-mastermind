import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/hooks/useAuth";

// Centralized deep-link and post-login routing for Capacitor apps
// Single source of truth. Do not duplicate routing logic elsewhere.
const DeepLinkController = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const isMobile = Capacitor.getPlatform() !== "web";

  const deepLinkRef = useRef<string | null>(null);
  const hasHandledInitialRef = useRef(false);
  const [pendingChecked, setPendingChecked] = useState(!isMobile);

  // Extract route from deep link URL (supports query + path based)
  const extractRoute = (url: string): string | null => {
    try {
      // 1) Prefer explicit query param ?route=...
      const qIndex = url.indexOf("?");
      if (qIndex !== -1) {
        const qs = url.substring(qIndex + 1);
        const params = new URLSearchParams(qs);
        const r = params.get("route");
        if (r) return decodeURIComponent(r);
      }

      // 2) Fallback: custom scheme with path (e.g., app://.../path)
      const pathMatch = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*(\/.+)?$/);
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
      }

      // 3) Last attempt: use URL with a dummy base
      const parsed = new URL(url, "https://deep.link");
      const fromRoute = parsed.searchParams.get("route");
      if (fromRoute) return decodeURIComponent(fromRoute);
      if (parsed.pathname && parsed.pathname !== "/") return parsed.pathname + parsed.search;

      return null;
    } catch {
      // Final fallback: regex for route query
      try {
        const m = decodeURIComponent(url).match(/(?:\?|&)route=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
      } catch {}
      return null;
    }
  };

  // One-time setup for pending route and deep-link listeners
  useEffect(() => {
    if (!isMobile) return;

    let appUrlOpenListener: { remove: () => void } | undefined;

    const setup = async () => {
      // 1) Check pending route saved by notification tap while logged out
      try {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: "pendingRoute" });
        if (value) {
          deepLinkRef.current = value;
          await Preferences.remove({ key: "pendingRoute" });
        }
      } catch (e) {
        console.warn("[DeepLinkController] Preferences unavailable", e);
      } finally {
        setPendingChecked(true);
      }

      // 2) Handle cold start deep links
      try {
        const launchUrl = await CapApp.getLaunchUrl();
        if (launchUrl?.url) {
          const route = extractRoute(launchUrl.url);
          if (route) deepLinkRef.current = route;
        }
      } catch (e) {
        console.warn("[DeepLinkController] getLaunchUrl failed", e);
      }

      // 3) Listen for warm start deep links
      try {
        appUrlOpenListener = await CapApp.addListener("appUrlOpen", (data) => {
          if (!data?.url) return;
          const route = extractRoute(data.url);
          if (!route) return;

          deepLinkRef.current = route;

          // If auth state known, route immediately on warm starts
          if (!loading) {
            if (user) navigate(route, { replace: true });
            else navigate("/specialist-auth", { replace: true });
            hasHandledInitialRef.current = true;
          }
        });
      } catch (e) {
        console.warn("[DeepLinkController] addListener appUrlOpen failed", e);
      }
    };

    setup();

    return () => {
      try {
        appUrlOpenListener?.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Perform initial navigation once auth + pending check are ready
  useEffect(() => {
    if (!isMobile) return;
    if (loading || !pendingChecked || hasHandledInitialRef.current) return;

    const route = deepLinkRef.current;

    if (route) {
      if (user) navigate(route, { replace: true });
      else navigate("/specialist-auth", { replace: true });
    } else {
      // Default paths when no deep link
      if (user) navigate("/specialist-orders", { replace: true });
      else navigate("/specialist-auth", { replace: true });
    }

    hasHandledInitialRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, pendingChecked, isMobile]);

  return null; // Side-effect only controller
};

export default DeepLinkController;
