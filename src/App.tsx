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
import { firebaseNotifications } from "./lib/firebaseNotifications";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";
import { UserRoleProvider } from "./contexts/UserRoleContext";
import { PermissionRedirect } from "./components/auth/PermissionRedirect";

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
function DeepLinkHandler() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Extract route from deep link URL
  const extractRoute = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const route = parsed.searchParams.get('route');
      return route ? decodeURIComponent(route) : null;
    } catch {
      return null;
    }
  };

  // Navigate or stash pending route based on auth
  const handleRoute = async (route: string | null) => {
    if (!route) return;

    // Mark that a deep link navigation is happening to avoid default redirects
    sessionStorage.setItem('deeplink:navigated', '1');

    if (loading) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'pendingRoute', value: route });
      return;
    }

    if (user) {
      navigate(route, { replace: true });
    } else {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'pendingRoute', value: route });
      navigate('/specialist-auth', { replace: true });
    }
  };

  // Handle deep links on cold start and when app is opened via URL
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    let appUrlOpenListener: any;

    // Cold start deep link
    CapApp.getLaunchUrl().then((launchUrl) => {
      handleRoute(extractRoute(launchUrl?.url));
    });

    // Warm start deep link
    (async () => {
      appUrlOpenListener = await CapApp.addListener('appUrlOpen', (data) => {
        handleRoute(extractRoute(data?.url));
      });
    })();

    return () => {
      if (appUrlOpenListener) appUrlOpenListener.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When auth becomes ready, process any pending route saved by pushNotificationActionPerformed
  useEffect(() => {
    if (loading) return;

    (async () => {
      if (Capacitor.getPlatform() === 'web') return;
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'pendingRoute' });
      if (value) {
        await Preferences.remove({ key: 'pendingRoute' });
        sessionStorage.setItem('deeplink:navigated', '1');
        if (user) {
          navigate(value, { replace: true });
        } else {
          await Preferences.set({ key: 'pendingRoute', value });
          navigate('/specialist-auth', { replace: true });
        }
      }
    })();
  }, [user, loading, navigate]);

  return null;
}


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
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);

  // Extract route from deep link URL
  const extractRoute = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      const route = parsed.searchParams.get('route');
      return route ? decodeURIComponent(route) : null;
    } catch {
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

  // Handle navigation once auth is ready
  useEffect(() => {
    if (loading || hasNavigated) return;

    console.log('🧭 [APP] Handling navigation - user:', !!user, 'deepLink:', deepLink);

    if (deepLink) {
      if (user) {
        console.log('✅ [APP] Navigating to deep link:', deepLink);
        navigate(deepLink, { replace: true });
      } else {
        console.log('🔐 [APP] Deep link present but not authenticated, going to auth');
        navigate('/specialist-auth', { replace: true });
      }
    } else {
      // Normal navigation
      if (user) {
        navigate('/specialist-orders', { replace: true });
      } else {
        navigate('/specialist-auth', { replace: true });
      }
    }

    setHasNavigated(true);
  }, [user, loading, deepLink, navigate, hasNavigated]);

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
        <DeepLinkHandler />
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
          <Route path="/" element={<MobileLanding />} />
          <Route path="*" element={<MobileLanding />} />
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
          path="/company-booking/:orderId/:companyId"
          element={<CompanyBooking />}
        />
        
        {/* Company routes */}
        <Route path="/company-auth" element={<CompanyAuth />} />
        <Route path="/company-portal" element={<CompanyPortal />} />
        <Route path="/company/team" element={<CompanyTeamManagement />} />
        <Route path="/company/contracts" element={<CompanyContracts />} />
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
