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
    console.log('🔔 [FCM] Starting push notification process...');

    const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!firebaseServerKey) {
      throw new Error('FIREBASE_SERVER_KEY not configured');
    }

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

    // Send FCM notifications in batches
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        const fcmPayload = {
          to: deviceToken.token,
          priority: 'high',
          notification: {
            title,
            body,
            sound: 'default',
            android_channel_id: 'new-orders',
            badge: 1,
          },
          data: {
            ...data,
            route: '/specialist/new-orders',
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'notification_sound',
              channel_id: 'new-orders',
              priority: 'max',
              visibility: 'public',
              vibrate: [500, 200, 500],
              lights: { color: '#FF0000', light_on_duration: 300, light_off_duration: 1000 },
            },
          },
        };

        console.log(`📤 [FCM] Sending to specialist ${deviceToken.specialist_id}...`);

        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `key=${firebaseServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`❌ [FCM] Failed for ${deviceToken.specialist_id}:`, result);
          
          // If token is invalid, delete it from database
          if (result.error === 'InvalidRegistration' || result.error === 'NotRegistered') {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('token', deviceToken.token);
            console.log(`🗑️ [FCM] Removed invalid token for specialist ${deviceToken.specialist_id}`);
          }
          
          throw new Error(result.error || 'FCM error');
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
