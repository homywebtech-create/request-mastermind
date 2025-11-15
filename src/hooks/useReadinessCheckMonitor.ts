import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global hook to monitor and dispatch readiness check notifications
 * This runs at app-level to catch notifications even if dialog isn't mounted
 */
export function useReadinessCheckMonitor() {
  useEffect(() => {
    console.log('🌐 [ReadinessMonitor] Initializing global readiness check monitor');
    
    const checkForPendingReadiness = async () => {
      try {
        console.log('🔍 [ReadinessMonitor] Checking for pending readiness notifications...');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('❌ [ReadinessMonitor] No user found');
          return;
        }

        // Get user's phone from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', user.id)
          .single();

        if (!profile?.phone) {
          console.log('❌ [ReadinessMonitor] No phone found in profile');
          return;
        }

        // Get specialist info by phone
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id')
          .eq('phone', profile.phone)
          .single();

        if (!specialist) {
          console.log('❌ [ReadinessMonitor] No specialist found for phone:', profile.phone);
          return;
        }

        console.log('✅ [ReadinessMonitor] Checking for specialist:', specialist.id);

        // Get orders assigned to this specialist
        const { data: orderSpecialists } = await supabase
          .from('order_specialists')
          .select('order_id')
          .eq('specialist_id', specialist.id);

        if (!orderSpecialists || orderSpecialists.length === 0) {
          console.log('📭 [ReadinessMonitor] No orders found for specialist');
          return;
        }

        const orderIds = orderSpecialists.map((os) => os.order_id);

        // Check for orders needing readiness response
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, order_number, readiness_notification_viewed_at')
          .in('id', orderIds)
          .eq('status', 'upcoming')
          .eq('specialist_readiness_status', 'pending')
          .not('readiness_check_sent_at', 'is', null);

        if (ordersData && ordersData.length > 0) {
          console.log('🔔 [ReadinessMonitor] Found pending readiness checks:', ordersData.length);
          
          // CRITICAL FIX: Update viewed_at for all pending orders to mark specialist as "opened app"
          for (const order of ordersData) {
            if (!order.readiness_notification_viewed_at) {
              console.log('📱 [ReadinessMonitor] Marking order as viewed:', order.order_number);
              await supabase
                .from('orders')
                .update({ 
                  readiness_notification_viewed_at: new Date().toISOString() 
                })
                .eq('id', order.id);
            }
          }
          
          // Dispatch event to trigger dialog
          window.dispatchEvent(new CustomEvent('readiness-check-received', {
            detail: {
              orderId: ordersData[0].id,
              orders: ordersData,
            }
          }));
          
          console.log('✅ [ReadinessMonitor] Event dispatched for pending orders');
        } else {
          console.log('✓ [ReadinessMonitor] No pending readiness checks found');
        }
      } catch (error) {
        console.error('❌ [ReadinessMonitor] Error checking pending orders:', error);
      }
    };

    // Check immediately on mount
    checkForPendingReadiness();

    // Check every 5 seconds while app is active for faster response
    const interval = setInterval(checkForPendingReadiness, 5000);

    // Also check when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [ReadinessMonitor] App became visible, checking for pending orders');
        checkForPendingReadiness();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
