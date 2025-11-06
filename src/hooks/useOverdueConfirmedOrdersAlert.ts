import { useEffect, useRef, useState } from 'react';
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
  const [overdueOrders, setOverdueOrders] = useState<string[]>([]);

  useEffect(() => {
    // Check for overdue confirmed orders
    const checkOverdueOrders = () => {
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
              overdueOrderIds.push(order.id);
            }
          }
        }
      });

      setOverdueOrders(overdueOrderIds);
      
      // If there are overdue orders, show alert and play sound
      if (overdueOrderIds.length > 0) {
        console.log('🚨 Overdue confirmed orders detected:', overdueOrderIds);
        
        // Dispatch event for UI to highlight these orders
        window.dispatchEvent(new CustomEvent('overdue-confirmed-orders', { 
          detail: { orderIds: overdueOrderIds } 
        }));
      }
    };

    // Initial check
    checkOverdueOrders();

    // Check every 30 seconds
    const checkInterval = setInterval(checkOverdueOrders, 30000);

    // Play continuous alert sound every 15 seconds if there are overdue orders
    if (overdueOrders.length > 0 && !alertIntervalRef.current) {
      // Show toast notification
      toast({
        title: '🚨 تنبيه: طلبات موكدة متأخرة!',
        description: `يوجد ${overdueOrders.length} طلب موكد متأخر يحتاج إلى إجراء فوري!`,
        variant: 'destructive',
        duration: 10000,
      });

      // Play initial sound
      soundNotification.current.playNewOrderSound();

      // Set up continuous alert
      alertIntervalRef.current = setInterval(() => {
        soundNotification.current.playNewOrderSound();
      }, 15000); // Play sound every 15 seconds
    }

    // Clean up interval if no overdue orders
    if (overdueOrders.length === 0 && alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }

    return () => {
      clearInterval(checkInterval);
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [orders, overdueOrders.length, toast]);

  return { overdueOrders };
}
