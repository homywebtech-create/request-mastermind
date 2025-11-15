import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Running catalog permissions diagnostic...');

    const META_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const META_CATALOG_ID = Deno.env.get('META_CATALOG_ID');

    if (!META_ACCESS_TOKEN || !META_CATALOG_ID) {
      return new Response(
        JSON.stringify({
          canAccess: false,
          message: 'Missing META_CATALOG_ID or WHATSAPP_ACCESS_TOKEN in environment',
          error: 'Configuration error'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Try to read the catalog to verify permissions
    const catalogUrl = `https://graph.facebook.com/v21.0/${META_CATALOG_ID}?fields=name,product_count&access_token=${META_ACCESS_TOKEN}`;
    
    console.log(`📖 Attempting to read catalog: ${META_CATALOG_ID}`);
    
    const response = await fetch(catalogUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Catalog access failed:', data);
      
      return new Response(
        JSON.stringify({
          canAccess: false,
          message: `Cannot access catalog ${META_CATALOG_ID}. Error: ${data.error?.message || 'Unknown error'}`,
          errorDetails: data.error,
          instructions: 'Your access token needs catalog_management permission. Go to Meta Business Settings → System Users → Assign catalog asset with Manage Catalog permission.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('✅ Catalog access successful:', data);

    return new Response(
      JSON.stringify({
        canAccess: true,
        message: `Successfully accessed catalog "${data.name}" with ${data.product_count || 0} products`,
        catalogInfo: {
          id: META_CATALOG_ID,
          name: data.name,
          productCount: data.product_count || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    return new Response(
      JSON.stringify({
        canAccess: false,
        error: error.message,
        message: 'Failed to run diagnostic'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
