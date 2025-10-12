import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderForm } from "@/components/orders/order-form";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('new');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

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
          send_to_all_companies,
          customers (
            name,
            whatsapp_number
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
              image_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('🔍 Admin Orders - Sample:', data?.[0]);
      console.log('📋 Order number check:', data?.[0]?.order_number);

      setOrders((data || []) as Order[]);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ في تحميل الطلبات",
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
        const orderSpecialists = specialistsToLink.map(specialistId => ({
          order_id: newOrder.id,
          specialist_id: specialistId
        }));

        const { error: linkError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        // Handle duplicate key errors gracefully
        if (linkError && !linkError.message.includes('duplicate key')) {
          console.error('Error linking specialists to order:', linkError);
          throw linkError;
        }
        
        console.log('Successfully linked specialists to order');
        
        // Send push notifications via Firebase
        try {
          console.log('📤 [FCM] إرسال إشعارات Firebase...');
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
          
          if (fcmError) {
            console.error('⚠️ [FCM] خطأ في إرسال الإشعارات:', fcmError);
          } else {
            console.log('✅ [FCM] تم إرسال الإشعارات:', fcmResult);
          }
        } catch (fcmError) {
          console.error('⚠️ [FCM] استثناء في إرسال الإشعارات:', fcmError);
          // Continue even if push notifications fail
        }
      } else {
        if (!linkingSkipped) {
          console.warn('No active specialists found!');
          toast({
            title: "تحذير",
            description: "لم يتم العثور على محترفين نشطين للشركة المحددة",
            variant: "default",
          });
        }
      }

      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: formData.sendToAll 
          ? "تم إرسال الطلب لجميع المحترفين"
          : "تم إرسال الطلب للمحترفين المختارين",
      });

      setShowForm(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "خطأ في إنشاء الطلب",
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

      toast({
        title: "تم تحديث الحالة",
        description: "تم تحديث حالة الطلب بنجاح",
      });

      fetchOrders();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "خطأ في التحديث",
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
          <h1 className="text-3xl font-bold text-foreground">إدارة الطلبات</h1>
          <p className="text-muted-foreground mt-2">
            إدارة وتتبع جميع طلبات الصيانة والخدمات
          </p>
        </div>
        
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="lg">
            <Plus className="h-5 w-5 ml-2" />
            طلب جديد
          </Button>
        )}
      </div>

      {showForm && (
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
          filter={filter}
          onFilterChange={setFilter}
        />
      )}
    </div>
  );
}
