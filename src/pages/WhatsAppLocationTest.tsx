import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RequestLocationButton } from "@/components/orders/RequestLocationButton";
import { MapPin, RefreshCw, CheckCircle2, XCircle, Navigation } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useNavigate } from "react-router-dom";

interface Order {
  id: string;
  order_number: string;
  customer_latitude: number | null;
  customer_longitude: number | null;
  customer_location_address: string | null;
  customer_location_name: string | null;
  status: string;
  customers: {
    name: string;
    whatsapp_number: string;
  };
}

export default function WhatsAppLocationTest() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchOrders();
      setupRealtimeSubscription();
    }
  }, [user, authLoading, navigate]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_latitude,
          customer_longitude,
          customer_location_address,
          customer_location_name,
          status,
          customers (
            name,
            whatsapp_number
          )
        `)
        .in('status', ['pending', 'waiting_quotes', 'quoted', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الطلبات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('location_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('📍 Location update received:', payload);
          const updatedOrder = payload.new as Order;
          
          // Update orders list
          setOrders(prev => prev.map(order => 
            order.id === updatedOrder.id 
              ? { ...order, ...updatedOrder }
              : order
          ));

          // Show toast if location was added
          if (updatedOrder.customer_latitude && updatedOrder.customer_longitude) {
            toast({
              title: "✅ تم استلام الموقع!",
              description: `تم استلام موقع العميل للطلب ${updatedOrder.order_number}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">اختبار مواقع WhatsApp</h1>
          <p className="text-muted-foreground mt-2">
            اطلب مواقع العملاء عبر WhatsApp وراقب استلامها في الوقت الفعلي
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            تحديث
          </Button>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">لديها موقع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.customer_latitude && o.customer_longitude).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">بدون موقع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {orders.filter(o => !o.customer_latitude || !o.customer_longitude).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>الطلبات النشطة</CardTitle>
          <CardDescription>
            اضغط على "طلب الموقع" لإرسال رسالة WhatsApp للعميل
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد طلبات نشطة
              </div>
            ) : (
              orders.map((order) => {
                const hasLocation = order.customer_latitude && order.customer_longitude;
                
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-full ${hasLocation ? 'bg-green-100' : 'bg-orange-100'}`}>
                        {hasLocation ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{order.customers.name}</h3>
                          <Badge variant="outline">{order.order_number}</Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          📱 {order.customers.whatsapp_number}
                        </p>
                        
                        {hasLocation ? (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <MapPin className="h-4 w-4" />
                            <span>
                              {order.customer_location_name || order.customer_location_address || 'موقع محفوظ'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-orange-600">
                            ⚠️ لم يتم استلام الموقع بعد
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!hasLocation && (
                        <RequestLocationButton
                          customerPhone={order.customers.whatsapp_number}
                          orderNumber={order.order_number}
                          onLocationRequested={() => {
                            toast({
                              title: "تم الإرسال",
                              description: "تم إرسال طلب الموقع للعميل",
                            });
                          }}
                        />
                      )}
                      
                      {hasLocation && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInGoogleMaps(
                            order.customer_latitude!,
                            order.customer_longitude!
                          )}
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          فتح في الخرائط
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">📝 تعليمات الاستخدام</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <ol className="list-decimal list-inside space-y-2">
            <li>اضغط على زر "طلب الموقع عبر WhatsApp" لأي طلب</li>
            <li>سيتم إرسال رسالة للعميل على WhatsApp تطلب منه مشاركة موقعه</li>
            <li>عندما يشارك العميل موقعه، سيتم استلامه تلقائياً عبر webhook</li>
            <li>ستظهر إشعار وسيتحول الطلب إلى اللون الأخضر</li>
            <li>يمكنك فتح الموقع في خرائط Google بالضغط على "فتح في الخرائط"</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-300">
            <p className="font-semibold mb-2">⚙️ متطلبات التشغيل:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>WhatsApp webhook مُفعّل ومُسجّل في Meta Developer Console</li>
              <li>حقل "messages" مُفعّل في webhook fields</li>
              <li>WHATSAPP_VERIFY_TOKEN مُضاف في Lovable Secrets</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
