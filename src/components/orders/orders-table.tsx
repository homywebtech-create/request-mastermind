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
import { Calendar, Phone, User, Wrench, Building2, ExternalLink, Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      };
    };
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
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied, filter, onFilterChange, isCompanyView = false, companyId }: OrdersTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSpecialistIds, setSelectedSpecialistIds] = useState<string[]>([]);

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
        const companySpecialists = order.order_specialists?.filter(os => 
          os.specialists?.company_id === companyId
        );
        return companySpecialists && 
               companySpecialists.some(os => os.quoted_price && os.is_accepted === null);
      } else {
        // For admin: show orders with any quotes not yet accepted
        return order.order_specialists && 
               order.order_specialists.some(os => os.quoted_price) &&
               !order.order_specialists.some(os => os.is_accepted === true);
      }
    }
    
    if (filter === 'upcoming') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialist was accepted but not started tracking
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const notStartedTracking = !order.tracking_stage;
        const notCompleted = order.status !== 'completed';
        return hasAcceptedSpecialist && notStartedTracking && notCompleted;
      } else {
        // For admin: show orders with accepted quotes but not started tracking
        const hasAcceptedQuote = order.order_specialists && 
                                 order.order_specialists.some(os => os.is_accepted === true);
        const notStartedTracking = !order.tracking_stage || order.tracking_stage === null;
        const notCompleted = order.status !== 'completed';
        return hasAcceptedQuote && notStartedTracking && notCompleted;
      }
    }
    
    if (filter === 'in-progress') {
      if (isCompanyView && companyId) {
        // For companies: show orders where company specialist was accepted and is tracking
        const hasAcceptedSpecialist = order.order_specialists?.some(os => 
          os.is_accepted === true && os.specialists?.company_id === companyId
        );
        const trackingStage = order.tracking_stage;
        return hasAcceptedSpecialist && 
               trackingStage && 
               ['moving', 'arrived', 'working', 'invoice_requested'].includes(trackingStage);
      } else {
        // For admin: show orders with active tracking
        return order.tracking_stage && 
               order.tracking_stage !== null &&
               ['moving', 'arrived', 'working', 'invoice_requested'].includes(order.tracking_stage);
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
  const getCompanyQuotes = (order: Order): CompanyQuoteGroup[] => {
    if (!order.order_specialists) return [];
    
    const companyMap = new Map<string, CompanyQuoteGroup>();

    order.order_specialists
      .filter(os => os.quoted_price && os.is_accepted === null)
      .forEach(os => {
        const companyId = os.specialists?.companies?.id;
        const companyName = os.specialists?.companies?.name || 'Unknown Company';
        
        // Extract numeric value from price string (e.g., "24 QAR" -> 24)
        const priceMatch = os.quoted_price?.match(/(\d+(\.\d+)?)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : Infinity;
        
        if (!companyId) return;

        if (!companyMap.has(companyId)) {
          companyMap.set(companyId, {
            companyId,
            companyName,
            lowestPrice: price,
            lowestPriceFormatted: os.quoted_price || '',
            quotesCount: 1,
            specialists: [os]
          });
        } else {
          const existing = companyMap.get(companyId)!;
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

  const getTimeSinceSent = (order: Order) => {
    const now = new Date();
    const sentTime = order.last_sent_at ? new Date(order.last_sent_at) : new Date(order.created_at);
    const diffInMinutes = Math.floor((now.getTime() - sentTime.getTime()) / (1000 * 60));
    return diffInMinutes;
  };

  const isOverThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) > 3;
  };

  const isWithinThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) <= 3;
  };

  const handleCopyOrderLink = async (order: Order) => {
    try {
      const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
      await navigator.clipboard.writeText(orderLink);
      
      onLinkCopied(order.id);
      
      toast({
        title: "Link Copied",
        description: "Order link copied and shared with the team",
      });
    } catch (error) {
      toast({
        title: "Copy Error",
        description: "Error copying link",
        variant: "destructive",
      });
    }
  };

  const sendOrderLinkViaWhatsApp = (order: Order) => {
    if (!order.customers?.whatsapp_number) {
      toast({
        title: "Error",
        description: "WhatsApp number not available",
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
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    onLinkCopied(order.id);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, '_blank');
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

      // Update order status to in-progress
      await supabase
        .from('orders')
        .update({ status: 'in-progress' })
        .eq('id', orderId);

      toast({
        title: "عرض مقبول",
        description: "تم قبول عرض السعر بنجاح",
      });

      // Refresh orders
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "خطأ",
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
        title: "عرض مرفوض",
        description: "تم رفض عرض السعر",
      });

      // Refresh orders
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "خطأ",
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
        title: "Error",
        description: "Failed to load companies",
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
    try {
      // 1) Read existing assignments (avoid DELETE which requires admin)
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

      // 3) Insert only missing specialists (no DELETE needed)
      const missing = (allSpecialists || []).filter((s) => !existingSet.has(s.id));
      if (missing.length > 0) {
        const toInsert = missing.map((s) => ({ order_id: orderId, specialist_id: s.id }));
        const { error: insertError } = await supabase
          .from('order_specialists')
          .insert(toInsert);
        if (insertError) throw insertError;
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

      toast({
        title: 'Success',
        description: `Order broadcasted to ${allSpecialists?.length || 0} active specialists`,
      });

      setResendDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleResendToSameCompany = async (order: Order) => {
    try {
      if (!order.company_id) {
        toast({
          title: 'Error',
          description: 'No company assigned for this order',
          variant: 'destructive',
        });
        return;
      }

      // Read existing assignments (avoid DELETE which requires admin)
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

      toast({
        title: 'Success',
        description: `Order re-sent to ${companySpecialists?.length || 0} specialist(s) in the company`,
      });

      setResendDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleResendToSameSpecialists = async (order: Order) => {
    try {
      // Get current specialists for this order
      const { data: currentSpecialists, error: fetchError } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', order.id);

      if (fetchError) throw fetchError;

      if (!currentSpecialists || currentSpecialists.length === 0) {
        toast({
          title: 'Error',
          description: 'No specialists assigned to this order',
          variant: 'destructive',
        });
        return;
      }

      // No need to delete/re-insert. Just bump the timestamp to notify.
      const { error } = await supabase
        .from('orders')
        .update({
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Order re-sent to ${currentSpecialists.length} specialist(s)`,
      });

      setResendDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openResendDialog = async (order: Order) => {
    setSelectedOrder(order);

    setResendDialogOpen(true);
  };

  const handleSendToCompany = async () => {
    if (!selectedOrder || !selectedCompanyId) return;

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
        }
      }

      let description = "Order sent to company";
      if (selectedSpecialistIds.length > 0) {
        description = `Order sent to ${selectedSpecialistIds.length} specialist(s)`;
      } else {
        description = "Order sent to all company specialists";
      }

      toast({
        title: 'Success',
        description,
      });

      setSendDialogOpen(false);
      setSelectedOrder(null);
      setSelectedCompanyId('');
      setSelectedSpecialistIds([]);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
            Orders List
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={onFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="new">New Requests</SelectItem>
                <SelectItem value="awaiting-response">Awaiting Response</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {filteredOrders.length} orders
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto" dir="ltr">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Order #</TableHead>
                <TableHead className="text-left">Customer</TableHead>
                <TableHead className="text-left">Area</TableHead>
                <TableHead className="text-left">Customer Budget</TableHead>
                <TableHead className="text-left">Service</TableHead>
                <TableHead className="text-left">
                  {filter === 'awaiting-response' ? 'Company Quotes' : 'Notes'}
                </TableHead>
                <TableHead className="text-left">Date & Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No orders available
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const customerName = order.customers?.name || 'غير متوفر';
                  const customerPhone = order.customers?.whatsapp_number || 'غير متوفر';
                  const customerArea = order.customers?.area || '-';
                  const customerBudget = order.customers?.budget || '-';
                  const isPending = order.status === 'pending' && (order.company_id || order.send_to_all_companies);
                  const minutesSinceSent = getTimeSinceSent(order);
                  const isDelayed = isOverThreeMinutes(order) && isPending;
                  const isRecentlySent = isWithinThreeMinutes(order) && isPending;
                  
                  return (
                    <TableRow 
                      key={order.id}
                      className={isDelayed ? "bg-destructive/10 border-destructive/20" : isRecentlySent ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30" : ""}
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
                            <span className="text-xs text-muted-foreground italic">Hidden until quote accepted</span>
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
                                          {company.quotesCount} {company.quotesCount === 1 ? 'quote' : 'quotes'}
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 whitespace-nowrap text-xs">
                                          {company.lowestPriceFormatted}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="w-full"
                                        onClick={() => {
                                          const url = `${window.location.origin}/company-booking/${order.id}/${company.companyId}`;
                                          window.open(url, '_blank');
                                        }}
                                      >
                                        <Building2 className="h-3 w-3 mr-2" />
                                        Enter Company Page
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No quotes available</span>
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
                            <div className={`text-xs font-medium ${isDelayed ? 'text-destructive' : isRecentlySent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {isDelayed 
                                ? `⚠️ لا يوجد رد منذ ${minutesSinceSent} دقيقة`
                                : isRecentlySent 
                                  ? `✓ تم الإرسال، بانتظار الرد (${minutesSinceSent} دقيقة)`
                                  : `✓ تم الإرسال، بانتظار الرد (${minutesSinceSent} دقيقة)`
                              }
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant={isDelayed ? "destructive" : "outline"}
                                onClick={() => openResendDialog(order)}
                                disabled={!!isRecentlySent}
                                className="flex items-center gap-1"
                              >
                                <Send className="h-3 w-3" />
                                {isRecentlySent ? `Resend (${3 - minutesSinceSent}m)` : 'Resend'}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSendDialog(order)}
                                className="flex items-center gap-1"
                              >
                                <Building2 className="h-3 w-3" />
                                Change
                              </Button>
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
            <DialogTitle>Resend Order</DialogTitle>
            <DialogDescription>
              Choose how you want to resend this order to specialists
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to resend this order:
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
                      Send to All Companies
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Broadcast this order to all available companies
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
                          Resend to Same Company
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedOrder.companies?.name ? `Send again to ${selectedOrder.companies.name}` : 'Send again to the same company'}
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
                          Resend to Same Specialists
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Send again to the same specialists in the company
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
            <DialogTitle>Send Order to Company</DialogTitle>
            <DialogDescription>
              Select a company and optionally choose specific specialists
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Select Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
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
                <Label>Select Specialists (Optional)</Label>
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
                    {selectedSpecialistIds.length} specialist(s) selected
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Leave empty to send to all specialists in this company
                </p>
              </div>
            )}

            {selectedCompanyId && specialists.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No specialists available for this company
              </p>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSendToCompany}
                disabled={!selectedCompanyId}
                className="flex-1"
              >
                Send Order
              </Button>
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
