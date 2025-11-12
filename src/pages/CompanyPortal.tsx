import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";
import { useOrderReadinessNotifications } from "@/hooks/useOrderReadinessNotifications";
import { useOverdueConfirmedOrdersAlert } from "@/hooks/useOverdueConfirmedOrdersAlert";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Package, Clock, CheckCircle, Users, UserCog, Calendar, Plus, FileCheck, BarChart, XCircle, AlertCircle } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderForm } from "@/components/orders/order-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import SpecialistsLivePanel from "@/components/specialists/SpecialistsLivePanel";
import { CompanyChatButton } from "@/components/company/CompanyChatButton";

interface Company {
  id: string;
  name: string;
  name_en?: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
  currentUserName?: string;
  currentUserPhone?: string;
}

interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'waiting_quotes' | 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  tracking_stage?: string | null;
  notes?: string;
  order_link?: string;
  created_at: string;
  updated_at: string;
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
  specialist_id?: string | null;
  cleaning_equipment_required?: boolean | null;
  customers: {
    name: string;
    whatsapp_number: string;
    area?: string;
    budget?: string;
    budget_type?: string;
  };
  companies: {
    name: string;
  } | null;
  order_specialists?: Array<{
    id: string;
    quoted_price: string | null;
    quoted_at: string | null;
    is_accepted: boolean | null;
    specialist_id: string;
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

interface OrderStats {
  total: number;
  pending: number;
  awaitingResponse: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export default function CompanyPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  
  // Enable real-time notifications for order readiness
  useOrderReadinessNotifications();
  const { hasPermission, hasAnyPermission, isOwner } = useCompanyUserPermissions(user?.id);
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [hasOverdueConfirmedOrders, setHasOverdueConfirmedOrders] = useState(false);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    awaitingResponse: 0,
    upcoming: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });
  
  // Enable alerts for overdue confirmed orders
  const { snoozeOrder, isSnoozed, toggleMute, isMuted } = useOverdueConfirmedOrdersAlert(orders);
  
  // Listen for overdue confirmed orders event to update visual alert
  useEffect(() => {
    const handleOverdueOrders = (event: CustomEvent) => {
      const overdueOrderIds = event.detail?.orderIds || [];
      setHasOverdueConfirmedOrders(overdueOrderIds.length > 0);
    };
    
    window.addEventListener('overdue-confirmed-orders', handleOverdueOrders as EventListener);
    
    return () => {
      window.removeEventListener('overdue-confirmed-orders', handleOverdueOrders as EventListener);
    };
  }, []);

  useEffect(() => {
    checkAuth();
    
    // Subscribe to realtime changes for orders
    const ordersChannel = supabase
      .channel('company-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          if (company) {
            fetchOrders(company.id);
          }
        }
      )
      .subscribe();

    // Subscribe to realtime changes for order_specialists (quotes)
    const quotesChannel = supabase
      .channel('company-order-specialists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists'
        },
        () => {
          if (company) {
            fetchOrders(company.id);
            toast({
              title: "تحديث",
              description: "تم استلام عرض سعر جديد من محترف",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, [company]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/company-auth");
        return;
      }

      // الحصول على معلومات الشركة
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, full_name, phone")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "Error",
          description: "No company found associated with this account",
          variant: "destructive",
        });
        navigate("/company-auth");
        return;
      }

      // جلب معلومات الشركة
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();

      if (companyError) throw companyError;
      
      // إضافة معلومات المستخدم للشركة
      setCompany({
        ...companyData,
        currentUserName: profile.full_name,
        currentUserPhone: profile.phone,
      });

      // جلب الطلبات
      fetchOrders(profile.company_id);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async (companyId: string) => {
    try {
      // جلب جميع الطلبات مع بيانات المحترفات (نفس ما يظهر في لوحة الأدمن)
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_id,
          company_id,
          specialist_id,
          service_type,
          status,
          tracking_stage,
          notes,
          order_link,
          created_at,
          updated_at,
          send_to_all_companies,
          booking_type,
          booking_date,
          booking_date_type,
          booking_time,
          hours_count,
          building_info,
          gps_latitude,
          gps_longitude,
          cancelled_by,
          cancelled_by_role,
          cancellation_reason,
          cancelled_at,
          cleaning_equipment_required,
          customers (name, whatsapp_number, area, budget, budget_type),
          companies (name),
          order_specialists (
            id,
            quoted_price,
            quoted_at,
            is_accepted,
            specialist_id,
            specialists (
              id,
              name,
              phone,
              nationality,
              image_url,
              company_id,
              companies (
                id,
                name
              )
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // عرض جميع الطلبات (مثل لوحة الأدمن)
      setOrders((data as Order[]) || []);
      calculateStats((data as Order[]) || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "خطأ",
        description: "خطأ في تحميل الطلبات",
        variant: "destructive",
      });
    }
  };

  const calculateStats = (ordersList: Order[]) => {
    // New Orders (الطلبات الجديدة): جميع الطلبات pending بدون أي عروض من أي شركة
    const pendingOrders = ordersList.filter(o => 
      o.status === 'pending' && 
      (!o.order_specialists || o.order_specialists.length === 0 || 
       o.order_specialists.every(os => !os.quoted_price))
    );
    
    // Awaiting Response (بانتظار الرد): تم تقديم عرض من محترفات الشركة ولم يتم قبوله بعد
    // نفس منطق orders-table للشركات
    const awaitingOrders = ordersList.filter(o => {
      // استبعاد الطلبات المؤكدة (التي لديها specialist_id أو status=upcoming)
      const hasSpecialistAssigned = o.specialist_id != null;
      const isUpcoming = o.status === 'upcoming';
      
      if (hasSpecialistAssigned || isUpcoming) {
        console.log(`❌ Order ${o.order_number} excluded from Awaiting: has_specialist=${hasSpecialistAssigned}, status=${o.status}`);
        return false;
      }
      
      const companySpecialists = o.order_specialists?.filter(os => 
        os.specialists?.company_id === company?.id
      );
      const hasQuoteNotAccepted = companySpecialists && 
                                   companySpecialists.some(os => os.quoted_price && os.is_accepted !== true);
      const noAcceptedQuote = !companySpecialists?.some(os => os.is_accepted === true);
      const noAcceptedQuoteFromAnyCompany = !o.order_specialists?.some(os => os.is_accepted === true);
      const notStartedTracking = !o.tracking_stage || o.tracking_stage === null;
      const notCompleted = o.status !== 'completed';
      
      return hasQuoteNotAccepted && noAcceptedQuote && noAcceptedQuoteFromAnyCompany && notStartedTracking && notCompleted;
    });
    
    console.log(`✅ Company ${company?.name} Awaiting Response orders:`, awaitingOrders.length);
    
    // Upcoming (القادمة): تم قبول عرض محترفة من الشركة أو له specialist_id من شركتنا
    const upcomingOrders = ordersList.filter(o => {
      // نفس منطق orders-table للشركات في فلتر 'confirmed'/'upcoming'
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const hasAssignedSpecialistFromCompany = o.specialist_id && 
        o.order_specialists?.some(os => 
          os.specialist_id === o.specialist_id && os.specialists?.company_id === company?.id
        );
      const isUpcoming = o.status === 'upcoming';
      const notStartedTracking = !o.tracking_stage || o.tracking_stage === null;
      const notCompleted = o.status !== 'completed';
      const notCancelled = o.status !== 'cancelled';
      
      const result = (hasAcceptedSpecialist || hasAssignedSpecialistFromCompany || (isUpcoming && hasAssignedSpecialistFromCompany)) && 
             notStartedTracking && notCompleted && notCancelled;
      
      if (result) {
        console.log(`✅ Order ${o.order_number} is confirmed for company ${company?.name}`, {
          hasAcceptedSpecialist,
          hasAssignedSpecialistFromCompany,
          isUpcoming,
          specialist_id: o.specialist_id
        });
      }
      
      return result;
    });
    
    console.log(`✅ Company ${company?.name} Confirmed orders:`, upcomingOrders.length, upcomingOrders.map(o => o.order_number));
    
    // In Progress (تحت الإجراء): بدأ التتبع لمحترفة من الشركة
    const inProgressOrders = ordersList.filter(o => {
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const hasAssignedSpecialistFromCompany = o.specialist_id && 
        o.order_specialists?.some(os => 
          os.specialist_id === o.specialist_id && os.specialists?.company_id === company?.id
        );
      const trackingStarted = o.tracking_stage && 
             ['moving', 'arrived', 'working', 'invoice_requested'].includes(o.tracking_stage);
      
      return (hasAcceptedSpecialist || hasAssignedSpecialistFromCompany) && trackingStarted;
    });
    
    // Completed (منتهية): تم إكمال الطلب لمحترفة من الشركة
    const completedOrders = ordersList.filter(o => {
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const hasAssignedSpecialistFromCompany = o.specialist_id && 
        o.order_specialists?.some(os => 
          os.specialist_id === o.specialist_id && os.specialists?.company_id === company?.id
        );
      const isCompleted = o.tracking_stage === 'payment_received' || o.status === 'completed';
      
      return (hasAcceptedSpecialist || hasAssignedSpecialistFromCompany) && isCompleted;
    });
    
    // Cancelled (ملغاة): الطلبات الملغاة للشركة
    const cancelledOrders = ordersList.filter(o => 
      o.status === 'cancelled' && 
      (o.company_id === company?.id || o.send_to_all_companies)
    );
    
    setStats({
      total: ordersList.length,
      pending: pendingOrders.length,
      awaitingResponse: awaitingOrders.length,
      upcoming: upcomingOrders.length,
      inProgress: inProgressOrders.length,
      completed: completedOrders.length,
      cancelled: cancelledOrders.length,
    });
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Order status updated",
      });
    }
  };

  const handleLinkCopied = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'in-progress',
        link_copied_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateOrder = async (orderData: any) => {
    try {
      // First, check if customer exists or create new one
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp_number', orderData.whatsappNumber)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: orderData.customerName,
            whatsapp_number: orderData.whatsappNumber,
            area: orderData.area,
            budget: orderData.budget,
            budget_type: orderData.budgetType,
            company_id: company?.id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      } else {
        await supabase
          .from('customers')
          .update({
            name: orderData.customerName,
            area: orderData.area,
            budget: orderData.budget,
            budget_type: orderData.budgetType,
          })
          .eq('id', customerId);
      }

      // Create the order with company_id and send_to_all_companies = false
      const orderLink = `${window.location.origin}/order/${Date.now()}`;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: company?.id, // Set company_id
          service_type: orderData.serviceType,
          status: 'pending',
          notes: orderData.notes,
          order_link: orderLink,
          hours_count: orderData.hoursCount,
          send_to_all_companies: false, // Always false for company orders
          booking_type: orderData.bookingType,
          booking_date: orderData.bookingDate,
          booking_time: orderData.bookingTime,
          gps_latitude: orderData.gpsLatitude,
          gps_longitude: orderData.gpsLongitude,
          building_info: orderData.buildingInfo,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Get specialists from the company only
      let specialistsToLink: string[] = [];
      
      if (orderData.specialistIds && orderData.specialistIds.length > 0) {
        specialistsToLink = orderData.specialistIds;
      } else {
        // Get all active specialists from this company
        const { data: companySpecialists } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', company?.id)
          .eq('is_active', true);

        specialistsToLink = companySpecialists?.map(s => s.id) || [];
      }

      // Link specialists to order
      if (specialistsToLink.length > 0) {
        const orderSpecialists = specialistsToLink.map(specialistId => ({
          order_id: order.id,
          specialist_id: specialistId,
        }));

        const { error: linkError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

      if (linkError) throw linkError;
      }

      // Send WhatsApp notification to customer
      try {
        // Get customer language preference
        const { data: customerData } = await supabase
          .from('customers')
          .select('preferred_language')
          .eq('id', customerId)
          .single();

        const customerLanguage = (customerData?.preferred_language || 'ar') as 'ar' | 'en';
        
        const { sendTemplateMessage } = await import('@/lib/whatsappTemplateHelper');
        await sendTemplateMessage(
          orderData.whatsappNumber,
          'order_created',
          customerLanguage,
          {
            customer_name: orderData.customerName,
            order_number: order.order_number || order.id,
            service_type: orderData.serviceType,
            booking_date: orderData.bookingDate || (language === 'ar' ? 'سيتم التحديد لاحقاً' : 'To be determined')
          }
        );
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError);
        // Don't fail the order creation if WhatsApp fails
      }

      toast({
        title: "تم إنشاء الطلب بنجاح / Order Created Successfully",
        description: `رقم الطلب: ${order.order_number}`,
      });

      setShowOrderForm(false);
      fetchOrders(company!.id);
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "خطأ / Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/company-auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img 
                  src={company.logo_url} 
                  alt={company.name}
                  className="h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow-lg ring-2 ring-border hover:ring-primary/50 transition-all"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/30 shadow-lg">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-cairo">
                  {company.name}
                </h1>
                {company.name_en && (
                  <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground">
                    {company.name_en}
                  </h2>
                )}
                {/* Current user info only */}
                {company.currentUserName && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>{company.currentUserName}</span>
                    {company.currentUserPhone && (
                      <span className="text-xs">({company.currentUserPhone})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              
              <Button
                variant={isMuted ? "outline" : "default"}
                size="icon"
                onClick={toggleMute}
                title={isMuted ? (language === 'ar' ? "تفعيل تنبيهات الطلبات المتأخرة" : "Enable Overdue Alerts") : (language === 'ar' ? "كتم تنبيهات الطلبات المتأخرة" : "Mute Overdue Alerts")}
              >
                <AlertCircle className={`h-4 w-4 ${isMuted ? 'opacity-50' : ''}`} />
              </Button>
              
              {/* Support Chat Button */}
              <CompanyChatButton 
                companyId={company.id}
                companyName={company.name}
              />
              
              {/* Team Management - only for users with manage_team permission */}
              {hasPermission('manage_team') && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/company/team")}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'الفريق' : 'Team'}</span>
                </Button>
              )}
              
              {/* Statistics - only for users with view_reports or view_statistics permission */}
              {(hasPermission('view_reports') || hasPermission('view_statistics')) && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/company/statistics")}
                  className="flex items-center gap-2"
                >
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'الإحصائيات' : 'Statistics'}</span>
                </Button>
              )}
              
              {/* Contracts - only for users with view/manage contracts permission */}
              {hasAnyPermission(['view_contracts', 'manage_contracts']) && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/company/contracts")}
                  className="flex items-center gap-2"
                >
                  <FileCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'العقود' : 'Contracts'}</span>
                </Button>
              )}
              
              {/* Specialists - only for users with view/manage specialists permission */}
              {hasAnyPermission(['view_specialists', 'manage_specialists']) && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/specialists")}
                  className="flex items-center gap-2"
                >
                  <UserCog className="h-4 w-4" />
                  <span className="hidden sm:inline">Specialists</span>
                </Button>
              )}
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
              <div onClick={() => setFilter('new')} className="cursor-pointer">
                <StatsCard
                  title="New Orders"
                  value={stats.pending}
                  icon={<Package className="h-4 w-4" />}
                  variant="pending"
                  isActive={filter === 'new'}
                />
              </div>
              <div onClick={() => setFilter('awaiting-response')} className="cursor-pointer">
                <StatsCard
                  title="Awaiting Response"
                  value={stats.awaitingResponse}
                  icon={<Clock className="h-4 w-4" />}
                  variant="awaiting"
                  isActive={filter === 'awaiting-response'}
                />
              </div>
              <div onClick={() => setFilter('confirmed')} className="cursor-pointer">
                <StatsCard
                  title="الطلبات المؤكدة / Confirmed"
                  value={stats.upcoming}
                  icon={<Calendar className="h-4 w-4" />}
                  variant="success"
                  isActive={filter === 'confirmed'}
                  hasOverdueAlert={hasOverdueConfirmedOrders}
                />
              </div>
              <div onClick={() => setFilter('in-progress')} className="cursor-pointer">
                <StatsCard
                  title="In Progress"
                  value={stats.inProgress}
                  icon={<Users className="h-4 w-4" />}
                  variant="warning"
                  isActive={filter === 'in-progress'}
                />
              </div>
              <div onClick={() => setFilter('completed')} className="cursor-pointer">
                <StatsCard
                  title="Completed"
                  value={stats.completed}
                  icon={<CheckCircle className="h-4 w-4" />}
                  variant="success"
                  isActive={filter === 'completed'}
                />
              </div>
              <div onClick={() => setFilter('cancelled')} className="cursor-pointer">
                <StatsCard
                  title={language === 'ar' ? 'ملغاة' : 'Cancelled'}
                  value={stats.cancelled}
                  icon={<XCircle className="h-4 w-4" />}
                  variant="destructive"
                  isActive={filter === 'cancelled'}
                />
              </div>
            </div>

            {/* New Order Button - only for users with manage_orders permission */}
            {hasPermission('manage_orders') && (
              <div className="flex justify-start">
                <Button
                  onClick={() => setShowOrderForm(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>طلب جديد / New Order</span>
                </Button>
              </div>
            )}

            <OrdersTable
              orders={orders}
              onUpdateStatus={handleUpdateStatus}
              onLinkCopied={handleLinkCopied}
              filter={filter}
              onFilterChange={setFilter}
              isCompanyView={true}
              companyId={company.id}
              isSnoozed={isSnoozed}
            />
          </div>

          {/* Specialists Live Panel */}
          <div className="w-80 lg:w-96 hidden lg:block">
            <div className="sticky top-6">
              <SpecialistsLivePanel 
                companyId={company.id} 
                isAdmin={false}
              />
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-[99vw] w-[99vw] max-h-[96vh] overflow-y-auto p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              طلب جديد / New Order
            </DialogTitle>
          </DialogHeader>
          <OrderForm 
            onSubmit={handleCreateOrder}
            onCancel={() => setShowOrderForm(false)}
            isCompanyView={true}
            companyId={company.id}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
