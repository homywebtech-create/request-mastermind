import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getSoundNotification } from '@/lib/soundNotification';

interface Order {
  id: string;
  order_number?: string;
  status: string;
  booking_date?: string | null;
  booking_date_type?: string | null;
  booking_time?: string | null;
  order_specialists?: Array<{
    is_accepted: boolean | null;
  }>;
}

export function useOverdueConfirmedOrdersAlert(orders: Order[]) {
  const { toast } = useToast();
  const soundNotification = useRef(getSoundNotification());
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const hasShownToastRef = useRef(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [snoozedOrders, setSnoozedOrders] = useState<Map<string, number>>(new Map());
  
  // Snooze handler function that can be called from outside
  const snoozeOrder = useCallback((orderId: string) => {
    console.log('⏰ [SNOOZE] Called for order:', orderId);
    const snoozeUntil = Date.now() + (3 * 60 * 1000); // 3 minutes
    setSnoozedOrders(prev => {
      const newMap = new Map(prev);
      newMap.set(orderId, snoozeUntil);
      console.log('⏰ [SNOOZE] Updated snoozed orders map:', Array.from(newMap.entries()));
      return newMap;
    });
    console.log(`⏰ [SNOOZE] Order ${orderId} snoozed until`, new Date(snoozeUntil).toLocaleTimeString());
    
    toast({
      title: '⏰ تم تأجيل التنبيه',
      description: 'سيتم إعادة التنبيه بعد 3 دقائق',
      duration: 3000,
    });
    
    // Clear snooze after 3 minutes
    setTimeout(() => {
      setSnoozedOrders(prev => {
        const newMap = new Map(prev);
        newMap.delete(orderId);
        console.log('⏰ [SNOOZE] Cleared snooze for order:', orderId);
        return newMap;
      });
      console.log(`⏰ [SNOOZE] Snooze ended for order ${orderId}`);
    }, 3 * 60 * 1000);
  }, [toast]);
  
  // Expose snooze function globally
  useEffect(() => {
    console.log('🔧 [SNOOZE] Registering snoozeOverdueOrder on window object');
    (window as any).snoozeOverdueOrder = snoozeOrder;
    console.log('✅ [SNOOZE] Function registered:', typeof (window as any).snoozeOverdueOrder);
    return () => {
      console.log('🧹 [SNOOZE] Cleaning up snoozeOverdueOrder from window');
      delete (window as any).snoozeOverdueOrder;
    };
  }, [snoozeOrder]);

  // Initialize audio on mount (requires user interaction)
  useEffect(() => {
    const initAudio = async () => {
      try {
        await soundNotification.current.initialize();
        setIsAudioInitialized(true);
        console.log('✅ Audio system initialized on component mount');
      } catch (error) {
        console.error('❌ Failed to initialize audio:', error);
      }
    };

    // Initialize on first user interaction
    const handleUserInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    console.log('🔍 [OVERDUE CHECK] Running overdue check for', orders.length, 'orders');
    
    // Check for overdue confirmed orders
    const now = new Date();
    const overdueOrderIds: string[] = [];

    orders.forEach(order => {
      const hasAcceptedQuote = order.order_specialists?.some(os => os.is_accepted === true);
      const isUpcoming = order.status === 'upcoming';
      
      console.log(`📋 [${order.order_number}] status=${order.status}, accepted=${hasAcceptedQuote}, upcoming=${isUpcoming}, booking_date=${order.booking_date}`);
      
      // Check if order is confirmed
      if (hasAcceptedQuote || isUpcoming) {
        // Check if booking date exists and is in the past
        if (order.booking_date) {
          const bookingDate = new Date(order.booking_date);
          const now = new Date();
          let exactBookingTime: Date;
          
          // For specific time bookings, use exact datetime from booking_date
          if (order.booking_date_type === 'specific') {
            exactBookingTime = bookingDate;
          } else {
            // For date-only bookings, use booking_time if available
            exactBookingTime = new Date(bookingDate);
            if (order.booking_time) {
              if (order.booking_time === 'morning') {
                exactBookingTime.setHours(8, 0, 0, 0);
              } else if (order.booking_time === 'afternoon') {
                exactBookingTime.setHours(14, 0, 0, 0);
              } else if (order.booking_time === 'evening') {
                exactBookingTime.setHours(18, 0, 0, 0);
              } else {
                // Parse HH:MM format
                const [hours, minutes] = order.booking_time.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                  exactBookingTime.setHours(hours, minutes, 0, 0);
                } else {
                  exactBookingTime.setHours(8, 0, 0, 0);
                }
              }
            } else {
              // Default to 8 AM for date-only bookings
              exactBookingTime.setHours(8, 0, 0, 0);
            }
          }
          
          console.log(`⏰ [${order.order_number}] now=${now.toLocaleString()}, booking=${exactBookingTime.toLocaleString()}, diff=${(now.getTime() - exactBookingTime.getTime()) / 1000 / 60} mins, isOverdue=${now > exactBookingTime}`);
          
          if (now > exactBookingTime) {
            // Check if order is snoozed
            const snoozeUntil = snoozedOrders.get(order.id);
            if (snoozeUntil && Date.now() < snoozeUntil) {
              console.log(`⏰ [${order.order_number}] is snoozed until`, new Date(snoozeUntil).toLocaleTimeString());
            } else {
              overdueOrderIds.push(order.id);
              console.log(`🚨 [${order.order_number}] OVERDUE! booking_date=${order.booking_date}, booking_time=${order.booking_time}`);
            }
          } else {
            console.log(`✅ [${order.order_number}] NOT overdue yet - ${Math.floor((exactBookingTime.getTime() - now.getTime()) / 1000 / 60)} minutes remaining`);
          }
        } else {
          console.log(`⚠️ [${order.order_number}] No booking date found`);
        }
      }
    });

    // Dispatch event for UI to highlight these orders
    if (overdueOrderIds.length > 0) {
      console.log('🚨 [ALERT] Total overdue confirmed orders:', overdueOrderIds.length, 'IDs:', overdueOrderIds);
      window.dispatchEvent(new CustomEvent('overdue-confirmed-orders', { 
        detail: { orderIds: overdueOrderIds } 
      }));
      console.log('📡 [ALERT] Event dispatched: overdue-confirmed-orders');
      
      // Show toast notification once
      if (!hasShownToastRef.current) {
        console.log('📢 [ALERT] Showing toast notification');
        toast({
          title: '🚨 تنبيه: طلبات موكدة متأخرة!',
          description: `يوجد ${overdueOrderIds.length} طلب موكد متأخر يحتاج إلى إجراء فوري!`,
          variant: 'destructive',
          duration: 10000,
        });
        hasShownToastRef.current = true;
      }
      
      // Play sound immediately if not played recently (within 15 seconds)
      const timeSinceLastAlert = Date.now() - lastAlertTimeRef.current;
      console.log(`🔊 [AUDIO] Time since last alert: ${timeSinceLastAlert}ms`);
      
      if (timeSinceLastAlert > 15000) {
        console.log('🔊 [AUDIO] Playing overdue alert sound NOW...');
        soundNotification.current.playNewOrderSound();
        lastAlertTimeRef.current = Date.now();
      } else {
        console.log(`⏳ [AUDIO] Skipping sound - played ${timeSinceLastAlert}ms ago`);
      }
      
      // Set up continuous alert if not already running
      if (!alertIntervalRef.current) {
        console.log('🔄 [ALERT] Setting up continuous alert interval (15s)...');
        alertIntervalRef.current = setInterval(() => {
          console.log('🔊 [AUDIO] Playing periodic overdue alert sound...');
          soundNotification.current.playNewOrderSound();
          lastAlertTimeRef.current = Date.now();
        }, 15000); // Play sound every 15 seconds
      } else {
        console.log('✓ [ALERT] Continuous alert already running');
      }
    } else {
      console.log('✅ [CHECK] No overdue orders found');
      // Clean up if no overdue orders
      hasShownToastRef.current = false;
      if (alertIntervalRef.current) {
        console.log('🛑 [ALERT] Clearing alert interval - no overdue orders');
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [orders, toast, snoozedOrders]);

  return { snoozeOrder };
}
