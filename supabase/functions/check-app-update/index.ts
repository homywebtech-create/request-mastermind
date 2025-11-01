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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { currentVersionCode } = await req.json();

    console.log('Checking for updates. Current version:', currentVersionCode);

    // Get the latest version from database
    const { data: latestVersion, error } = await supabaseClient
      .from('app_versions')
      .select('*')
      .order('version_code', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching latest version:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to check for updates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const needsUpdate = latestVersion.version_code > parseInt(currentVersionCode);

    return new Response(
      JSON.stringify({
        needsUpdate,
        latestVersion: needsUpdate ? latestVersion : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-app-update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});