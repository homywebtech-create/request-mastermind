import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Package, Clock, CheckCircle, Users } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OrdersTable } from "@/components/orders/orders-table";

interface Company {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
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

export default function CompanyPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    checkAuth();
    
    // Subscribe to realtime changes
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
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
          title: "خطأ",
          description: "لم يتم العثور على شركة مرتبطة بهذا الحساب",
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
        title: "خطأ",
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
          customers (name, whatsapp_number, area, budget),
          companies (name)
        `)
        .or(`company_id.eq.${companyId},send_to_all_companies.eq.true`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
      calculateStats((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء جلب الطلبات",
        variant: "destructive",
      });
    }
  };

  const calculateStats = (ordersList: Order[]) => {
    setStats({
      total: ordersList.length,
      pending: ordersList.filter(o => o.status === 'pending').length,
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
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground font-cairo">
                  {company.name}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {company.phone}
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </Button>
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
