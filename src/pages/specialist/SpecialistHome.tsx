import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Navigation, Calendar, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import { translateOrderDetails } from "@/lib/translateHelper";
import { parseISO, format, isToday, isFuture } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { firebaseNotifications } from "@/lib/firebaseNotifications";

import { useLanguage } from "@/hooks/useLanguage";

interface Order {
  id: string;
  service_type: string;
  booking_date: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  building_info: string | null;
  customer: {
    name: string;
    area: string | null;
  } | null;
  order_specialist?: {
    quoted_price: string | null;
  };
  translated?: {
    service_type?: string;
    area?: string;
  };
}

export default function SpecialistHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [preferredLanguage, setPreferredLanguage] = useState('ar');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  useEffect(() => {
    checkAuth();
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    fetchOrders(specialistId);
    fetchNewOrdersCount(specialistId);

    const channel = supabase
      .channel('specialist-home-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        () => {
          fetchOrders(specialistId);
          fetchNewOrdersCount(specialistId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders(specialistId);
          fetchNewOrdersCount(specialistId);
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
          .select('id, preferred_language')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          setSpecialistId(specialist.id);
          setPreferredLanguage(specialist.preferred_language || 'ar');
          
          // 🔥 Initialize Firebase Push Notifications
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🚀 [SPECIALIST] Initializing Firebase for:', specialist.id);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          try {
            await firebaseNotifications.initialize(specialist.id);
            console.log('✅ [SPECIALIST] Firebase initialized successfully');
          } catch (error) {
            console.error('❌ [SPECIALIST] Failed to initialize Firebase:', error);
          }
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
        .select('order_id, quoted_price')
        .eq('specialist_id', specId)
        .eq('is_accepted', true);

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
          service_type,
          booking_date,
          gps_latitude,
          gps_longitude,
          building_info,
          customer:customers (
            name,
            area
          )
        `)
        .in('id', orderIds)
        .gte('booking_date', new Date().toISOString().split('T')[0]) // Only show today and future orders
        .neq('status', 'completed') // Hide completed orders
        .order('booking_date', { ascending: true });

      const ordersWithQuotes = ordersData?.map(order => {
        const orderSpec = orderSpecialists.find(os => os.order_id === order.id);
        return {
          ...order,
          order_specialist: orderSpec ? {
            quoted_price: orderSpec.quoted_price
          } : undefined
        };
      }) || [];

      // Show orders immediately without translation
      setOrders(ordersWithQuotes);
      setIsLoading(false);

      // Translate in background if needed (non-blocking)
      if (preferredLanguage && preferredLanguage !== 'ar' && ordersWithQuotes.length > 0) {
        Promise.all(ordersWithQuotes.map(async (order) => {
          const translated = await translateOrderDetails({
            serviceType: order.service_type,
            area: order.customer?.area || undefined,
          }, preferredLanguage);
          
          return {
            ...order,
            translated: {
              service_type: translated.serviceType,
              area: translated.area,
            }
          };
        })).then(translatedOrders => {
          setOrders(translatedOrders);
        }).catch(error => {
          console.error('Translation error (non-critical):', error);
        });
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الطلبات",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const fetchNewOrdersCount = async (specId: string) => {
    try {
      const now = new Date().toISOString();
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          id,
          order_id,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specId)
        .is('quoted_price', null)
        .is('rejected_at', null);

      if (!orderSpecialists) {
        setNewOrdersCount(0);
        return;
      }

      const validOrders = orderSpecialists.filter((os: any) => {
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true;
        return new Date(expiresAt) > new Date(now);
      });

      setNewOrdersCount(validOrders.length);
    } catch (error) {
      console.error('Error fetching new orders count:', error);
      setNewOrdersCount(0);
    }
  };

  const canMoveNow = (bookingDate: string | null) => {
    if (!bookingDate) return false;
    
    try {
      const bookingDateTime = parseISO(bookingDate);
      const moveTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
      return currentTime >= moveTime;
    } catch (error) {
      return false;
    }
  };

  const getTimeUntilMovement = (bookingDate: string | null) => {
    if (!bookingDate) return null;
    
    try {
      const bookingDateTime = parseISO(bookingDate);
      const moveTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
      const totalSeconds = Math.floor((moveTime.getTime() - currentTime.getTime()) / 1000);
      
      if (totalSeconds <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return { days, hours, minutes, seconds };
    } catch (error) {
      return null;
    }
  };

  const isOrderToday = (bookingDate: string | null) => {
    if (!bookingDate) return false;
    try {
      return isToday(parseISO(bookingDate));
    } catch {
      return false;
    }
  };

  const isOrderFuture = (bookingDate: string | null) => {
    if (!bookingDate) return false;
    try {
      const date = parseISO(bookingDate);
      return isFuture(date) && !isToday(date);
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Display only first 3 orders
  const displayOrders = orders.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <div>
            <h1 className="text-2xl font-bold mb-1">{isAr ? 'مرحباً' : 'Welcome'}, {specialistName}</h1>
            <p className="text-sm opacity-90">{isAr ? 'طلباتك المقبولة' : 'Your accepted orders'}</p>
          </div>
        </div>
      </div>

      {/* Tools + Orders List */}
      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {displayOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{isAr ? 'لا توجد طلبات مقبولة حالياً' : 'No accepted orders yet'}</p>
          </Card>
        ) : (
          displayOrders.map((order) => {
            const isTodayOrder = isOrderToday(order.booking_date);
            const isFutureOrder = isOrderFuture(order.booking_date);
            const canMove = canMoveNow(order.booking_date);
            const timeUntil = getTimeUntilMovement(order.booking_date);

            return (
              <Card 
                key={order.id}
                className={cn(
                  "overflow-hidden transition-all",
                  isTodayOrder && canMove && "border-green-500 border-2 shadow-lg shadow-green-500/20",
                  isTodayOrder && !canMove && "border-green-500 border-2 shadow-lg",
                  isFutureOrder && "border-destructive border-2 opacity-75"
                )}
              >
                {/* Status Indicator */}
                <div className={cn(
                  "h-2 w-full",
                  isTodayOrder && canMove && "bg-green-500 animate-pulse",
                  isTodayOrder && !canMove && "bg-green-500",
                  isFutureOrder && "bg-destructive"
                )} />

                <div className="p-5 space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      isTodayOrder && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      isFutureOrder && "bg-destructive/10 text-destructive"
                    )}>
                      {isTodayOrder 
                        ? (isAr ? "⭐ طلب اليوم" : "⭐ Today's Order")
                        : (isAr ? "📅 طلب قادم" : "📅 Upcoming Order")
                      }
                    </div>
                    {order.booking_date && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(order.booking_date), "d MMMM yyyy - h:mm a", { locale: isAr ? ar : enUS })}
                      </div>
                    )}
                  </div>

                  {/* Customer Info */}
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {order.customer?.name}
                    </h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{order.translated?.area || order.customer?.area || (isAr ? 'غير محدد' : 'Not specified')}</span>
                      {order.translated && preferredLanguage !== 'ar' && (
                        <Globe className="h-3 w-3 text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Service and Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <div className="flex items-center gap-2 justify-between mb-1">
                        <p className="text-xs text-muted-foreground">{isAr ? 'الخدمة' : 'Service'}</p>
                        {order.translated && preferredLanguage !== 'ar' && (
                          <Globe className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                      <p className="font-bold text-sm">{order.translated?.service_type || order.service_type}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-muted-foreground mb-1">{isAr ? 'السعر المتفق عليه' : 'Agreed price'}</p>
                      <p className="font-bold text-sm text-green-700 dark:text-green-300">
                        {order.order_specialist?.quoted_price}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  {isTodayOrder && (
                    <Button
                      onClick={() => navigate(`/order-tracking/${order.id}`)}
                      disabled={!canMove}
                      className={cn(
                        "w-full h-14 text-base font-bold shadow-lg transition-all",
                        canMove && "bg-green-600 hover:bg-green-700 animate-pulse"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-5 w-5" />
                        <span>{canMove ? (isAr ? "انطلق الآن" : "Start now") : (isAr ? "انتظر الموعد" : "Wait for time")}</span>
                      </div>
                        {timeUntil && (
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full font-mono text-sm",
                            canMove ? "bg-white/20" : "bg-destructive/20"
                          )}>
                            <Clock className="h-4 w-4" />
                            <span>
                              {timeUntil.days > 0 && `${timeUntil.days}${isAr ? 'ي ' : 'd '}`}
                              {String(timeUntil.hours).padStart(2, '0')}:
                              {String(timeUntil.minutes).padStart(2, '0')}:
                              {String(timeUntil.seconds).padStart(2, '0')}
                            </span>
                          </div>
                        )}
                      </div>
                    </Button>
                  )}

                  {isFutureOrder && timeUntil && (
                    <div className="text-center p-4 bg-destructive/10 rounded-lg space-y-2">
                      <p className="text-sm text-destructive font-bold">
                        {isAr ? '⏳ سيفتح الطلب قبل الموعد بساعة' : '⏳ Order opens one hour before appointment'}
                      </p>
                      <div className="flex items-center justify-center gap-2 text-destructive font-mono text-lg">
                        <Clock className="h-5 w-5" />
                        <span>
                          {timeUntil.days > 0 && (isAr ? `${timeUntil.days} يوم و ` : `${timeUntil.days} day and `)}
                          {String(timeUntil.hours).padStart(2, '0')}:
                          {String(timeUntil.minutes).padStart(2, '0')}:
                          {String(timeUntil.seconds).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isAr ? 'الوقت المتبقي حتى فتح الطلب' : 'Time remaining until opening'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {orders.length > 3 && (
          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              {isAr ? 'عرض 3 من' : 'Showing 3 of'} {orders.length} {isAr ? 'طلب • للمزيد انتقل للإحصائيات' : 'orders • See Stats for more'}
            </p>
          </div>
        )}
      </div>

      <BottomNavigation newOrdersCount={newOrdersCount} />
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
