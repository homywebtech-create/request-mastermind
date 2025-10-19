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

// Helper function to get OAuth2 access token
async function getAccessToken(serviceAccount: any) {
  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  // Import private key
  const pemKey = serviceAccount.private_key;
  const pemContents = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const jwt = `${signatureInput}.${signatureEncoded}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  if (!tokenResponse.ok) {
    console.error('Failed to get access token:', await tokenResponse.text());
    return null;
  }
  
  return await tokenResponse.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 [FCM] Starting push notification with Firebase Admin SDK...');

    const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }
    
    const serviceAccountJson = JSON.parse(serviceAccount);
    console.log('✅ [FCM] Service account loaded for project:', serviceAccountJson.project_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { specialistIds, title, body, data = {} }: NotificationPayload = await req.json();

    console.log(`📱 [FCM] Sending to ${specialistIds.length} specialists...`);

    // Get OAuth2 access token for Firebase Admin SDK
    const tokenResponse = await getAccessToken(serviceAccountJson);
    if (!tokenResponse) {
      throw new Error('Failed to get Firebase access token');
    }
    console.log('✅ [FCM] Got access token');

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

    // Send FCM notifications using Firebase Admin SDK v1 API
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        const message = {
          message: {
            token: deviceToken.token,
            notification: {
              title: title || 'طلب جديد',
              body: body || 'لديك طلب جديد',
            },
            data: {
              type: 'new_order',
              title: title || 'طلب جديد',
              body: body || 'لديك طلب جديد',
              route: '/specialist/new-orders',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              orderId: data.orderId?.toString() || '',
              customerId: data.customerId?.toString() || '',
              serviceType: data.serviceType?.toString() || '',
              price: data.price?.toString() || '',
              timestamp: new Date().toISOString(),
              ...Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
              ),
            },
            android: {
              priority: 'high',
              notification: {
                channel_id: 'new-orders-v2',
                sound: 'short_notification',
              },
            },
          }
        };

        console.log(`📤 [FCM] Sending to specialist ${deviceToken.specialist_id}...`);
        console.log(`📤 [FCM] Message payload:`, JSON.stringify(message, null, 2));

        let response;
        let result;
        
        try {
          const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccountJson.project_id}/messages:send`;
          
          response = await fetch(fcmUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenResponse.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });

          console.log(`📝 [FCM] HTTP Status: ${response.status} ${response.statusText}`);
          
          const responseText = await response.text();
          console.log(`📝 [FCM] Response:`, responseText);
          
          if (!response.ok) {
            result = JSON.parse(responseText);
            throw new Error(result.error?.message || 'FCM send failed');
          }
          
          result = JSON.parse(responseText);
        } catch (fetchError) {
          console.error(`❌ [FCM] Fetch error for ${deviceToken.specialist_id}:`, fetchError);
          throw fetchError;
        }
        console.log(`✅ [FCM] Successfully sent to specialist ${deviceToken.specialist_id}`);
        
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
