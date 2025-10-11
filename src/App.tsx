import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Companies from "./pages/Companies";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import CompanyAuth from "./pages/CompanyAuth";
import CompanyPortal from "./pages/CompanyPortal";
import Specialists from "./pages/Specialists";
import SpecialistAuth from "./pages/SpecialistAuth";
import SpecialistOrders from "./pages/SpecialistOrders";
import OrderTracking from "./pages/OrderTracking";
import CompanyBooking from "./pages/CompanyBooking";
import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";
import DeletionRequests from "./pages/DeletionRequests";

const queryClient = new QueryClient();

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

// Component to detect pathname and route accordingly
function PathBasedRouter() {
  const [renderKey, setRenderKey] = useState(0);
  
  useEffect(() => {
    // Force re-render when pathname changes
    const handlePopState = () => setRenderKey(k => k + 1);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pathname = window.location.pathname;
  const hash = window.location.hash;
  
  // Clear hash if we're on admin routes to prevent conflicts
  useEffect(() => {
    if ((pathname === '/auth' || pathname === '/admin' || pathname === '/companies' || 
         pathname === '/services' || pathname === '/orders' || pathname === '/deletion-requests' ||
         pathname.startsWith('/company-booking/')) && hash && hash !== '') {
      window.history.replaceState(null, '', pathname + window.location.search);
    }
  }, [pathname, hash]);
  
  // Detect if running in Capacitor (mobile app)
  const isCapacitor = window.location.protocol === 'capacitor:' || 
                      window.location.protocol === 'ionic:' ||
                      (typeof window !== 'undefined' && (window as any).Capacitor);
  
  // If running in Capacitor, always use HashRouter for specialist routes
  if (isCapacitor) {
    return (
      <HashRouter key={renderKey}>
        <Routes>
          <Route path="/specialist-auth" element={<SpecialistAuth />} />
          <Route path="/specialist-orders" element={<SpecialistOrders />} />
          <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
          <Route path="/" element={<Navigate to="/specialist-auth" replace />} />
          <Route path="*" element={<Navigate to="/specialist-auth" replace />} />
        </Routes>
      </HashRouter>
    );
  }
  
  // Admin routes
  if (pathname === '/auth' || pathname === '/admin' || pathname === '/companies' || 
      pathname === '/services' || pathname === '/orders' || pathname === '/deletion-requests' ||
      pathname.startsWith('/company-booking/')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
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
            path="/company-booking/:orderId/:companyId"
            element={<CompanyBooking />}
          />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  
  // Company routes
  if (pathname === '/company-auth' || pathname === '/company-portal' || pathname === '/specialists') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/company-auth" element={<CompanyAuth />} />
          <Route path="/company-portal" element={<CompanyPortal />} />
          <Route path="/specialists" element={<Specialists />} />
          <Route path="*" element={<Navigate to="/company-auth" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  
  // Specialist routes (default for mobile app and root path)
  return (
    <HashRouter key={renderKey}>
      <Routes>
        <Route path="/specialist-auth" element={<SpecialistAuth />} />
        <Route path="/specialist-orders" element={<SpecialistOrders />} />
        <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
        <Route path="/" element={<Navigate to="/specialist-auth" replace />} />
        <Route path="*" element={<Navigate to="/specialist-auth" replace />} />
      </Routes>
    </HashRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PathBasedRouter />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
