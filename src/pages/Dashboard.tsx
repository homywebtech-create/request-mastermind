import { useState, useEffect, useRef } from "react";
import { OrderForm } from "@/components/orders/order-form";
import { OrdersTable } from "@/components/orders/orders-table";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, Clock, CheckCircle, Users, Building2, LogOut, Settings, Volume2, FileText, AlertCircle, MoreVertical, FileUser, UserCog, FileCheck, Briefcase, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { getSoundNotification } from "@/lib/soundNotification";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

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
    specialists: {
      id: string;
      name: string;
      phone: string;
      nationality: string | null;
      image_url: string | null;
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

export default function Dashboard() {
  const { language } = useLanguage();
  const tDash = useTranslation(language).dashboard;
  const tCommon = useTranslation(language).common;
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState<string>('pending');
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    awaitingResponse: 0,
    upcoming: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [suspendedSpecialistsCount, setSuspendedSpecialistsCount] = useState(0);
  const [pendingDeletionRequestsCount, setPendingDeletionRequestsCount] = useState(0);
  const [userProfile, setUserProfile] = useState<{ full_name: string; is_active: boolean } | null>(null);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const { hasPermission: userHasPermission } = useUserPermissions(user?.id, role);
  const navigate = useNavigate();
  const soundNotification = useRef(getSoundNotification());
  const previousOrdersCount = useRef<number>(0);
  const previousQuotesCount = useRef<number>(0);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, is_active')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setUserProfile(data);
      }
    };
    
    fetchUserProfile();
  }, [user?.id]);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = async () => {
      await soundNotification.current.initialize();
    };
    
    document.addEventListener('click', initAudio, { once: true });
    return () => document.removeEventListener('click', initAudio);
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchSuspendedSpecialistsCount();
    fetchPendingDeletionRequestsCount();
    
    // Subscribe to realtime changes for orders
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order detected:', payload);
          fetchOrders();
          
          // Play sound notification for new order (COMMENTED: Push notifications now handle this)
          // if (soundEnabled) {
          //   soundNotification.current.playNewOrderSound();
          // }
          
          toast({
            title: "🔔 طلب جديد",
            description: "تم إضافة طلب جديد للنظام",
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Subscribe to realtime changes for order_specialists (quotes)
    const quotesChannel = supabase
      .channel('order-specialists-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_specialists'
        },
        (payload) => {
          console.log('New order_specialist entry:', payload);
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_specialists'
        },
        (payload) => {
          console.log('Order specialist updated:', payload);
          const newRecord = payload.new as any;
          
          // Check if quoted_price was added (new quote)
          if (newRecord.quoted_price && soundEnabled) {
            soundNotification.current.playNewQuoteSound();
            toast({
              title: "💰 عرض سعر جديد",
              description: "تم استلام عرض سعر جديد من المحترف",
            });
          }
          
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, [soundEnabled]);

  const fetchSuspendedSpecialistsCount = async () => {
    const { count, error } = await supabase
      .from('specialists')
      .select('*', { count: 'exact', head: true })
      .or('suspension_type.eq.temporary,suspension_type.eq.permanent')
      .eq('is_active', false);

    if (!error && count !== null) {
      setSuspendedSpecialistsCount(count);
    }
  };

  const fetchPendingDeletionRequestsCount = async () => {
    const { count, error } = await supabase
      .from('deletion_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (!error && count !== null) {
      setPendingDeletionRequestsCount(count);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
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
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } else {
      setOrders((data as any) || []);
      calculateStats((data as any) || []);
    }
    setLoading(false);
  };

  const calculateStats = (ordersList: Order[]) => {
    // Pending: Orders with no quotes yet
    const pendingOrders = ordersList.filter(o => 
      o.status === 'pending' && 
      (o.company_id || o.send_to_all_companies) &&
      (!o.order_specialists || o.order_specialists.every(os => !os.quoted_price))
    );
    
    // Awaiting Response: Orders with at least one quote, not accepted yet
    const awaitingOrders = ordersList.filter(o => 
      o.order_specialists && 
      o.order_specialists.some(os => os.quoted_price) &&
      !o.order_specialists.some(os => os.is_accepted === true)
    );
    
    // Upcoming: Orders with accepted quotes but tracking hasn't started yet
    const upcomingOrders = ordersList.filter(o => {
      const hasAcceptedQuote = o.order_specialists && 
                               o.order_specialists.some(os => os.is_accepted === true);
      const notStartedTracking = !(o as any).tracking_stage;
      const notCompleted = o.status !== 'completed';
      
      return hasAcceptedQuote && notStartedTracking && notCompleted;
    });
    
    // In Progress: Orders where specialist has started tracking
    const inProgressOrders = ordersList.filter(o => {
      const trackingStage = (o as any).tracking_stage;
      return trackingStage && 
             ['moving', 'arrived', 'working', 'invoice_requested'].includes(trackingStage);
    });
    
    // Completed: Orders where payment received or status is completed
    const completedOrders = ordersList.filter(o => {
      const trackingStage = (o as any).tracking_stage;
      return trackingStage === 'payment_received' || o.status === 'completed';
    });
    
    setStats({
      total: ordersList.filter(o => o.company_id || o.send_to_all_companies).length,
      pending: pendingOrders.length,
      awaitingResponse: awaitingOrders.length,
      upcoming: upcomingOrders.length,
      inProgress: inProgressOrders.length,
      completed: completedOrders.length,
    });
  };

  const handleCreateOrder = async (formData: any) => {
    try {
      const whatsapp = (formData.whatsappNumber || '').trim();
      if (!whatsapp) {
        toast({ title: 'Error', description: 'WhatsApp number is required', variant: 'destructive' });
        return;
      }

      // First, create or get customer
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp_number', whatsapp)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: (formData.customerName || '').trim() || 'Customer',
            whatsapp_number: whatsapp,
            area: (formData.area || '').trim() || null,
            budget: formData.budget || null,
            budget_type: formData.budgetType || null,
            company_id: formData.companyId || null
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      } else {
        // Update existing customer with new budget info
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            name: (formData.customerName || '').trim() || 'Customer',
            area: (formData.area || '').trim() || null,
            budget: formData.budget || null,
            budget_type: formData.budgetType || null,
          })
          .eq('id', customerId);

        if (updateError) throw updateError;
      }

      // Create order link
      const orderLink = `${window.location.origin}/order/${Date.now()}`;

      // Create order and send to companies
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: formData.sendToAll ? null : formData.companyId,
          specialist_id: null,
          send_to_all_companies: formData.sendToAll || false,
          service_type: formData.serviceType,
          booking_type: formData.bookingType || null,
          hours_count: formData.hoursCount || null,
          notes: formData.notes,
          order_link: orderLink,
          created_by: user?.id,
          last_sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Send WhatsApp notification to customer
      try {
        const { sendWhatsAppMessage } = await import('@/lib/whatsappHelper');
        await sendWhatsAppMessage({
          to: whatsapp,
          message: `تم إنشاء طلبك بنجاح\n\nرقم الطلب: ${newOrder.id}\n\nيمكنك متابعة طلبك من خلال الرابط:\n${orderLink}`,
          customerName: formData.customerName
        });
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError);
        // Don't fail the order creation if WhatsApp fails
      }

      // If specific specialists are selected, insert into junction table
      if (formData.specialistIds && formData.specialistIds.length > 0) {
        // Check if pricing is fixed (not hourly/daily)
        const hasFixedPrice = formData.pricingType && 
                              !['hourly', 'daily'].includes(formData.pricingType) &&
                              formData.servicePrice;
        
        const orderSpecialists = formData.specialistIds.map(specialistId => ({
          order_id: newOrder.id,
          specialist_id: specialistId,
          // Auto-fill quoted_price for fixed pricing types
          ...(hasFixedPrice && {
            quoted_price: formData.servicePrice?.toString(),
            quoted_at: new Date().toISOString()
          })
        }));

        const { error: junctionError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        if (junctionError) throw junctionError;
      } else if (formData.sendToAll) {
        // If send to all companies, get all active specialists
        const { data: allSpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('is_active', true);

        if (specialistsError) {
          console.error('Error fetching specialists:', specialistsError);
          throw specialistsError;
        }

        console.log('Found specialists for send to all:', allSpecialists?.length || 0);

        if (allSpecialists && allSpecialists.length > 0) {
          // Check if pricing is fixed (not hourly/daily)
          const hasFixedPrice = formData.pricingType && 
                                !['hourly', 'daily'].includes(formData.pricingType) &&
                                formData.servicePrice;
          
          const orderSpecialists = allSpecialists.map(specialist => ({
            order_id: newOrder.id,
            specialist_id: specialist.id,
            // Auto-fill quoted_price for fixed pricing types
            ...(hasFixedPrice && {
              quoted_price: formData.servicePrice?.toString(),
              quoted_at: new Date().toISOString()
            })
          }));

          console.log('Inserting order_specialists:', orderSpecialists);

          const { error: linkError } = await supabase
            .from('order_specialists')
            .insert(orderSpecialists);

          if (linkError) {
            console.error('Error linking specialists to order:', linkError);
            throw linkError;
          }
          
          console.log('Successfully linked specialists to order');

          // Send Firebase push notifications to all specialists
          try {
            console.log('📤 [FCM] Sending push notifications to all specialists...');
            const specialistIds = allSpecialists.map(s => s.id);
            const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
              body: {
                specialistIds,
                title: '🔔 عرض عمل جديد',
                body: 'لديك عرض عمل جديد - افتح التطبيق الآن',
                data: { orderId: newOrder.id, type: 'new_order' }
              }
            });
            if (fcmError) {
              console.error('⚠️ [FCM] Error sending notifications:', fcmError);
            } else {
              console.log('✅ [FCM] Notifications sent:', fcmResult);
            }
          } catch (fcmErr) {
            console.error('⚠️ [FCM] Exception during notifications send:', fcmErr);
          }
        } else {
          console.warn('No active specialists found!');
        }
      } else if (formData.companyId) {
        // If specific company selected, get all specialists from that company
        const { data: companySpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', formData.companyId)
          .eq('is_active', true);

        if (specialistsError) {
          console.error('Error fetching company specialists:', specialistsError);
          throw specialistsError;
        }

        console.log('Found company specialists:', companySpecialists?.length || 0);

        if (companySpecialists && companySpecialists.length > 0) {
          // Check if pricing is fixed (not hourly/daily)
          const hasFixedPrice = formData.pricingType && 
                                !['hourly', 'daily'].includes(formData.pricingType) &&
                                formData.servicePrice;
          
          const orderSpecialists = companySpecialists.map(specialist => ({
            order_id: newOrder.id,
            specialist_id: specialist.id,
            // Auto-fill quoted_price for fixed pricing types
            ...(hasFixedPrice && {
              quoted_price: formData.servicePrice?.toString(),
              quoted_at: new Date().toISOString()
            })
          }));

          const { error: linkError } = await supabase
            .from('order_specialists')
            .insert(orderSpecialists);

          if (linkError) {
            console.error('Error linking company specialists:', linkError);
            throw linkError;
          }

          // Send Firebase push notifications to company specialists
          try {
            console.log('📤 [FCM] Sending push notifications to company specialists...');
            const specialistIds = companySpecialists.map(s => s.id);
            const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
              body: {
                specialistIds,
                title: '🔔 عرض عمل جديد',
                body: 'لديك عرض عمل جديد - افتح التطبيق الآن',
                data: { orderId: newOrder.id, type: 'new_order' }
              }
            });
            if (fcmError) {
              console.error('⚠️ [FCM] Error sending notifications:', fcmError);
            } else {
              console.log('✅ [FCM] Notifications sent:', fcmResult);
            }
          } catch (fcmErr) {
            console.error('⚠️ [FCM] Exception during notifications send:', fcmErr);
          }
        }
      }

      let description = "Order sent successfully";
      if (formData.sendToAll) {
        description = "Order sent to all specialized companies";
      } else if (formData.specialistIds && formData.specialistIds.length > 0) {
        description = `Order sent to ${formData.specialistIds.length} specialist(s)`;
      } else if (formData.companyId) {
        description = "Order sent to all company specialists";
      }

      toast({
        title: "Success",
        description,
      });
      
      setIsFormOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNavigateToUsers = () => {
    navigate('/admin/users');
  };
 
  const handleNavigateToActivityLogs = () => {
    navigate('/admin/activity');
  };
 
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          {/* Welcome Message with User Status */}
          {userProfile && (
            <div className="mb-4 flex items-center gap-3 pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${userProfile.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm text-muted-foreground">
                  {userProfile.is_active 
                    ? (language === 'ar' ? 'متصل' : 'Online')
                    : (language === 'ar' ? 'غير متصل' : 'Offline')
                  }
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <h2 className="text-lg font-medium">
                {language === 'ar' 
                  ? `مرحباً، ${userProfile.full_name}` 
                  : `Welcome, ${userProfile.full_name}`
                }
              </h2>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {tDash.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                {tDash.subtitle}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <LanguageSwitcher />
              
              <Button
                variant={soundEnabled ? "default" : "outline"}
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={tDash.soundNotifications}
              >
                <Volume2 className={`h-4 w-4 ${soundEnabled ? '' : 'opacity-50'}`} />
              </Button>

              {/* Priority Actions - Always Visible with Alerts */}
              {userHasPermission('view_specialists') && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/specialists')}
                  className="flex items-center gap-2 relative"
                >
                  <Users className="h-4 w-4" />
                  {tDash.specialists}
                  {suspendedSpecialistsCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 min-w-[20px] flex items-center justify-center px-1 text-xs"
                    >
                      {suspendedSpecialistsCount}
                    </Badge>
                  )}
                </Button>
              )}

              {userHasPermission('view_deletion_requests') && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/deletion-requests')}
                  className="flex items-center gap-2 relative"
                >
                  <AlertCircle className="h-4 w-4" />
                  {language === 'ar' ? 'طلبات الحذف' : 'Deletion Requests'}
                  {pendingDeletionRequestsCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 min-w-[20px] flex items-center justify-center px-1 text-xs"
                    >
                      {pendingDeletionRequestsCount}
                    </Badge>
                  )}
                </Button>
              )}

              {/* Separator - Only show if there are dropdown items */}
              {(userHasPermission('view_activity_logs') || 
                userHasPermission('manage_users') || 
                userHasPermission('view_users') ||
                userHasPermission('view_contracts') || 
                userHasPermission('view_services') || 
                userHasPermission('view_companies')) && (
                <>
                  <div className="h-8 w-px bg-border mx-2" />

                  {/* Other Options - Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <MoreVertical className="h-4 w-4" />
                        {language === 'ar' ? "خيارات أخرى" : "More Options"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={language === 'ar' ? "end" : "start"} className="w-56">
                      {userHasPermission('view_activity_logs') && (
                        <DropdownMenuItem onClick={() => navigate('/admin/activity')}>
                          <FileText className="h-4 w-4 mr-2" />
                          {tDash.activityLogs}
                        </DropdownMenuItem>
                      )}
                      
                      {(userHasPermission('manage_users') || userHasPermission('view_users')) && (
                        <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                          <UserCog className="h-4 w-4 mr-2" />
                          {tDash.users}
                        </DropdownMenuItem>
                      )}

                      {(userHasPermission('view_contracts') || 
                        userHasPermission('view_services') || 
                        userHasPermission('view_companies')) && 
                        (userHasPermission('view_activity_logs') || userHasPermission('manage_users') || userHasPermission('view_users')) && (
                        <DropdownMenuSeparator />
                      )}

                      {userHasPermission('view_contracts') && (
                        <DropdownMenuItem onClick={() => navigate('/contracts')}>
                          <FileCheck className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'العقود' : 'Contracts'}
                        </DropdownMenuItem>
                      )}

                      {userHasPermission('view_services') && (
                        <DropdownMenuItem onClick={() => navigate('/services')}>
                          <Settings className="h-4 w-4 mr-2" />
                          {tDash.services}
                        </DropdownMenuItem>
                      )}

                      {userHasPermission('view_companies') && (
                        <DropdownMenuItem onClick={() => navigate('/companies')}>
                          <Building2 className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'الشركات' : 'Companies'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              {userHasPermission('manage_orders') && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      New Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <OrderForm 
                      onSubmit={handleCreateOrder}
                      onCancel={() => setIsFormOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={handleSignOut}
                title={tCommon.logout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {userHasPermission('view_new_requests') && (
            <div onClick={() => setFilter('pending')} className="cursor-pointer">
              <StatsCard
                title="New Requests"
                value={stats.pending}
                icon={<Package className="h-4 w-4" />}
                variant="pending"
                isActive={filter === 'pending'}
              />
            </div>
          )}
          {userHasPermission('view_awaiting_response') && (
            <div onClick={() => setFilter('awaiting-response')} className="cursor-pointer">
              <StatsCard
                title="Awaiting Response"
                value={stats.awaitingResponse}
                icon={<Clock className="h-4 w-4" />}
                variant="awaiting"
                isActive={filter === 'awaiting-response'}
              />
            </div>
          )}
          {userHasPermission('view_upcoming') && (
            <div onClick={() => setFilter('upcoming')} className="cursor-pointer">
              <StatsCard
                title="Upcoming"
                value={stats.upcoming}
                icon={<CheckCircle className="h-4 w-4" />}
                variant="success"
                isActive={filter === 'upcoming'}
              />
            </div>
          )}
          {userHasPermission('view_in_progress') && (
            <div onClick={() => setFilter('in-progress')} className="cursor-pointer">
              <StatsCard
                title="In Progress"
                value={stats.inProgress}
                icon={<Users className="h-4 w-4" />}
                variant="warning"
                isActive={filter === 'in-progress'}
              />
            </div>
          )}
          {userHasPermission('view_completed') && (
            <div onClick={() => setFilter('completed')} className="cursor-pointer">
              <StatsCard
                title="Completed"
                value={stats.completed}
                icon={<CheckCircle className="h-4 w-4" />}
                variant="success"
                isActive={filter === 'completed'}
              />
            </div>
          )}
        </div>

        <OrdersTable 
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onLinkCopied={handleLinkCopied}
          filter={filter}
          onFilterChange={setFilter}
        />
      </main>
    </div>
  );
}
