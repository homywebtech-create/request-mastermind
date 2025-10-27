import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderForm } from "@/components/orders/order-form";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { SpecialistAvailabilityDialog } from "@/components/orders/SpecialistAvailabilityDialog";

interface OrderFormData {
  customerName: string;
  whatsappNumber: string;
  area: string;
  budget: string;
  budgetType: string;
  serviceType: string;
  hoursCount: string;
  sendToAll: boolean;
  companyId?: string;
  specialistIds?: string[];
  notes: string;
  servicePrice?: number | null;
  pricingType?: string | null;
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
  updated_at?: string;
  last_sent_at?: string;
  send_to_all_companies?: boolean;
  customers: {
    name: string;
    whatsapp_number: string;
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

export default function Orders() {
  const { language } = useLanguage();
  const t = useTranslation(language).orders;
  const tCommon = useTranslation(language).common;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission: userHasPermission } = useUserPermissions(user?.id, role);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('new');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unavailableDialog, setUnavailableDialog] = useState<{
    open: boolean;
    specialists: Array<{ id: string; name: string }>;
  }>({ open: false, specialists: [] });
  const [pendingOrderData, setPendingOrderData] = useState<OrderFormData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchUserProfile();
      fetchOrders();
      setupRealtimeSubscription();
    }
  }, [user, authLoading]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setUserProfile(data);
    }
  };

  const fetchOrders = async () => {
    try {
      console.log('🔄 [FETCH] Fetching orders...');
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
          last_sent_at,
          send_to_all_companies,
          booking_type,
          hours_count,
          customers (
            name,
            whatsapp_number,
            area,
            budget,
            budget_type
          ),
          companies (
            name
          ),
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

      if (error) throw error;

      console.log('🔍 Admin Orders - Sample:', data?.[0]);
      console.log('📋 Order number check:', data?.[0]?.order_number);
      console.log('🕐 last_sent_at check:', {
        'ORD-0005': data?.find(o => o.order_number === 'ORD-0005')?.last_sent_at,
        'ORD-0004': data?.find(o => o.order_number === 'ORD-0004')?.last_sent_at,
        'ORD-0003': data?.find(o => o.order_number === 'ORD-0003')?.last_sent_at,
      });

      setOrders((data || []) as Order[]);
      console.log('✅ [FETCH] Orders fetched:', data?.length, 'orders');
      if (data && data.length > 0) {
        console.log('📊 [FETCH] Sample order last_sent_at:', data[0].order_number, data[0].last_sent_at);
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: t.errorLoading,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const checkSpecialistAvailability = async (
    specialistIds: string[],
    orderData: OrderFormData
  ): Promise<Array<{ id: string; name: string }>> => {
    // If no specific company selected, skip availability check
    if (!orderData.companyId) return [];

    const unavailableSpecialists: Array<{ id: string; name: string }> = [];

    // Create a temporary order to check availability
    const tempOrderId = crypto.randomUUID();
    
    for (const specialistId of specialistIds) {
      try {
        // Check if specialist is available using the database function
        const { data, error } = await supabase.rpc('is_specialist_available_for_order', {
          _specialist_id: specialistId,
          _order_id: tempOrderId
        });

        if (error) {
          console.error('Error checking availability:', error);
          continue;
        }

        // If not available, add to unavailable list
        if (!data) {
          const { data: specialist } = await supabase
            .from('specialists')
            .select('name')
            .eq('id', specialistId)
            .single();

          if (specialist) {
            unavailableSpecialists.push({
              id: specialistId,
              name: specialist.name
            });
          }
        }
      } catch (error) {
        console.error('Exception checking availability:', error);
      }
    }

    return unavailableSpecialists;
  };

  const handleCreateOrder = async (formData: OrderFormData) => {
    try {
      console.log('=== Creating Order ===');
      console.log('Form Data:', {
        customerName: formData.customerName,
        whatsappNumber: formData.whatsappNumber,
        budget: formData.budget,
        budgetType: formData.budgetType,
        area: formData.area
      });

      // Check specialist availability if specific company is selected
      if (formData.companyId && !formData.sendToAll) {
        const { data: companySpecialists } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', formData.companyId)
          .eq('is_active', true);

        const specialistIds = companySpecialists?.map(s => s.id) || [];
        
        if (specialistIds.length > 0) {
          const unavailable = await checkSpecialistAvailability(specialistIds, formData);
          
          if (unavailable.length > 0) {
            // Show dialog with options
            setUnavailableDialog({ open: true, specialists: unavailable });
            setPendingOrderData(formData);
            return; // Stop here, let user decide
          }
        }
      }

      const whatsapp = (formData.whatsappNumber || '').trim();
      if (!whatsapp) {
        toast({ title: 'Error', description: 'WhatsApp number is required', variant: 'destructive' });
        return;
      }

      // Create or get customer
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp_number', whatsapp)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        // Create new customer
        const customerData = {
          name: formData.customerName?.trim() || 'Customer',
          whatsapp_number: whatsapp,
          area: formData.area?.trim() || null,
          budget: formData.budget || null,
          budget_type: formData.budgetType || null,
          company_id: formData.companyId || null
        } as const;
        
        console.log('Creating new customer:', customerData);
        
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert(customerData)
          .select('id')
          .single();

        if (customerError) {
          console.error('Customer creation error:', customerError);
          throw customerError;
        }
        customerId = newCustomer.id;
        console.log('New customer created:', customerId);
      } else {
        // Update existing customer with new budget info
        const updateData = {
          name: formData.customerName?.trim() || 'Customer',
          area: formData.area?.trim() || null,
          budget: formData.budget || null,
          budget_type: formData.budgetType || null,
        } as const;
        
        console.log('Updating existing customer:', customerId, updateData);
        
        const { error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId);

        if (updateError) {
          console.error('Customer update error:', updateError);
          throw updateError;
        }
        console.log('Customer updated successfully');
      }

      // Create order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: formData.sendToAll ? null : formData.companyId,
          send_to_all_companies: formData.sendToAll,
          service_type: formData.serviceType,
          hours_count: formData.hoursCount || null,
          notes: formData.notes,
          status: 'pending',
          created_by: user?.id
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Link specialists to the order
      let specialistsToLink: string[] = [];
      
      if (formData.sendToAll) {
        // Fetch ALL active specialists when sending to all
        console.log('📤 Fetching all active specialists...');
        const { data: allSpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('is_active', true);

        if (specialistsError) {
          console.error('Error fetching all specialists:', specialistsError);
          throw specialistsError;
        }

        specialistsToLink = allSpecialists?.map(s => s.id) || [];
        console.log('Found specialists for send to all:', specialistsToLink.length);
      } else if (formData.companyId) {
        // Get all specialists from the specific company
        const { data: companySpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', formData.companyId)
          .eq('is_active', true);

        if (specialistsError) {
          console.error('Error fetching company specialists:', specialistsError);
          throw specialistsError;
        }

        specialistsToLink = companySpecialists?.map(s => s.id) || [];
        console.log('Found company specialists:', specialistsToLink.length);
      }

      // Insert all specialists at once with proper error handling
      const linkingSkipped = formData.sendToAll;
      if (specialistsToLink.length > 0) {
        // Check if pricing is fixed (not hourly/daily)
        const hasFixedPrice = formData.pricingType && 
                              !['hourly', 'daily'].includes(formData.pricingType) &&
                              formData.servicePrice;
        
        const orderSpecialists = specialistsToLink.map(specialistId => ({
          order_id: newOrder.id,
          specialist_id: specialistId,
          // Auto-fill quoted_price for fixed pricing types
          ...(hasFixedPrice && {
            quoted_price: formData.servicePrice?.toString(),
            quoted_at: new Date().toISOString()
          })
        }));

        const { error: linkError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        // Handle duplicate key errors gracefully
        if (linkError && !linkError.message.includes('duplicate key')) {
          console.error('Error linking specialists to order:', linkError);
          throw linkError;
        }
        
        console.log('✅ Successfully linked specialists to order');
        console.log('🔴🔴🔴 [NEW CODE LOADED] Version 2.0 🔴🔴🔴');
        console.log('🔍 [DEBUG] About to enter FCM try block');
        console.log('🔍 [DEBUG] specialistsToLink:', specialistsToLink);
        
        // Send push notifications via Firebase
        try {
          console.log('📤 [FCM] ✨✨ INSIDE TRY BLOCK ✨✨ - Starting push notification send...');
          console.log('📤 [FCM] Specialist IDs:', specialistsToLink);
          
          const { data: fcmResult, error: fcmError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              specialistIds: specialistsToLink,
              title: '🔔 عرض عمل جديد',
              body: `طلب جديد: ${formData.serviceType}`,
              data: {
                orderId: newOrder.id,
                type: 'new_order'
              }
            }
          });
          
          console.log('📤 [FCM] Edge function response:', fcmResult);
          console.log('📤 [FCM] Edge function error:', fcmError);
          
          if (fcmError) {
            console.error('❌ [FCM] Error sending push notifications:', fcmError);
          } else {
            console.log('✅ [FCM] Push notifications sent successfully:', fcmResult);
          }
        } catch (fcmError) {
          console.error('⚠️ [FCM] Exception sending push notifications:', fcmError);
          // Continue even if push notifications fail
        }
      } else {
        if (!linkingSkipped) {
          console.warn('No active specialists found!');
          toast({
            title: t.warning,
            description: t.noActiveSpecialists,
            variant: "default",
          });
        }
      }

      console.log('📱 [WhatsApp] Starting WhatsApp send process...');
      console.log('📱 [WhatsApp] Customer WhatsApp:', whatsapp);
      
      // Send WhatsApp message to customer
      try {
        console.log('📱 [WhatsApp] إرسال رسالة واتساب للعميل...');
        
        // Prepare WhatsApp message
        const customerName = formData.customerName?.trim() || 'عزيزنا العميل';
        const whatsappMessage = language === 'ar' 
          ? `مرحباً ${customerName}! 🎉\n\nلقد قمنا باستلام طلبك بنجاح وسوف نرد عليك في أقرب وقت ممكن.\n\nشكراً لثقتك بنا! 🙏`
          : `Hello ${customerName}! 🎉\n\nWe have successfully received your request and will respond to you as soon as possible.\n\nThank you for your trust! 🙏`;
        
        console.log('📱 [WhatsApp] Invoking send-whatsapp function...');
        
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: whatsapp,
            message: whatsappMessage,
            customerName: formData.customerName?.trim()
          }
        });
        
        if (whatsappError) {
          console.error('⚠️ [WhatsApp] خطأ في إرسال رسالة واتساب:', whatsappError);
          toast({
            title: 'تحذير',
            description: 'تم إنشاء الطلب ولكن فشل إرسال رسالة واتساب',
            variant: "default",
          });
        } else {
          console.log('✅ [WhatsApp] تم إرسال رسالة واتساب بنجاح:', whatsappResult);
        }
      } catch (whatsappError: any) {
        console.error('⚠️ [WhatsApp] استثناء في إرسال رسالة واتساب:', whatsappError);
        console.error('⚠️ [WhatsApp] Error details:', {
          message: whatsappError?.message,
          name: whatsappError?.name,
          stack: whatsappError?.stack
        });
        // Continue even if WhatsApp message fails
      }
      
      console.log('📱 [WhatsApp] WhatsApp send process completed');

      toast({
        title: t.orderCreatedSuccess,
        description: formData.sendToAll 
          ? t.sentToAll
          : t.sentToSelected,
      });

      setShowForm(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: t.errorCreating,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Notify the accepted specialist (if any) about status change → deep link to tracking page
      try {
        const { data: accepted, error: acceptedErr } = await supabase
          .from('order_specialists')
          .select('specialist_id')
          .eq('order_id', orderId)
          .eq('is_accepted', true)
          .maybeSingle();

        if (!acceptedErr && accepted?.specialist_id) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              specialistIds: [accepted.specialist_id],
              title: 'تحديث حالة الطلب',
              body: `تم تحديث حالة طلبك إلى: ${newStatus}`,
              data: {
                orderId,
                type: 'order_status_change',
                status: newStatus,
              },
            },
          });
        }
      } catch (e) {
        console.warn('🔔 Push for status change failed (non-blocking):', e);
      }

      toast({
        title: t.statusUpdated,
        description: t.statusUpdatedSuccess,
      });

      fetchOrders();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: t.errorUpdating,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLinkCopied = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          link_copied_at: new Date().toISOString(),
          status: 'in-progress'
        })
        .eq('id', orderId);

      if (error) throw error;
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating link copied:', error);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
          <p className="text-muted-foreground mt-2">
            {t.subtitle}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          
          {!showForm && userHasPermission('create_order') && (
            <Button onClick={() => setShowForm(true)} size="lg">
              <Plus className="h-5 w-5 ml-2" />
              {t.newOrder}
            </Button>
          )}
        </div>
      </div>

      {showForm && userHasPermission('create_order') && (
        <OrderForm 
          onSubmit={handleCreateOrder}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <OrdersTable
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onLinkCopied={handleLinkCopied}
          onRefreshOrders={fetchOrders}
          filter={filter}
          onFilterChange={setFilter}
        />
      )}

      <SpecialistAvailabilityDialog
        open={unavailableDialog.open}
        onOpenChange={(open) => {
          setUnavailableDialog({ ...unavailableDialog, open });
          if (!open) {
            setPendingOrderData(null);
          }
        }}
        unavailableSpecialists={unavailableDialog.specialists}
        onChooseOtherCompany={() => {
          // Reset form to allow choosing another company
          if (pendingOrderData) {
            setPendingOrderData({ ...pendingOrderData, companyId: undefined, sendToAll: false });
            toast({
              title: language === 'ar' ? 'اختر شركة أخرى' : 'Choose Another Company',
              description: language === 'ar' 
                ? 'الرجاء اختيار شركة أخرى لديها محترفات متوفرات'
                : 'Please choose another company with available specialists',
            });
          }
        }}
      />
    </div>
  );
}
