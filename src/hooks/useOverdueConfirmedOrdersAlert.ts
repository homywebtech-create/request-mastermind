import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getSoundNotification } from '@/lib/soundNotification';

interface Order {
  id: string;
  order_number?: string;
  status: string;
  booking_date?: string | null;
  booking_date_type?: string | null;
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
    const snoozeUntil = Date.now() + (3 * 60 * 1000); // 3 minutes
    setSnoozedOrders(prev => new Map(prev).set(orderId, snoozeUntil));
    console.log(`⏰ Order ${orderId} snoozed until`, new Date(snoozeUntil).toLocaleTimeString());
    
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
        return newMap;
      });
      console.log(`⏰ Snooze ended for order ${orderId}`);
    }, 3 * 60 * 1000);
  }, [toast]);
  
  // Expose snooze function globally
  useEffect(() => {
    (window as any).snoozeOverdueOrder = snoozeOrder;
    return () => {
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
    // Check for overdue confirmed orders
    const now = new Date();
    const overdueOrderIds: string[] = [];

    orders.forEach(order => {
      const hasAcceptedQuote = order.order_specialists?.some(os => os.is_accepted === true);
      const isUpcoming = order.status === 'upcoming';
      
      // Check if order is confirmed
      if (hasAcceptedQuote || isUpcoming) {
        // Check if booking date exists and is in the past
        if (order.booking_date) {
          const bookingDate = new Date(order.booking_date);
          
          // Add 1 day buffer before considering it overdue
          const overdueThreshold = new Date(bookingDate);
          overdueThreshold.setHours(23, 59, 59, 999); // End of booking day
          
          if (now > overdueThreshold) {
            // Check if order is snoozed
            const snoozeUntil = snoozedOrders.get(order.id);
            if (snoozeUntil && Date.now() < snoozeUntil) {
              console.log('⏰ Order', order.order_number, 'is snoozed until', new Date(snoozeUntil).toLocaleTimeString());
            } else {
              overdueOrderIds.push(order.id);
              console.log('🚨 Found overdue order:', order.order_number, 'booking date:', order.booking_date);
            }
          }
        }
      }
    });

    // Dispatch event for UI to highlight these orders
    if (overdueOrderIds.length > 0) {
      console.log('🚨 Total overdue confirmed orders:', overdueOrderIds.length);
      window.dispatchEvent(new CustomEvent('overdue-confirmed-orders', { 
        detail: { orderIds: overdueOrderIds } 
      }));
      
      // Show toast notification once
      if (!hasShownToastRef.current) {
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
      if (timeSinceLastAlert > 15000) {
        console.log('🔊 Playing overdue alert sound...');
        soundNotification.current.playNewOrderSound();
        lastAlertTimeRef.current = Date.now();
      }
      
      // Set up continuous alert if not already running
      if (!alertIntervalRef.current) {
        console.log('🔄 Setting up continuous alert interval...');
        alertIntervalRef.current = setInterval(() => {
          console.log('🔊 Playing periodic overdue alert sound...');
          soundNotification.current.playNewOrderSound();
          lastAlertTimeRef.current = Date.now();
        }, 15000); // Play sound every 15 seconds
      }
    } else {
      // Clean up if no overdue orders
      hasShownToastRef.current = false;
      if (alertIntervalRef.current) {
        console.log('✅ Clearing alert interval - no overdue orders');
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
