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

// Helper function to get OAuth2 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  // Import private key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Sign JWT
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signatureInput)
  );
  
  const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  const jwt = `${signatureInput}.${jwtSignature}`;
  
  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const data = await response.json();
  return data.access_token;
}

function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 [FCM] Starting push notification process (HTTP v1 API)...');

    const firebaseServiceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!firebaseServiceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured. Please add your Firebase service account JSON.');
    }

    const serviceAccount = JSON.parse(firebaseServiceAccountJson);
    const projectId = serviceAccount.project_id;

    console.log(`🔑 [FCM] Getting OAuth2 access token for project: ${projectId}...`);
    const accessToken = await getAccessToken(serviceAccount);
    console.log('✅ [FCM] Access token obtained');

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

    // Send FCM notifications using HTTP v1 API
    const fcmV1Url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        const message = {
          message: {
            token: deviceToken.token,
            notification: {
              title,
              body,
            },
            data: {
              ...data,
              title,
              body,
              route: '/specialist/new-orders',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'short_notification', // 1-second sound
                channel_id: 'new-orders-v2',
                default_sound: false,
                default_vibrate_timings: false,
                vibrate_timings: ['0.3s', '0.1s', '0.3s'], // Shorter vibration
                visibility: 'public',
                notification_priority: 'PRIORITY_MAX',
                color: '#FF0000',
                icon: 'ic_stat_icon_config_sample',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'short_notification.mp3', // 1-second sound
                  badge: 1,
                  'content-available': 1, // Enable background delivery
                },
              },
            },
          },
        };

        console.log(`📤 [FCM v1] Sending to specialist ${deviceToken.specialist_id}...`);

        const response = await fetch(fcmV1Url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`❌ [FCM v1] Failed for ${deviceToken.specialist_id}:`, result);
          
          // If token is invalid, delete it from database
          if (result.error?.status === 'NOT_FOUND' || result.error?.status === 'INVALID_ARGUMENT') {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('token', deviceToken.token);
            console.log(`🗑️ [FCM v1] Removed invalid token for specialist ${deviceToken.specialist_id}`);
          }
          
          throw new Error(result.error?.message || 'FCM v1 error');
        }

        console.log(`✅ [FCM v1] Sent to specialist ${deviceToken.specialist_id}`);
        
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
