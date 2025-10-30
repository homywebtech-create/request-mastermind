import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BusyStatus {
  isBusy: boolean;
  currentOrderId: string | null;
  isLoading: boolean;
}

export function useSpecialistBusyStatus(specialistId: string | null) {
  const [status, setStatus] = useState<BusyStatus>({
    isBusy: false,
    currentOrderId: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!specialistId) {
      setStatus({ isBusy: false, currentOrderId: null, isLoading: false });
      return;
    }

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('specialists')
          .select('current_order_id')
          .eq('id', specialistId)
          .single();

        if (error) throw error;

        setStatus({
          isBusy: !!data.current_order_id,
          currentOrderId: data.current_order_id,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching specialist busy status:', error);
        setStatus({ isBusy: false, currentOrderId: null, isLoading: false });
      }
    };

    fetchStatus();

    // Subscribe to changes
    const channel = supabase
      .channel(`specialist-status-${specialistId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'specialists',
          filter: `id=eq.${specialistId}`,
        },
        (payload) => {
          const newData = payload.new as { current_order_id: string | null };
          setStatus({
            isBusy: !!newData.current_order_id,
            currentOrderId: newData.current_order_id,
            isLoading: false,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId]);

  return status;
}
