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
  bookingType: string;
  hoursCount: string;
  sendToAll: boolean;
  companyId?: string;
  specialistIds?: string[];
  notes: string;
}

interface Order {
  id: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
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
          *,
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
      // Create or get customer
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp_number', formData.whatsappNumber)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: formData.customerName,
            whatsapp_number: formData.whatsappNumber,
            area: formData.area || null,
            budget: formData.budget || null,
            budget_type: formData.budgetType || null,
            company_id: formData.companyId || null
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: formData.sendToAll ? null : formData.companyId,
          send_to_all_companies: formData.sendToAll,
          service_type: formData.serviceType,
          booking_type: formData.bookingType || null,
          hours_count: formData.hoursCount || null,
          notes: formData.notes,
          status: 'pending',
          created_by: user?.id
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Link specialists to the order
      if (formData.specialistIds && formData.specialistIds.length > 0) {
        // If specific specialists selected
        const orderSpecialists = formData.specialistIds.map(specialistId => ({
          order_id: newOrder.id,
          specialist_id: specialistId
        }));

        const { error: linkError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        if (linkError) throw linkError;
      } else if (formData.sendToAll) {
        // If send to all companies, get all active specialists
        const { data: allSpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('is_active', true);

        if (specialistsError) throw specialistsError;

        if (allSpecialists && allSpecialists.length > 0) {
          const orderSpecialists = allSpecialists.map(specialist => ({
            order_id: newOrder.id,
            specialist_id: specialist.id
          }));

          const { error: linkError } = await supabase
            .from('order_specialists')
            .insert(orderSpecialists);

          if (linkError) throw linkError;
        }
      } else if (formData.companyId) {
        // If specific company selected, get all specialists from that company
        const { data: companySpecialists, error: specialistsError } = await supabase
          .from('specialists')
          .select('id')
          .eq('company_id', formData.companyId)
          .eq('is_active', true);

        if (specialistsError) throw specialistsError;

        if (companySpecialists && companySpecialists.length > 0) {
          const orderSpecialists = companySpecialists.map(specialist => ({
            order_id: newOrder.id,
            specialist_id: specialist.id
          }));

          const { error: linkError } = await supabase
            .from('order_specialists')
            .insert(orderSpecialists);

          if (linkError) throw linkError;
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
