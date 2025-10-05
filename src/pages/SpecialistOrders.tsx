import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Package, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  created_at: string;
  service_type: string;
  status: string;
  notes: string | null;
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
  } | null;
}

export default function SpecialistOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistName, setSpecialistName] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      // Get profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, company_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSpecialistName(profile.full_name);
        await fetchOrders(user.id, profile.company_id);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchOrders = async (userId: string, companyId: string) => {
    try {
      setIsLoading(true);

      // Get specialist ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', userId)
        .single();

      if (!profile?.phone) {
        setIsLoading(false);
        return;
      }

      const { data: specialist } = await supabase
        .from('specialists')
        .select('id')
        .eq('phone', profile.phone)
        .single();

      if (!specialist) {
        setIsLoading(false);
        return;
      }

      // Get orders assigned to this specialist
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select('order_id')
        .eq('specialist_id', specialist.id);

      const orderIds = orderSpecialists?.map(os => os.order_id) || [];

      if (orderIds.length === 0) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          service_type,
          status,
          notes,
          customer:customers (
            name,
            whatsapp_number,
            area,
            budget
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الطلبات",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/specialist-auth');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'قيد الانتظار', variant: 'secondary' as const },
      in_progress: { label: 'جاري العمل', variant: 'default' as const },
      completed: { label: 'مكتمل', variant: 'default' as const },
      cancelled: { label: 'ملغي', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\+/g, '')}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">طلباتي</h1>
              <p className="text-muted-foreground">مرحباً {specialistName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">لا توجد طلبات مخصصة لك حالياً</p>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{order.customer?.name}</h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(order.created_at).toLocaleDateString('ar-SA')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">نوع الخدمة</p>
                    <p className="font-medium">{order.service_type}</p>
                  </div>
                  {order.customer?.area && (
                    <div>
                      <p className="text-muted-foreground">المنطقة</p>
                      <p className="font-medium">{order.customer.area}</p>
                    </div>
                  )}
                  {order.customer?.budget && (
                    <div>
                      <p className="text-muted-foreground">الميزانية</p>
                      <p className="font-medium">{order.customer.budget}</p>
                    </div>
                  )}
                </div>

                {order.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">ملاحظات</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                )}

                <Button
                  onClick={() => order.customer && openWhatsApp(order.customer.whatsapp_number)}
                  className="w-full"
                  variant="default"
                >
                  تواصل مع العميل عبر واتساب
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
