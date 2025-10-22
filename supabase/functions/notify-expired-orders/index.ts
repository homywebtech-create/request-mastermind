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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if a specific order_id is provided (from trigger)
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    
    const specificOrderId = body?.order_id;

    if (specificOrderId) {
      console.log(`⏰ [EXPIRY-INSTANT] Processing specific order: ${specificOrderId}`);
      
      // Get the specific order
      const { data: expiredOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, service_type, status, expires_at, notified_expiry')
        .eq('id', specificOrderId)
        .in('status', ['pending', 'waiting_quotes'])
        .is('notified_expiry', null)
        .single();

      if (ordersError || !expiredOrders) {
        console.log(`ℹ️ [EXPIRY-INSTANT] Order ${specificOrderId} not found or already notified`);
        return new Response(
          JSON.stringify({ success: true, message: 'Order already processed or not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process single order
      await processExpiredOrder(supabase, expiredOrders);

      return new Response(
        JSON.stringify({ success: true, processed: 1, notified: 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: batch check for any missed orders (runs periodically if needed)
    console.log('⏰ [EXPIRY-BATCH] Checking for any missed expired orders...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: expiredOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, service_type, status, expires_at, notified_expiry')
      .lt('expires_at', now)
      .gt('expires_at', fiveMinutesAgo)
      .in('status', ['pending', 'waiting_quotes'])
      .is('notified_expiry', null);

    if (ordersError) {
      console.error('❌ [EXPIRY] Error fetching expired orders:', ordersError);
      throw ordersError;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('✅ [EXPIRY-BATCH] No missed expired orders found');
      return new Response(
        JSON.stringify({ success: true, count: 0, message: 'No expired orders to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [EXPIRY-BATCH] Found ${expiredOrders.length} missed expired orders`);

    // Process each expired order
    const notificationPromises = expiredOrders.map((order) => processExpiredOrder(supabase, order));

    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`📊 [EXPIRY-BATCH] Results: ${successCount}/${expiredOrders.length} orders notified`);

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

// Helper function to process a single expired order
async function processExpiredOrder(supabase: any, order: any) {
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
}
