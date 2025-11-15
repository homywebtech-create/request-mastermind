import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

export function useOrderReadinessNotifications() {
  const { toast } = useToast();
  const { language } = useLanguage();

  useEffect(() => {
    console.log('🔔 Setting up order readiness notifications...');
    
    const channel = supabase
      .channel('order-readiness-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('📨 Order update received:', payload);
          const oldOrder = payload.old;
          const newOrder = payload.new;

          // Check if readiness check was just sent
          if (!oldOrder.readiness_check_sent_at && newOrder.readiness_check_sent_at) {
            console.log('🔔 Readiness check sent for order:', newOrder.order_number);
            
            // Show toast notification (no sound for admin panel)
            toast({
              title: language === 'ar' ? '🔔 تم إرسال تنبيه الجاهزية' : '🔔 Readiness Alert Sent',
              description: language === 'ar' 
                ? `تم إرسال تنبيه الجاهزية للمحترف في الطلب ${newOrder.order_number}. بانتظار الاستجابة...`
                : `Readiness alert sent to specialist for order ${newOrder.order_number}. Awaiting response...`,
              duration: 5000,
              className: 'bg-blue-50 border-blue-500 dark:bg-blue-950',
            });
            
            // Trigger a custom event for the orders table to highlight the row
            window.dispatchEvent(new CustomEvent('order-readiness-alert', { 
              detail: { orderId: newOrder.id, type: 'sent' } 
            }));
          }

          // Check if specialist responded "ready"
          if (
            oldOrder.specialist_readiness_status !== 'ready' && 
            newOrder.specialist_readiness_status === 'ready'
          ) {
            console.log('🟡 Specialist ready for order:', newOrder.order_number);
            
            // Show toast notification (no sound for admin panel)
            toast({
              title: language === 'ar' ? '🟡 المحترفة جاهزة!' : '🟡 Specialist Ready!',
              description: language === 'ar' 
                ? `المحترفة أكدت جاهزيتها للطلب ${newOrder.order_number} وستذهب للموعد`
                : `Specialist confirmed readiness for order ${newOrder.order_number} and will attend`,
              duration: 6000,
              className: 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950',
            });
            
            // Trigger a custom event for highlighting
            window.dispatchEvent(new CustomEvent('order-readiness-alert', { 
              detail: { orderId: newOrder.id, type: 'ready' } 
            }));
          }

          // Check if specialist responded "not ready"
          if (
            oldOrder.specialist_readiness_status !== 'not_ready' && 
            newOrder.specialist_readiness_status === 'not_ready'
          ) {
            console.log('🔴 Specialist not ready for order:', newOrder.order_number);
            
            // Show toast notification (no sound for admin panel)
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
            
            // Trigger a custom event for highlighting
            window.dispatchEvent(new CustomEvent('order-readiness-alert', { 
              detail: { orderId: newOrder.id, type: 'not_ready' } 
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔇 Cleaning up order readiness notifications');
      supabase.removeChannel(channel);
    };
  }, [toast, language]);
}
