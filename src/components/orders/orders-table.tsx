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
import { Calendar, Phone, User, Wrench, Building2, ExternalLink, Send, Users, Copy } from "lucide-react";
import { openWhatsApp as openWhatsAppHelper } from "@/lib/externalLinks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";

interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  tracking_stage?: string | null;
  notes?: string;
  order_link?: string;
  created_at: string;
  last_sent_at?: string;
  send_to_all_companies?: boolean;
  booking_type?: string | null;
  booking_date?: string | null;
  hours_count?: string | null;
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
  onRefreshOrders?: () => Promise<void>;
  filter: string;
  onFilterChange: (filter: string) => void;
  isCompanyView?: boolean;
  companyId?: string;
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied, onRefreshOrders, filter, onFilterChange, isCompanyView = false, companyId }: OrdersTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language).orders;
  const tCommon = useTranslation(language).common;
  const { user } = useAuth();
  const { role } = useUserRole();
  const { hasPermission } = useUserPermissions(user?.id, role);
  const { hasPermission: hasCompanyPermission } = useCompanyUserPermissions(user?.id);
  
  // Determine if user can manage orders based on view type
  const canManageOrders = isCompanyView 
    ? hasCompanyPermission('manage_orders')
    : hasPermission('manage_orders');
  
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSpecialistIds, setSelectedSpecialistIds] = useState<string[]>([]);
  
  // Track recently sent orders with timestamps
  const [recentlySentOrders, setRecentlySentOrders] = useState<Map<string, number>>(new Map());
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());

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
        // AND exclude orders that have started tracking (in progress)
        const companySpecialists = order.order_specialists?.filter(os => 
          os.specialists?.company_id === companyId
        );
        const hasQuoteNotAccepted = companySpecialists && 
                                     companySpecialists.some(os => os.quoted_price && os.is_accepted === null);
        const notInProgress = !order.tracking_stage && order.status !== 'completed';
        
        return hasQuoteNotAccepted && notInProgress;
      } else {
        // For admin: show orders with quotes but NO quote accepted yet
        const hasAnyAccepted = order.order_specialists?.some(os => os.is_accepted === true);
        const hasQuotes = order.order_specialists?.some(os => os.quoted_price);
        
        // Show only if has quotes AND no quote accepted yet
        return hasQuotes && !hasAnyAccepted;
      }
    }
    
    if (filter === 'upcoming') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialist was accepted but not started tracking yet
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const notStartedTracking = !order.tracking_stage;
        const notCompleted = order.status !== 'completed';
        return hasAcceptedSpecialist && notStartedTracking && notCompleted;
      } else {
        // For admin: show orders with accepted quotes but tracking hasn't started yet
        const hasAcceptedQuote = order.order_specialists && 
                                 order.order_specialists.some(os => os.is_accepted === true);
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        return hasAcceptedQuote && notStartedTracking && notCompleted;
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
        // For admin: show accepted orders with active tracking
        const hasAcceptedQuote = order.order_specialists?.some(os => os.is_accepted === true);
        const trackingStarted = order.tracking_stage && 
               order.tracking_stage !== null &&
               ['moving', 'arrived', 'working', 'invoice_requested'].includes(order.tracking_stage);
        return hasAcceptedQuote && trackingStarted;
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
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [recentlySentOrders]);

  const getTimeSinceSent = (order: Order) => {
    // Check local state first for immediate UI updates
    const localSentTime = recentlySentOrders.get(order.id);
    if (localSentTime) {
      const diffInMinutes = Math.floor((Date.now() - localSentTime) / (1000 * 60));
      return Math.max(0, diffInMinutes);
    }
    
    // Fall back to database time
    const now = new Date();
    const sentTime = order.last_sent_at ? new Date(order.last_sent_at) : new Date(order.created_at);
    const diffInMinutes = Math.floor((now.getTime() - sentTime.getTime()) / (1000 * 60));
    return Math.max(0, diffInMinutes);
  };

  const isOverThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) >= 3;
  };

  const isWithinThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) < 3;
  };

  const isReallyDelayed = (order: Order) => {
    return getTimeSinceSent(order) >= 15;
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

      // Mark order as sent locally for immediate UI update
      markOrderAsSent(orderId);
      
      // Refresh orders to get updated last_sent_at from database
      if (onRefreshOrders) {
        await onRefreshOrders();
      }
      
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

      // Mark order as sent locally for immediate UI update
      markOrderAsSent(order.id);
      
      // Refresh orders to get updated last_sent_at from database
      if (onRefreshOrders) {
        await onRefreshOrders();
      }
      
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

      // Mark order as sent locally for immediate UI update
      markOrderAsSent(order.id);
      
      // Refresh orders to get updated last_sent_at from database
      if (onRefreshOrders) {
        await onRefreshOrders();
      }
      
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
                <TableHead className="text-left">
                  {filter === 'awaiting-response' ? t.companyQuotes : t.notes}
                </TableHead>
                <TableHead className="text-left">{t.dateAndStatus}</TableHead>
                <TableHead className="text-left">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                  const minutesSinceSent = getTimeSinceSent(order);
                  // Show delayed status for all orders that can be resent, not just pending ones
                  const canShowResendButton = canManageOrders && (filter === 'new' || filter === 'pending' || (filter === 'awaiting-response' && !isCompanyView));
                  const isDelayed = isReallyDelayed(order) && canShowResendButton; // 15+ minutes without response
                  const isRecentlySent = isWithinThreeMinutes(order) && canShowResendButton; // < 3 minutes (waiting period)
                  const isOrderProcessing = isProcessing(order.id);
                  
                  return (
                    <TableRow 
                      key={order.id}
                      className={isDelayed ? "bg-destructive/10 border-destructive/20" : ""}
                    >
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {order.order_number || 'N/A'}
                        </Badge>
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
                        <Badge variant="outline">{order.service_type}</Badge>
                      </TableCell>

                      <TableCell>
                        {filter === 'awaiting-response' ? (
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
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                       <Badge variant="secondary" className="whitespace-nowrap text-xs">
                                          {company.quotesCount} {company.quotesCount === 1 ? t.quote : t.quotePlural}
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 whitespace-nowrap text-xs">
                                          {company.lowestPriceFormatted}
                                        </Badge>
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
                        ) : (filter === 'upcoming' || filter === 'in-progress' || filter === 'completed') ? (
                          // Show accepted specialist info for upcoming, in-progress, and completed orders
                          (() => {
                            const acceptedSpecialist = order.order_specialists?.find(os => os.is_accepted === true);
                            if (acceptedSpecialist) {
                              return (
                                <div className="bg-muted/50 rounded-md p-3 border border-border">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-primary" />
                                      <span className="text-sm font-semibold text-primary">
                                        {acceptedSpecialist.specialists.companies?.name || 'Company'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">
                                        {acceptedSpecialist.specialists.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span dir="ltr">{acceptedSpecialist.specialists.phone}</span>
                                    </div>
                                    {acceptedSpecialist.quoted_price && (
                                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                                        {acceptedSpecialist.quoted_price}
                                      </Badge>
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
                          // Show notes for other filters
                          order.notes ? (
                            <p className="text-sm max-w-xs line-clamp-2">{order.notes}</p>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )
                        )}
                      </TableCell>
                      
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
                            <div className={`text-xs font-medium ${isDelayed ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {isDelayed 
                                ? t.noResponseSince.replace('{minutes}', minutesSinceSent.toString())
                                : t.sentWaiting.replace('{minutes}', minutesSinceSent.toString())
                              }
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
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
                                    {t.resendIn.replace('{minutes}', Math.max(1, 3 - minutesSinceSent).toString())}
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3" />
                                    {t.resend} ({minutesSinceSent} min)
                                  </>
                                )}
                              </Button>

                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSendDialog(order)}
                                  disabled={Boolean(isOrderProcessing)}
                                  className="flex items-center gap-1"
                                >
                                  <Building2 className="h-3 w-3" />
                                  {t.change}
                                </Button>
                              )}
                            </>
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
    </Card>
  );
}
