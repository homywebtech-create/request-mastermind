import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SpecialistLiveStatus {
  id: string;
  name: string;
  image_url: string | null;
  phone: string;
  is_active: boolean;
  current_order_id: string | null;
  suspension_type: string | null;
  id_card_expiry_date: string | null;
  last_token_used: string | null;
  has_device_token: boolean;
  status: 'online' | 'offline' | 'busy' | 'not_logged_in' | 'on_the_way' | 'working';
  accepted_today: number;
  rejected_today: number;
  last_notification_status: {
    time: string | null;
    action: 'received' | 'ignored' | 'no_response' | null;
  };
  upcoming_order_time: string | null;
}

export function useSpecialistsLiveStatus(companyId: string | null | undefined, isAdmin: boolean = false) {
  const [specialists, setSpecialists] = useState<SpecialistLiveStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSpecialistsStatus = async () => {
    // For non-admin users without company, don't show anything
    if (!isAdmin && !companyId) {
      setSpecialists([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get specialists with their current orders
      let query = supabase
        .from('specialists')
        .select('id, name, image_url, phone, is_active, current_order_id, suspension_type, id_card_expiry_date');
      
      // If not admin, filter by company
      if (!isAdmin && companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data: specialistsData, error: specError } = await query.order('name');

      if (specError) throw specError;

      // Get device tokens
      const { data: tokensData } = await supabase
        .from('device_tokens')
        .select('specialist_id, last_used_at')
        .in('specialist_id', specialistsData?.map(s => s.id) || []);

      // Get today's order statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: ordersData } = await supabase
        .from('order_specialists')
        .select('specialist_id, is_accepted, rejected_at, quoted_at')
        .in('specialist_id', specialistsData?.map(s => s.id) || [])
        .gte('created_at', today.toISOString());

      // Get all active orders for specialists (from order_specialists table)
      const { data: acceptedOrdersData } = await supabase
        .from('order_specialists')
        .select(`
          specialist_id,
          order_id,
          is_accepted,
          orders!inner (
            id,
            tracking_stage,
            status,
            order_number,
            booking_date,
            booking_time
          )
        `)
        .in('specialist_id', specialistsData?.map(s => s.id) || [])
        .or('is_accepted.eq.true,is_accepted.is.null')
        .neq('orders.status', 'cancelled')
        .neq('orders.status', 'completed');
      
      // Get current orders for tracking stage (fallback for current_order_id field)
      const activeOrderIds = specialistsData
        ?.filter(s => s.current_order_id)
        .map(s => s.current_order_id) || [];
      
      const { data: activeOrdersData } = await supabase
        .from('orders')
        .select('id, tracking_stage, status')
        .in('id', activeOrderIds);

      // Combine data
      const statusList: SpecialistLiveStatus[] = (specialistsData || []).map(spec => {
        const token = tokensData?.find(t => t.specialist_id === spec.id);
        const orders = ordersData?.filter(o => o.specialist_id === spec.id) || [];
        const activeOrder = activeOrdersData?.find(o => o.id === spec.current_order_id);
        
        // Find any active order from order_specialists (more reliable than current_order_id)
        const specialistActiveOrders = acceptedOrdersData?.filter(
          (ao: any) => ao.specialist_id === spec.id
        ) || [];
        
        // Get the most recent active order
        const mostRecentOrder = specialistActiveOrders[0];
        const orderWithTracking = mostRecentOrder?.orders;
        
        // Find upcoming order (with booking_date in the future)
        let upcomingOrderTime: string | null = null;
        const upcomingOrders = specialistActiveOrders
          .filter((ao: any) => ao.orders?.booking_date)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.orders.booking_date);
            const dateB = new Date(b.orders.booking_date);
            return dateA.getTime() - dateB.getTime();
          });
        
        if (upcomingOrders.length > 0) {
          const nextOrder = upcomingOrders[0];
          const bookingDate = nextOrder.orders?.booking_date;
          const bookingTime = nextOrder.orders?.booking_time;
          
          if (bookingDate) {
            // Combine date and time if available
            upcomingOrderTime = bookingTime 
              ? `${bookingDate} ${bookingTime}`
              : bookingDate;
          }
        }

        // Determine status
        let status: SpecialistLiveStatus['status'] = 'not_logged_in';
        
        if (!spec.is_active) {
          status = 'offline';
        } else {
          // Check for active order from either current_order_id or accepted orders
          const hasActiveOrder = spec.current_order_id || specialistActiveOrders.length > 0;
          const trackingStage = orderWithTracking?.tracking_stage || activeOrder?.tracking_stage;
          const hasDeviceToken = !!token;
          
          if (hasActiveOrder && hasDeviceToken) {
            // Has active order and has logged in before - determine work stage
            if (trackingStage === 'moving' || trackingStage === 'on_the_way') {
              status = 'on_the_way';
            } else if (trackingStage === 'arrived' || trackingStage === 'working' || trackingStage === 'in_progress') {
              status = 'working';
            } else {
              // Has accepted order but no tracking stage yet - means busy/preparing
              status = 'busy';
            }
          } else if (hasDeviceToken && token?.last_used_at) {
            // Has device token - check last activity
            const lastUsed = new Date(token.last_used_at);
            const minutesAgo = (Date.now() - lastUsed.getTime()) / 1000 / 60;
            
            // Check if specialist had any recent activity in order_specialists
            const recentOrderActivity = orders.length > 0 && orders[0];
            let lastActivityTime = lastUsed;
            
            if (recentOrderActivity) {
              const activityTime = new Date(recentOrderActivity.quoted_at || recentOrderActivity.rejected_at || lastUsed);
              if (activityTime > lastUsed) {
                lastActivityTime = activityTime;
              }
            }
            
            const minutesSinceActivity = (Date.now() - lastActivityTime.getTime()) / 1000 / 60;
            
            if (minutesSinceActivity < 30) {
              // Active within last 30 minutes
              status = 'online';
            } else {
              status = 'offline';
            }
          } else {
            // No device token registered
            status = 'not_logged_in';
          }
        }

        // Calculate today's stats
        const accepted_today = orders.filter(o => o.is_accepted === true).length;
        const rejected_today = orders.filter(o => o.rejected_at !== null).length;

        // Last notification status
        const lastOrder = orders.sort((a, b) => 
          new Date(b.quoted_at || b.rejected_at || '').getTime() - 
          new Date(a.quoted_at || a.rejected_at || '').getTime()
        )[0];

        let lastNotificationStatus: SpecialistLiveStatus['last_notification_status'] = {
          time: null,
          action: null
        };

        if (lastOrder) {
          if (lastOrder.is_accepted !== null) {
            lastNotificationStatus = {
              time: lastOrder.quoted_at,
              action: lastOrder.is_accepted ? 'received' : 'ignored'
            };
          } else if (lastOrder.rejected_at) {
            lastNotificationStatus = {
              time: lastOrder.rejected_at,
              action: 'received'
            };
          }
        }

        return {
          id: spec.id,
          name: spec.name,
          image_url: spec.image_url,
          phone: spec.phone,
          is_active: spec.is_active,
          current_order_id: spec.current_order_id,
          suspension_type: spec.suspension_type,
          id_card_expiry_date: spec.id_card_expiry_date,
          last_token_used: token?.last_used_at || null,
          has_device_token: !!token,
          status,
          accepted_today,
          rejected_today,
          last_notification_status: lastNotificationStatus,
          upcoming_order_time: upcomingOrderTime
        };
      });

      setSpecialists(statusList);
    } catch (error) {
      console.error('Error fetching specialists status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialistsStatus();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('specialists-live-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'specialists',
          filter: companyId ? `company_id=eq.${companyId}` : undefined
        },
        () => {
          fetchSpecialistsStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_tokens'
        },
        () => {
          fetchSpecialistsStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists'
        },
        () => {
          fetchSpecialistsStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchSpecialistsStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, isAdmin]);

  return { specialists, isLoading, refresh: fetchSpecialistsStatus };
}
