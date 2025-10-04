import { useState, useEffect } from "react";
import { OrderForm } from "@/components/orders/order-form";
import { OrdersTable } from "@/components/orders/orders-table";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, Clock, CheckCircle, Users, Building2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Order {
  id: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  order_link?: string;
  created_at: string;
  updated_at: string;
  send_to_all_companies?: boolean;
  customers: {
    name: string;
    whatsapp_number: string;
  };
  companies: {
    name: string;
  } | null;
}

interface OrderStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    
    // Subscribe to realtime changes
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
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, whatsapp_number),
        companies (name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الطلبات",
        variant: "destructive",
      });
    } else {
      setOrders((data as any) || []);
      calculateStats((data as any) || []);
    }
    setLoading(false);
  };

  const calculateStats = (ordersList: Order[]) => {
    setStats({
      total: ordersList.length,
      pending: ordersList.filter(o => o.status === 'pending').length,
      inProgress: ordersList.filter(o => o.status === 'in-progress').length,
      completed: ordersList.filter(o => o.status === 'completed').length,
    });
  };

  const handleCreateOrder = async (formData: any) => {
    try {
      // First, create or get customer
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
            company_id: formData.companyId || null
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create order link
      const orderLink = `${window.location.origin}/order/${Date.now()}`;

      // Create order
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: formData.sendToAll ? null : formData.companyId,
          send_to_all_companies: formData.sendToAll || false,
          service_type: formData.serviceType,
          notes: formData.notes,
          order_link: orderLink,
          created_by: user?.id,
        });

      if (orderError) throw orderError;

      toast({
        title: "نجح",
        description: formData.sendToAll 
          ? "تم إرسال الطلب لجميع الشركات المختصة"
          : "تم إنشاء الطلب بنجاح",
      });
      
      setIsFormOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "خطأ",
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
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "نجح",
        description: "تم تحديث حالة الطلب",
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-cairo">
                لوحة إدارة الطلبات
              </h1>
              <p className="text-muted-foreground mt-1">
                إدارة شاملة لطلبات العملاء والخدمات
              </p>
            </div>
            
            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/companies')}
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  الشركات
                </Button>
              )}

              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    طلب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <OrderForm 
                    onSubmit={handleCreateOrder}
                    onCancel={() => setIsFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="icon"
                onClick={handleSignOut}
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="إجمالي الطلبات"
            value={stats.total}
            icon={<Package className="h-4 w-4" />}
          />
          <StatsCard
            title="قيد الانتظار"
            value={stats.pending}
            icon={<Clock className="h-4 w-4" />}
            variant="pending"
          />
          <StatsCard
            title="قيد التنفيذ"
            value={stats.inProgress}
            icon={<Users className="h-4 w-4" />}
            variant="warning"
          />
          <StatsCard
            title="مكتملة"
            value={stats.completed}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="success"
          />
        </div>

        <OrdersTable 
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onLinkCopied={handleLinkCopied}
        />
      </main>
    </div>
  );
}
