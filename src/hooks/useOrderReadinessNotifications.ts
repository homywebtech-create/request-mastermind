import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { Bell, CheckCircle, XCircle } from 'lucide-react';

export function useOrderReadinessNotifications() {
  const { toast } = useToast();
  const { language } = useLanguage();

  useEffect(() => {
    const channel = supabase
      .channel('order-readiness-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'status=in.(confirmed,upcoming,in_progress)'
        },
        (payload) => {
          const oldOrder = payload.old;
          const newOrder = payload.new;

          // Check if readiness check was just sent
          if (!oldOrder.readiness_check_sent_at && newOrder.readiness_check_sent_at) {
            toast({
              title: language === 'ar' ? '🔔 تم إرسال تنبيه الجاهزية' : '🔔 Readiness Alert Sent',
              description: language === 'ar' 
                ? `تم إرسال تنبيه الجاهزية للمحترف في الطلب ${newOrder.order_number}. بانتظار الاستجابة...`
                : `Readiness alert sent to specialist for order ${newOrder.order_number}. Awaiting response...`,
              duration: 5000,
            });
          }

          // Check if specialist responded "ready"
          if (
            oldOrder.specialist_readiness_status !== 'ready' && 
            newOrder.specialist_readiness_status === 'ready'
          ) {
            toast({
              title: language === 'ar' ? '🟡 المحترفة جاهزة!' : '🟡 Specialist Ready!',
              description: language === 'ar' 
                ? `المحترفة أكدت جاهزيتها للطلب ${newOrder.order_number} وستذهب للموعد`
                : `Specialist confirmed readiness for order ${newOrder.order_number} and will attend`,
              duration: 6000,
            });
          }

          // Check if specialist responded "not ready"
          if (
            oldOrder.specialist_readiness_status !== 'not_ready' && 
            newOrder.specialist_readiness_status === 'not_ready'
          ) {
            const reason = newOrder.specialist_not_ready_reason 
              ? (language === 'ar' ? `\nالسبب: ${newOrder.specialist_not_ready_reason}` : `\nReason: ${newOrder.specialist_not_ready_reason}`)
              : '';
              
            toast({
              title: language === 'ar' ? '🔴 المحترفة لن تستطيع الذهاب' : '🔴 Specialist Cannot Attend',
              description: language === 'ar' 
                ? `المحترفة أعلمت أنها لن تستطيع الذهاب للطلب ${newOrder.order_number}${reason}`
                : `Specialist indicated they cannot attend order ${newOrder.order_number}${reason}`,
              variant: 'destructive',
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, language]);
}
