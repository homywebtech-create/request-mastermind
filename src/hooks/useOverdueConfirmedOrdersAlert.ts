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
  tracking_stage?: string | null;
  order_specialists?: Array<{
    is_accepted: boolean | null;
  }>;
}

export function useOverdueConfirmedOrdersAlert(orders: Order[]) {
  const { toast } = useToast();
  const soundNotification = useRef(getSoundNotification());
  const lastAlertTimeRef = useRef<number>(0);
  const hasShownToastRef = useRef(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [snoozedOrders, setSnoozedOrders] = useState<Map<string, number>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const alertedOrdersRef = useRef<Set<string>>(new Set());
  
  // Mute handler function
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    toast({
      title: !isMuted ? '🔇 تم كتم التنبيهات' : '🔊 تم تفعيل التنبيهات',
      description: !isMuted ? 'لن يتم تشغيل صوت التنبيه' : 'سيتم تشغيل صوت التنبيه للطلبات المتأخرة',
      duration: 3000,
    });
  }, [isMuted, toast]);
  
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
  
  // Expose snooze and mute functions globally
  useEffect(() => {
    console.log('🔧 [SNOOZE] Registering snoozeOverdueOrder on window object');
    (window as any).snoozeOverdueOrder = snoozeOrder;
    (window as any).toggleOverdueAlertMute = toggleMute;
    console.log('✅ [SNOOZE] Function registered:', typeof (window as any).snoozeOverdueOrder);
    return () => {
      console.log('🧹 [SNOOZE] Cleaning up snoozeOverdueOrder from window');
      delete (window as any).snoozeOverdueOrder;
      delete (window as any).toggleOverdueAlertMute;
    };
  }, [snoozeOrder, toggleMute]);

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
      
      // Skip orders that are already in progress (tracking stages)
      const isInProgressStage = order.tracking_stage && ['moving', 'arrived', 'working', 'completed'].includes(order.tracking_stage);
      const isCompletedOrCancelled = ['in-progress', 'completed', 'cancelled'].includes(order.status);
      
      console.log(`📋 [${order.order_number}] status=${order.status}, accepted=${hasAcceptedQuote}, upcoming=${isUpcoming}, tracking_stage=${order.tracking_stage}, skip=${isInProgressStage || isCompletedOrCancelled}`);
      
      // Skip if order is already in progress, completed, or cancelled
      if (isInProgressStage || isCompletedOrCancelled) {
        console.log(`⏭️ [${order.order_number}] Skipping - order is in progress or completed`);
        return;
      }
      
      // Check if order is confirmed
      if (hasAcceptedQuote || isUpcoming) {
        // Check if booking date exists and is in the past
        if (order.booking_date) {
          const bookingDate = new Date(order.booking_date);
          const now = new Date();
          let exactBookingTime: Date;
          
          // For specific time bookings, use exact datetime
          if (order.booking_date_type === 'specific') {
            exactBookingTime = new Date(order.booking_date);
          } else {
            // For date-only bookings, parse booking_time
            exactBookingTime = new Date(bookingDate);
            
            if (order.booking_time) {
              // Handle period-based times
              if (order.booking_time === 'morning') {
                exactBookingTime.setHours(8, 0, 0, 0);
              } else if (order.booking_time === 'afternoon') {
                exactBookingTime.setHours(14, 0, 0, 0);
              } else if (order.booking_time === 'evening') {
                exactBookingTime.setHours(18, 0, 0, 0);
              } else {
                // Parse time range like "8:00 AM-8:30 AM"
                const startTimeStr = order.booking_time.split('-')[0].trim();
                const timeMatch = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                
                if (timeMatch) {
                  let hours = parseInt(timeMatch[1]);
                  const minutes = parseInt(timeMatch[2]);
                  const period = timeMatch[3]?.toUpperCase();
                  
                  // Convert to 24-hour format if AM/PM is present
                  if (period === 'PM' && hours < 12) {
                    hours += 12;
                  } else if (period === 'AM' && hours === 12) {
                    hours = 0;
                  }
                  
                  if (!isNaN(hours) && !isNaN(minutes)) {
                    exactBookingTime.setHours(hours, minutes, 0, 0);
                  } else {
                    exactBookingTime.setHours(8, 0, 0, 0);
                  }
                } else {
                  exactBookingTime.setHours(8, 0, 0, 0);
                }
              }
            } else {
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
      
      // Play sound immediately if not played recently (within 15 seconds) and not muted
      if (!isMuted) {
        // Check if this order has been alerted before
        const hasBeenAlerted = overdueOrderIds.some(id => alertedOrdersRef.current.has(id));
        
        if (!hasBeenAlerted) {
          console.log('🔊 [AUDIO] Playing single overdue alert sound for new overdue orders...');
          soundNotification.current.playNewOrderSound();
          lastAlertTimeRef.current = Date.now();
          
          // Mark these orders as alerted
          overdueOrderIds.forEach(id => alertedOrdersRef.current.add(id));
          console.log('✅ [AUDIO] Marked orders as alerted:', overdueOrderIds);
        } else {
          console.log('⏭️ [AUDIO] Skipping sound - orders already alerted');
        }
      } else {
        console.log('🔇 [AUDIO] Alert is muted');
      }
    } else {
      console.log('✅ [CHECK] No overdue orders found');
      // Clean up if no overdue orders - clear alerted orders list
      hasShownToastRef.current = false;
      alertedOrdersRef.current.clear();
      console.log('🧹 [CLEANUP] Cleared alerted orders list');
    }
  }, [orders, toast, snoozedOrders, isMuted]);

  return { 
    snoozeOrder,
    toggleMute,
    isMuted,
    isSnoozed: (orderId: string) => {
      const snoozeUntil = snoozedOrders.get(orderId);
      return snoozeUntil ? Date.now() < snoozeUntil : false;
    }
  };
}
