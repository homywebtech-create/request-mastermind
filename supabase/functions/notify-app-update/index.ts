import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: get OAuth2 access token for Firebase v1 API using service account
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

  const pemKey = serviceAccount.private_key;
  const pemContents = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signatureInput));
  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signatureInput}.${signatureEncoded}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    console.error('[notify-app-update] Failed to get access token:', await tokenResponse.text());
    return null;
  }
  return await tokenResponse.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { versionId } = await req.json();
    console.log('[notify-app-update] Sending update notifications for version:', versionId);

    // Get the version details
    const { data: version, error: versionError } = await supabaseClient
      .from('app_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      console.error('[notify-app-update] Error fetching version:', versionError);
      return new Response(
        JSON.stringify({ error: 'Version not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all device tokens
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('device_tokens')
      .select('token, platform');

    if (tokensError) {
      console.error('[notify-app-update] Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('[notify-app-update] No device tokens found');
      return new Response(
        JSON.stringify({ message: 'No devices to notify', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const legacyServerKey = Deno.env.get('FIREBASE_SERVER_KEY');
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    console.log('[notify-app-update] Tokens:', tokens.length, 'Using', serviceAccountJson ? 'FCM v1' : legacyServerKey ? 'legacy FCM' : 'no Firebase config');

    if (!serviceAccountJson && !legacyServerKey) {
      return new Response(
        JSON.stringify({ error: 'Firebase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failCount = 0;

    // Prepare common data payload
    const dataPayload: Record<string, string> = {
      type: 'app_update',
      version_id: version.id,
      version_code: String(version.version_code),
      version_name: version.version_name,
      apk_url: version.apk_url,
      is_mandatory: String(!!version.is_mandatory),
      changelog: version.changelog || '',
      route: '/specialist-orders?showUpdate=true',
    };

    if (serviceAccountJson) {
      // Prefer FCM v1
      const serviceAccount = JSON.parse(serviceAccountJson);
      const tokenResponse = await getAccessToken(serviceAccount);
      if (!tokenResponse) {
        throw new Error('Failed to obtain Firebase access token');
      }
      const accessToken = tokenResponse.access_token;
      const projectId = serviceAccount.project_id;

      console.log('[notify-app-update] Using FCM v1 for project:', projectId);

      for (const deviceToken of tokens) {
        try {
          const isAndroid = (deviceToken.platform || '').toLowerCase() === 'android';
          const message = {
            message: {
              token: deviceToken.token,
              notification: {
                title: version.is_mandatory ? '⚠️ تحديث إجباري متاح' : '🔔 تحديث جديد متاح',
                body: `الإصدار ${version.version_name} - ${version.changelog || 'تحسينات وإصلاحات'}`,
              },
              data: dataPayload,
              android: isAndroid
                ? {
                    priority: 'high',
                    direct_boot_ok: true,
                    notification: {
                      sound: 'notification_sound',
                      channel_id: 'new_orders_channel',
                      priority: 'max',
                    },
                  }
                : undefined,
            },
          };

          const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });

          if (resp.ok) {
            successCount++;
          } else {
            failCount++;
            console.error('[notify-app-update] v1 send failed:', await resp.text());
          }
        } catch (e) {
          failCount++;
          console.error('[notify-app-update] v1 send error:', e);
        }
      }
    } else if (legacyServerKey) {
      // Fallback: legacy HTTP API
      for (const deviceToken of tokens) {
        try {
          const notification = {
            to: deviceToken.token,
            notification: {
              title: version.is_mandatory ? '⚠️ تحديث إجباري متاح' : '🔔 تحديث جديد متاح',
              body: `الإصدار ${version.version_name} - ${version.changelog || 'تحسينات وإصلاحات'}`,
              sound: 'notification_sound',
            },
            data: dataPayload,
            priority: 'high'
          };

          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${legacyServerKey}`,
            },
            body: JSON.stringify(notification),
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.error('[notify-app-update] legacy send failed:', await response.text());
          }
        } catch (e) {
          failCount++;
          console.error('[notify-app-update] legacy send error:', e);
        }
      }
    }

    console.log(`[notify-app-update] Done. Sent: ${successCount}, Failed: ${failCount}, Total: ${tokens.length}`);

    return new Response(
      JSON.stringify({
        message: 'Update notifications sent',
        sent: successCount,
        failed: failCount,
        total: tokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[notify-app-update] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
