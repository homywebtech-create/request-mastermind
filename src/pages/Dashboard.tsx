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
import { Plus, Package, Clock, CheckCircle, Users, Building2, LogOut, Settings } from "lucide-react";
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
  const [filter, setFilter] = useState<string>('pending');
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
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
    setStats({
      total: ordersList.filter(o => o.status === 'pending' && (o.company_id || o.send_to_all_companies)).length, // Pending requests sent to companies
      pending: ordersList.filter(o => o.status === 'pending' && (o.company_id || o.send_to_all_companies)).length, // Same as total
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

      // Create order and send to companies
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          company_id: formData.sendToAll ? null : formData.companyId,
          specialist_id: null,
          send_to_all_companies: formData.sendToAll || false,
          service_type: formData.serviceType,
          notes: formData.notes,
          order_link: orderLink,
          created_by: user?.id,
          last_sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // If specific specialists are selected, insert into junction table
      if (formData.specialistIds && formData.specialistIds.length > 0) {
        const orderSpecialists = formData.specialistIds.map(specialistId => ({
          order_id: newOrder.id,
          specialist_id: specialistId,
        }));

        const { error: junctionError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        if (junctionError) throw junctionError;
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
              <h1 className="text-3xl font-bold text-foreground">
                Orders Management Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive management of customer orders and services
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/companies')}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Companies
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/services')}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Services
              </Button>

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

              <Button
                variant="outline"
                size="icon"
                onClick={handleSignOut}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div onClick={() => setFilter('pending')} className="cursor-pointer">
            <StatsCard
              title="Pending Requests"
              value={stats.total}
              icon={<Package className="h-4 w-4" />}
              variant="pending"
            />
          </div>
          <div onClick={() => setFilter('pending')} className="cursor-pointer">
            <StatsCard
              title="Awaiting Response"
              value={stats.pending}
              icon={<Clock className="h-4 w-4" />}
              variant="pending"
            />
          </div>
          <div onClick={() => setFilter('in-progress')} className="cursor-pointer">
            <StatsCard
              title="In Progress"
              value={stats.inProgress}
              icon={<Users className="h-4 w-4" />}
              variant="warning"
            />
          </div>
          <div onClick={() => setFilter('completed')} className="cursor-pointer">
            <StatsCard
              title="Completed"
              value={stats.completed}
              icon={<CheckCircle className="h-4 w-4" />}
              variant="success"
            />
          </div>
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
