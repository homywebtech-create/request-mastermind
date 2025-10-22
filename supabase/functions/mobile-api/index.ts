import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to check company
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User not assigned to a company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/mobile-api')[1];

    // GET /orders - Get orders for specialist's company
    if (req.method === 'GET' && path === '/orders') {
      const status = url.searchParams.get('status');
      
      let query = supabaseClient
        .from('orders')
        .select(`
          *,
          customers (name, whatsapp_number, area),
          companies (name),
          order_specialists!inner (
            id,
            is_accepted,
            quoted_price,
            specialists!inner (
              id,
              name,
              company_id
            )
          )
        `)
        .or(`company_id.eq.${profile.company_id},send_to_all_companies.eq.true`)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (status) {
        if (status === 'upcoming') {
          // For upcoming: orders with accepted specialists but not completed
          query = query
            .eq('order_specialists.is_accepted', true)
            .neq('status', 'completed')
            .neq('status', 'cancelled');
        } else if (status === 'pending') {
          // For pending: orders without accepted specialists
          query = query
            .is('order_specialists.is_accepted', null)
            .eq('status', 'pending');
        } else {
          // For other statuses, filter by order status
          query = query.eq('status', status);
        }
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return new Response(
          JSON.stringify({ error: ordersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ orders }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PATCH /orders/:id - Update order status
    if (req.method === 'PATCH' && path.startsWith('/orders/')) {
      const orderId = path.split('/orders/')[1];
      const { status: newStatus } = await req.json();

      if (!newStatus || !['pending', 'in-progress', 'completed', 'cancelled'].includes(newStatus)) {
        return new Response(
          JSON.stringify({ error: 'Invalid status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify order belongs to specialist's company OR is sent to all companies
      const { data: order } = await supabaseClient
        .from('orders')
        .select('company_id, send_to_all_companies')
        .eq('id', orderId)
        .single();

      if (!order || (!order.send_to_all_companies && order.company_id !== profile.company_id)) {
        return new Response(
          JSON.stringify({ error: 'Order not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message: 'Order updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /stats - Get statistics for specialist's company
    if (req.method === 'GET' && path === '/stats') {
      const { data: orders, error: ordersError } = await supabaseClient
        .from('orders')
        .select('status')
        .or(`company_id.eq.${profile.company_id},send_to_all_companies.eq.true`);

      if (ordersError) {
        console.error('Error fetching stats:', ordersError);
        return new Response(
          JSON.stringify({ error: ordersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        inProgress: orders.filter(o => o.status === 'in-progress').length,
        completed: orders.filter(o => o.status === 'completed').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      };

      return new Response(
        JSON.stringify({ stats }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mobile-api:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
