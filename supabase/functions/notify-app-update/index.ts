import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 [notify-app-update] Starting app update notification...');

    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    console.log('✅ [notify-app-update] Service account loaded for project:', serviceAccount.project_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { versionId } = await req.json();
    console.log('📦 [notify-app-update] Version ID:', versionId);

    // Get version details
    const { data: version, error: versionError } = await supabase
      .from('app_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      console.error('❌ [notify-app-update] Error fetching version:', versionError);
      throw new Error('Version not found');
    }

    console.log('✅ [notify-app-update] Version:', version.version_name, '(code:', version.version_code, ')');
    console.log('📝 [notify-app-update] Mandatory:', version.is_mandatory);
    console.log('📝 [notify-app-update] APK URL:', version.apk_url);

    // Get all device tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('token, platform, specialist_id');

    if (tokensError) {
      console.error('❌ [notify-app-update] Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ [notify-app-update] No device tokens found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No devices to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [notify-app-update] Found ${tokens.length} device tokens`);

    // Get OAuth2 access token for Firebase Admin SDK
    const tokenResponse = await getAccessToken(serviceAccount);
    if (!tokenResponse) {
      throw new Error('Failed to get Firebase access token');
    }
    console.log('✅ [notify-app-update] Got access token');

    // Prepare notification data
    const notificationTitle = version.is_mandatory ? '⚠️ تحديث إجباري متاح' : '🔔 تحديث جديد متاح';
    const notificationBody = `الإصدار ${version.version_name} - ${version.changelog || 'تحسينات وإصلاحات'}`;
    
    console.log('📝 [notify-app-update] Notification title:', notificationTitle);
    console.log('📝 [notify-app-update] Notification body:', notificationBody);
    
    const baseData: Record<string, string> = {
      type: 'app_update',
      title: notificationTitle,
      body: notificationBody,
      version_id: version.id,
      version_code: String(version.version_code),
      version_name: version.version_name,
      apk_url: version.apk_url,
      is_mandatory: String(!!version.is_mandatory),
      changelog: version.changelog || '',
      route: '/specialist-orders?showUpdate=true',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      timestamp: new Date().toISOString(),
    };

    console.log('📦 [notify-app-update] Base data prepared:', JSON.stringify(baseData, null, 2));

    // Send FCM notifications using Firebase Admin SDK v1 API (exactly like send-push-notification)
    const results = await Promise.allSettled(
      tokens.map(async (deviceToken) => {
        const isAndroid = (deviceToken.platform || '').toLowerCase() === 'android';

        // Use app-updates channel for update notifications
        const androidChannelId = 'app-updates';

        const message = isAndroid
          ? {
              message: {
                token: deviceToken.token,
                data: baseData,
                android: {
                  priority: 'high',
                  direct_boot_ok: true,
                },
              },
            }
          : {
              message: {
                token: deviceToken.token,
                notification: {
                  title: notificationTitle,
                  body: notificationBody,
                },
                data: baseData,
                apns: {
                  payload: {
                    aps: {
                      sound: 'notification_sound.mp3',
                    },
                  },
                },
              },
            };

        console.log(`📤 [notify-app-update] Sending to specialist ${deviceToken.specialist_id} (${deviceToken.platform})...`);

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
        
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResponse.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        console.log(`📝 [notify-app-update] HTTP Status: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        console.log(`📝 [notify-app-update] Response:`, responseText);
        
        if (!response.ok) {
          const result = JSON.parse(responseText);
          throw new Error(result.error?.message || 'FCM send failed');
        }
        
        const result = JSON.parse(responseText);
        console.log(`✅ [notify-app-update] Successfully sent to specialist ${deviceToken.specialist_id}`);
        
        return result;
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 [notify-app-update] Results: ${successCount} sent, ${failedCount} failed`);

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
    console.error('❌ [notify-app-update] Fatal error:', (error as any)?.message || error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
