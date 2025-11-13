import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InconsistentOrder {
  id: string;
  order_number: string;
  tracking_stage: string;
  waiting_started_at: string | null;
  waiting_ends_at: string | null;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Starting check for inconsistent orders...');

    // Find orders where tracking_stage is 'working' but waiting fields are still set
    const { data: inconsistentOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, tracking_stage, waiting_started_at, waiting_ends_at, status')
      .eq('tracking_stage', 'working')
      .or('waiting_started_at.not.is.null,waiting_ends_at.not.is.null')
      .in('status', ['confirmed', 'in_progress']);

    if (fetchError) {
      console.error('❌ Error fetching inconsistent orders:', fetchError);
      throw fetchError;
    }

    if (!inconsistentOrders || inconsistentOrders.length === 0) {
      console.log('✅ No inconsistent orders found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No inconsistent orders found',
          fixed_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚠️ Found ${inconsistentOrders.length} inconsistent orders`);

    const fixedOrders: string[] = [];
    const errors: Array<{ order_id: string; error: string }> = [];

    // Fix each inconsistent order
    for (const order of inconsistentOrders) {
      try {
        console.log(`🔧 Fixing order ${order.order_number} (${order.id})`);
        console.log(`   - tracking_stage: ${order.tracking_stage}`);
        console.log(`   - waiting_started_at: ${order.waiting_started_at}`);
        console.log(`   - waiting_ends_at: ${order.waiting_ends_at}`);

        // Clear waiting fields when order is in working stage
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            waiting_started_at: null,
            waiting_ends_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`❌ Error fixing order ${order.order_number}:`, updateError);
          errors.push({
            order_id: order.id,
            error: updateError.message
          });
        } else {
          console.log(`✅ Successfully fixed order ${order.order_number}`);
          fixedOrders.push(order.order_number);
        }
      } catch (err) {
        console.error(`❌ Exception fixing order ${order.id}:`, err);
        errors.push({
          order_id: order.id,
          error: err.message
        });
      }
    }

    const result = {
      success: true,
      message: `Fixed ${fixedOrders.length} inconsistent orders`,
      total_found: inconsistentOrders.length,
      fixed_count: fixedOrders.length,
      fixed_orders: fixedOrders,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('📊 Fix inconsistent orders result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in fix-inconsistent-orders function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
