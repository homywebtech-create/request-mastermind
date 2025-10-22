import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('⏰ [EXPIRY] Checking for expired orders...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orders that expired in the last 2 minutes and haven't been notified yet
    // We check last 2 minutes to catch any that might have been missed
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: expiredOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, service_type, status, expires_at, notified_expiry')
      .lt('expires_at', now)
      .gt('expires_at', twoMinutesAgo)
      .in('status', ['pending', 'waiting_quotes'])
      .is('notified_expiry', null);

    if (ordersError) {
      console.error('❌ [EXPIRY] Error fetching expired orders:', ordersError);
      throw ordersError;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('✅ [EXPIRY] No newly expired orders found');
      return new Response(
        JSON.stringify({ success: true, count: 0, message: 'No expired orders to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [EXPIRY] Found ${expiredOrders.length} expired orders`);

    // Process each expired order
    const notificationPromises = expiredOrders.map(async (order) => {
      try {
        // Get all specialists who were notified about this order but didn't respond
        const { data: orderSpecialists, error: specialistsError } = await supabase
          .from('order_specialists')
          .select('specialist_id')
          .eq('order_id', order.id)
          .is('quoted_price', null); // Didn't submit a quote

        if (specialistsError) {
          console.error(`❌ [EXPIRY] Error fetching specialists for order ${order.order_number}:`, specialistsError);
          return { success: false, orderId: order.id };
        }

        if (!orderSpecialists || orderSpecialists.length === 0) {
          console.log(`ℹ️ [EXPIRY] No specialists to notify for order ${order.order_number}`);
          // Mark as notified anyway
          await supabase
            .from('orders')
            .update({ notified_expiry: true })
            .eq('id', order.id);
          return { success: true, orderId: order.id, specialistCount: 0 };
        }

        const specialistIds = orderSpecialists.map(os => os.specialist_id);
        console.log(`📤 [EXPIRY] Sending expiry notification for order ${order.order_number} to ${specialistIds.length} specialists`);

        // Send push notification via the send-push-notification function
        const { error: notificationError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            specialistIds,
            title: '⏰ انتهى وقت العرض',
            body: `انتهى وقت تقديم عرض للطلب ${order.order_number}`,
            data: {
              type: 'order_expired',
              orderId: order.id,
              orderNumber: order.order_number,
              serviceType: order.service_type,
            }
          }
        });

        if (notificationError) {
          console.error(`❌ [EXPIRY] Failed to send notification for order ${order.order_number}:`, notificationError);
          return { success: false, orderId: order.id };
        }

        // Mark order as notified
        await supabase
          .from('orders')
          .update({ notified_expiry: true })
          .eq('id', order.id);

        console.log(`✅ [EXPIRY] Successfully notified about expired order ${order.order_number}`);
        return { success: true, orderId: order.id, specialistCount: specialistIds.length };
      } catch (error) {
        console.error(`❌ [EXPIRY] Error processing order ${order.order_number}:`, error);
        return { success: false, orderId: order.id };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`📊 [EXPIRY] Results: ${successCount}/${expiredOrders.length} orders notified`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: expiredOrders.length,
        notified: successCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [EXPIRY] Fatal error:', (error as any)?.message || error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
