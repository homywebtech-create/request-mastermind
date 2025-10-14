import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Companies from "./pages/Companies";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import CompanyAuth from "./pages/CompanyAuth";
import CompanyPortal from "./pages/CompanyPortal";
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

// Single Router for ALL environments (Web + Mobile)
function AppRouter() {
  // Render different routes based on environment
  if (isCapacitorApp) {
    // Mobile App Routes (Capacitor)
    return (
      <BrowserRouter>
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
          <Route path="/" element={<Navigate to="/specialist-auth" replace />} />
          <Route path="*" element={<Navigate to="/specialist-auth" replace />} />
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
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <Companies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <Services />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deletion-requests"
          element={
            <ProtectedRoute>
              <DeletionRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <ProtectedRoute>
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company-booking/:orderId/:companyId"
          element={<CompanyBooking />}
        />
        
        {/* Company routes */}
        <Route path="/company-auth" element={<CompanyAuth />} />
        <Route path="/company-portal" element={<CompanyPortal />} />
        <Route path="/specialists" element={<Specialists />} />
        
        {/* Public specialist registration route */}
        <Route path="/specialist-registration" element={<SpecialistRegistration />} />
        
        {/* Default route */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
