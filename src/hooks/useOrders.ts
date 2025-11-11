import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  company_id: string | null;
  specialist_id?: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'upcoming';
  tracking_stage?: string | null;
  notes?: string;
  order_link?: string;
  created_at: string;
  updated_at: string;
  send_to_all_companies?: boolean;
  booking_type?: string | null;
  booking_date?: string | null;
  booking_date_type?: string | null;
  booking_time?: string | null;
  hours_count?: number | null;
  building_info?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  cancelled_by?: string | null;
  cancelled_by_role?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  customers: {
    name: string;
    whatsapp_number: string;
    area?: string;
    budget?: string;
    budget_type?: string;
  };
  companies: {
    name: string;
  } | null;
  order_specialists?: Array<{
    id: string;
    specialist_id?: string;
    quoted_price: string | null;
    quoted_at: string | null;
    is_accepted: boolean | null;
    specialists: {
      id: string;
      name: string;
      phone: string;
      nationality: string | null;
      image_url: string | null;
    };
  }>;
}

interface UseOrdersOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useOrders = ({ page = 1, pageSize = 50, enabled = true }: UseOrdersOptions = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchOrders = async (): Promise<Order[]> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        company_id,
        service_type,
        status,
        tracking_stage,
        notes,
        order_link,
        created_at,
        updated_at,
        send_to_all_companies,
        booking_type,
        booking_date,
        booking_date_type,
        booking_time,
        hours_count,
        building_info,
        gps_latitude,
        gps_longitude,
        cancelled_by,
        cancelled_by_role,
        cancellation_reason,
        cancelled_at,
        customers!inner (name, whatsapp_number, area, budget, budget_type),
        companies (name),
        order_specialists (
          id,
          quoted_price,
          quoted_at,
          is_accepted,
          specialists (id, name, phone, nationality, image_url)
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل تحميل الطلبات",
        variant: "destructive",
      });
      throw error;
    }

    return (data as any) || [];
  };

  const query = useQuery({
    queryKey: ['orders', page, pageSize],
    queryFn: fetchOrders,
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Subscribe to realtime updates
  const subscribeToOrders = () => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['order-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_specialists' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    ...query,
    subscribeToOrders,
  };
};

// Hook for order stats only
export const useOrderStats = () => {
  const fetchStats = async () => {
    // Simple count queries - much faster than complex joins
    const [pendingResult, awaitingResult, upcomingResult, inProgressResult, completedResult, cancelledResult, totalResult] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in-progress'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).in('tracking_stage', ['moving', 'arrived', 'working', 'invoice_requested']),
      supabase.from('orders').select('*', { count: 'exact', head: true }).or('tracking_stage.eq.payment_received,status.eq.completed'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('orders').select('*', { count: 'exact', head: true })
    ]);

    return {
      total: totalResult.count || 0,
      pending: pendingResult.count || 0,
      awaitingResponse: awaitingResult.count || 0,
      upcoming: upcomingResult.count || 0,
      inProgress: inProgressResult.count || 0,
      completed: completedResult.count || 0,
      cancelled: cancelledResult.count || 0,
    };
  };

  return useQuery({
    queryKey: ['order-stats'],
    queryFn: fetchStats,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Optimistic update for order status
export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    },
    onMutate: async ({ orderId, status }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      // Snapshot previous value
      const previousOrders = queryClient.getQueryData(['orders']);

      // Optimistically update
      queryClient.setQueryData(['orders'], (old: any) => {
        if (!old) return old;
        return old.map((order: Order) =>
          order.id === orderId ? { ...order, status } : order
        );
      });

      return { previousOrders };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast({
        title: "خطأ",
        description: "فشل تحديث حالة الطلب",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
};
