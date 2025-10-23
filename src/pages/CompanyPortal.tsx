import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Package, Clock, CheckCircle, Users, UserCog, Calendar, Plus, FileCheck, BarChart } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderForm } from "@/components/orders/order-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";

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
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  tracking_stage?: string | null;
  notes?: string;
  order_link?: string;
  created_at: string;
  updated_at: string;
  send_to_all_companies?: boolean;
  booking_type?: string | null;
  hours_count?: string | null;
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
}

export default function CompanyPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission, isOwner } = useCompanyUserPermissions(user?.id);
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    awaitingResponse: 0,
    upcoming: 0,
    inProgress: 0,
    completed: 0,
  });

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
          service_type,
          status,
          tracking_stage,
          notes,
          order_link,
          created_at,
          updated_at,
          send_to_all_companies,
          booking_type,
          hours_count,
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
    const awaitingOrders = ordersList.filter(o => {
      const companySpecialists = o.order_specialists?.filter(os => 
        os.specialists?.company_id === company?.id
      );
      return companySpecialists && 
             companySpecialists.some(os => os.quoted_price && os.is_accepted === null);
    });
    
    // Upcoming (القادمة): تم قبول عرض محترفة من الشركة لكن لم يبدأ التتبع بعد
    const upcomingOrders = ordersList.filter(o => {
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const notStartedTracking = !o.tracking_stage;
      const notCompleted = o.status !== 'completed';
      
      return hasAcceptedSpecialist && notStartedTracking && notCompleted;
    });
    
    // In Progress (تحت الإجراء): تم قبول عرض محترفة من الشركة وبدأ المحترف في التتبع
    const inProgressOrders = ordersList.filter(o => {
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const trackingStage = o.tracking_stage;
      return hasAcceptedSpecialist && 
             trackingStage && 
             ['moving', 'arrived', 'working', 'invoice_requested'].includes(trackingStage);
    });
    
    // Completed (منتهية): تم إكمال الطلب لمحترفة من الشركة
    const completedOrders = ordersList.filter(o => {
      const hasAcceptedSpecialist = o.order_specialists?.some(os => 
        os.is_accepted === true && os.specialists?.company_id === company?.id
      );
      const trackingStage = o.tracking_stage;
      return hasAcceptedSpecialist && 
             (trackingStage === 'payment_received' || o.status === 'completed');
    });
    
    setStats({
      total: ordersList.length,
      pending: pendingOrders.length,
      awaitingResponse: awaitingOrders.length,
      upcoming: upcomingOrders.length,
      inProgress: inProgressOrders.length,
      completed: completedOrders.length,
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
        const { sendWhatsAppMessage } = await import('@/lib/whatsappHelper');
        await sendWhatsAppMessage({
          to: orderData.whatsappNumber,
          message: `تم إنشاء طلبك بنجاح\n\nرقم الطلب: ${order.order_number}\n\nيمكنك متابعة طلبك من خلال الرابط:\n${orderLink}`,
          customerName: orderData.customerName
        });
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
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
              ) : (
                <Building2 className="h-16 w-16 text-primary" />
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

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
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
          <div onClick={() => setFilter('upcoming')} className="cursor-pointer">
            <StatsCard
              title="Upcoming"
              value={stats.upcoming}
              icon={<Calendar className="h-4 w-4" />}
              variant="success"
              isActive={filter === 'upcoming'}
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
        />
      </main>

      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
