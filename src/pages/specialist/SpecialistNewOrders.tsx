import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Package, FileText, Tag, Sparkles } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LocalNotifications } from '@capacitor/local-notifications';
import { getSoundNotification } from "@/lib/soundNotification";

interface Order {
  id: string;
  created_at: string;
  service_type: string;
  notes: string | null;
  booking_type: string | null;
  hours_count: string | null;
  customer: {
    name: string;
    area: string | null;
    budget: string | null;
  } | null;
  order_specialist?: {
    id: string;
  };
}

export default function SpecialistNewOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [quoteDialog, setQuoteDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const soundNotification = useRef(getSoundNotification());

  useEffect(() => {
    const initAudio = async () => {
      await soundNotification.current.initialize();
    };
    
    const setupNotifications = async () => {
      try {
        await LocalNotifications.requestPermissions();
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    
    document.addEventListener('click', initAudio, { once: true });
    setupNotifications();
    
    return () => document.removeEventListener('click', initAudio);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    fetchOrders(specialistId);

    const channel = supabase
      .channel('specialist-new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        async () => {
          fetchOrders(specialistId);
          soundNotification.current.playNewOrderSound();
          
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: '🔔 عرض عمل جديد!',
                  body: 'لديك عرض عمل جديد متاح. اضغط للمشاهدة.',
                  id: Date.now(),
                  schedule: { at: new Date(Date.now() + 100) },
                  sound: undefined,
                  attachments: undefined,
                  actionTypeId: '',
                  extra: null
                }
              ]
            });
          } catch (error) {
            console.error('Error sending notification:', error);
          }
          
          toast({
            title: "🔔 عرض عمل جديد!",
            description: "لديك عرض عمل جديد متاح",
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        () => {
          fetchOrders(specialistId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSpecialistName(profile.full_name);
        
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          setSpecialistId(specialist.id);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchOrders = async (specId: string) => {
    try {
      setIsLoading(true);

      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select('order_id, id')
        .eq('specialist_id', specId)
        .is('quoted_price', null)
        .is('rejected_at', null);

      if (!orderSpecialists || orderSpecialists.length === 0) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const orderIds = orderSpecialists.map(os => os.order_id);

      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          service_type,
          notes,
          booking_type,
          hours_count,
          customer:customers (
            name,
            area,
            budget
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      const ordersWithSpec = ordersData?.map(order => {
        const orderSpec = orderSpecialists.find(os => os.order_id === order.id);
        return {
          ...order,
          order_specialist: orderSpec ? { id: orderSpec.id } : undefined
        };
      });

      setOrders(ordersWithSpec || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل العروض",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuote = async (price: string) => {
    if (!quoteDialog.orderId) return;

    setIsSubmitting(true);
    try {
      const order = orders.find(o => o.id === quoteDialog.orderId);
      if (!order?.order_specialist) {
        throw new Error('Order specialist not found');
      }

      const { error } = await supabase
        .from('order_specialists')
        .update({
          quoted_price: price,
          quoted_at: new Date().toISOString(),
        })
        .eq('id', order.order_specialist.id);

      if (error) throw error;

      toast({
        title: "تم إرسال العرض",
        description: "تم إرسال عرض السعر بنجاح",
      });

      await fetchOrders(specialistId);
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: "خطأ",
        description: "فشل إرسال العرض",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipOrder = async () => {
    if (!quoteDialog.orderId) return;

    setIsSubmitting(true);
    try {
      const order = orders.find(o => o.id === quoteDialog.orderId);
      if (!order?.order_specialist) {
        throw new Error('Order specialist not found');
      }

      const { error } = await supabase
        .from('order_specialists')
        .update({
          is_accepted: false,
          rejected_at: new Date().toISOString(),
          rejection_reason: 'Skipped by specialist'
        })
        .eq('id', order.order_specialist.id);

      if (error) throw error;

      toast({
        title: "تم التجاوز",
        description: "تم تجاوز هذا العرض",
      });

      await fetchOrders(specialistId);
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error skipping order:', error);
      toast({
        title: "خطأ",
        description: "فشل تجاوز العرض",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <h1 className="text-2xl font-bold mb-1">العروض الجديدة</h1>
          <p className="text-sm opacity-90">{orders.length} عرض متاح</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد عروض جديدة</p>
            <p className="text-sm text-muted-foreground mt-2">سنعلمك عند وجود عروض جديدة</p>
          </Card>
        ) : (
          orders.map((order) => {
            const budgetStr = order.customer?.budget || '';
            const numericBudget = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
            const baseBudget = !isNaN(numericBudget) && numericBudget > 0 ? numericBudget : 0;
            
            const priceOptions = baseBudget > 0 ? [
              { label: `${baseBudget} ريال`, value: `${baseBudget} QAR` },
              { label: `${baseBudget + 3} ريال`, value: `${baseBudget + 3} QAR` },
              { label: `${baseBudget + 6} ريال`, value: `${baseBudget + 6} QAR` },
              { label: `${baseBudget + 9} ريال`, value: `${baseBudget + 9} QAR` },
            ] : [];

            return (
              <Card 
                key={order.id}
                className="overflow-hidden border-primary border-2 shadow-lg animate-fade-in"
              >
                {/* New Order Indicator */}
                <div className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 p-4">
                  <div className="flex items-center gap-2 text-primary-foreground">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <span className="text-sm font-bold">عرض جديد - قدم سعرك</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Customer Info */}
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {order.customer?.name}
                    </h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      <span>
                        {new Date(order.created_at).toLocaleDateString('ar-QA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Package className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">الخدمة</p>
                        <p className="font-bold text-sm">{order.service_type}</p>
                      </div>
                    </div>

                    {order.customer?.area && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">المنطقة</p>
                          <p className="font-bold text-sm">{order.customer.area}</p>
                        </div>
                      </div>
                    )}

                    {order.booking_type && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">نوع الحجز</p>
                          <p className="font-bold text-sm">{order.booking_type}</p>
                        </div>
                      </div>
                    )}

                    {order.hours_count && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">المدة</p>
                          <p className="font-bold text-sm">{order.hours_count} ساعات</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-1 font-bold">ملاحظات</p>
                        <p className="text-sm leading-relaxed">{order.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Quote Button */}
                  <Dialog 
                    open={quoteDialog.open && quoteDialog.orderId === order.id} 
                    onOpenChange={(open) => {
                      if (!open) setQuoteDialog({ open: false, orderId: null });
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => setQuoteDialog({ open: true, orderId: order.id })}
                        className="w-full h-14 text-base font-bold shadow-lg"
                      >
                        <Tag className="h-5 w-5 ml-2" />
                        قدم عرض السعر
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>اختر السعر المناسب</DialogTitle>
                        <DialogDescription>
                          {baseBudget > 0 
                            ? `ميزانية العميل: ${baseBudget} ريال - اختر السعر المناسب`
                            : "اختر السعر المناسب لك"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-4">
                        {priceOptions.length > 0 ? (
                          <>
                            <Button
                              onClick={() => handleSubmitQuote(priceOptions[0].value)}
                              disabled={isSubmitting}
                              variant="default"
                              className="w-full h-auto py-4 flex flex-col gap-1"
                            >
                              <span className="text-lg font-bold">{priceOptions[0].label}</span>
                              <span className="text-xs opacity-80">سعر العميل</span>
                            </Button>
                            
                            <div className="grid grid-cols-3 gap-2">
                              {priceOptions.slice(1).map((option, index) => (
                                <Button
                                  key={index + 1}
                                  onClick={() => handleSubmitQuote(option.value)}
                                  disabled={isSubmitting}
                                  variant="outline"
                                  className="h-auto py-3 flex flex-col gap-1"
                                >
                                  <span className="text-base font-bold">{option.label}</span>
                                  <span className="text-xs opacity-80">+{(index + 1) * 3}</span>
                                </Button>
                              ))}
                            </div>
                            <div className="pt-2 border-t">
                              <Button
                                onClick={handleSkipOrder}
                                disabled={isSubmitting}
                                variant="ghost"
                                className="w-full"
                              >
                                تجاوز هذا العرض
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">لم يحدد العميل ميزانية</p>
                            <Button
                              onClick={handleSkipOrder}
                              disabled={isSubmitting}
                              variant="outline"
                              className="w-full"
                            >
                              تجاوز هذا العرض
                            </Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <BottomNavigation newOrdersCount={orders.length} />
    </div>
  );
}
