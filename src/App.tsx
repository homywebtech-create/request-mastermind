import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Companies from "./pages/Companies";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import CompanyAuth from "./pages/CompanyAuth";
import CompanyPortal from "./pages/CompanyPortal";
import CompanyContracts from "./pages/company/CompanyContracts";
import Specialists from "./pages/Specialists";
import SpecialistAuth from "./pages/SpecialistAuth";
import SpecialistHome from "./pages/specialist/SpecialistHome";
import SpecialistNewOrders from "./pages/specialist/SpecialistNewOrders";
import SpecialistStats from "./pages/specialist/SpecialistStats";
import SpecialistProfile from "./pages/specialist/SpecialistProfile";
import SpecialistRegistration from "./pages/SpecialistRegistration";
import OrderTracking from "./pages/OrderTracking";
import CompanyBooking from "./pages/CompanyBooking";
import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";
import DeletionRequests from "./pages/DeletionRequests";
import AdminUsers from "./pages/AdminUsers";
import ActivityLogs from "./pages/ActivityLogs";
import SetPassword from "./pages/SetPassword";
import ContractManagement from "./pages/ContractManagement";
import AdminSpecialists from "./pages/AdminSpecialists";
import PushNotificationTest from "./pages/PushNotificationTest";
import CompanyTeamManagement from "./pages/company/CompanyTeamManagement";
import AdminStatistics from "./pages/AdminStatistics";
import CompanyStatistics from "./pages/company/CompanyStatistics";
import { firebaseNotifications } from "./lib/firebaseNotifications";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";
import { UserRoleProvider } from "./contexts/UserRoleContext";
import { PermissionRedirect } from "./components/auth/PermissionRedirect";
import DeepLinkController from "./components/mobile/DeepLinkController";

const queryClient = new QueryClient();

// Detect if running in Capacitor (mobile app)
const isCapacitorApp = (() => {
  const protocol = window.location.protocol;
  
  // CRITICAL: Only trust isNativePlatform() or capacitor:// protocol
  // Do NOT trust just the existence of Capacitor object (can be in web during dev)
  const isCapacitorProtocol = protocol === 'capacitor:' || protocol === 'ionic:';
  const isNativePlatform = typeof window !== 'undefined' && 
                           (window as any).Capacitor?.isNativePlatform?.() === true;
  
  // ONLY consider mobile if protocol is capacitor:// OR isNativePlatform returns true
  const detected = isCapacitorProtocol || isNativePlatform;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 [CAPACITOR] Environment Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Protocol:', protocol);
  console.log('Is Capacitor Protocol:', isCapacitorProtocol);
  console.log('Is Native Platform:', isNativePlatform);
  console.log('Final Detection:', detected ? '✅ MOBILE APP (Capacitor)' : '❌ WEB BROWSER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return detected;
})();

// Global deep link and notification click handler (always mounted on mobile)
/* DeepLinkHandler removed: MobileLanding now handles all deep-link and pending-route navigation as a single source of truth to avoid race conditions and duplication. */


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Single source of truth for deep-link navigation
function MobileLanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [pendingRouteChecked, setPendingRouteChecked] = useState(false);

  // Extract route from deep link URL (supports custom schemes + path-based)
  const extractRoute = (url: string): string | null => {
    try {
      // 1) Prefer explicit query param ?route=...
      const qIndex = url.indexOf('?');
      if (qIndex !== -1) {
        const qs = url.substring(qIndex + 1);
        const params = new URLSearchParams(qs);
        const r = params.get('route');
        if (r) return decodeURIComponent(r);
      }

      // 2) Fallback: custom scheme with path (e.g., request-mastermind://open/path or ...//order-tracking/123)
      const pathMatch = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*(\/.+)?$/);
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
      }

      // 3) Last attempt: use URL with a dummy base
      const parsed = new URL(url, 'https://deep.link');
      const fromRoute = parsed.searchParams.get('route');
      if (fromRoute) return decodeURIComponent(fromRoute);
      if (parsed.pathname && parsed.pathname !== '/') return parsed.pathname + parsed.search;

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

  // Set up deep link listeners once on mount
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    console.log('🔗 [APP] Setting up deep link listeners');

    let listener: any;

    // Check launch URL (cold start from notification)
    CapApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        const route = extractRoute(launchUrl.url);
        if (route) {
          console.log('🔗 [APP] Launch URL contained route:', route);
          setDeepLink(route);
        }
      }
    });

    // Listen for app opened via URL (warm start from notification)
    const setupListener = async () => {
      listener = await CapApp.addListener('appUrlOpen', (data) => {
        if (data.url) {
          const route = extractRoute(data.url);
          if (route) {
            console.log('🔗 [APP] App URL open contained route:', route);
            setDeepLink(route);
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  // Check for pending routes FIRST (from notification tap while logged out)
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') {
      setPendingRouteChecked(true);
      return;
    }

    const checkPendingRoute = async () => {
      console.log('🔍 [PENDING] Checking for pending route from notification...');
      
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'pendingRoute' });
      
      if (value) {
        console.log('✅ [PENDING] Found pending route:', value);
        setDeepLink(value);
        await Preferences.remove({ key: 'pendingRoute' });
      } else {
        console.log('ℹ️ [PENDING] No pending route found');
      }
      
      setPendingRouteChecked(true);
    };

    checkPendingRoute();
  }, []);

  // Handle navigation once auth is ready AND pending route is checked
  useEffect(() => {
    if (loading || hasNavigated || !pendingRouteChecked) {
      console.log('⏸️ [NAV] Waiting...', { loading, hasNavigated, pendingRouteChecked });
      return;
    }

    console.log('🧭 [NAV] Ready to navigate - user:', !!user, 'deepLink:', deepLink);

    if (deepLink) {
      if (user) {
        console.log('✅ [NAV] User + deep link → navigating to:', deepLink);
        navigate(deepLink, { replace: true });
      } else {
        console.log('🔐 [NAV] Deep link but not authenticated → going to auth');
        navigate('/specialist-auth', { replace: true });
      }
    } else {
      // Normal navigation
      if (user) {
        console.log('🏠 [NAV] User logged in → default to /specialist-orders');
        navigate('/specialist-orders', { replace: true });
      } else {
        console.log('🔐 [NAV] Not logged in → going to /specialist-auth');
        navigate('/specialist-auth', { replace: true });
      }
    }

    setHasNavigated(true);
  }, [user, loading, deepLink, navigate, hasNavigated, pendingRouteChecked]);

  if (loading || !hasNavigated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
}

function AppRouter() {
  // Render different routes based on environment
  if (isCapacitorApp) {
    // Mobile App Routes (Capacitor)
    return (
      <BrowserRouter>
        <DeepLinkController />
        <Routes>
          <Route path="/specialist-auth" element={<SpecialistAuth />} />
          <Route path="/specialist-orders" element={
            <ProtectedRoute>
              <SpecialistHome />
            </ProtectedRoute>
          } />
          <Route path="/specialist-orders/new" element={
            <ProtectedRoute>
              <SpecialistNewOrders />
            </ProtectedRoute>
          } />
          {/* Alias for legacy deep link path used by notifications */}
          <Route path="/specialist/new-orders" element={
            <ProtectedRoute>
              <SpecialistNewOrders />
            </ProtectedRoute>
          } />
          <Route path="/specialist-orders/stats" element={
            <ProtectedRoute>
              <SpecialistStats />
            </ProtectedRoute>
          } />
          <Route path="/specialist-orders/profile" element={
            <ProtectedRoute>
              <SpecialistProfile />
            </ProtectedRoute>
          } />
          <Route path="/order-tracking/:orderId" element={
            <ProtectedRoute>
              <OrderTracking />
            </ProtectedRoute>
          } />
          <Route path="/specialist-registration" element={<SpecialistRegistration />} />
          <Route path="/push-test" element={
            <ProtectedRoute>
              <PushNotificationTest />
            </ProtectedRoute>
          } />
          <Route path="/" element={<SpecialistAuth />} />
          <Route path="*" element={<SpecialistAuth />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // Web App Routes (Browser)
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect specialist routes to auth in web */}
        <Route path="/specialist-auth" element={<Navigate to="/auth" replace />} />
        <Route path="/specialist-orders" element={<Navigate to="/auth" replace />} />
        <Route path="/order-tracking/:orderId" element={<Navigate to="/auth" replace />} />
        
        {/* Admin routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute requiredPermission="view_orders" fallbackPath="/orders">
              <Dashboard />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/companies"
          element={
            <RoleProtectedRoute requiredPermission="view_companies">
              <Companies />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <RoleProtectedRoute requiredPermission="view_services">
              <Services />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/contracts"
          element={
            <RoleProtectedRoute requiredPermission="view_contracts">
              <ContractManagement />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/specialists"
          element={
            <RoleProtectedRoute requiredPermission="view_specialists">
              <AdminSpecialists />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <RoleProtectedRoute requiredPermission="view_orders">
              <Orders />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/deletion-requests"
          element={
            <RoleProtectedRoute requiredPermission="view_deletion_requests">
              <DeletionRequests />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleProtectedRoute anyPermissions={['manage_users', 'view_users']}>
              <AdminUsers />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <RoleProtectedRoute requiredPermission="view_activity_logs">
              <ActivityLogs />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/statistics"
          element={
            <RoleProtectedRoute requiredPermission="view_admin_statistics">
              <AdminStatistics />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/company-booking/:orderId/:companyId"
          element={<CompanyBooking />}
        />
        
        {/* Company routes */}
        <Route path="/company-auth" element={<CompanyAuth />} />
        <Route path="/company-portal" element={<CompanyPortal />} />
        <Route path="/company/team" element={<CompanyTeamManagement />} />
        <Route path="/company/contracts" element={<CompanyContracts />} />
        <Route path="/company/statistics" element={<CompanyStatistics />} />
        <Route path="/specialists" element={<Specialists />} />
        
        {/* Public specialist registration route */}
        <Route path="/specialist-registration" element={<SpecialistRegistration />} />
        
        {/* Push notification test (admin only) */}
        <Route path="/push-test" element={
          <RoleProtectedRoute requiredPermission="view_dashboard">
            <PushNotificationTest />
          </RoleProtectedRoute>
        } />
        
        {/* Default route - redirect based on permissions */}
        <Route path="/" element={
          <ProtectedRoute>
            <PermissionRedirect />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserRoleProvider>
          <Toaster />
          <Sonner />
          <AppRouter />
        </UserRoleProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
