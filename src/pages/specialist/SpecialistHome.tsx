import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Navigation, Calendar, Globe, Wallet, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import BusyGuard from "@/components/specialist/BusyGuard";
import { translateOrderDetails } from "@/lib/translateHelper";
import { parseISO, format, isToday, isFuture } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { firebaseNotifications } from "@/lib/firebaseNotifications";
import { ReadinessCheckDialog } from "@/components/specialist/ReadinessCheckDialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { getSoundNotification } from "@/lib/soundNotification";
import { useSpecialistCompanyCountry } from "@/hooks/useCompanyCountry";
import { TranslateButton } from "@/components/specialist/TranslateButton";

interface Order {
  id: string;
  order_number: string | null;
  service_type: string;
  booking_date: string | null;
  booking_time: string | null;
  booking_type: string | null;
  hours_count: number | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  building_info: string | null;
  notes: string | null;
  status: string;
  customer: {
    name: string;
    area: string | null;
  } | null;
  customers?: {
    name: string;
    area: string | null;
  };
  order_specialist?: {
    quoted_price: string | null;
  };
  translated?: {
    service_type?: string;
    area?: string;
    building_info?: string;
    notes?: string;
  };
}

export default function SpecialistHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [preferredLanguage, setPreferredLanguage] = useState('ar');
  const [readinessCheckOrder, setReadinessCheckOrder] = useState<string | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [translatedNotes, setTranslatedNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language, initializeLanguage, setLanguage } = useLanguage();
  const t = useTranslation(language);
  const isAr = language === 'ar';
  const { currencySymbol, currency, isLoading: currencyLoading } = useSpecialistCompanyCountry(specialistId);
  
  useEffect(() => {
    initializeLanguage();
    checkAuth();
    fetchGoogleMapsKey();
  }, []);

  const fetchGoogleMapsKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) throw error;
      if (data?.apiKey) {
        setGoogleMapsApiKey(data.apiKey);
      }
    } catch (error) {
      console.error('Error fetching Google Maps API key:', error);
    }
  };

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
          console.log('🔄 [Realtime] order_specialists changed, refreshing data...');
          fetchOrders(specialistId);
          fetchNewOrdersCount(specialistId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🔄 [Realtime] orders changed, refreshing data...');
          fetchOrders(specialistId);
          fetchNewOrdersCount(specialistId);
          
          // Check if this is a readiness check update
          if (payload.new && typeof payload.new === 'object') {
            const newOrder = payload.new as any;
            if (newOrder.specialist_id === specialistId &&
                newOrder.specialist_readiness_status === 'pending' && 
                newOrder.readiness_check_sent_at &&
                !newOrder.specialist_readiness_response_at) {
              setReadinessCheckOrder(newOrder.id);
            }
          }
        }
      )
      .subscribe();

    // Listen for navigation events from push notifications
    const handleNavigationEvent = () => {
      console.log('📱 [Navigation Event] Detected, refreshing orders...');
      fetchOrders(specialistId);
      fetchNewOrdersCount(specialistId);
    };

    // Listen for readiness check notifications
    const handleReadinessCheck = (event: any) => {
      console.log('⏰ [READINESS EVENT] Received:', event.detail);
      const { orderId } = event.detail;
      
      if (orderId) {
        // Play urgent sound notification
        const soundNotif = getSoundNotification();
        soundNotif.playNewOrderSound();
        
        // Show readiness dialog
        setReadinessCheckOrder(orderId);
        
        // Show toast
        toast({
          title: isAr ? "⏰ تأكيد الجاهزية" : "⏰ Readiness Check",
          description: isAr 
            ? "هل أنت جاهز للطلب القادم؟ يرجى التأكيد" 
            : "Are you ready for the upcoming order? Please confirm",
          duration: 10000,
        });
        
        // Refresh orders
        fetchOrders(specialistId);
      }
    };

    window.addEventListener('specialist-navigate', handleNavigationEvent);
    window.addEventListener('readiness-check-received', handleReadinessCheck);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('specialist-navigate', handleNavigationEvent);
      window.removeEventListener('readiness-check-received', handleReadinessCheck);
    };
  }, [specialistId, isAr, toast]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('🔐 [AUTH] User data:', user);
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone, user_id')
        .eq('user_id', user.id)
        .single();

      console.log('👤 [PROFILE] Profile data:', profile, 'Error:', profileError);

      if (profile) {
        setSpecialistName(profile.full_name);
        
        const { data: specialist, error: specialistError } = await supabase
          .from('specialists')
          .select('id, name, phone, preferred_language, is_active, suspension_type, suspension_reason, company_id')
          .eq('phone', profile.phone)
          .single();

        console.log('⭐ [SPECIALIST] Specialist data:', specialist, 'Error:', specialistError);

        if (specialist) {
          // Check for PERMANENT suspension - force logout
          if (!specialist.is_active && specialist.suspension_type === 'permanent') {
            console.log('🚫 [PERMANENT SUSPENSION] Logging out specialist');
            await supabase.auth.signOut();
            toast({
              title: isAr ? "حساب موقوف نهائياً 🚫" : "Account Permanently Suspended 🚫",
              description: isAr 
                ? 'تم إيقاف حسابك بشكل نهائي. للمزيد من المعلومات، يرجى مراجعة الإدارة.'
                : 'Your account has been permanently suspended. For more information, please contact administration.',
              variant: "destructive",
              duration: 10000,
            });
            navigate('/specialist-auth');
            return;
          }

          console.log('✅ [SPECIALIST] Setting specialist ID:', specialist.id);
          setSpecialistId(specialist.id);
          
          // Set language from database
          const dbLanguage = specialist.preferred_language || 'ar';
          setPreferredLanguage(dbLanguage);
          setLanguage(dbLanguage as 'ar' | 'en');
          
          // Set company ID
          if (specialist.company_id) {
            setCompanyId(specialist.company_id);
          }
          
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
        } else {
          console.error('❌ [SPECIALIST] No specialist found for phone:', profile.phone);
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchOrders = async (specId: string) => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [SpecialistHome] Fetching orders for specialist:', specId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setIsLoading(true);

      // First, verify authentication
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔐 [FETCH] Current user:', user?.id);

      // Get all accepted orders for this specialist from order_specialists
      const { data: acceptedOrderSpecs, error: orderSpecsError } = await supabase
        .from('order_specialists')
        .select('order_id')
        .eq('specialist_id', specId)
        .eq('is_accepted', true);

      if (orderSpecsError) {
        console.error('❌ Error fetching accepted order specialists:', orderSpecsError);
        throw orderSpecsError;
      }

      const acceptedOrderIds = acceptedOrderSpecs?.map(os => os.order_id) || [];
      console.log('✅ Accepted order IDs:', acceptedOrderIds);

      // Get confirmed orders (show all confirmed orders regardless of date)
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            name,
            whatsapp_number,
            area
          )
        `)
        .in('status', ['upcoming', 'in_progress'])
        .order('booking_date', { ascending: true });

      // Filter to show orders where:
      // - specialist_id matches OR order_id is in accepted orders list
      if (acceptedOrderIds.length > 0) {
        query = query.or(`specialist_id.eq.${specId},id.in.(${acceptedOrderIds.join(',')})`);
      } else {
        query = query.eq('specialist_id', specId);
      }

      const { data: ordersData, error: ordersError } = await query;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 [SpecialistHome] Orders query result:');
      console.log('   Specialist ID:', specId);
      console.log('   Count:', ordersData?.length || 0);
      console.log('   Error:', ordersError);
      console.log('   Orders:', JSON.stringify(ordersData, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (ordersError) {
        console.error('❌ [SpecialistHome] Error fetching orders:', ordersError);
      }

      if (!ordersData || ordersData.length === 0) {
        console.log('⚠️ [SpecialistHome] No orders found');
        setOrders([]);
        setIsLoading(false);
        return;
      }

      // Get quoted prices for these orders
      const orderIds = ordersData.map(o => o.id);
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select('order_id, quoted_price')
        .eq('specialist_id', specId)
        .in('order_id', orderIds);

      const ordersWithQuotes = ordersData.map((order: any) => {
        const orderSpec = orderSpecialists?.find(os => os.order_id === order.id);
        return {
          ...order,
          customer: order.customers || order.customer || null,
          order_specialist: orderSpec ? {
            quoted_price: orderSpec.quoted_price
          } : undefined
        };
      });

      // Show orders immediately without translation
      setOrders(ordersWithQuotes);
      setIsLoading(false);

      // Translate in background if needed (non-blocking)
      if (preferredLanguage && preferredLanguage !== 'ar' && ordersWithQuotes.length > 0) {
        Promise.all(ordersWithQuotes.map(async (order) => {
          const translated = await translateOrderDetails({
            serviceType: order.service_type,
            area: order.customer?.area || undefined,
            buildingInfo: order.building_info || undefined,
            notes: order.notes || undefined,
          }, preferredLanguage);
          
          return {
            ...order,
            translated: {
              service_type: translated.serviceType,
              area: translated.area,
              building_info: translated.buildingInfo,
              notes: translated.notes,
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

  const canMoveNow = (bookingDate: string | null, bookingTime: string | null) => {
    if (!bookingDate) return false;
    
    try {
      // Extract start time if bookingTime is a range (e.g., "10:00-11:00" or "10:00 AM-11:00 AM")
      let timeToUse = bookingTime;
      if (bookingTime && bookingTime.includes('-')) {
        timeToUse = bookingTime.split('-')[0].trim();
      }
      
      // Convert 12-hour format to 24-hour format if needed (e.g., "10:00 AM" -> "10:00")
      if (timeToUse && (timeToUse.includes('AM') || timeToUse.includes('PM'))) {
        const isPM = timeToUse.includes('PM');
        const timeOnly = timeToUse.replace(/\s?(AM|PM)/gi, '').trim();
        const [hours, minutes] = timeOnly.split(':').map(Number);
        
        let hours24 = hours;
        if (isPM && hours !== 12) {
          hours24 = hours + 12;
        } else if (!isPM && hours === 12) {
          hours24 = 0;
        }
        
        timeToUse = `${String(hours24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
      }
      
      // Combine date and time if time is available
      const dateTimeString = timeToUse 
        ? `${bookingDate}T${timeToUse}`
        : bookingDate;
      const bookingDateTime = parseISO(dateTimeString);
      
      // Check if the parsed date is valid
      if (isNaN(bookingDateTime.getTime())) {
        console.error('Invalid date parsed in canMoveNow:', { bookingDate, bookingTime, timeToUse, dateTimeString });
        return false;
      }
      
      const moveTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
      return currentTime >= moveTime;
    } catch (error) {
      console.error('Error in canMoveNow:', error, { bookingDate, bookingTime });
      return false;
    }
  };

  const getTimeUntilMovement = (bookingDate: string | null, bookingTime: string | null) => {
    if (!bookingDate) return null;
    
    try {
      // Extract start time if bookingTime is a range (e.g., "10:00-11:00" or "10:00 AM-11:00 AM")
      let timeToUse = bookingTime;
      if (bookingTime && bookingTime.includes('-')) {
        timeToUse = bookingTime.split('-')[0].trim();
      }
      
      // Convert 12-hour format to 24-hour format if needed (e.g., "10:00 AM" -> "10:00")
      if (timeToUse && (timeToUse.includes('AM') || timeToUse.includes('PM'))) {
        const isPM = timeToUse.includes('PM');
        const timeOnly = timeToUse.replace(/\s?(AM|PM)/gi, '').trim();
        const [hours, minutes] = timeOnly.split(':').map(Number);
        
        let hours24 = hours;
        if (isPM && hours !== 12) {
          hours24 = hours + 12;
        } else if (!isPM && hours === 12) {
          hours24 = 0;
        }
        
        timeToUse = `${String(hours24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
      }
      
      // Combine date and time if time is available
      const dateTimeString = timeToUse 
        ? `${bookingDate}T${timeToUse}`
        : bookingDate;
      const bookingDateTime = parseISO(dateTimeString);
      
      // Check if the parsed date is valid
      if (isNaN(bookingDateTime.getTime())) {
        console.error('Invalid date parsed:', { bookingDate, bookingTime, timeToUse, dateTimeString });
        return null;
      }
      
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
      console.error('Error calculating time until movement:', error, { bookingDate, bookingTime });
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

  const isOrderOverdue = (order: Order) => {
    if (!order.booking_date || order.status === 'completed' || order.status === 'cancelled') return false;
    
    const bookingDateTime = new Date(order.booking_date);
    
    // Parse booking time
    if (order.booking_time) {
      if (order.booking_time === 'morning') {
        bookingDateTime.setHours(8, 0, 0, 0);
      } else if (order.booking_time === 'afternoon') {
        bookingDateTime.setHours(14, 0, 0, 0);
      } else if (order.booking_time === 'evening') {
        bookingDateTime.setHours(18, 0, 0, 0);
      } else {
        const [hours, minutes] = order.booking_time.split(':').map(Number);
        bookingDateTime.setHours(hours, minutes, 0, 0);
      }
    } else {
      bookingDateTime.setHours(8, 0, 0, 0);
    }
    
    return new Date() > bookingDateTime;
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
    <BusyGuard specialistId={specialistId} allowWhenBusy={false}>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header - Optimized for Mobile */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 text-white shadow-lg">
        <div className="w-full px-3 py-3 sm:px-6 sm:py-4">
          {/* Top Row: Name, Wallet and Settings */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold mb-0.5 drop-shadow-lg truncate">
                {isAr ? 'مرحباً' : 'Welcome'}, {specialistName}
              </h1>
              <p className="text-xs sm:text-sm opacity-90 font-medium">
                {isAr ? '✅ طلباتك المؤكدة' : '✅ Your Confirmed Bookings'}
              </p>
            </div>
            
            {/* Wallet Display and Settings Button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Wallet Display */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/30">
                <div className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 leading-none">{t.specialist.wallet}</p>
                    <p className="text-sm font-bold leading-tight">
                      {currencyLoading ? '...' : `0 ${currencySymbol}`}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Settings Button */}
              <Button
                onClick={() => navigate('/specialist/profile')}
                variant="secondary"
                size="sm"
                className="h-10 w-10 p-0"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Bottom Row: Refresh Button Only */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Refresh Button */}
            <Button
              onClick={() => {
                console.log('🔄 [MANUAL] Manual refresh triggered');
                if (specialistId) {
                  fetchOrders(specialistId);
                  fetchNewOrdersCount(specialistId);
                }
              }}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-8 shadow-md"
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tools + Orders List - Mobile Optimized */}
      <div className="w-full px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 max-w-screen-lg mx-auto">
        {displayOrders.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center shadow-lg">
            <p className="text-muted-foreground text-base sm:text-lg">{isAr ? 'لا توجد طلبات مؤكدة حالياً' : 'No confirmed bookings yet'}</p>
          </Card>
        ) : (
          displayOrders.map((order) => {
            const isTodayOrder = isOrderToday(order.booking_date);
            const isFutureOrder = isOrderFuture(order.booking_date);
            const canMove = canMoveNow(order.booking_date, order.booking_time);
            const timeUntil = getTimeUntilMovement(order.booking_date, order.booking_time);
            const isOverdue = isOrderOverdue(order);

            // Debug logging
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 Order Debug:', {
              orderId: order.id,
              orderNumber: order.order_number,
              bookingDate: order.booking_date,
              bookingTime: order.booking_time,
              isTodayOrder,
              isFutureOrder,
              canMove,
              timeUntil,
              isOverdue,
              currentTime: currentTime.toISOString(),
            });
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            return (
              <Card 
                key={order.id}
                className={cn(
                  "overflow-hidden transition-all",
                  isTodayOrder && canMove && "border-green-500 border-2 shadow-lg shadow-green-500/20",
                  isTodayOrder && !canMove && "border-green-500 border-2 shadow-lg",
                  isFutureOrder && !isOverdue && "border-destructive border-2 opacity-75",
                  isOverdue && "border-destructive border-2 animate-pulse"
                )}
              >
                {/* Status Indicator */}
                <div className={cn(
                  "h-2 w-full",
                  isTodayOrder && canMove && "bg-green-500 animate-pulse",
                  isTodayOrder && !canMove && "bg-green-500",
                  isFutureOrder && !isOverdue && "bg-destructive",
                  isOverdue && "bg-destructive animate-pulse"
                )} />

                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Status Badge - Mobile Optimized */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className={cn(
                      "px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap",
                      isTodayOrder && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      isFutureOrder && !isOverdue && "bg-destructive/10 text-destructive",
                      isOverdue && "bg-destructive text-destructive-foreground animate-pulse"
                    )}>
                      {isOverdue
                        ? (isAr ? "⚠️ متأخر" : "⚠️ Overdue")
                        : isTodayOrder 
                          ? (isAr ? "⭐ طلب اليوم" : "⭐ Today")
                          : (isAr ? "✅ مؤكد" : "✅ Confirmed")
                      }
                    </div>
                    {order.booking_date && (
                      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {(() => {
                            try {
                              const dateTimeString = order.booking_time 
                                ? `${order.booking_date}T${order.booking_time}`
                                : order.booking_date;
                              return format(parseISO(dateTimeString), "d MMM yyyy - h:mm a", { locale: isAr ? ar : enUS });
                            } catch (error) {
                              return format(parseISO(order.booking_date), "d MMM yyyy", { locale: isAr ? ar : enUS });
                            }
                          })()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Order Number - Mobile Optimized */}
                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-2 sm:p-3 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{isAr ? 'رقم الطلب' : 'Order #'}</span>
                      <span className="text-base sm:text-lg font-bold text-primary">{order.order_number || `#${order.id.split('-')[0]}`}</span>
                    </div>
                  </div>

                  {/* Customer Info - Mobile Optimized */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground mb-1.5 sm:mb-2">
                      {order.customer?.name}
                    </h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span className="truncate">{order.translated?.area || order.customer?.area || (isAr ? 'غير محدد' : 'Not specified')}</span>
                      {order.translated && preferredLanguage !== 'ar' && (
                        <Globe className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Location Map - Mobile Optimized */}
                  {order.gps_latitude && order.gps_longitude && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="relative rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-90 transition-opacity group">
                          {googleMapsApiKey ? (
                            <img
                              src={`https://maps.googleapis.com/maps/api/staticmap?center=${order.gps_latitude},${order.gps_longitude}&zoom=15&size=600x300&markers=color:red%7C${order.gps_latitude},${order.gps_longitude}&key=${googleMapsApiKey}&scale=2`}
                              alt={isAr ? 'موقع العميل' : 'Customer Location'}
                              className="w-full h-[150px] sm:h-[180px] object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div className="w-full h-[150px] sm:h-[180px] bg-muted flex items-center justify-center" style={{ display: googleMapsApiKey ? 'none' : 'flex' }}>
                            <div className="text-center space-y-1.5 sm:space-y-2 px-3">
                              <MapPin className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto" />
                              <p className="text-xs sm:text-sm font-medium">{isAr ? 'اضغط لعرض الموقع' : 'Tap to view location'}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {`${order.gps_latitude.toFixed(4)}°, ${order.gps_longitude.toFixed(4)}°`}
                              </p>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>{isAr ? 'موقع العميل' : 'Customer Location'}</DialogTitle>
                          <DialogDescription>
                            {order.customer?.area || (isAr ? 'موقع العميل على الخريطة' : 'Customer location on map')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="relative rounded-lg overflow-hidden border border-border h-[500px]">
                          <style dangerouslySetInnerHTML={{ __html: `
                            .gm-style-iw-c,
                            .gm-style-iw-t,
                            a[href^="https://maps.google.com/maps"],
                            .gm-style a[href^="https://maps.google.com/maps"],
                            .gm-style-cc {
                              display: none !important;
                            }
                          `}} />
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            style={{ border: 0 }}
                            src={`https://www.google.com/maps?q=${order.gps_latitude},${order.gps_longitude}&output=embed&z=16&disableDefaultUI=1&gestureHandling=greedy`}
                            allowFullScreen
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Booking Details - Mobile Optimized */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Booking Type */}
                    <div className="bg-purple-50 dark:bg-purple-950/30 p-2 sm:p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 mb-0.5 sm:mb-1 font-medium">{isAr ? 'نوع الحجز' : 'Type'}</p>
                      <p className="font-bold text-xs sm:text-sm text-purple-700 dark:text-purple-300 leading-tight">
                        {order.booking_type === 'one_time' && (isAr ? '🏠 مرة واحدة' : '🏠 One Time')}
                        {order.booking_type === 'weekly' && (isAr ? '📅 أسبوعي' : '📅 Weekly')}
                        {order.booking_type === 'bi_weekly' && (isAr ? '📅 نصف شهري' : '📅 Bi-Weekly')}
                        {order.booking_type === 'monthly' && (isAr ? '📅 شهري' : '📅 Monthly')}
                        {!order.booking_type && (isAr ? 'غير محدد' : 'Not specified')}
                      </p>
                    </div>

                    {/* Hours Count */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-2 sm:p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1 font-medium">{isAr ? 'عدد الساعات' : 'Hours'}</p>
                      <p className="font-bold text-xs sm:text-sm text-blue-700 dark:text-blue-300 leading-tight">
                        {order.hours_count ? `⏰ ${order.hours_count} ${isAr ? 'ساعة' : 'h'}` : (isAr ? 'غير محدد' : 'N/A')}
                      </p>
                    </div>
                  </div>

                  {/* Time and Service - Mobile Optimized */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-primary/10 p-2 sm:p-2.5 rounded-lg">
                      <div className="flex items-center gap-1 justify-between mb-0.5 sm:mb-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{isAr ? 'الخدمة' : 'Service'}</p>
                        {order.translated && preferredLanguage !== 'ar' && (
                          <Globe className="h-3 w-3 text-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="font-bold text-xs sm:text-sm leading-tight line-clamp-2">{order.translated?.service_type || order.service_type}</p>
                    </div>
                    
                    {/* Start Time - Mobile Optimized */}
                    <div className="bg-orange-50 dark:bg-orange-950/30 p-2 sm:p-2.5 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 mb-0.5 sm:mb-1 font-medium">{isAr ? 'وقت البدء' : 'Start'}</p>
                      <p className="font-bold text-xs sm:text-sm text-orange-700 dark:text-orange-300 leading-tight">
                        {order.booking_time ? (
                          (() => {
                            try {
                              const dateTimeString = `${order.booking_date}T${order.booking_time}`;
                              const time = format(parseISO(dateTimeString), "h:mm a", { locale: isAr ? ar : enUS });
                              return `🕐 ${time}`;
                            } catch {
                              return order.booking_time;
                            }
                          })()
                        ) : (isAr ? 'غير محدد' : 'N/A')}
                      </p>
                    </div>
                  </div>

                  {/* Agreed Price - Mobile Optimized */}
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 sm:p-3.5 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mb-1 font-medium">{isAr ? 'السعر المتفق عليه' : 'Agreed Price'}</p>
                    <p className="font-bold text-base sm:text-lg text-green-700 dark:text-green-300">
                      💰 {order.order_specialist?.quoted_price}
                    </p>
                  </div>

                  {/* Customer Notes - Mobile Optimized */}
                  {order.notes && order.notes.trim() !== '' && !order.notes.includes('Terms and Conditions') && (
                    <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 sm:p-3.5 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                        <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                          💬 {isAr ? 'ملاحظات العميل' : 'Customer Notes'}
                        </p>
                        <TranslateButton
                          text={order.notes}
                          onTranslated={(translated) => setTranslatedNotes(prev => ({ ...prev, [order.id]: translated }))}
                          sourceLanguage="ar"
                          size="sm"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed">
                        {translatedNotes[order.id] || order.translated?.notes || order.notes}
                      </p>
                    </div>
                  )}


                  {/* Countdown Timer - Mobile Optimized */}
                  {!canMove && timeUntil && (timeUntil.days > 0 || timeUntil.hours > 0 || timeUntil.minutes > 0 || timeUntil.seconds > 0) && (
                    <div className={cn(
                      "p-3 sm:p-4 rounded-xl space-y-2 sm:space-y-3 text-center",
                      isTodayOrder ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" : "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
                    )}>
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        <Clock className={cn(
                          "h-4 w-4 sm:h-5 sm:w-5 animate-pulse",
                          isTodayOrder ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"
                        )} />
                        <p className={cn(
                          "font-bold text-xs sm:text-sm",
                          isTodayOrder ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"
                        )}>
                          {isAr ? 'سيفتح الطلب بعد' : 'Order opens in'}
                        </p>
                      </div>
                      
                      {/* Large Countdown Display - Mobile Optimized */}
                      <div className={cn(
                        "font-mono font-bold text-2xl sm:text-3xl md:text-4xl tracking-wider",
                        isTodayOrder ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"
                      )}>
                        {timeUntil.days > 0 && (
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <span className="text-3xl sm:text-4xl md:text-5xl">{timeUntil.days}</span>
                            <span className="text-base sm:text-lg md:text-xl">{isAr ? 'يوم' : 'day'}{timeUntil.days > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                          <span>{String(timeUntil.hours).padStart(2, '0')}</span>
                          <span className="animate-pulse">:</span>
                          <span>{String(timeUntil.minutes).padStart(2, '0')}</span>
                          <span className="animate-pulse">:</span>
                          <span>{String(timeUntil.seconds).padStart(2, '0')}</span>
                        </div>
                      </div>

                      <p className="text-[10px] sm:text-xs text-muted-foreground px-2">
                        {isAr ? 'سيتم فتح الطلب قبل الموعد بساعة واحدة' : 'Order opens one hour before appointment'}
                      </p>
                    </div>
                  )}

                  {/* Action Button - Mobile Optimized */}
                  {isTodayOrder && canMove && (
                    <Button
                      onClick={() => navigate(`/order-tracking/${order.id}`)}
                      className="w-full h-12 sm:h-14 text-sm sm:text-base font-bold shadow-lg transition-all bg-green-600 hover:bg-green-700 animate-pulse"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Navigation className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>{isAr ? "🚀 ابدأ التحرك الآن" : "🚀 Start Moving Now"}</span>
                      </div>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {orders.length > 3 && (
          <div className="text-center pt-3 sm:pt-4 pb-2">
            <p className="text-xs sm:text-sm text-muted-foreground px-3">
              {isAr ? 'عرض 3 من' : 'Showing 3 of'} {orders.length} {isAr ? 'طلب • للمزيد انتقل للإحصائيات' : 'orders • See Stats for more'}
            </p>
          </div>
        )}
      </div>

      <BottomNavigation newOrdersCount={newOrdersCount} specialistId={specialistId} />
      
      {readinessCheckOrder && (
        <ReadinessCheckDialog
          orderId={readinessCheckOrder}
          isOpen={!!readinessCheckOrder}
          onClose={() => setReadinessCheckOrder(null)}
        />
      )}
      </div>
    </BusyGuard>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
