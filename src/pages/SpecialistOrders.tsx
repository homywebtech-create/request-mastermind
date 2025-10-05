import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Package, Clock, CheckCircle, AlertCircle, Phone, MapPin, DollarSign, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const newOrders = orders.filter(o => o.status === 'pending');
  const inProgressOrders = orders.filter(o => o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const renderOrderCard = (order: Order, isNew: boolean = false) => (
    <Card 
      key={order.id} 
      className={`p-6 space-y-4 transition-all hover:shadow-lg ${isNew ? 'border-primary border-2 bg-primary/5' : ''}`}
    >
      {isNew && (
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-semibold">طلب جديد</span>
        </div>
      )}
      
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold">{order.customer?.name}</h3>
            {getStatusBadge(order.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {new Date(order.created_at).toLocaleDateString('ar-SA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">نوع الخدمة</p>
            <p className="font-semibold text-sm break-words">{order.service_type}</p>
          </div>
        </div>

        {order.customer?.area && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">المنطقة</p>
              <p className="font-semibold text-sm break-words">{order.customer.area}</p>
            </div>
          </div>
        )}

        {order.customer?.budget && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">الميزانية</p>
              <p className="font-semibold text-sm break-words">{order.customer.budget}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">رقم الواتساب</p>
            <p className="font-semibold text-sm break-words" dir="ltr">{order.customer?.whatsapp_number}</p>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-muted">
          <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">ملاحظات</p>
            <p className="text-sm leading-relaxed">{order.notes}</p>
          </div>
        </div>
      )}

      <Button
        onClick={() => order.customer && openWhatsApp(order.customer.whatsapp_number)}
        className="w-full gap-2"
        size="lg"
      >
        <Phone className="h-4 w-4" />
        تواصل مع العميل عبر واتساب
      </Button>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-4 space-y-6 max-w-6xl">
        {/* Header */}
        <Card className="p-6 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                طلباتي
              </h1>
              <p className="text-muted-foreground">مرحباً {specialistName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">طلبات جديدة</p>
                <p className="text-3xl font-bold text-blue-600">{newOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">قيد العمل</p>
                <p className="text-3xl font-bold text-orange-600">{inProgressOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">مكتملة</p>
                <p className="text-3xl font-bold text-green-600">{completedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Orders Tabs */}
        <Tabs defaultValue="new" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="new" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              جديدة ({newOrders.length})
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="gap-2">
              <Clock className="h-4 w-4" />
              قيد العمل ({inProgressOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              مكتملة ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {newOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد طلبات جديدة</p>
              </Card>
            ) : (
              newOrders.map((order) => renderOrderCard(order, true))
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4">
            {inProgressOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد طلبات قيد العمل</p>
              </Card>
            ) : (
              inProgressOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد طلبات مكتملة</p>
              </Card>
            ) : (
              completedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
