import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Package, Clock, CheckCircle, Users, UserCog } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OrdersTable } from "@/components/orders/orders-table";

interface Company {
  id: string;
  name: string;
  name_en?: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
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
    };
  }>;
}

interface OrderStats {
  total: number;
  pending: number;
  awaitingResponse: number;
  inProgress: number;
  completed: number;
}

export default function CompanyPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    awaitingResponse: 0,
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
        .select("company_id")
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
      setCompany(companyData);

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
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
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
        .or(`company_id.eq.${companyId},send_to_all_companies.eq.true`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
      calculateStats((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Error loading orders",
        variant: "destructive",
      });
    }
  };

  const calculateStats = (ordersList: Order[]) => {
    // Pending: Orders with no quotes yet
    const pendingOrders = ordersList.filter(o => 
      o.status === 'pending' && 
      (!o.order_specialists || o.order_specialists.every(os => !os.quoted_price))
    );
    
    // Awaiting Response: Orders with at least one quote from company specialists, not accepted yet
    const awaitingOrders = ordersList.filter(o => 
      o.order_specialists && 
      o.order_specialists.some(os => os.quoted_price && os.is_accepted === null)
    );
    
    setStats({
      total: ordersList.length,
      pending: pendingOrders.length,
      awaitingResponse: awaitingOrders.length,
      inProgress: ordersList.filter(o => o.status === 'in-progress').length,
      completed: ordersList.filter(o => o.status === 'completed').length,
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
                <p className="text-sm text-muted-foreground mt-1">
                  {company.phone}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/specialists")}
                className="flex items-center gap-2"
              >
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Specialists</span>
              </Button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div onClick={() => setFilter('new')} className="cursor-pointer">
            <StatsCard
              title="New Orders"
              value={stats.pending}
              icon={<Package className="h-4 w-4" />}
              variant="pending"
            />
          </div>
          <div onClick={() => setFilter('awaiting-response')} className="cursor-pointer">
            <StatsCard
              title="Awaiting Response"
              value={stats.awaitingResponse}
              icon={<Clock className="h-4 w-4" />}
              variant="warning"
            />
          </div>
          <div onClick={() => setFilter('in-progress')} className="cursor-pointer">
            <StatsCard
              title="In Progress"
              value={stats.inProgress}
              icon={<Users className="h-4 w-4" />}
              variant="default"
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
