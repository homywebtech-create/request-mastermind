import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Sending update notifications for version:', versionId);

    // Get the version details
    const { data: version, error: versionError } = await supabaseClient
      .from('app_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      console.error('Error fetching version:', versionError);
      return new Response(
        JSON.stringify({ error: 'Version not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active device tokens
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('device_tokens')
      .select('token, platform, specialist_id');

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('No device tokens found');
      return new Response(
        JSON.stringify({ message: 'No devices to notify', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!FIREBASE_SERVER_KEY) {
      console.error('FIREBASE_SERVER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Firebase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending notifications to ${tokens.length} devices`);

    let successCount = 0;
    let failCount = 0;

    // Send notifications in batches
    for (const deviceToken of tokens) {
      try {
        const notification = {
          to: deviceToken.token,
          notification: {
            title: `تحديث جديد متوفر - ${version.version_name}`,
            body: version.changelog || 'إصدار جديد من التطبيق متاح للتحميل',
            sound: 'notification_sound',
            android_channel_id: 'app-updates',
            icon: 'ic_stat_icon_config_sample',
            color: '#FF0000',
            priority: 'high',
            click_action: 'OPEN_UPDATE_DIALOG',
          },
          data: {
            type: 'app_update',
            version_id: version.id,
            version_code: version.version_code.toString(),
            version_name: version.version_name,
            apk_url: version.apk_url,
            is_mandatory: version.is_mandatory.toString(),
            changelog: version.changelog || '',
            route: '/specialist-orders?showUpdate=true',
          },
          android: {
            priority: 'high',
            notification: {
              channel_id: 'app-updates',
              sound: 'notification_sound',
              priority: 'high',
              default_vibrate_timings: true,
            },
          },
        };

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${FIREBASE_SERVER_KEY}`,
          },
          body: JSON.stringify(notification),
        });

        if (response.ok) {
          successCount++;
          console.log(`✅ Notification sent to device ${deviceToken.token.substring(0, 20)}...`);
        } else {
          failCount++;
          const errorText = await response.text();
          console.error(`❌ Failed to send to device: ${errorText}`);
        }
      } catch (error) {
        failCount++;
        console.error('Error sending notification:', error);
      }
    }

    console.log(`Update notifications sent: ${successCount} success, ${failCount} failed`);

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
    console.error('Error in notify-app-update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});