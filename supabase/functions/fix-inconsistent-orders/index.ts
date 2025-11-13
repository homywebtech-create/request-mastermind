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
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔍 Checking for inconsistent orders...');
    
    // Find orders with inconsistent states:
    // 1. Orders with tracking_stage = 'working' but waiting_started_at/waiting_ends_at are NOT null
    // 2. Orders with status = 'cancelled' but tracking_stage is NOT null
    const { data: inconsistentOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, status, tracking_stage, waiting_started_at, waiting_ends_at')
      .or(`and(tracking_stage.eq.working,or(waiting_started_at.not.is.null,waiting_ends_at.not.is.null),status.in.(confirmed,in_progress)),and(status.eq.cancelled,tracking_stage.not.is.null)`)
      .in('status', ['confirmed', 'in_progress', 'cancelled']);
    
    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError);
      throw fetchError;
    }
    
    console.log(`📊 Found ${inconsistentOrders?.length || 0} inconsistent orders`);
    
    if (!inconsistentOrders || inconsistentOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No inconsistent orders found',
          found: 0,
          fixed: 0
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    // Fix each inconsistent order
    const fixes = [];
    const errors = [];
    
    for (const order of inconsistentOrders) {
      try {
        let updateData: any = { updated_at: new Date().toISOString() };
        let reason = '';
        
        // Case 1: Cancelled order with tracking_stage
        if (order.status === 'cancelled' && order.tracking_stage) {
          updateData.tracking_stage = null;
          reason = 'Cancelled order should not have tracking_stage';
        }
        // Case 2: Working order with waiting times
        else if (order.tracking_stage === 'working' && (order.waiting_started_at || order.waiting_ends_at)) {
          updateData.waiting_started_at = null;
          updateData.waiting_ends_at = null;
          reason = 'Working order should not have waiting times';
        }
        
        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);
        
        if (updateError) {
          console.error(`❌ Error fixing order ${order.order_number}:`, updateError);
          errors.push({ order: order.order_number, error: updateError.message });
        } else {
          console.log(`✅ Fixed order ${order.order_number}: ${reason}`);
          fixes.push({ order: order.order_number, reason });
        }
      } catch (err) {
        console.error(`❌ Exception fixing order ${order.order_number}:`, err);
        errors.push({ order: order.order_number, error: err.message });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Fixed ${fixes.length} out of ${inconsistentOrders.length} inconsistent orders`,
        found: inconsistentOrders.length,
        fixed: fixes.length,
        fixes,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
    
  } catch (error) {
    console.error('❌ Error in fix-inconsistent-orders:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
