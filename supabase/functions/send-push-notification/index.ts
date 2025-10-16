import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  specialistIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 [FCM] Starting push notification with server key...');

    const serverKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!serverKey) {
      throw new Error('FIREBASE_SERVER_KEY not configured');
    }
    console.log('✅ [FCM] Server key loaded');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { specialistIds, title, body, data = {} }: NotificationPayload = await req.json();

    console.log(`📱 [FCM] Sending to ${specialistIds.length} specialists...`);

    // Get device tokens for these specialists
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('token, platform, specialist_id')
      .in('specialist_id', specialistIds);

    if (tokensError) {
      console.error('❌ [FCM] Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ [FCM] No device tokens found for specialists');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No devices to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [FCM] Found ${tokens.length} device tokens`);

    // Send FCM notifications using legacy API (works with server key)
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        // Data-only message to ensure onMessageReceived() is called
        const message = {
          to: deviceToken.token,
          priority: 'high',
          data: {
            type: 'new_order',
            title: title || 'طلب جديد',
            body: body || 'لديك طلب جديد',
            route: '/specialist/new-orders',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            timestamp: new Date().toISOString(),
            // Convert all data values to strings (FCM requirement)
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
          },
        };

        console.log(`📤 [FCM] Sending to specialist ${deviceToken.specialist_id}...`);

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${serverKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        
        if (!response.ok || result.failure === 1) {
          console.error(`❌ [FCM] Failed for ${deviceToken.specialist_id}:`, result);
          
          // If token is invalid, delete it from database
          if (result.results?.[0]?.error === 'NotRegistered' || 
              result.results?.[0]?.error === 'InvalidRegistration') {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('token', deviceToken.token);
            console.log(`🗑️ [FCM] Removed invalid token for specialist ${deviceToken.specialist_id}`);
          }
          
          throw new Error(result.results?.[0]?.error || 'FCM send error');
        }

        console.log(`✅ [FCM] Sent to specialist ${deviceToken.specialist_id}`);
        
        // Update last_used_at
        await supabase
          .from('device_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('token', deviceToken.token);

        return result;
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 [FCM] Results: ${successCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedCount,
        total: tokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [FCM] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
