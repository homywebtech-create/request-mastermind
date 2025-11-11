import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Order {
  id: string;
  order_number: string;
  booking_date: string;
  booking_time: string;
  specialist_readiness_status: string | null;
  readiness_check_sent_at: string | null;
  order_specialists?: Array<{
    specialist_id: string;
    is_accepted: boolean;
    specialists?: {
      id: string;
      name: string;
    };
  }>;
}

// Helper to get hour from booking_time (morning, afternoon, evening)
function getBookingHour(bookingTime: string): number {
  switch (bookingTime) {
    case 'morning':
      return 9; // 9 AM
    case 'afternoon':
      return 15; // 3 PM
    case 'evening':
      return 20; // 8 PM
    default:
      return 12; // Default noon
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for orders requiring readiness check...');

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Get all upcoming orders that need readiness check
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, 
        booking_date, 
        booking_time, 
        order_number,
        specialist_readiness_status, 
        readiness_check_sent_at,
        order_specialists!inner(
          specialist_id,
          is_accepted,
          specialists(id, name)
        )
      `)
      .eq('status', 'upcoming')
      .not('booking_date', 'is', null)
      .not('booking_time', 'is', null)
      .is('readiness_check_sent_at', null)
      .eq('order_specialists.is_accepted', true);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log(`Found ${orders?.length || 0} orders to check`);

    const ordersToNotify: Order[] = [];

    for (const order of orders || []) {
      const bookingDate = new Date(order.booking_date);
      const bookingHour = getBookingHour(order.booking_time);
      
      // Set the exact booking time
      bookingDate.setHours(bookingHour, 0, 0, 0);
      
      // Check time one hour before
      const checkTime = new Date(bookingDate.getTime() - 60 * 60 * 1000);

      // If current time is past the check time and before booking time
      if (now >= checkTime && now < bookingDate) {
        ordersToNotify.push(order);
      }
    }

    console.log(`${ordersToNotify.length} orders need readiness notification`);

    const results = [];

    for (const order of ordersToNotify) {
      try {
        // Get all accepted specialists for this order
        const acceptedSpecialists = order.order_specialists
          ?.filter((os: any) => os.is_accepted)
          .map((os: any) => os.specialist_id) || [];

        if (acceptedSpecialists.length === 0) {
          console.log(`No accepted specialists for order ${order.id}`);
          continue;
        }

        // Update order with readiness check sent timestamp
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            readiness_check_sent_at: new Date().toISOString(),
            specialist_readiness_status: 'pending'
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating order ${order.id}:`, updateError);
          results.push({ orderId: order.id, success: false, error: updateError.message });
          continue;
        }

        // Send push notification to all accepted specialists
        const { data: notificationData, error: notificationError } = await supabase.functions.invoke(
          'send-push-notification',
          {
            body: {
              specialistIds: acceptedSpecialists,
              title: 'تأكيد الجاهزية ⏰',
              body: `هل أنت جاهزة للطلب ${order.order_number} القادم بعد ساعة؟ يرجى التأكيد الآن`,
              data: {
                type: 'readiness_check',
                orderId: order.id,
                orderNumber: order.order_number,
                requiresAction: 'true',
                route: '/specialist/home'
              }
            }
          }
        );

        if (notificationError) {
          console.error(`Error sending notification for order ${order.id}:`, notificationError);
        }

        results.push({
          orderId: order.id,
          success: true,
          specialistCount: acceptedSpecialists.length,
          notificationSent: !notificationError
        });

        console.log(`Readiness check sent for order ${order.id} to ${acceptedSpecialists.length} specialist(s)`);
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        results.push({ orderId: order.id, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: orders?.length || 0,
        notified: ordersToNotify.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-order-readiness function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
