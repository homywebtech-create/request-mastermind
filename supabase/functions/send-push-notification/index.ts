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

// Helper function to translate notification text based on specialist's language
function translateNotification(originalTitle: string, originalBody: string, language: string) {
  if (!language || language === 'ar') {
    return { title: originalTitle, body: originalBody };
  }

  // Translation mapping for common notification phrases
  const translations: Record<string, Record<string, string>> = {
    en: {
      'طلب جديد': 'New Order',
      'لديك طلب جديد': 'You have a new order',
      'تأكيد الحجز': 'Booking Confirmed',
      'تم تأكيد حجزك': 'Your booking has been confirmed',
      'تم تأكيد حجزك بنجاح': 'Your booking was confirmed successfully',
      '⏰ انتهى وقت العرض': '⏰ Offer Time Expired',
      'انتهى وقت تقديم عرض للطلب': 'Time to submit offer has expired for order',
      'تحديث الطلب': 'Order Update',
      'تم تحديث حالة الطلب': 'Order status has been updated',
      'عرض جديد': 'New Quote',
      'رد على العرض': 'Quote Response',
    }
  };

  let translatedTitle = originalTitle;
  let translatedBody = originalBody;

  // Translate title
  if (translations[language] && translations[language][originalTitle]) {
    translatedTitle = translations[language][originalTitle];
  }

  // Translate body - check for partial matches
  if (translations[language]) {
    for (const [arPhrase, enPhrase] of Object.entries(translations[language])) {
      if (originalBody.includes(arPhrase)) {
        translatedBody = translatedBody.replace(arPhrase, enPhrase);
      }
    }
  }

  return { title: translatedTitle, body: translatedBody };
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

    // Get specialist data including language preferences
    const { data: specialistsData, error: specialistsError } = await supabase
      .from('specialists')
      .select('id, is_online, offline_until, preferred_language')
      .in('id', specialistIds);

    if (specialistsError) {
      console.error('❌ [FCM] Error fetching specialists status:', specialistsError);
      throw specialistsError;
    }

    // Filter specialists: only include those who are online or whose offline period has expired
    const now = new Date();
    const onlineSpecialistIds = specialistsData
      ?.filter(spec => {
        if (!spec.is_online && spec.offline_until) {
          const offlineUntil = new Date(spec.offline_until);
          // Check if offline period has expired
          if (offlineUntil > now) {
            console.log(`⏸️ [FCM] Specialist ${spec.id} is offline until ${offlineUntil.toISOString()}`);
            return false;
          }
          // Offline period expired - should be set back online (this will happen via auto function)
          console.log(`✅ [FCM] Specialist ${spec.id} offline period expired - including in notifications`);
          return true;
        }
        return spec.is_online;
      })
      .map(spec => spec.id) || [];

    if (onlineSpecialistIds.length === 0) {
      console.log('⏸️ [FCM] All specialists are offline - no notifications sent');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'All specialists are offline' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [FCM] ${onlineSpecialistIds.length} of ${specialistIds.length} specialists are online`);

    // Get OAuth2 access token for Firebase Admin SDK
    const tokenResponse = await getAccessToken(serviceAccountJson);
    if (!tokenResponse) {
      throw new Error('Failed to get Firebase access token');
    }
    console.log('✅ [FCM] Got access token');

    // Get device tokens for online specialists only
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('token, platform, specialist_id, device_model, device_os, device_os_version, app_version')
      .in('specialist_id', onlineSpecialistIds);

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
        const isAndroid = (deviceToken.platform || '').toLowerCase() === 'android';

        // Determine notification type and get specialist language
        const notificationType = (data.type as string) || 'new_order';
        const specialist = specialistsData?.find(s => s.id === deviceToken.specialist_id);
        const specialistLanguage = specialist?.preferred_language || 'ar';

        // Translate notification based on specialist's language
        const { title: translatedTitle, body: translatedBody } = translateNotification(title, body, specialistLanguage);

        let targetRoute = '/specialist-orders/new'; // Default to new orders page
        console.log(`📍 [ROUTE] Determining route for type: ${notificationType}, orderId: ${data.orderId || 'none'}`);
        console.log(`🌐 [LANG] Specialist language: ${specialistLanguage}, Title: ${translatedTitle}`);
        
        // Route mapping based on notification type
        if (notificationType === 'new_quote' || notificationType === 'quote_response') {
          // Quote-related notifications → Active orders page
          targetRoute = '/specialist-orders';
          console.log(`📍 [ROUTE] Quote notification → ${targetRoute}`);
        } else if (notificationType === 'new_order' || notificationType === 'resend_order') {
          // New or resent order notifications → New orders page
          targetRoute = '/specialist-orders/new';
          console.log(`📍 [ROUTE] New/Resent order → ${targetRoute}`);
        } else if (notificationType === 'order_update' || notificationType === 'order_status_change') {
          // Order update notifications → Order tracking page (if orderId exists)
          targetRoute = data.orderId ? `/order-tracking/${data.orderId}` : '/specialist-orders';
          console.log(`📍 [ROUTE] Order update → ${targetRoute}`);
        } else if (notificationType === 'booking_confirmed') {
          // Booking confirmation → Show in accepted orders list (Home page)
          targetRoute = '/specialist-orders';
          console.log(`📍 [ROUTE] Booking confirmed → ${targetRoute} (show in accepted orders)`);
        } else if (notificationType === 'booking_update') {
          // Booking update → Order tracking page (if orderId exists)
          targetRoute = data.orderId ? `/order-tracking/${data.orderId}` : '/specialist-orders';
          console.log(`📍 [ROUTE] Booking update → ${targetRoute}`);
        } else if (notificationType === 'order_expired') {
          // Order expired → Stay on new orders page to see other opportunities
          targetRoute = '/specialist-orders/new';
          console.log(`📍 [ROUTE] Order expired → ${targetRoute}`);
        } else if (notificationType === 'test') {
          // Test notifications → New orders page
          targetRoute = '/specialist-orders/new';
          console.log(`📍 [ROUTE] Test notification → ${targetRoute}`);
        } else {
          // Unknown type → default to new orders
          console.log(`⚠️ [ROUTE] Unknown notification type: ${notificationType}, using default: ${targetRoute}`);
        }

        // Build message payload with translated text
        const baseData: Record<string, string> = {
          type: notificationType,
          title: translatedTitle,
          body: translatedBody,
          route: targetRoute,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          orderId: data.orderId?.toString() || '',
          customerId: data.customerId?.toString() || '',
          serviceType: data.serviceType?.toString() || '',
          price: data.price?.toString() || '',
          timestamp: new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
        };

        // Choose Android channel: use call-style for new orders/tests, standard otherwise
        const androidChannelId =
          (notificationType === 'new_order' || notificationType === 'resend_order' || notificationType === 'test')
            ? 'booking-calls-v6'
            : 'new-orders-v6';

        // IMPORTANT: Include BOTH notification and data for Android
        // - notification: Ensures FCM displays notification when app is CLOSED
        // - data: Allows MyFirebaseMessagingService.onMessageReceived() to handle it when app is open/background
        const message = isAndroid
          ? {
              message: {
                token: deviceToken.token,
                notification: {
                  title: translatedTitle,
                  body: translatedBody,
                },
                data: baseData,
                android: {
                  priority: 'high',
                  direct_boot_ok: true,
                  notification: {
                    channel_id: androidChannelId,
                  },
                },
              },
            }
          : {
              message: {
                token: deviceToken.token,
                notification: {
                  title: title || 'طلب جديد',
                  body: body || 'لديك طلب جديد',
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

        console.log(`📤 [FCM] Sending to specialist ${deviceToken.specialist_id} (${deviceToken.platform})...`);
        console.log(`📱 [DEVICE] Model: ${deviceToken.device_model || 'unknown'}, OS: ${deviceToken.device_os || 'unknown'} ${deviceToken.device_os_version || ''}, App: ${deviceToken.app_version || 'unknown'}`);
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

    // 🧹 Clean up invalid device tokens (UNREGISTERED/NotFound)
    for (let i = 0; i < results.length; i++) {
      const r = results[i] as PromiseRejectedResult | PromiseFulfilledResult<any>;
      if ((r as PromiseRejectedResult).status === 'rejected') {
        const reason: any = (r as PromiseRejectedResult).reason || {};
        const msg = typeof reason === 'string' ? reason : (reason.message || '');
        const tokenToDelete = tokens[i].token;
        if (/UNREGISTERED|NOT_FOUND|requested entity was not found|Invalid registration token/i.test(msg)) {
          console.log(`🗑️ [FCM] Deleting invalid token: ${tokenToDelete.slice(0, 12)}...`);
          await supabase.from('device_tokens').delete().eq('token', tokenToDelete);
        }
      }
    }

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
    console.error('❌ [FCM] Fatal error:', (error as any)?.message || error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
