import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Specialist {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  image_url: string | null;
  rating: number;
  experience_years: number | null;
  is_active: boolean;
  approval_status: string;
}

interface CatalogProduct {
  retailer_id: string;
  name: string;
  description: string;
  availability: string;
  condition: string;
  price: number;
  currency: string;
  image_url?: string;
  url: string;
  brand?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const metaCatalogId = Deno.env.get('META_CATALOG_ID');

    if (!metaAccessToken || !metaCatalogId) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Missing Meta API credentials',
          details: 'WHATSAPP_ACCESS_TOKEN or META_CATALOG_ID not configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching active specialists...');
    
    // Fetch all active, approved specialists
    const { data: specialists, error: fetchError } = await supabase
      .from('specialists')
      .select('*')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (fetchError) {
      console.error('Error fetching specialists:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch specialists', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${specialists?.length || 0} specialists to sync`);

    if (!specialists || specialists.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active specialists found to sync',
          synced: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get specialist specialties for descriptions
    const specialistIds = specialists.map(s => s.id);
    const { data: specialties } = await supabase
      .from('specialist_specialties')
      .select('specialist_id, sub_service_id, sub_services(name)')
      .in('specialist_id', specialistIds);

    // Create a map of specialist to their services
    const specialtiesMap = new Map<string, string[]>();
    specialties?.forEach((item: any) => {
      if (!specialtiesMap.has(item.specialist_id)) {
        specialtiesMap.set(item.specialist_id, []);
      }
      specialtiesMap.get(item.specialist_id)?.push(item.sub_services?.name || 'Service');
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Sync each specialist to Meta Catalog
    for (const specialist of specialists as Specialist[]) {
      try {
        const services = specialtiesMap.get(specialist.id) || [specialist.specialty || 'Service'];
        const serviceName = services.join(', ');

        // Create product data for Meta Catalog
        const product: CatalogProduct = {
          retailer_id: specialist.id,
          name: specialist.name || 'Specialist',
          description: `${serviceName} - ${specialist.experience_years || 0} years experience. Rating: ${specialist.rating || 0}/5`,
          availability: 'in stock',
          condition: 'new',
          price: 50, // Default price in SAR, you can customize this
          currency: 'SAR',
          url: `https://your-domain.com/specialist/${specialist.id}`, // Update with your domain
          brand: 'Your Company Name', // Update with your company name
          category: serviceName,
          // Meta requires image_url - use specialist image or placeholder
          image_url: specialist.image_url || 'https://via.placeholder.com/400x400.png?text=Specialist',
        };

        // Note: For item location, you'll need to add lat/long fields to specialists table
        // For now, we'll use a default location or skip it
        // product.latitude = specialist.latitude;
        // product.longitude = specialist.longitude;

        console.log(`Syncing specialist ${specialist.name} (${specialist.id})...`);

        // Add product to Meta Catalog using Graph API
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${metaCatalogId}/products`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(product)
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error(`Failed to sync ${specialist.name}:`, result);
          results.failed++;
          results.errors.push({
            specialist_id: specialist.id,
            name: specialist.name,
            error: result.error?.message || 'Unknown error'
          });
        } else {
          console.log(`Successfully synced ${specialist.name}`);
          results.success++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error syncing specialist ${specialist.id}:`, error);
        results.failed++;
        results.errors.push({
          specialist_id: specialist.id,
          name: specialist.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.success} specialists, ${results.failed} failed`,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in sync-specialists-to-catalog:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
