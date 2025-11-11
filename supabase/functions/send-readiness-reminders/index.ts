import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for orders needing readiness reminders...');

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Get orders with pending readiness that need reminders (< 3 reminders sent)
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        specialist_readiness_status,
        readiness_reminder_count,
        readiness_last_reminder_at,
        readiness_check_sent_at,
        order_specialists!inner(
          specialist_id,
          is_accepted
        )
      `)
      .eq('status', 'upcoming')
      .eq('specialist_readiness_status', 'pending')
      .lt('readiness_reminder_count', 3)
      .or(`readiness_last_reminder_at.is.null,readiness_last_reminder_at.lt.${fiveMinutesAgo.toISOString()}`)
      .eq('order_specialists.is_accepted', true);

    if (pendingError) {
      console.error('Error fetching pending orders:', pendingError);
      throw pendingError;
    }

    // Get orders with ready status but specialist hasn't moved (< 3 movement reminders)
    const { data: readyOrders, error: readyError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number,
        specialist_readiness_status,
        movement_reminder_count,
        movement_last_reminder_at,
        tracking_stage,
        order_specialists!inner(
          specialist_id,
          is_accepted
        )
      `)
      .eq('status', 'upcoming')
      .eq('specialist_readiness_status', 'ready')
      .is('tracking_stage', null)
      .lt('movement_reminder_count', 3)
      .or(`movement_last_reminder_at.is.null,movement_last_reminder_at.lt.${fiveMinutesAgo.toISOString()}`)
      .eq('order_specialists.is_accepted', true);

    if (readyError) {
      console.error('Error fetching ready orders:', readyError);
      throw readyError;
    }

    const results = [];

    // Process pending readiness reminders
    for (const order of pendingOrders || []) {
      try {
        const acceptedSpecialists = order.order_specialists
          ?.filter((os: any) => os.is_accepted)
          .map((os: any) => os.specialist_id) || [];

        if (acceptedSpecialists.length === 0) continue;

        const newCount = (order.readiness_reminder_count || 0) + 1;

        // Update reminder count
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            readiness_reminder_count: newCount,
            readiness_last_reminder_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating order ${order.id}:`, updateError);
          continue;
        }

        // Send reminder notification
        const { error: notificationError } = await supabase.functions.invoke(
          'send-push-notification',
          {
            body: {
              specialistIds: acceptedSpecialists,
              title: `تذكير ${newCount}/3 - تأكيد الجاهزية ⏰`,
              body: `يرجى تأكيد جاهزيتك للطلب ${order.order_number}. هذا التذكير رقم ${newCount} من 3`,
              data: {
                type: 'readiness_reminder',
                orderId: order.id,
                orderNumber: order.order_number,
                reminderCount: newCount.toString(),
                requiresAction: 'true',
                route: '/specialist/home'
              }
            }
          }
        );

        results.push({
          orderId: order.id,
          type: 'readiness_reminder',
          reminderCount: newCount,
          success: !notificationError
        });

        // If this was the 3rd reminder with no response, set penalty and notify admins
        if (newCount === 3) {
          const { error: penaltyError } = await supabase
            .from('orders')
            .update({
              readiness_penalty_percentage: 10, // 10% penalty
              specialist_readiness_status: 'no_response'
            })
            .eq('id', order.id);

          console.log(`Order ${order.id} marked as no_response after 3 reminders`);
        }

      } catch (error) {
        console.error(`Error processing pending order ${order.id}:`, error);
      }
    }

    // Process movement reminders for ready specialists
    for (const order of readyOrders || []) {
      try {
        const acceptedSpecialists = order.order_specialists
          ?.filter((os: any) => os.is_accepted)
          .map((os: any) => os.specialist_id) || [];

        if (acceptedSpecialists.length === 0) continue;

        const newCount = (order.movement_reminder_count || 0) + 1;

        // Update movement reminder count
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            movement_reminder_count: newCount,
            movement_last_reminder_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating order ${order.id}:`, updateError);
          continue;
        }

        // Send movement reminder
        const { error: notificationError } = await supabase.functions.invoke(
          'send-push-notification',
          {
            body: {
              specialistIds: acceptedSpecialists,
              title: `تذكير ${newCount}/3 - ابدأي التحرك 🚗`,
              body: `يرجى الضغط على "بدء التحرك" للطلب ${order.order_number}. هذا التذكير رقم ${newCount} من 3`,
              data: {
                type: 'movement_reminder',
                orderId: order.id,
                orderNumber: order.order_number,
                reminderCount: newCount.toString(),
                requiresAction: 'true',
                route: '/specialist/home'
              }
            }
          }
        );

        results.push({
          orderId: order.id,
          type: 'movement_reminder',
          reminderCount: newCount,
          success: !notificationError
        });

        // If this was the 3rd reminder, mark order as needing reassignment
        if (newCount === 3) {
          const { error: reassignError } = await supabase
            .from('orders')
            .update({
              specialist_readiness_status: 'needs_reassignment',
              readiness_penalty_percentage: 5 // 5% penalty for not moving
            })
            .eq('id', order.id);

          console.log(`Order ${order.id} marked as needs_reassignment after 3 movement reminders`);
        }

      } catch (error) {
        console.error(`Error processing ready order ${order.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pendingReminders: pendingOrders?.length || 0,
        movementReminders: readyOrders?.length || 0,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-readiness-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
