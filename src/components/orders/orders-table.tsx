// OrdersTable Component - Version: 2025-01-05-08:46
// All null checks implemented with optional chaining
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrackingStageBadge } from "@/components/ui/tracking-stage-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, Phone, User, Wrench, Building2, ExternalLink, Send, Users, Copy, MoreVertical, Clock, Volume2, VolumeX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { openWhatsApp as openWhatsAppHelper } from "@/lib/externalLinks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";
import { SpecialistProfileDialog } from "@/components/specialists/SpecialistProfileDialog";
import { ReadinessStatusIndicator } from "./ReadinessStatusIndicator";

interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  company_id: string | null;
  specialist_id?: string | null;
  service_type: string;
  status: 'pending' | 'waiting_quotes' | 'in-progress' | 'completed' | 'cancelled' | 'upcoming';
  tracking_stage?: string | null;
  notes?: string;
  order_link?: string;
  created_at: string;
  last_sent_at?: string;
  send_to_all_companies?: boolean;
  booking_type?: string | null;
  booking_date?: string | null;
  booking_date_type?: string | null;
  booking_time?: string | null;
  hours_count?: number | null;
  building_info?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  cancelled_by?: string | null;
  cancelled_by_role?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  specialist_readiness_status?: string | null;
  specialist_readiness_response_at?: string | null;
  specialist_not_ready_reason?: string | null;
  readiness_check_sent_at?: string | null;
  customers: {
    name: string;
    whatsapp_number: string;
    area?: string;
    budget?: string;
    budget_type?: string;
  } | null;
  companies: {
    name: string;
  } | null;
  order_specialists?: Array<{
    id: string;
    specialist_id?: string;
    quoted_price: string | null;
    quoted_at: string | null;
    is_accepted: boolean | null;
    specialists: {
      id: string;
      name: string;
      phone: string;
      nationality: string | null;
      image_url: string | null;
      company_id?: string;
      companies?: {
        id: string;
        name: string;
      } | null;
    } | null;
  }>;
}

interface CompanyQuoteGroup {
  companyId: string;
  companyName: string;
  lowestPrice: number;
  lowestPriceFormatted: string;
  quotesCount: number;
  specialists: Array<{
    id: string;
    quoted_price: string | null;
    quoted_at: string | null;
    is_accepted: boolean | null;
    specialists: {
      id: string;
      name: string;
      phone: string;
      nationality: string | null;
      image_url: string | null;
    };
  }>;
}

interface Company {
  id: string;
  name: string;
}

interface Specialist {
  id: string;
  name: string;
  specialty: string | null;
  phone: string;
  image_url: string | null;
}

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => void;
  onLinkCopied: (orderId: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  isCompanyView?: boolean;
  companyId?: string;
  isSnoozed?: (orderId: string) => boolean;
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied, filter, onFilterChange, isCompanyView = false, companyId, isSnoozed }: OrdersTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language).orders;
  const tCommon = useTranslation(language).common;
  const { user } = useAuth();
  const { role } = useUserRole();
  const { hasPermission } = useUserPermissions(user?.id, role);
  const { hasPermission: hasCompanyPermission } = useCompanyUserPermissions(user?.id);
  
  // State for highlighted orders with readiness alerts
  const [highlightedOrders, setHighlightedOrders] = useState<Record<string, { type: 'sent' | 'ready' | 'not_ready', timestamp: number }>>({});
  const [overdueConfirmedOrderIds, setOverdueConfirmedOrderIds] = useState<string[]>([]);
  
  // Listen for readiness alert events
  useEffect(() => {
    const handleReadinessAlert = (event: CustomEvent) => {
      const { orderId, type } = event.detail;
      console.log('🎨 Highlighting order:', orderId, 'type:', type);
      
      // Add to highlighted orders
      setHighlightedOrders(prev => ({
        ...prev,
        [orderId]: { type, timestamp: Date.now() }
      }));
      
      // Remove highlight after 10 seconds
      setTimeout(() => {
        setHighlightedOrders(prev => {
          const newHighlights = { ...prev };
          delete newHighlights[orderId];
          return newHighlights;
        });
      }, 10000);
    };
    
    const handleOverdueConfirmedOrders = (event: CustomEvent) => {
      const { orderIds } = event.detail;
      console.log('🚨 Overdue confirmed orders event received:', orderIds);
      setOverdueConfirmedOrderIds(orderIds);
    };
    
    window.addEventListener('order-readiness-alert', handleReadinessAlert as EventListener);
    window.addEventListener('overdue-confirmed-orders', handleOverdueConfirmedOrders as EventListener);
    
    return () => {
      window.removeEventListener('order-readiness-alert', handleReadinessAlert as EventListener);
      window.removeEventListener('overdue-confirmed-orders', handleOverdueConfirmedOrders as EventListener);
    };
  }, []);
  
  // Determine if user can manage orders based on view type
  const canManageOrders = isCompanyView 
    ? hasCompanyPermission('manage_orders')
    : hasPermission('manage_orders');

  // Check if order is overdue
  const isOrderOverdue = (order: Order) => {
    if (!order.booking_date || order.status === 'completed' || order.status === 'cancelled') return false;
    
    const bookingDateTime = new Date(order.booking_date);
    const now = new Date();
    
    // For specific time bookings, use the exact datetime
    if (order.booking_date_type === 'specific') {
      return now > bookingDateTime;
    }
    
    // For date-only bookings, parse booking time or set default
    if (order.booking_time) {
      // Handle period-based times
      if (order.booking_time === 'morning') {
        bookingDateTime.setHours(8, 0, 0, 0);
      } else if (order.booking_time === 'afternoon') {
        bookingDateTime.setHours(14, 0, 0, 0);
      } else if (order.booking_time === 'evening') {
        bookingDateTime.setHours(18, 0, 0, 0);
      } else {
        // Parse time range like "8:00 AM-8:30 AM" or simple time like "08:00"
        const startTimeStr = order.booking_time.split('-')[0].trim();
        const timeMatch = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const period = timeMatch[3]?.toUpperCase();
          
          // Convert to 24-hour format if AM/PM is present
          if (period === 'PM' && hours < 12) {
            hours += 12;
          } else if (period === 'AM' && hours === 12) {
            hours = 0;
          }
          
          if (!isNaN(hours) && !isNaN(minutes)) {
            bookingDateTime.setHours(hours, minutes, 0, 0);
          } else {
            bookingDateTime.setHours(8, 0, 0, 0);
          }
        } else {
          bookingDateTime.setHours(8, 0, 0, 0);
        }
      }
    } else {
      // Default to 8 AM for date-only bookings without time
      bookingDateTime.setHours(8, 0, 0, 0);
    }
    
    return now > bookingDateTime;
  };
  
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSpecialistIds, setSelectedSpecialistIds] = useState<string[]>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [specialistProfileOpen, setSpecialistProfileOpen] = useState(false);
  
  // Track recently sent orders with timestamps
  const [recentlySentOrders, setRecentlySentOrders] = useState<Map<string, number>>(new Map());
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(Date.now());

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    
    if (filter === 'new' || filter === 'pending') {
      // عرض الطلبات pending بدون أي عروض
      const isPendingWithoutQuotes = order.status === 'pending' && 
             (!order.order_specialists || order.order_specialists.length === 0 ||
              order.order_specialists.every(os => !os.quoted_price));
      
      // للأدمن: فقط الطلبات المعينة لشركة أو مرسلة لجميع الشركات
      if (!isCompanyView) {
        return isPendingWithoutQuotes && (order.company_id || order.send_to_all_companies);
      }
      
      // للشركات: عرض جميع الطلبات pending بدون عروض
      return isPendingWithoutQuotes;
    }
    
    if (filter === 'awaiting-response') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialists have quoted but not accepted yet
        // استبعاد الطلبات المؤكدة (التي لديها specialist_id أو status=upcoming أو is_accepted=true)
        console.log(`🔍 Checking [${order.order_number}] for awaiting-response (company view)`);
        
        const hasSpecialistAssigned = order.specialist_id != null;
        const isUpcoming = order.status === 'upcoming';
        
        if (hasSpecialistAssigned || isUpcoming) {
          console.log(`❌ [${order.order_number}] Excluded from Awaiting (Company): has_specialist=${hasSpecialistAssigned}, status=${order.status}`);
          return false;
        }
        
        const companySpecialists = order.order_specialists?.filter(os => 
          os.specialists?.company_id === companyId
        );
        const hasQuoteNotAccepted = companySpecialists && 
                                     companySpecialists.some(os => os.quoted_price && os.is_accepted !== true);
        const noAcceptedQuote = !companySpecialists?.some(os => os.is_accepted === true);
        const noAcceptedQuoteFromAnyCompany = !order.order_specialists?.some(os => os.is_accepted === true);
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        
        return hasQuoteNotAccepted && noAcceptedQuote && noAcceptedQuoteFromAnyCompany && notStartedTracking && notCompleted;
      } else {
        // For admin: show orders with quotes but NO quote accepted yet AND not started tracking
        console.log(`🔍 Checking [${order.order_number}] - specialist_id=${order.specialist_id}, status=${order.status}`);
        
        const hasSpecialistAssigned = order.specialist_id != null;
        const isUpcoming = order.status === 'upcoming';
        const hasAnyAccepted = order.order_specialists?.some(os => os.is_accepted === true);
        const hasQuotes = order.order_specialists?.some(os => os.quoted_price);
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        
        // استبعاد الطلبات التي لديها specialist_id أو status=upcoming
        if (hasSpecialistAssigned || isUpcoming || hasAnyAccepted) {
          console.log(`❌ [${order.order_number}] Excluded from Awaiting: specialist=${hasSpecialistAssigned}, upcoming=${isUpcoming}, accepted=${hasAnyAccepted}`);
          return false;
        }
        
        // Show only if has quotes AND no quote accepted yet AND not tracking
        return hasQuotes && !hasAnyAccepted && notStartedTracking && notCompleted;
      }
    }
    
    if (filter === 'confirmed') {
      if (isCompanyView && companyId) {
        // For companies: show confirmed orders (has accepted specialist OR has specialist_id OR status=upcoming)
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const hasAssignedSpecialistFromCompany = order.specialist_id && 
          order.order_specialists?.some(os => 
            os.specialist_id === order.specialist_id && os.specialists?.company_id === companyId
          );
        const isUpcoming = order.status === 'upcoming';
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        const notCancelled = order.status !== 'cancelled';
        
        return (hasAcceptedSpecialist || hasAssignedSpecialistFromCompany || isUpcoming) && 
               notStartedTracking && notCompleted && notCancelled;
      } else {
        // For admin: show confirmed orders (has accepted quote OR has specialist_id OR status=upcoming)
        const hasAcceptedQuote = order.order_specialists?.some(os => os.is_accepted === true);
        const hasSpecialistAssigned = order.specialist_id != null;
        const isUpcoming = order.status === 'upcoming';
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        const notCancelled = order.status !== 'cancelled';
        
        console.log(`[${order.order_number}] Confirmed check: accepted=${hasAcceptedQuote}, has_specialist=${hasSpecialistAssigned}, upcoming=${isUpcoming}`);
        
        return (hasAcceptedQuote || hasSpecialistAssigned || isUpcoming) && 
               notStartedTracking && notCompleted && notCancelled;
      }
    }
    
    if (filter === 'in-progress') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialist was accepted AND tracking started
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const trackingStarted = order.tracking_stage && 
               ['moving', 'arrived', 'working', 'invoice_requested'].includes(order.tracking_stage);
        return hasAcceptedSpecialist && trackingStarted;
      } else {
        // For admin: show orders with active tracking OR status in-progress
        const trackingStarted = order.tracking_stage && 
               order.tracking_stage !== null &&
               ['moving', 'arrived', 'working', 'invoice_requested'].includes(order.tracking_stage);
        const statusInProgress = order.status === 'in-progress';
        return trackingStarted || statusInProgress;
      }
    }
    
    if (filter === 'completed') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialist was accepted and completed
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const trackingStage = order.tracking_stage;
        return hasAcceptedSpecialist && 
               (trackingStage === 'payment_received' || order.status === 'completed');
      } else {
        // For admin: show completed orders
        return order.tracking_stage === 'payment_received' ||
               order.status === 'completed';
      }
    }
    
    if (filter === 'cancelled') {
      if (isCompanyView && companyId) {
        // For companies: show cancelled orders related to this company
        return order.status === 'cancelled' && 
               (order.company_id === companyId || order.send_to_all_companies);
      } else {
        // For admin: show all cancelled orders
        return order.status === 'cancelled';
      }
    }
    
    return order.status === filter;
  });

  // Group orders by companies for awaiting-response filter
  // IMPORTANT: For company view, only show quotes from the current company
  const getCompanyQuotes = (order: Order): CompanyQuoteGroup[] => {
    if (!order.order_specialists) return [];
    
    const companyMap = new Map<string, CompanyQuoteGroup>();

    order.order_specialists
      .filter(os => {
        // Must have a quote and not yet accepted
        if (!os.quoted_price || os.is_accepted !== null || !os.specialists) return false;
        
        // PRIVACY CHECK: If company view, only show quotes from current company
        if (isCompanyView && companyId) {
          return os.specialists.company_id === companyId;
        }
        
        // Admin can see all quotes
        return true;
      })
      .forEach(os => {
        // Add null check for specialists
        if (!os.specialists) return;
        
        const quoteCompanyId = os.specialists.companies?.id;
        const quoteCompanyName = os.specialists.companies?.name || 'Unknown Company';
        
        // Extract numeric value from price string (e.g., "24 QAR" -> 24)
        const priceMatch = os.quoted_price?.match(/(\d+(\.\d+)?)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : Infinity;
        
        if (!quoteCompanyId) return;

        if (!companyMap.has(quoteCompanyId)) {
          companyMap.set(quoteCompanyId, {
            companyId: quoteCompanyId,
            companyName: quoteCompanyName,
            lowestPrice: price,
            lowestPriceFormatted: os.quoted_price || '',
            quotesCount: 1,
            specialists: [os]
          });
        } else {
          const existing = companyMap.get(quoteCompanyId)!;
          existing.specialists.push(os);
          existing.quotesCount++;
          if (price < existing.lowestPrice) {
            existing.lowestPrice = price;
            existing.lowestPriceFormatted = os.quoted_price || '';
          }
        }
      });

    return Array.from(companyMap.values())
      .sort((a, b) => a.lowestPrice - b.lowestPrice);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  // Timer effect to update recently sent orders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      const newMap = new Map(recentlySentOrders);
      let updated = false;
      
      recentlySentOrders.forEach((timestamp, orderId) => {
        const minutesPassed = Math.floor((now - timestamp) / (1000 * 60));
        if (minutesPassed >= 3) {
          newMap.delete(orderId);
          updated = true;
        }
      });
      
      if (updated) {
        setRecentlySentOrders(newMap);
      }
    }, 1000); // Check every second for smoother countdown
    
    return () => clearInterval(interval);
  }, [recentlySentOrders]);

  const getTimeSinceSent = (order: Order) => {
    // Check local state first
    const localSentTime = recentlySentOrders.get(order.id);
    if (localSentTime) {
      const diffInSeconds = Math.floor((currentTime - localSentTime) / 1000);
      return Math.max(0, diffInSeconds); // Return seconds
    }
    
    // Fall back to database time
    const sentTime = order.last_sent_at ? new Date(order.last_sent_at) : new Date(order.created_at);
    const diffInSeconds = Math.floor((currentTime - sentTime.getTime()) / 1000);
    return Math.max(0, diffInSeconds); // Return seconds
  };

  const getMinutesSinceSent = (order: Order) => {
    return Math.floor(getTimeSinceSent(order) / 60);
  };

  const getRemainingTime = (order: Order) => {
    const secondsSinceSent = getTimeSinceSent(order);
    const totalSeconds = 3 * 60; // 3 minutes in seconds
    const remainingSeconds = Math.max(0, totalSeconds - secondsSinceSent);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isOverThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) >= 180; // 3 minutes = 180 seconds
  };

  const isWithinThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) < 180; // 3 minutes = 180 seconds
  };

  const isProcessing = (orderId: string) => {
    return processingOrders.has(orderId);
  };

  const markOrderAsSent = (orderId: string) => {
    const newMap = new Map(recentlySentOrders);
    newMap.set(orderId, Date.now());
    setRecentlySentOrders(newMap);
  };

  const setOrderProcessing = (orderId: string, processing: boolean) => {
    const newSet = new Set(processingOrders);
    if (processing) {
      newSet.add(orderId);
    } else {
      newSet.delete(orderId);
    }
    setProcessingOrders(newSet);
  };

  const handleCopyOrderLink = async (order: Order) => {
    try {
      const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
      await navigator.clipboard.writeText(orderLink);
      
      onLinkCopied(order.id);
      
      toast({
        title: t.linkCopied,
        description: t.linkCopiedDesc,
      });
    } catch (error) {
      toast({
        title: t.copyError,
        description: t.errorCopyingLink,
        variant: "destructive",
      });
    }
  };

  const sendOrderLinkViaWhatsApp = (order: Order) => {
    if (!order.customers?.whatsapp_number) {
      toast({
        title: t.error,
        description: t.errorCopyingLink,
        variant: "destructive",
      });
      return;
    }
    
    const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
    const cleanNumber = order.customers.whatsapp_number.replace(/\D/g, '');
    const companyName = order.companies?.name || 'Not specified';
    const customerName = order.customers?.name || 'Dear Customer';
    
    const message = `Hello ${customerName},

Your order has been successfully received! ✅

📋 *Order Details:*
• Service: ${order.service_type}
• Company: ${companyName}
${order.notes ? `• Notes: ${order.notes}` : ''}

🔗 *Order Tracking Link:*
${orderLink}

You can use this link to track your order status at any time.

Thank you for contacting us! 🌟`;
    
    openWhatsAppHelper(cleanNumber, message);
    onLinkCopied(order.id);
  };

  const openWhatsApp = (phoneNumber: string) => {
    openWhatsAppHelper(phoneNumber);
  };

  const handleAcceptQuote = async (orderSpecialistId: string, orderId: string) => {
    try {
      const { error } = await supabase
        .from('order_specialists')
        .update({ 
          is_accepted: true,
          rejected_at: null,
          rejection_reason: null
        })
        .eq('id', orderSpecialistId);

      if (error) throw error;

      // Fetch the specialist to notify
      let specialistId: string | null = null;
      try {
        const { data: os, error: osErr } = await supabase
          .from('order_specialists')
          .select('specialist_id')
          .eq('id', orderSpecialistId)
          .single();
        if (!osErr) specialistId = os?.specialist_id || null;
      } catch (e) {
        console.warn('Could not resolve specialist_id for accepted quote:', e);
      }

      // Update specialist_id in orders table
      if (specialistId) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ specialist_id: specialistId })
          .eq('id', orderId);
        
        if (orderError) {
          console.error('Error updating order specialist_id:', orderError);
        }
      }

      // Send booking confirmation push → deep link to /order-tracking/:orderId
      if (specialistId) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              specialistIds: [specialistId],
              title: 'تأكيد الحجز',
              body: 'تم تأكيد حجزك بنجاح',
              data: {
                orderId,
                type: 'booking_confirmed',
              },
            },
          });
        } catch (e) {
          console.warn('🔔 Push booking_confirmed failed (non-blocking):', e);
        }
      }

      toast({
        title: t.quoteAccepted,
        description: t.quoteAcceptedDesc,
      });

      // No need to reload, realtime subscription will handle the update
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectQuote = async (orderSpecialistId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('order_specialists')
        .update({ 
          is_accepted: false,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || 'تم رفض العرض من قبل الإدارة'
        })
        .eq('id', orderSpecialistId);

      if (error) throw error;

      toast({
        title: t.quoteRejected,
        description: t.quoteRejectedDesc,
      });

      // No need to reload, realtime subscription will handle the update
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: t.error,
        description: t.errorLoadingCompanies,
        variant: "destructive",
      });
    }
  };

  const fetchSpecialists = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name, specialty, phone, image_url")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSpecialists(data || []);
    } catch (error) {
      console.error("Error fetching specialists:", error);
      setSpecialists([]);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSpecialists(selectedCompanyId);
    } else {
      setSpecialists([]);
      setSelectedSpecialistIds([]);
    }
  }, [selectedCompanyId]);

  const handleSendToAll = async (orderId: string) => {
    setOrderProcessing(orderId, true);
    try {
      // 1) Read existing assignments
      const { data: existing, error: existingError } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', orderId);

      if (existingError) throw existingError;
      const existingSet = new Set((existing || []).map((e) => e.specialist_id));

      // 2) Get all active specialists from all companies
      const { data: allSpecialists, error: specialistsError } = await supabase
        .from('specialists')
        .select('id')
        .eq('is_active', true);

      if (specialistsError) throw specialistsError;

      // 3) Insert only missing specialists in batches for performance
      const missing = (allSpecialists || []).filter((s) => !existingSet.has(s.id));
      if (missing.length > 0) {
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < missing.length; i += batchSize) {
          batches.push(missing.slice(i, i + batchSize));
        }
        
        await Promise.all(
          batches.map(batch => 
            supabase
              .from('order_specialists')
              .insert(batch.map(s => ({ order_id: orderId, specialist_id: s.id })))
          )
        );
      }

      // 4) Update order broadcast flags and timestamp
      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: true,
          company_id: null,
          specialist_id: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send Firebase push notifications to all specialists
      try {
        console.log('📤 [FCM] إرسال إشعارات Firebase...');
        const specialistIds = (allSpecialists || []).map(s => s.id);
        
        const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            specialistIds,
            title: '🔔 عرض عمل جديد',
            body: 'لديك عرض عمل جديد - افتح التطبيق الآن',
            data: { orderId, type: 'new_order' }
          }
        });
        
        if (fcmError) {
          console.error('⚠️ [FCM] خطأ في إرسال الإشعارات:', fcmError);
        } else {
          console.log('✅ [FCM] تم إرسال الإشعارات:', fcmResult);
        }
      } catch (fcmError) {
        console.error('⚠️ [FCM] استثناء في إرسال الإشعارات:', fcmError);
      }

      // Mark order as sent locally
      markOrderAsSent(orderId);

      toast({
        title: t.sendSuccessful,
        description: t.sentToSpecialists.replace('{count}', (allSpecialists?.length || 0).toString()),
      });

      setResendDialogOpen(false);
      setSelectedOrder(null);
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOrderProcessing(orderId, false);
    }
  };

  const handleResendToSameCompany = async (order: Order) => {
    setOrderProcessing(order.id, true);
    try {
      if (!order.company_id) {
        toast({
          title: t.error,
          description: t.noCompanyAssigned,
          variant: 'destructive',
        });
        return;
      }

      // Read existing assignments
      const { data: existing, error: existingError } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', order.id);
      if (existingError) throw existingError;
      const existingSet = new Set((existing || []).map((e) => e.specialist_id));

      // Get all active specialists from the same company
      const { data: companySpecialists, error: specialistsError } = await supabase
        .from('specialists')
        .select('id')
        .eq('company_id', order.company_id)
        .eq('is_active', true);
      if (specialistsError) throw specialistsError;

      // Insert only missing
      const missing = (companySpecialists || []).filter((s) => !existingSet.has(s.id));
      if (missing.length > 0) {
        const toInsert = missing.map((s) => ({ order_id: order.id, specialist_id: s.id }));
        const { error: insertError } = await supabase
          .from('order_specialists')
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // Update order timestamp and flags
      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: false,
          company_id: order.company_id,
          specialist_id: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      // Send Firebase push notifications to company specialists
      try {
        console.log('📤 [FCM] إرسال إشعارات Firebase لنفس الشركة...');
        const specialistIds = (companySpecialists || []).map(s => s.id);
        
        const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            specialistIds,
            title: '🔁 إعادة إرسال طلب',
            body: 'تم إعادة إرسال طلب لك - راجعه الآن',
            data: { orderId: order.id, type: 'resend_order' }
          }
        });
        
        if (fcmError) {
          console.error('⚠️ [FCM] خطأ في إرسال الإشعارات:', fcmError);
        } else {
          console.log('✅ [FCM] تم إرسال الإشعارات:', fcmResult);
        }
      } catch (fcmError) {
        console.error('⚠️ [FCM] استثناء في إرسال الإشعارات:', fcmError);
      }

      // Mark order as sent locally
      markOrderAsSent(order.id);

      toast({
        title: t.sendSuccessful,
        description: t.sentToSpecialists.replace('{count}', (companySpecialists?.length || 0).toString()),
      });

      setResendDialogOpen(false);
      setSelectedOrder(null);
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOrderProcessing(order.id, false);
    }
  };

  // Reset order to pending and resend to new companies/specialists
  const handleResetAndResendOrder = async (orderId: string) => {
    setOrderProcessing(orderId, true);
    try {
      console.log(`🔄 [RESET] إعادة تعيين الطلب ${orderId} إلى pending...`);
      
      // Delete all existing order_specialists assignments
      const { error: deleteError } = await supabase
        .from('order_specialists')
        .delete()
        .eq('order_id', orderId);
      
      if (deleteError) {
        console.error('❌ [RESET] خطأ في حذف التعيينات:', deleteError);
        throw deleteError;
      }

      // Reset order to pending status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'pending',
          specialist_id: null,
          company_id: null,
          send_to_all_companies: false,
          specialist_readiness_status: null,
          specialist_readiness_response_at: null,
          specialist_not_ready_reason: null,
          readiness_check_sent_at: null,
          last_sent_at: null,
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ [RESET] خطأ في إعادة تعيين حالة الطلب:', updateError);
        throw updateError;
      }

      console.log('✅ [RESET] تم إعادة تعيين الطلب بنجاح');

      toast({
        title: language === 'ar' ? '✅ تم إعادة تعيين الطلب' : '✅ Order Reset',
        description: language === 'ar' 
          ? 'تم إعادة الطلب إلى قائمة الطلبات الجديدة. يمكنك الآن إرساله لشركات ومحترفين آخرين.' 
          : 'The order has been reset to new orders. You can now send it to other companies and specialists.',
      });

      setResendDialogOpen(false);
      setSelectedOrder(null);
      
      // Refresh page to show updated orders
      window.location.reload();
    } catch (error: any) {
      console.error('❌ [RESET] خطأ في إعادة تعيين الطلب:', error);
      toast({
        title: t.error,
        description: error.message || (language === 'ar' ? 'حدث خطأ أثناء إعادة تعيين الطلب' : 'An error occurred while resetting the order'),
        variant: 'destructive',
      });
    } finally {
      setOrderProcessing(orderId, false);
    }
  };

  const handleResendToSameSpecialists = async (order: Order) => {
    setOrderProcessing(order.id, true);
    try {
      // Get current specialists for this order
      const { data: currentSpecialists, error: fetchError } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', order.id);

      if (fetchError) throw fetchError;

      if (!currentSpecialists || currentSpecialists.length === 0) {
        toast({
          title: t.error,
          description: t.noActiveSpecialists,
          variant: 'destructive',
        });
        return;
      }

      // Update timestamp to trigger notifications
      const { error } = await supabase
        .from('orders')
        .update({
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      // Send Firebase push notifications to same specialists
      try {
        console.log('📤 [FCM] إرسال إشعارات Firebase لنفس المحترفين...');
        const specialistIds = currentSpecialists.map(s => s.specialist_id);
        
        const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            specialistIds,
            title: '🔁 إعادة إرسال طلب',
            body: 'تم إعادة إرسال طلب لك - راجعه الآن',
            data: { orderId: order.id, type: 'resend_order' }
          }
        });
        
        if (fcmError) {
          console.error('⚠️ [FCM] خطأ في إرسال الإشعارات:', fcmError);
        } else {
          console.log('✅ [FCM] تم إرسال الإشعارات:', fcmResult);
        }
      } catch (fcmError) {
        console.error('⚠️ [FCM] استثناء في إرسال الإشعارات:', fcmError);
      }

      // Mark order as sent locally
      markOrderAsSent(order.id);

      toast({
        title: t.sendSuccessful,
        description: t.sentToSpecialists.replace('{count}', currentSpecialists.length.toString()),
      });

      setResendDialogOpen(false);
      setSelectedOrder(null);
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOrderProcessing(order.id, false);
    }
  };

  const openResendDialog = async (order: Order) => {
    setSelectedOrder(order);

    setResendDialogOpen(true);
  };

  const handleSendToCompany = async () => {
    if (!selectedOrder || !selectedCompanyId) return;

    setOrderProcessing(selectedOrder.id, true);
    try {
      // Update order with company assignment and timestamp
      const { data: updatedOrder, error: orderError } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: false,
          company_id: selectedCompanyId,
          specialist_id: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id)
        .select('id')
        .single();

      if (orderError) throw orderError;

      // First, delete existing specialists for this order
      await supabase
        .from('order_specialists')
        .delete()
        .eq('order_id', selectedOrder.id);

      let finalSpecialistIds: string[] = [];

      // If specific specialists are selected, add only them
      if (selectedSpecialistIds.length > 0) {
        const orderSpecialists = selectedSpecialistIds.map(specialistId => ({
          order_id: updatedOrder.id,
          specialist_id: specialistId,
        }));

        const { error: junctionError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        if (junctionError) throw junctionError;
        
        finalSpecialistIds = selectedSpecialistIds;
      } else {
        // If no specific specialists selected, add all active specialists from company
        const { data: companySpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true);

        if (specialistsError) throw specialistsError;

        if (companySpecialists && companySpecialists.length > 0) {
          const orderSpecialists = companySpecialists.map(specialist => ({
            order_id: updatedOrder.id,
            specialist_id: specialist.id,
          }));

          const { error: insertError } = await supabase
            .from('order_specialists')
            .insert(orderSpecialists);

          if (insertError) throw insertError;
          
          finalSpecialistIds = companySpecialists.map(s => s.id);
        }
      }

      // Mark order as sent locally
      markOrderAsSent(selectedOrder.id);

      // Send Firebase push notifications
      try {
        console.log('📤 [FCM] إرسال إشعارات Firebase...');
        
        if (finalSpecialistIds.length > 0) {
          const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              specialistIds: finalSpecialistIds,
              title: '🔔 عرض عمل جديد',
              body: 'لديك عرض عمل جديد - افتح التطبيق الآن',
              data: { orderId: selectedOrder.id, type: 'new_order' }
            }
          });
          
          if (fcmError) {
            console.error('⚠️ [FCM] خطأ في إرسال الإشعارات:', fcmError);
          } else {
            console.log('✅ [FCM] تم إرسال الإشعارات:', fcmResult);
          }
        }
      } catch (fcmError) {
        console.error('⚠️ [FCM] استثناء في إرسال الإشعارات:', fcmError);
      }

      let description = t.sentToCompany;
      if (selectedSpecialistIds.length > 0) {
        description = t.sentToSpecialists.replace('{count}', selectedSpecialistIds.length.toString());
      } else {
        description = t.sentToCompanySpecialists;
      }

      toast({
        title: t.sendSuccessful,
        description,
      });

      setSendDialogOpen(false);
      setSelectedOrder(null);
      setSelectedCompanyId('');
      setSelectedSpecialistIds([]);
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setOrderProcessing(selectedOrder.id, false);
    }
  };

  const openSendDialog = (order: Order) => {
    setSelectedOrder(order);
    setSelectedCompanyId('');
    setSelectedSpecialistIds([]);
    fetchCompanies();
    setSendDialogOpen(true);
  };

  const toggleSpecialist = (specialistId: string) => {
    setSelectedSpecialistIds(prev =>
      prev.includes(specialistId)
        ? prev.filter(id => id !== specialistId)
        : [...prev, specialistId]
    );
  };

  const getTrackingStageLabel = (stage: string | null | undefined): { label: string; color: string } => {
    switch (stage) {
      case 'moving':
        return { label: '🚗 Moving to Customer', color: 'text-blue-600 dark:text-blue-400' };
      case 'arrived':
        return { label: '📍 Arrived at Location', color: 'text-purple-600 dark:text-purple-400' };
      case 'working':
        return { label: '⚙️ Working', color: 'text-orange-600 dark:text-orange-400' };
      case 'completed':
        return { label: '✅ Work Completed', color: 'text-green-600 dark:text-green-400' };
      case 'invoice_requested':
        return { label: '📄 Invoice Requested', color: 'text-indigo-600 dark:text-indigo-400' };
      case 'payment_received':
        return { label: '💰 Payment Received', color: 'text-emerald-600 dark:text-emerald-400' };
      case 'cancelled':
        return { label: '❌ Cancelled', color: 'text-red-600 dark:text-red-400' };
      default:
        return { label: '', color: '' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t.ordersList}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={onFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hasPermission('view_orders') && <SelectItem value="all">{t.allOrders}</SelectItem>}
                {hasPermission('view_new_requests') && <SelectItem value="new">{t.newRequests}</SelectItem>}
                {hasPermission('view_awaiting_response') && <SelectItem value="awaiting-response">{t.awaitingResponse}</SelectItem>}
                {hasPermission('view_upcoming') && <SelectItem value="upcoming">{t.upcoming}</SelectItem>}
                {hasPermission('view_in_progress') && <SelectItem value="in-progress">{t.inProgress}</SelectItem>}
                {hasPermission('view_completed') && <SelectItem value="completed">{t.completed}</SelectItem>}
                {hasPermission('view_orders') && <SelectItem value="cancelled">{t.cancelled}</SelectItem>}
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {filteredOrders.length} {t.ordersCount.replace('{count}', '')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto" dir="ltr">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">{t.orderNumber}</TableHead>
                <TableHead className="text-left">{t.customer}</TableHead>
                <TableHead className="text-left">{t.area}</TableHead>
                <TableHead className="text-left">{t.customerBudget}</TableHead>
                <TableHead className="text-left">{t.service}</TableHead>
                <TableHead className="text-left">{language === 'ar' ? 'الشركة والمحترف' : 'Company & Specialist'}</TableHead>
                <TableHead className="text-left">{language === 'ar' ? 'تفاصيل الحجز' : 'Booking Details'}</TableHead>
                <TableHead className="text-left">
                  {filter === 'awaiting-response' ? t.companyQuotes : (filter === 'cancelled' ? (language === 'ar' ? 'تفاصيل الإلغاء' : 'Cancellation Details') : (language === 'ar' ? 'ملاحظات العميل' : 'Customer Notes'))}
                </TableHead>
                {(filter === 'confirmed' || filter === 'upcoming' || filter === 'in-progress') && (
                  <TableHead className="text-left">{language === 'ar' ? 'حالة الجاهزية / الوقت المتبقي' : 'Readiness / Time Remaining'}</TableHead>
                )}
                <TableHead className="text-left">{t.dateAndStatus}</TableHead>
                <TableHead className="text-left">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {t.noOrders}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const customerName = order.customers?.name || t.customerNA;
                  const customerPhone = order.customers?.whatsapp_number || t.customerNA;
                  const customerArea = order.customers?.area || '-';
                  const customerBudget = order.customers?.budget || '-';
                  const isPending = order.status === 'pending' && (order.company_id || order.send_to_all_companies);
                  const minutesSinceSent = getMinutesSinceSent(order);
                  // Show delayed status for all orders that can be resent, not just pending ones
                  const canShowResendButton = canManageOrders && (filter === 'new' || filter === 'pending' || (filter === 'awaiting-response' && !isCompanyView));
                  const isDelayed = isOverThreeMinutes(order) && canShowResendButton;
                  const isOverdue = isOrderOverdue(order);
                  const isRecentlySent = isWithinThreeMinutes(order) && canShowResendButton;
                  const isOrderProcessing = isProcessing(order.id);
                  
                  // Check if order has readiness alert highlight
                  const readinessHighlight = highlightedOrders[order.id];
                  
                  // Check if this is a confirmed order that's overdue (needs strong visual alert)
                  const isOverdueConfirmed = overdueConfirmedOrderIds.includes(order.id) && 
                                            (filter === 'confirmed' || filter === 'upcoming');
                  const isOrderSnoozed = isSnoozed ? isSnoozed(order.id) : false;
                  
                  return (
                    <TableRow 
                      key={order.id}
                      className={
                        isOverdueConfirmed
                          ? "bg-red-500/20 border-4 border-red-600 dark:border-red-500 animate-pulse shadow-2xl shadow-red-500/60 ring-4 ring-red-500/30 backdrop-blur-sm"
                          : readinessHighlight?.type === 'sent'
                            ? "bg-blue-100 dark:bg-blue-950/30 border-blue-500 dark:border-blue-700 animate-pulse shadow-lg shadow-blue-500/50"
                            : readinessHighlight?.type === 'ready'
                              ? "bg-yellow-100 dark:bg-yellow-950/30 border-yellow-500 dark:border-yellow-700 animate-pulse shadow-lg shadow-yellow-500/50"
                              : readinessHighlight?.type === 'not_ready'
                                ? "bg-red-100 dark:bg-red-950/30 border-red-500 dark:border-red-700 animate-pulse shadow-lg shadow-red-500/50"
                                : isOverdue 
                                  ? "bg-destructive/10 border-destructive/20 animate-pulse" 
                                  : isDelayed 
                                    ? "bg-destructive/10 border-destructive/20" 
                                    : isRecentlySent 
                                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30" 
                                      : ""
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {order.order_number || 'N/A'}
                          </Badge>
                          {isOverdueConfirmed && (
                            <>
                              <Badge className="text-xs animate-pulse bg-red-600 text-white border-2 border-red-800 shadow-lg">
                                🚨 {language === 'ar' ? 'متأخر جداً!' : 'Very Overdue!'}
                              </Badge>
                              {!isOrderSnoozed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-900 dark:text-yellow-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('🔕 [SNOOZE] Button clicked for order:', order.id, order.order_number);
                                    const snoozeFunc = (window as any).snoozeOverdueOrder;
                                    if (snoozeFunc) {
                                      console.log('✅ [SNOOZE] Function found, calling...');
                                      snoozeFunc(order.id);
                                    } else {
                                      console.error('❌ [SNOOZE] Function not found on window object');
                                    }
                                  }}
                                  title={language === 'ar' ? 'تأجيل التنبيه لمدة 3 دقائق' : 'Snooze for 3 minutes'}
                                >
                                  <VolumeX className="h-3 w-3 mr-1" />
                                  {language === 'ar' ? 'إيقاف مؤقت' : 'Snooze'}
                                </Button>
                              )}
                            </>
                          )}
                          {!isOverdueConfirmed && isOverdue && (
                            <Badge variant="destructive" className="text-xs animate-pulse">
                              {language === 'ar' ? '⚠️ متأخر' : '⚠️ Overdue'}
                            </Badge>
                          )}
                          {order.specialist_readiness_status === 'ready' && (
                            <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50">
                              🟡 {language === 'ar' ? 'جاهز / استعداد' : 'Ready / Standby'}
                            </Badge>
                          )}
                          {order.specialist_readiness_status === 'not_ready' && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ {language === 'ar' ? 'غير جاهز' : 'Not Ready'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{customerName}</span>
                          </div>
                          {!isCompanyView || (filter !== 'new' && filter !== 'pending') ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{customerPhone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t.hiddenUntilAccepted}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {!isCompanyView || (filter !== 'new' && filter !== 'pending') ? (
                          <span className="text-sm">{customerArea}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {!isCompanyView || (filter !== 'new' && filter !== 'pending') ? (
                          <span className="text-sm">{customerBudget}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                            <Wrench className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <Badge variant="secondary" className="font-medium">
                              {order.service_type}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>

                      {/* Combined Company & Specialist Column */}
                      <TableCell>
                        <div className="space-y-2 min-w-[220px]">
                          {/* Company Info */}
                          {(() => {
                            // Try to get company from accepted specialist first
                            const acceptedSpecialist = order.order_specialists?.find(os => os.is_accepted === true);
                            const companyName = acceptedSpecialist?.specialists?.companies?.name || order.companies?.name;
                            
                            if (companyName) {
                              return (
                                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                                  <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10">
                                    <Building2 className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm font-medium">{companyName}</span>
                                </div>
                              );
                            }
                            
                            if (order.send_to_all_companies) {
                              return (
                                <Badge variant="outline" className="text-xs">
                                  {language === 'ar' ? 'جميع الشركات' : 'All Companies'}
                                </Badge>
                              );
                            }
                            
                            return (
                              <span className="text-xs text-muted-foreground">
                                {language === 'ar' ? 'لم يتم التعيين' : 'Not assigned'}
                              </span>
                            );
                          })()}
                          
                          {/* Specialist Info */}
                          {(() => {
                            const acceptedSpecialist = order.order_specialists?.find(os => os.is_accepted === true);
                            if (acceptedSpecialist?.specialists) {
                              const specialist = acceptedSpecialist.specialists;
                              return (
                                <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800/30">
                                  {/* Specialist Image - Clickable */}
                                  <button
                                    onClick={() => {
                                      setSelectedSpecialistId(specialist.id);
                                      setSpecialistProfileOpen(true);
                                    }}
                                    className="flex-shrink-0 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full"
                                    title={language === 'ar' ? 'عرض الملف الشخصي' : 'View Profile'}
                                  >
                                    {specialist.image_url ? (
                                      <img 
                                        src={specialist.image_url} 
                                        alt={specialist.name}
                                        className="w-10 h-10 rounded-full object-cover border-2 border-green-300 dark:border-green-700 cursor-pointer"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 cursor-pointer">
                                        <User className="h-5 w-5 text-green-700 dark:text-green-400" />
                                      </div>
                                    )}
                                  </button>
                                  {/* Specialist Details */}
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                                      {specialist.name}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                                      <Phone className="h-3 w-3 flex-shrink-0" />
                                      <span dir="ltr" className="truncate">{specialist.phone}</span>
                                    </div>
                                    {specialist.nationality && (
                                      <div className="flex items-center gap-1">
                                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700">
                                          {specialist.nationality}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="text-xs text-muted-foreground italic p-2">
                                {language === 'ar' ? 'لم يتم تعيين محترف' : 'No specialist assigned'}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>

                      {/* Booking Details Column */}
                      <TableCell>
                        <div className="space-y-1 min-w-[180px]">
                          {order.booking_date && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium" dir="ltr">
                                {/* Always show Gregorian date */}
                                {new Date(order.booking_date).toLocaleDateString('en-GB', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          {/* Show booking_time if available (actual time like "8:00 AM-8:30 AM") */}
                          {order.booking_time && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium" dir="ltr">
                                {order.booking_time}
                              </span>
                            </div>
                          )}
                          {/* Fallback to booking_type if booking_time is not available */}
                          {!order.booking_time && order.booking_type && (
                            <Badge variant="outline" className="text-xs">
                              {order.booking_type === 'morning' && (language === 'ar' ? 'صباحي' : 'Morning')}
                              {order.booking_type === 'afternoon' && (language === 'ar' ? 'ظهري' : 'Afternoon')}
                              {order.booking_type === 'evening' && (language === 'ar' ? 'مسائي' : 'Evening')}
                              {!['morning', 'afternoon', 'evening'].includes(order.booking_type) && order.booking_type}
                            </Badge>
                          )}
                          {order.hours_count && (
                            <div className="text-xs text-muted-foreground">
                              {order.hours_count} {language === 'ar' ? 'ساعة' : 'hours'}
                            </div>
                          )}
                          {order.booking_date_type && (
                            <Badge variant="secondary" className="text-xs">
                              {order.booking_date_type === 'specific' && (language === 'ar' ? 'تاريخ محدد' : 'Specific Date')}
                              {order.booking_date_type === 'flexible' && (language === 'ar' ? 'مرن' : 'Flexible')}
                            </Badge>
                          )}
                          {!order.booking_date && !order.booking_type && !order.booking_time && (
                            <span className="text-xs text-muted-foreground">{language === 'ar' ? 'غير محدد' : 'Not specified'}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {filter === 'cancelled' ? (
                          // Show cancellation details for cancelled orders
                          <div className="bg-destructive/5 rounded-md p-3 border border-destructive/20 space-y-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-destructive" />
                                <span className="text-sm font-semibold text-destructive">
                                  {language === 'ar' ? 'تم الإلغاء بواسطة:' : 'Cancelled by:'}
                                </span>
                              </div>
                              <div className="text-sm font-medium">
                                {order.cancelled_by || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {order.cancelled_by_role === 'customer' && (language === 'ar' ? 'عميل' : 'Customer')}
                                {order.cancelled_by_role === 'specialist' && (language === 'ar' ? 'محترف' : 'Specialist')}
                                {order.cancelled_by_role === 'company' && (language === 'ar' ? 'شركة' : 'Company')}
                                {order.cancelled_by_role === 'admin' && (language === 'ar' ? 'مدير' : 'Admin')}
                                {!order.cancelled_by_role && (language === 'ar' ? 'غير محدد' : 'Not specified')}
                              </Badge>
                            </div>
                            
                            {order.cancellation_reason && (
                              <div className="space-y-1 pt-2 border-t border-destructive/10">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {language === 'ar' ? 'السبب:' : 'Reason:'}
                                </div>
                                <p className="text-sm">{order.cancellation_reason}</p>
                              </div>
                            )}
                            
                            {order.cancelled_at && (
                              <div className="text-xs text-muted-foreground pt-1 border-t border-destructive/10">
                                {language === 'ar' ? 'تاريخ الإلغاء: ' : 'Cancelled at: '}
                                {formatDate(order.cancelled_at)}
                              </div>
                            )}
                            
                            {/* Show company info */}
                            {order.companies && (
                              <div className="space-y-1 pt-2 border-t border-destructive/10">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">
                                    {language === 'ar' ? 'الشركة: ' : 'Company: '}
                                    {order.companies.name}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Show accepted specialist if any */}
                            {(() => {
                              const acceptedSpecialist = order.order_specialists?.find(os => os.is_accepted === true);
                              if (acceptedSpecialist?.specialists) {
                                return (
                                  <div className="space-y-1 pt-2 border-t border-destructive/10">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs font-medium">
                                        {language === 'ar' ? 'المحترف: ' : 'Specialist: '}
                                        {acceptedSpecialist.specialists.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span dir="ltr">{acceptedSpecialist.specialists.phone}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : filter === 'awaiting-response' ? (
                          // Show companies with lowest quotes for awaiting response filter
                          (() => {
                            const companyQuotes = getCompanyQuotes(order);
                            return companyQuotes.length > 0 ? (
                              <div className="space-y-2">
                                {companyQuotes.map((company) => (
                                  <div 
                                    key={company.companyId} 
                                    className="bg-muted/50 rounded-md p-3 border border-border hover:border-primary transition-all"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                          {company.companyName}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary" className="whitespace-nowrap text-xs">
                                            {company.quotesCount} {company.quotesCount === 1 ? t.quote : t.quotePlural}
                                          </Badge>
                                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 whitespace-nowrap text-xs">
                                            {company.lowestPriceFormatted}
                                          </Badge>
                                        </div>
                                        {order.hours_count && (
                                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {(() => {
                                              const totalPrice = company.lowestPrice;
                                              const pricePerHour = totalPrice / order.hours_count;
                                              const currency = company.lowestPriceFormatted.replace(/[\d.,]/g, '').trim() || '';
                                              return `${pricePerHour.toFixed(2)} ${currency}/ساعة × ${order.hours_count} ساعات`;
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                      {/* Only show these buttons to users with appropriate permissions */}
                                      {(canManageOrders || !isCompanyView) && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="flex-1"
                            onClick={() => {
                              const url = `${window.location.origin}/company-booking/${order.id}/${company.companyId}`;
                              window.location.href = url;
                            }}
                                          >
                                            <Building2 className="h-3 w-3 mr-2" />
                                            {t.enterCompanyPage}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const url = `${window.location.origin}/company-booking/${order.id}/${company.companyId}`;
                                              navigator.clipboard.writeText(url);
                                              toast({
                                                title: t.linkCopiedSuccess,
                                                description: t.linkCopiedSuccessDesc,
                                              });
                                            }}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">{t.noQuotes}</span>
                            );
                          })()
                        ) : (filter === 'confirmed' || filter === 'in-progress' || filter === 'completed') ? (
                          // Show accepted specialist info for confirmed, in-progress, and completed orders
                          (() => {
                            const acceptedSpecialist = order.order_specialists?.find(os => os.is_accepted === true);
                            if (acceptedSpecialist) {
                              return (
                                <div className="bg-muted/50 rounded-md p-3 border border-border">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-primary" />
                                      <span className="text-sm font-semibold text-primary">
                                        {acceptedSpecialist.specialists?.companies?.name || 'Company'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">
                                        {acceptedSpecialist.specialists?.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span dir="ltr">{acceptedSpecialist.specialists?.phone}</span>
                                    </div>
                                    {acceptedSpecialist.quoted_price && (
                                      <div className="space-y-1">
                                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-sm">
                                          {acceptedSpecialist.quoted_price}
                                        </Badge>
                                        {order.hours_count && (
                                          <div className="text-xs text-muted-foreground">
                                            {(() => {
                                              const totalPrice = parseFloat(acceptedSpecialist.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                                              const pricePerHour = totalPrice / order.hours_count;
                                              const currency = acceptedSpecialist.quoted_price?.replace(/[\d.,]/g, '').trim() || '';
                                              return `${pricePerHour.toFixed(2)} ${currency}/ساعة × ${order.hours_count} ساعات`;
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return order.notes ? (
                              <p className="text-sm max-w-xs line-clamp-2">{order.notes}</p>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            );
                          })()
                        ) : (
                          // Show customer notes only
                          order.notes ? (
                            <div className="text-sm max-w-xs line-clamp-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800/30">
                              <span className="text-blue-900 dark:text-blue-100">{order.notes}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )
                        )}
                      </TableCell>
                      
                      {/* Readiness Status Column - For confirmed, upcoming and in-progress */}
                      {(filter === 'confirmed' || filter === 'upcoming' || filter === 'in-progress') && (
                        <TableCell>
                          <ReadinessStatusIndicator
                            bookingDate={order.booking_date}
                            bookingTime={order.booking_time}
                            readinessCheckSentAt={order.readiness_check_sent_at}
                            specialistReadinessStatus={order.specialist_readiness_status}
                            specialistReadinessResponseAt={order.specialist_readiness_response_at}
                            specialistNotReadyReason={order.specialist_not_ready_reason}
                            canManage={canManageOrders}
                            onReassign={() => openResendDialog(order)}
                          />
                        </TableCell>
                      )}
                      
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {formatDate(order.created_at)}
                          </div>
                          <StatusBadge status={order.status} />
                          {order.tracking_stage && (
                            <TrackingStageBadge stage={order.tracking_stage} />
                          )}
                          {isPending && (
                            <div className={`text-xs font-medium ${isDelayed ? 'text-destructive' : isRecentlySent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {isDelayed 
                                ? t.noResponseSince.replace('{minutes}', minutesSinceSent.toString())
                                : t.sentWaiting.replace('{minutes}', minutesSinceSent.toString())
                              }
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Show resend button for pending orders and orders without quotes */}
                          {canManageOrders && (filter === 'new' || filter === 'pending' || (filter === 'awaiting-response' && !isCompanyView)) && (
                            <>
                              <Button
                                size="sm"
                                variant={isRecentlySent ? "destructive" : "default"}
                                onClick={() => openResendDialog(order)}
                                disabled={isRecentlySent || isOrderProcessing}
                                className="flex items-center gap-1"
                              >
                                 {isOrderProcessing ? (
                                  <>
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    {t.sending}
                                  </>
                                ) : isRecentlySent ? (
                                  <>
                                    <Send className="h-3 w-3" />
                                    {getRemainingTime(order)}
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3" />
                                    {t.resend}
                                  </>
                                )}
                              </Button>

                              {isPending && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={Boolean(isOrderProcessing)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openSendDialog(order)}>
                                      <Building2 className="h-4 w-4 mr-2" />
                                      {t.change}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopyOrderLink(order)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      {language === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => sendOrderLinkViaWhatsApp(order)}>
                                      <Send className="h-4 w-4 mr-2" />
                                      {language === 'ar' ? 'إرسال واتساب' : 'Send WhatsApp'}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </>
                          )}
                          
                          {/* Show reset button for overdue confirmed orders */}
                          {canManageOrders && filter === 'confirmed' && isOverdue && !isCompanyView && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openResendDialog(order)}
                              disabled={isOrderProcessing}
                              className="flex items-center gap-1 animate-pulse"
                            >
                              {isOrderProcessing ? (
                                <>
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  {language === 'ar' ? 'جاري...' : 'Processing...'}
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  {language === 'ar' ? 'إعادة إرسال' : 'Resend'}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Resend Options Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.resendOrderTitle}</DialogTitle>
            <DialogDescription>
              {t.resendOrderDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t.resendOrderQuestion}
            </p>

            {selectedOrder && (
              <div className="space-y-3">
                <Button
                  onClick={() => handleSendToAll(selectedOrder.id)}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                >
                  <div className="flex flex-col items-start gap-1 text-left">
                    <div className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4" />
                      {t.sendToAllCompanies}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.broadcastDesc}
                    </span>
                  </div>
                </Button>

                {selectedOrder.company_id && (
                  <>
                    <Button
                      onClick={() => handleResendToSameCompany(selectedOrder)}
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                    >
                      <div className="flex flex-col items-start gap-1 text-left">
                        <div className="flex items-center gap-2 font-medium">
                          <Building2 className="h-4 w-4" />
                          {t.resendToSameCompany}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedOrder.companies?.name ? t.sendAgainToCompany.replace('{company}', selectedOrder.companies.name) : t.sendAgainToSameCompany}
                        </span>
                      </div>
                    </Button>

                    <Button
                      onClick={() => handleResendToSameSpecialists(selectedOrder)}
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                    >
                      <div className="flex flex-col items-start gap-1 text-left">
                        <div className="flex items-center gap-2 font-medium">
                          <User className="h-4 w-4" />
                          {t.resendToSameSpecialists}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t.sendAgainToSpecialists}
                        </span>
                      </div>
                    </Button>
                  </>
                )}
                
                {/* Reset Order Option - For overdue confirmed orders */}
                {(filter === 'confirmed' && isOrderOverdue(selectedOrder)) && (
                  <div className="pt-3 border-t">
                    <Button
                      onClick={() => handleResetAndResendOrder(selectedOrder.id)}
                      variant="destructive"
                      className="w-full justify-start h-auto py-4"
                    >
                      <div className="flex flex-col items-start gap-1 text-left">
                        <div className="flex items-center gap-2 font-medium">
                          <Clock className="h-4 w-4" />
                          {language === 'ar' ? 'إعادة تعيين الطلب وإرساله من جديد' : 'Reset & Resend Order'}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {language === 'ar' 
                            ? 'إلغاء الحجز الحالي وإعادة الطلب إلى قائمة الطلبات الجديدة لإرساله لشركات أخرى' 
                            : 'Cancel current booking and reset order to new orders to send to other companies'}
                        </span>
                      </div>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Company Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.sendOrderToCompany}</DialogTitle>
            <DialogDescription>
              {t.selectCompanyDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">{t.selectCompanyRequired}</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.chooseCompany} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompanyId && specialists.length > 0 && (
              <div className="space-y-3">
                <Label>{t.selectSpecialistsOptional}</Label>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-3">
                  {specialists.map((specialist) => (
                    <label
                      key={specialist.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSpecialistIds.includes(specialist.id)}
                        onChange={() => toggleSpecialist(specialist.id)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      {specialist.image_url ? (
                        <img 
                          src={specialist.image_url} 
                          alt={specialist.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">{specialist.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{specialist.phone}</span>
                          {specialist.specialty && (
                            <>
                              <span>•</span>
                              <span>{specialist.specialty}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedSpecialistIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t.specialistsSelected.replace('{count}', selectedSpecialistIds.length.toString())}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t.leaveEmpty}
                </p>
              </div>
            )}

            {selectedCompanyId && specialists.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t.noSpecialists}
              </p>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSendToCompany}
                disabled={!selectedCompanyId}
                className="flex-1"
              >
                {t.sendOrder}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(false)}
              >
                {tCommon.cancel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Specialist Profile Dialog */}
      {selectedSpecialistId && (
        <SpecialistProfileDialog
          open={specialistProfileOpen}
          onOpenChange={setSpecialistProfileOpen}
          specialist={{ id: selectedSpecialistId } as any}
          language={language}
          hideIdCards={false}
        />
      )}
    </Card>
  );
}
