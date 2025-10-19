import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  // Import the private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const jwt = `${signatureInput}.${signatureBase64}`;
  
  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  const data = await response.json();
  return data.access_token;
}

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
    console.log('🔔 [FCM] Starting push notification with FCM HTTP v1 API...');

    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;
    console.log('✅ [FCM] Service account loaded for project:', projectId);
    
    // Get OAuth2 access token
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
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        // FCM HTTP v1 API message format
        const message = {
          message: {
            token: deviceToken.token,
            notification: {
              title: title || 'طلب جديد',
              body: body || 'لديك طلب جديد',
            },
            android: {
              priority: 'high',
              notification: {
                channel_id: 'new-orders-v2',
                sound: 'short_notification',
              },
            },
            apns: {
              payload: {
                aps: {
                  'content-available': 1,
                  sound: 'default',
                },
              },
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
          },
        };

        console.log(`📤 [FCM] Sending to specialist ${deviceToken.specialist_id}...`);

        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`❌ [FCM] Failed for ${deviceToken.specialist_id}:`, result);
          
          // If token is invalid, delete it from database
          if (result.error?.code === 'NOT_FOUND' || 
              result.error?.code === 'INVALID_ARGUMENT' ||
              result.error?.message?.includes('not a valid FCM registration token')) {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('token', deviceToken.token);
            console.log(`🗑️ [FCM] Removed invalid token for specialist ${deviceToken.specialist_id}`);
          }
          
          throw new Error(result.error?.message || 'FCM send error');
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
