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
import SpecialistOrders from "./pages/SpecialistOrders";
import OrderTracking from "./pages/OrderTracking";
import CompanyBooking from "./pages/CompanyBooking";
import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";
import DeletionRequests from "./pages/DeletionRequests";

const queryClient = new QueryClient();

// Detect if running in Capacitor (mobile app)
const isCapacitorApp = 
  window.location.protocol === 'capacitor:' || 
  window.location.protocol === 'ionic:' ||
  !!(typeof window !== 'undefined' && (window as any).Capacitor);

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
  return (
    <BrowserRouter>
      <Routes>
        {/* Mobile-only routes - only accessible in Capacitor */}
        {isCapacitorApp && (
          <>
            <Route path="/specialist-auth" element={<SpecialistAuth />} />
            <Route path="/specialist-orders" element={<SpecialistOrders />} />
            <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
          </>
        )}
        
        {/* Web-only routes - only accessible in browser */}
        {!isCapacitorApp && (
          <>
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
            <Route path="/company-auth" element={<CompanyAuth />} />
            <Route path="/company-portal" element={<CompanyPortal />} />
            <Route path="/specialists" element={<Specialists />} />
          </>
        )}
        
        {/* Default routes */}
        <Route 
          path="/" 
          element={<Navigate to={isCapacitorApp ? "/specialist-auth" : "/auth"} replace />} 
        />
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
