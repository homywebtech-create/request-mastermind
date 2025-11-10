import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { UpdateDialog } from "@/components/update/UpdateDialog";
import { useAppUpdate } from "@/hooks/useAppUpdate";
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
import SpecialistMessages from "./pages/specialist/SpecialistMessages";
import SpecialistProfile from "./pages/specialist/SpecialistProfile";
import SpecialistWallet from "./pages/specialist/SpecialistWallet";
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
import NotificationDiagnostics from "./pages/NotificationDiagnostics";
import WhatsAppTest from "./pages/WhatsAppTest";
import WhatsAppInteractiveTest from "./pages/WhatsAppInteractiveTest";
import WhatsAppLocationTest from "./pages/WhatsAppLocationTest";
import CompanyTeamManagement from "./pages/company/CompanyTeamManagement";
import AdminStatistics from "./pages/AdminStatistics";
import CompanyStatistics from "./pages/company/CompanyStatistics";
import AppVersionManagement from "./pages/AppVersionManagement";
import { firebaseNotifications } from "./lib/firebaseNotifications";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";
import { UserRoleProvider } from "./contexts/UserRoleContext";
import { PermissionRedirect } from "./components/auth/PermissionRedirect";
import DeepLinkController from "./components/mobile/DeepLinkController";
import { AppLoader } from "./components/ui/app-loader";

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
    return <AppLoader message="جاري التحميل..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Simple fallback component for mobile root route
function MobileLanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    // Simple redirect to appropriate page
    if (user) {
      navigate('/specialist-orders', { replace: true });
    } else {
      navigate('/specialist-auth', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <AppLoader message="جاري التحميل..." />;
  }

  return <AppLoader message="جارٍ التوجيه..." />;
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
          {/* Aliases for renamed "offers" routes */}
          <Route path="/offers" element={
            <ProtectedRoute>
              <SpecialistNewOrders />
            </ProtectedRoute>
          } />
          <Route path="/specialist/offers" element={
            <ProtectedRoute>
              <SpecialistNewOrders />
            </ProtectedRoute>
          } />
          <Route path="/specialist-orders/stats" element={
            <ProtectedRoute>
              <SpecialistStats />
            </ProtectedRoute>
          } />
          <Route path="/specialist/messages" element={
            <ProtectedRoute>
              <SpecialistMessages />
            </ProtectedRoute>
          } />
          <Route path="/specialist/profile" element={
            <ProtectedRoute>
              <SpecialistProfile />
            </ProtectedRoute>
          } />
          <Route path="/specialist/wallet" element={
            <ProtectedRoute>
              <SpecialistWallet />
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
          path="/admin/app-versions"
          element={
            <RoleProtectedRoute requiredPermission="view_dashboard">
              <AppVersionManagement />
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
        
        {/* Notification diagnostics (admin only) */}
        <Route path="/notification-diagnostics" element={
          <RoleProtectedRoute requiredPermission="view_dashboard">
            <NotificationDiagnostics />
          </RoleProtectedRoute>
        } />
        
        {/* WhatsApp Test (admin only) */}
        <Route path="/whatsapp-test" element={
          <RoleProtectedRoute requiredPermission="view_dashboard">
            <WhatsAppTest />
          </RoleProtectedRoute>
        } />
        
        {/* WhatsApp Interactive Test (admin only) */}
        <Route path="/whatsapp-interactive-test" element={
          <RoleProtectedRoute requiredPermission="view_dashboard">
            <WhatsAppInteractiveTest />
          </RoleProtectedRoute>
        } />
        
        {/* WhatsApp Location Test (admin only) */}
        <Route path="/whatsapp-location-test" element={
          <RoleProtectedRoute requiredPermission="view_dashboard">
            <WhatsAppLocationTest />
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

const AppWithUpdates = () => {
  const { updateAvailable, latestVersion, checkForUpdates } = useAppUpdate();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const location = window.location;

  useEffect(() => {
    // Check for updates on app start (only on mobile)
    if (isCapacitorApp) {
      checkForUpdates();
    }
  }, [checkForUpdates]);

  useEffect(() => {
    if (updateAvailable && latestVersion) {
      setShowUpdateDialog(true);
    }
  }, [updateAvailable, latestVersion]);

  // Check for showUpdate URL parameter (from notification)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showUpdate') === 'true' && isCapacitorApp) {
      console.log('🔄 Update dialog requested via URL parameter');
      checkForUpdates().then(version => {
        if (version) {
          setShowUpdateDialog(true);
        }
      });
    }
  }, [location.search, checkForUpdates]);

  return (
    <>
      {latestVersion && (
        <UpdateDialog 
          open={showUpdateDialog} 
          onOpenChange={setShowUpdateDialog}
          version={latestVersion}
        />
      )}
      <AppRouter />
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserRoleProvider>
          <Toaster />
          <Sonner />
          <AppWithUpdates />
        </UserRoleProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
