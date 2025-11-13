import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface InconsistentOrder {
  id: string;
  order_number: string;
  status: string;
  tracking_stage: string | null;
  waiting_started_at: string | null;
  waiting_ends_at: string | null;
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
    
    console.log('🔍 Starting comprehensive order consistency check...');
    
    const fixes: Array<{ order: string; issue: string; action: string }> = [];
    const errors: Array<{ order: string; error: string }> = [];
    
    // ========================================
    // Priority 1: Cancelled orders with tracking_stage
    // ========================================
    console.log('📋 [P1] Checking cancelled orders with tracking_stage...');
    const { data: cancelledWithTracking } = await supabase
      .from('orders')
      .select('id, order_number, status, tracking_stage')
      .eq('status', 'cancelled')
      .not('tracking_stage', 'is', null);
    
    if (cancelledWithTracking && cancelledWithTracking.length > 0) {
      console.log(`Found ${cancelledWithTracking.length} cancelled orders with tracking_stage`);
      for (const order of cancelledWithTracking) {
        try {
          const { error } = await supabase
            .from('orders')
            .update({ 
              tracking_stage: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Cancelled with tracking_stage',
            action: 'Set tracking_stage to null'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 2: Working orders with waiting times
    // ========================================
    console.log('📋 [P2] Checking working orders with waiting times...');
    const { data: workingWithWaiting } = await supabase
      .from('orders')
      .select('id, order_number, tracking_stage, waiting_started_at, waiting_ends_at')
      .eq('tracking_stage', 'working')
      .or('waiting_started_at.not.is.null,waiting_ends_at.not.is.null');
    
    if (workingWithWaiting && workingWithWaiting.length > 0) {
      console.log(`Found ${workingWithWaiting.length} working orders with waiting times`);
      for (const order of workingWithWaiting) {
        try {
          const { error } = await supabase
            .from('orders')
            .update({ 
              waiting_started_at: null,
              waiting_ends_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Working with waiting times',
            action: 'Cleared waiting_started_at and waiting_ends_at'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 3: Payment received but not completed
    // ========================================
    console.log('📋 [P3] Checking payment_received without completed status...');
    const { data: paymentNotCompleted } = await supabase
      .from('orders')
      .select('id, order_number, status, tracking_stage')
      .eq('tracking_stage', 'payment_received')
      .neq('status', 'completed');
    
    if (paymentNotCompleted && paymentNotCompleted.length > 0) {
      console.log(`Found ${paymentNotCompleted.length} orders with payment received but not completed`);
      for (const order of paymentNotCompleted) {
        try {
          const { error } = await supabase
            .from('orders')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Payment received but not completed',
            action: 'Set status to completed'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 4: Completed without payment_received
    // ========================================
    console.log('📋 [P4] Checking completed orders without payment_received...');
    const { data: completedNoPayment } = await supabase
      .from('orders')
      .select('id, order_number, status, tracking_stage')
      .eq('status', 'completed')
      .neq('tracking_stage', 'payment_received');
    
    if (completedNoPayment && completedNoPayment.length > 0) {
      console.log(`Found ${completedNoPayment.length} completed orders without payment_received`);
      for (const order of completedNoPayment) {
        try {
          const { error } = await supabase
            .from('orders')
            .update({ 
              tracking_stage: 'payment_received',
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Completed without payment_received',
            action: 'Set tracking_stage to payment_received'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 5: Pending with tracking_stage
    // ========================================
    console.log('📋 [P5] Checking pending orders with tracking_stage...');
    const { data: pendingWithTracking } = await supabase
      .from('orders')
      .select('id, order_number, status, tracking_stage')
      .eq('status', 'pending')
      .not('tracking_stage', 'is', null);
    
    if (pendingWithTracking && pendingWithTracking.length > 0) {
      console.log(`Found ${pendingWithTracking.length} pending orders with tracking_stage`);
      for (const order of pendingWithTracking) {
        try {
          const { error } = await supabase
            .from('orders')
            .update({ 
              tracking_stage: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Pending with tracking_stage',
            action: 'Set tracking_stage to null'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 6: Waiting without proper times
    // ========================================
    console.log('📋 [P6] Checking waiting orders without proper times...');
    const { data: waitingNoTimes } = await supabase
      .from('orders')
      .select('id, order_number, tracking_stage, waiting_started_at, waiting_ends_at')
      .eq('tracking_stage', 'waiting')
      .or('waiting_started_at.is.null,waiting_ends_at.is.null');
    
    if (waitingNoTimes && waitingNoTimes.length > 0) {
      console.log(`Found ${waitingNoTimes.length} waiting orders without proper times`);
      for (const order of waitingNoTimes) {
        try {
          // Reset to arrived stage since waiting times are missing
          const { error } = await supabase
            .from('orders')
            .update({ 
              tracking_stage: 'arrived',
              waiting_started_at: null,
              waiting_ends_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Waiting without proper times',
            action: 'Reset to arrived stage'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Priority 7: Stuck waiting orders (past waiting_ends_at)
    // ========================================
    console.log('📋 [P7] Checking stuck waiting orders...');
    const { data: stuckWaiting } = await supabase
      .from('orders')
      .select('id, order_number, tracking_stage, waiting_ends_at')
      .eq('tracking_stage', 'waiting')
      .not('waiting_ends_at', 'is', null)
      .lt('waiting_ends_at', new Date().toISOString());
    
    if (stuckWaiting && stuckWaiting.length > 0) {
      console.log(`Found ${stuckWaiting.length} stuck waiting orders`);
      for (const order of stuckWaiting) {
        try {
          // Move to pending for re-assignment or manual review
          const { error } = await supabase
            .from('orders')
            .update({ 
              status: 'pending',
              tracking_stage: null,
              waiting_started_at: null,
              waiting_ends_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (error) throw error;
          fixes.push({ 
            order: order.order_number, 
            issue: 'Stuck in waiting (past deadline)',
            action: 'Moved to pending for review'
          });
        } catch (err: any) {
          errors.push({ order: order.order_number, error: err.message });
        }
      }
    }
    
    // ========================================
    // Summary
    // ========================================
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      totalFixed: fixes.length,
      totalErrors: errors.length,
      categories: {
        cancelledWithTracking: fixes.filter(f => f.issue === 'Cancelled with tracking_stage').length,
        workingWithWaiting: fixes.filter(f => f.issue === 'Working with waiting times').length,
        paymentNotCompleted: fixes.filter(f => f.issue === 'Payment received but not completed').length,
        completedNoPayment: fixes.filter(f => f.issue === 'Completed without payment_received').length,
        pendingWithTracking: fixes.filter(f => f.issue === 'Pending with tracking_stage').length,
        waitingNoTimes: fixes.filter(f => f.issue === 'Waiting without proper times').length,
        stuckWaiting: fixes.filter(f => f.issue === 'Stuck in waiting (past deadline)').length,
      },
      fixes: fixes.length > 0 ? fixes : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
    
    console.log('✅ Consistency check completed:', summary);
    
    return new Response(
      JSON.stringify(summary),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
    
  } catch (error: any) {
    console.error('❌ Error in fix-inconsistent-orders:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
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
