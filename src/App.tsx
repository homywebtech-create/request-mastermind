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

// Detect if running in Capacitor (mobile app)
const isCapacitorApp = () => {
  return window.location.protocol === 'capacitor:' || 
         window.location.protocol === 'ionic:' ||
         (typeof window !== 'undefined' && (window as any).Capacitor);
};

// Component to detect pathname and route accordingly
function PathBasedRouter() {
  const isCapacitor = isCapacitorApp();
  
  // Clean hash from URL on web browsers
  useEffect(() => {
    if (!isCapacitor && window.location.hash) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
      window.location.reload();
    }
  }, [isCapacitor]);
  
  // If running in Capacitor mobile app, use HashRouter
  if (isCapacitor) {
    return (
      <HashRouter>
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
  
  // For web browser, use BrowserRouter with all routes
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes */}
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
        
        {/* Company routes */}
        <Route path="/company-auth" element={<CompanyAuth />} />
        <Route path="/company-portal" element={<CompanyPortal />} />
        <Route path="/specialists" element={<Specialists />} />
        
        {/* Default route */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
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
