import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Package, FileText, Tag, Sparkles, Globe } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import { translateOrderDetails } from "@/lib/translateHelper";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { getSoundNotification } from "@/lib/soundNotification";
import { firebaseNotifications } from "@/lib/firebaseNotifications";

interface Order {
  id: string;
  created_at: string;
  expires_at: string | null;
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
  isNew?: boolean;
  timeRemaining?: number;
  translated?: {
    service_type?: string;
    notes?: string;
    area?: string;
    booking_type?: string;
  };
}

export default function SpecialistNewOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('ar');
  const [quoteDialog, setQuoteDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set()); // Track new orders for animation
  const [currentTime, setCurrentTime] = useState(Date.now()); // For timer updates
  const [newOrdersCount, setNewOrdersCount] = useState(0); // Dynamic count for badge
  const { toast } = useToast();
  const navigate = useNavigate();
  const soundNotification = useRef(getSoundNotification());
  
  // Language management
  const { language, setLanguage } = useLanguage();
  const t = useTranslation(language);

  useEffect(() => {
    let audioInitialized = false;
    
    const initAudio = async () => {
      if (audioInitialized) return;
      try {
        await soundNotification.current.initialize();
        audioInitialized = true;
        console.log('✅ [AUDIO] تم تهيئة الصوت');
      } catch (error) {
        console.error('❌ [AUDIO] خطأ في تهيئة الصوت:', error);
      }
    };
    
    const setupNotifications = async () => {
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔔 [INIT] بدء تهيئة نظام الإشعارات');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check platform
        const platform = (window as any).Capacitor?.getPlatform();
        console.log(`📱 [PLATFORM] المنصة: ${platform || 'web'}`);
        
        if (!platform || platform === 'web') {
          console.log('ℹ️ [PLATFORM] تشغيل على الويب - تخطي الإشعارات المحلية');
          return;
        }
        
        // Step 1: Request permissions
        console.log('🔐 [STEP 1] طلب أذونات الإشعارات...');
        const permissionResult = await LocalNotifications.requestPermissions();
        console.log(`✅ [PERMISSIONS] ${permissionResult.display}`);
        
        if (permissionResult.display !== 'granted') {
          console.error('❌ [ERROR] لم يتم منح الأذونات!');
          alert('⚠️ يرجى السماح بالإشعارات من إعدادات التطبيق لتلقي عروض العمل');
          return;
        }
        
        // Step 2: Create notification channel (Android only)
        if (platform === 'android') {
          console.log('🔧 [STEP 2] إنشاء قناة الإشعارات للأندرويد...');
          
          try {
            await LocalNotifications.deleteChannel({ id: 'new-orders' });
          } catch (e) {
            // Channel doesn't exist, that's fine
          }
          
          await LocalNotifications.createChannel({
            id: 'new-orders',
            name: 'عروض العمل الجديدة',
            description: 'تنبيهات فورية لعروض العمل الجديدة',
            importance: 5, // MAX - highest priority
            visibility: 1, // PUBLIC
            sound: 'notification_sound.mp3',
            vibration: true,
            lightColor: '#FF0000',
            lights: true,
          });
          
          console.log('✅ [CHANNEL] تم إنشاء قناة الإشعارات بنجاح');
        }
        
        // Step 3: Setup notification click handler to bring app to foreground
        console.log('🔧 [STEP 3] إعداد معالج النقر على الإشعارات...');
        await LocalNotifications.addListener('localNotificationActionPerformed', async (notification) => {
          console.log('👆 [CLICK] تم النقر على الإشعار');
          console.log('🚀 [FOREGROUND] إحضار التطبيق للمقدمة...');
          
          // Bring app to foreground if in background
          const state = await App.getState();
          console.log('📱 [APP STATE]:', state);
          
          if (!state.isActive) {
            console.log('⚡ [ACTION] التطبيق في الخلفية - تنشيطه الآن');
            // The tap itself will bring the app to foreground
          }
          
          navigate('/specialist/new-orders');
        });
        
        console.log('✅ [SUCCESS] تم تهيئة نظام الإشعارات بنجاح');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } catch (error) {
        console.error('❌ [FATAL ERROR] خطأ خطير في تهيئة الإشعارات:', error);
      }
    };
    
    // Initialize audio on first interaction
    const handleFirstInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    setupNotifications();
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      LocalNotifications.removeAllListeners();
    };
  }, [navigate]);

  useEffect(() => {
    checkAuth();
    
    console.log('🚀 [APP START] تطبيق المحترفين - جاهز');
    const platform = (window as any).Capacitor?.getPlatform();
    console.log(`📱 [PLATFORM] ${platform || 'web'}`);
  }, []);

  // Timer to update remaining time and auto-remove expired orders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      
      // Update orders to recalculate time remaining and filter expired
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.filter(order => {
          if (order.expires_at) {
            const expiresAt = new Date(order.expires_at).getTime();
            if (now > expiresAt) {
              console.log(`⏰ Order ${order.id} expired - removing from view`);
              return false; // Remove expired orders
            }
          }
          return true;
        }).map(order => ({
          ...order,
          timeRemaining: order.expires_at 
            ? Math.max(0, Math.floor((new Date(order.expires_at).getTime() - now) / 1000))
            : 0
        }));
        
        return updatedOrders;
      });
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    fetchOrders(specialistId);
    fetchNewOrdersCount(specialistId);

    // Enhanced notification function with GUARANTEED sound + vibration
    const triggerNotification = async (type: 'new' | 'resend' = 'new') => {
      const notificationId = Date.now();
      const title = type === 'resend' ? '🔁 إعادة إرسال طلب' : '🔔 عرض عمل جديد';
      const body = type === 'resend' 
        ? 'تم إعادة إرسال طلب لك - راجعه الآن!'
        : 'لديك عرض عمل جديد - اضغط للمشاهدة';
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚨🚨🚨 [${type.toUpperCase()} NOTIFICATION] #${notificationId} 🚨🚨🚨`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 العنوان:', title);
      console.log('📝 الرسالة:', body);
      console.log('⏰ الوقت:', new Date().toLocaleString('ar-EG'));
      
      try {
        const platform = (window as any).Capacitor?.getPlatform();
        console.log('🖥️ المنصة:', platform || 'web');
        
        // 1. Play sound IMMEDIATELY - HIGHEST PRIORITY! (COMMENTED: Push notifications now handle this)
        // console.log('\n🔊🔊🔊 [خطوة 1/4] تشغيل الصوت...');
        // try {
        //   // Ensure audio context is initialized
        //   await soundNotification.current.initialize();
        //   await soundNotification.current.playNewOrderSound();
        //   console.log('✅✅✅ الصوت: تم التشغيل بنجاح!');
        // } catch (soundError) {
        //   console.error('❌❌❌ الصوت: فشل التشغيل:', soundError);
        //   // Try backup sound method
        //   try {
        //     const audio = new Audio('/notification-sound.mp3');
        //     await audio.play();
        //     console.log('✅ الصوت الاحتياطي: تم التشغيل');
        //   } catch (backupError) {
        //     console.error('❌ الصوت الاحتياطي: فشل أيضاً:', backupError);
        //   }
        // }
        
        // 2. Vibrate device - STRONG vibration pattern
        console.log('\n📳 [خطوة 2/4] اهتزاز الجهاز...');
        if (navigator.vibrate) {
          try {
            // Long vibration pattern: [vibrate, pause, vibrate, pause, vibrate]
            const vibrationPattern = [800, 200, 800, 200, 800]; // Strong & noticeable
            navigator.vibrate(vibrationPattern);
            console.log('✅ الاهتزاز: تم بنجاح -', vibrationPattern.join(','));
          } catch (vibError) {
            console.error('❌ الاهتزاز: فشل:', vibError);
          }
        } else {
          console.log('ℹ️ الاهتزاز: غير مدعوم على هذا الجهاز');
        }
        
        // 3. Show local notification with sound (mobile only)
        console.log('\n📲 [خطوة 3/4] إشعار محلي...');
        if (platform && platform !== 'web') {
          try {
            await LocalNotifications.schedule({
              notifications: [{
                id: notificationId,
                title,
                body,
                schedule: { at: new Date(Date.now() + 100) },
                sound: 'notification_sound.mp3',
                channelId: 'new-orders',
                smallIcon: 'ic_stat_icon_config_sample',
                iconColor: '#FF0000',
                autoCancel: true,
                ongoing: false,
                extra: { 
                  route: '/specialist-orders/new',
                  type: type,
                  timestamp: Date.now()
                }
              }]
            });
            console.log('✅ الإشعار المحلي: تم الجدولة');
          } catch (localError) {
            console.error('❌ الإشعار المحلي: فشل:', localError);
          }
        } else {
          console.log('ℹ️ الإشعار المحلي: تخطي (ويب)');
        }
        
        // 4. Show in-app toast notification
        console.log('\n📱 [خطوة 4/4] Toast داخل التطبيق...');
        try {
          toast({
            title,
            description: body,
            duration: 8000,
          });
          sonnerToast.success(body, {
            description: title,
            duration: 8000,
            position: "top-center",
          });
          console.log('✅ Toast: تم العرض');
        } catch (toastError) {
          console.error('❌ Toast: فشل:', toastError);
        }
        
        console.log('\n✅✅✅ [اكتمل] تم تنفيذ جميع خطوات الإشعار!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } catch (error) {
        console.error('\n❌❌❌ [خطأ حرج] فشل الإشعار:', error);
        console.error('التفاصيل:', JSON.stringify(error, null, 2));
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    };

    const channel = supabase
      .channel('specialist-new-orders')
      // Listen to NEW order assignments
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        async (payload) => {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🆕🆕🆕 طلب جديد وصل! NEW ORDER DETECTED!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Order Specialist ID:', (payload.new as any)?.id);
          console.log('Order ID:', (payload.new as any)?.order_id);
          console.log('Full Payload:', JSON.stringify(payload, null, 2));
          
          await fetchOrders(specialistId);
          await fetchNewOrdersCount(specialistId);
          await triggerNotification('new');
          
          console.log('✅ تم معالجة الطلب الجديد بنجاح');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
      )
      // Listen to RESEND (when order.last_sent_at is updated)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🔄🔄🔄 تحديث على جدول الطلبات ORDER UPDATE');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Order ID:', (payload.new as any)?.id);
          
          // Check if last_sent_at was updated (indicates resend)
          const oldLastSent = (payload.old as any)?.last_sent_at;
          const newLastSent = (payload.new as any)?.last_sent_at;
          
          console.log('📅 Old last_sent_at:', oldLastSent);
          console.log('📅 New last_sent_at:', newLastSent);
          
          if (oldLastSent === newLastSent) {
            console.log('ℹ️ last_sent_at لم يتغير - تجاهل');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return;
          }
          
          // Check if this order is assigned to current specialist
          console.log('🔍 فحص تعيين الطلب للمحترف الحالي...');
          const { data: assignment, error } = await supabase
            .from('order_specialists')
            .select('id, order_id')
            .eq('order_id', (payload.new as any)?.id)
            .eq('specialist_id', specialistId)
            .is('quoted_price', null)
            .is('rejected_at', null)
            .single();
          
          if (error) {
            console.log('ℹ️ لا يوجد تعيين:', error.message);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return;
          }
          
          if (!assignment) {
            console.log('ℹ️ الطلب غير مخصص لهذا المحترف');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return;
          }
          
          console.log('✅ تأكيد: الطلب مخصص لهذا المحترف');
          console.log('🔁🔁🔁 إعادة إرسال مؤكدة! تشغيل الإشعار...');
          
          await fetchOrders(specialistId);
          await fetchNewOrdersCount(specialistId);
          await triggerNotification('resend');
          
          console.log('✅✅✅ اكتمل معالج إعادة الإرسال بنجاح!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
      )
      // Regular updates to order_specialists
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        async (payload) => {
          console.log('\n📝 تحديث على order_specialists');
          console.log('Order Specialist ID:', (payload.new as any)?.id);
          await fetchOrders(specialistId);
          await fetchNewOrdersCount(specialistId);
          console.log('✅ تم تحديث القائمة\n');
        }
      )
      .subscribe((status) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 [REALTIME] حالة اتصال القناة:', status);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId, toast]);

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
          .select('id, name, preferred_language')
          .eq('phone', profile.phone)
          .single();

      if (specialist) {
        setSpecialistId(specialist.id);
        setSpecialistName(specialist.name);
        const prefLang = specialist.preferred_language || 'ar';
        setPreferredLanguage(prefLang);
        
        // Sync UI language with global state
        // UI supports only 'ar' and 'en', content translation supports more languages
        let uiLanguage: 'ar' | 'en' = 'ar';
        if (prefLang === 'en' || prefLang === 'ar') {
          uiLanguage = prefLang;
        } else {
          // For other languages (tl, hi, si, etc.), use English UI
          uiLanguage = 'en';
        }
        setLanguage(uiLanguage);
        
        console.log('✅ Specialist profile loaded:', specialist.name);
        console.log('🌐 Preferred content language:', prefLang);
        console.log('🖥️ UI language:', uiLanguage);
          
          // Initialize Firebase Push Notifications
          try {
            await firebaseNotifications.initialize(specialist.id);
            console.log('✅ [FCM] Firebase initialized for specialist:', specialist.id);
          } catch (fcmError) {
            console.error('⚠️ [FCM] Failed to initialize Firebase:', fcmError);
            // Continue without push notifications
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchNewOrdersCount = async (specId: string) => {
    try {
      // Get current time for expiry check
      const now = new Date().toISOString();
      
      // Count orders that are:
      // 1. Assigned to this specialist
      // 2. Not quoted yet (quoted_price is null)
      // 3. Not rejected (rejected_at is null)
      // 4. Not expired (expires_at is in the future)
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

      // Filter out expired orders
      const validOrders = orderSpecialists.filter((os: any) => {
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true; // Include if no expiry
        return new Date(expiresAt) > new Date(now); // Include if not expired
      });

      setNewOrdersCount(validOrders.length);
    } catch (error) {
      console.error('Error fetching new orders count:', error);
      setNewOrdersCount(0);
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
          expires_at,
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

      // Filter out expired orders and calculate time remaining
      const now = new Date().getTime();
      const newOrderIdsSet = new Set<string>();
      
      const ordersWithSpec = ordersData?.filter(order => {
        // Filter out expired orders
        if (order.expires_at) {
          const expiresAt = new Date(order.expires_at).getTime();
          if (now > expiresAt) {
            console.log(`⏰ Order ${order.id} expired - hiding from view`);
            return false; // Skip expired orders
          }
        }
        return true;
      }).map(order => {
        const orderSpec = orderSpecialists.find(os => os.order_id === order.id);
        const createdAt = new Date(order.created_at).getTime();
        const isNew = (now - createdAt) < 30000; // 30 seconds
        
        // Calculate time remaining in seconds
        let timeRemaining = 0;
        if (order.expires_at) {
          const expiresAt = new Date(order.expires_at).getTime();
          timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        }
        
        if (isNew) {
          newOrderIdsSet.add(order.id);
        }
        
        return {
          ...order,
          order_specialist: orderSpec ? { id: orderSpec.id } : undefined,
          isNew,
          timeRemaining
        };
      });

      setNewOrderIds(newOrderIdsSet);
      
      // Translate orders if needed
      const translatedOrders = await Promise.all(ordersWithSpec.map(async (order) => {
        if (preferredLanguage && preferredLanguage !== 'ar') {
          const translated = await translateOrderDetails({
            serviceType: order.service_type,
            notes: order.notes || undefined,
            area: order.customer?.area || undefined,
            bookingType: order.booking_type || undefined,
          }, preferredLanguage);
          
          return {
            ...order,
            translated: {
              service_type: translated.serviceType,
              notes: translated.notes,
              area: translated.area,
              booking_type: translated.bookingType,
            }
          };
        }
        return order;
      }));
      
      setOrders(translatedOrders || []);
      
      // Auto-remove "new" flag after 30 seconds
      if (newOrderIdsSet.size > 0) {
        setTimeout(() => {
          setNewOrderIds(new Set());
          setOrders(prev => prev.map(order => ({ ...order, isNew: false })));
        }, 30000);
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: t.specialist.error,
        description: t.specialist.quoteFailed,
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

      // Notify admin/company about new quote from specialist → routes to /specialist-orders
      try {
        // Get admin/company user IDs to notify (you could expand this to notify company users too)
        // For now, we notify via order tracking - admin will see quote in "awaiting response"
        console.log('📬 Specialist submitted quote for order:', quoteDialog.orderId);
        // Optional: Send notification to admin/company if you have their specialist IDs
        // await supabase.functions.invoke('send-push-notification', { ... });
      } catch (e) {
        console.warn('🔔 Could not send quote notification (non-blocking):', e);
      }

      toast({
        title: "تم تقديم العرض",
        description: "تم إرسال عرض السعر الخاص بك بنجاح",
      });

      await fetchOrders(specialistId);
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: t.specialist.error,
        description: t.specialist.quoteFailed,
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
        title: t.specialist.orderSkipped,
        description: t.specialist.orderSkippedSuccess,
      });

      await fetchOrders(specialistId);
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error skipping order:', error);
      toast({
        title: t.specialist.error,
        description: t.specialist.skipFailed,
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
          <p className="text-muted-foreground">{t.specialist.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <div className="mb-2">
            <h1 className="text-2xl font-bold mb-1">{t.specialist.newOffersTitle}</h1>
            <p className="text-sm opacity-90">
              {orders.length} {orders.length === 1 ? t.specialist.availableOffers : t.specialist.availableOffersPlural}
            </p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">{t.specialist.noNewOrders}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.specialist.checkBackLater}</p>
          </Card>
        ) : (
          orders.map((order) => {
            const budgetStr = order.customer?.budget || '';
            const numericBudget = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
            const baseBudget = !isNaN(numericBudget) && numericBudget > 0 ? numericBudget : 0;
            
            const priceOptions = baseBudget > 0 ? [
              { label: `${baseBudget} QAR`, value: `${baseBudget} QAR` },
              { label: `${baseBudget + 3} QAR`, value: `${baseBudget + 3} QAR` },
              { label: `${baseBudget + 6} QAR`, value: `${baseBudget + 6} QAR` },
              { label: `${baseBudget + 9} QAR`, value: `${baseBudget + 9} QAR` },
            ] : [];

            return (
              <Card 
                key={order.id}
                className={`overflow-hidden border-2 shadow-lg ${
                  order.isNew 
                    ? 'border-primary animate-pulse-glow ring-4 ring-primary/20' 
                    : 'border-primary'
                }`}
              >
                {/* New Order Indicator with Timer */}
                <div className={`p-4 ${
                  order.isNew
                    ? 'bg-gradient-to-r from-primary via-amber-500 to-primary animate-gradient'
                    : 'bg-gradient-to-r from-primary via-primary/80 to-primary/60'
                }`}>
                  <div className="flex items-center justify-between text-primary-foreground">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`h-5 w-5 ${order.isNew ? 'animate-bounce' : 'animate-pulse'}`} />
                      <span className="text-sm font-bold">
                        {order.isNew ? t.specialist.newOrderArrived : t.specialist.newOrderSubmitPrice}
                      </span>
                    </div>
                    {order.timeRemaining !== undefined && order.timeRemaining > 0 && (
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                        order.timeRemaining <= 60 
                          ? 'bg-red-500 animate-pulse' 
                          : order.timeRemaining <= 120 
                            ? 'bg-amber-500' 
                            : 'bg-white/20'
                      }`}>
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-bold">
                          {Math.floor(order.timeRemaining / 60)}:{String(order.timeRemaining % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
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
                        <div className="flex items-center gap-2 justify-between">
                          <p className="text-xs text-muted-foreground">{t.specialist.service}</p>
                          {order.translated && preferredLanguage !== 'ar' && (
                            <Globe className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                        <p className="font-bold text-sm">
                          {order.translated?.service_type || order.service_type}
                        </p>
                      </div>
                    </div>

                    {order.customer?.area && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 justify-between">
                            <p className="text-xs text-muted-foreground">{t.specialist.area}</p>
                            {order.translated && preferredLanguage !== 'ar' && (
                              <Globe className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                          <p className="font-bold text-sm">
                            {order.translated?.area || order.customer.area}
                          </p>
                        </div>
                      </div>
                    )}

                    {order.booking_type && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 justify-between">
                            <p className="text-xs text-muted-foreground">{t.specialist.bookingType}</p>
                            {order.translated && preferredLanguage !== 'ar' && (
                              <Globe className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                          <p className="font-bold text-sm">
                            {order.translated?.booking_type || order.booking_type}
                          </p>
                        </div>
                      </div>
                    )}

                    {order.hours_count && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{t.specialist.hoursCount}</p>
                          <p className="font-bold text-sm">
                            {order.hours_count} {language === 'ar' ? 'ساعات' : 'hours'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 justify-between mb-1">
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-bold">{t.specialist.notes}</p>
                          {order.translated && preferredLanguage !== 'ar' && (
                            <Globe className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                        <p className="text-sm leading-relaxed">
                          {order.translated?.notes || order.notes}
                        </p>
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
                        {t.specialist.submitQuote}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t.specialist.selectAppropriatePrice}</DialogTitle>
                        <DialogDescription>
                          {baseBudget > 0 
                            ? `${t.specialist.customerBudget}: ${baseBudget} ${language === 'ar' ? 'ريال قطري' : 'QAR'} - ${t.specialist.selectPriceThatSuitsYou}`
                            : t.specialist.selectPriceThatSuitsYou}
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
                              <span className="text-xs opacity-80">{t.specialist.customerPrice}</span>
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
                                {t.specialist.skipThisOffer}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">{t.specialist.customerDidNotSpecifyBudget}</p>
                            <Button
                              onClick={handleSkipOrder}
                              disabled={isSubmitting}
                              variant="outline"
                              className="w-full"
                            >
                              {t.specialist.skipThisOffer}
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

      <BottomNavigation newOrdersCount={newOrdersCount} />
    </div>
  );
}
