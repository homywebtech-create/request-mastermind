import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily check for expired ID cards...');

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Find specialists with expired ID cards
    const { data: expiredSpecialists, error: fetchError } = await supabase
      .from('specialists')
      .select('id, name, phone, id_card_expiry_date')
      .not('id_card_expiry_date', 'is', null)
      .lt('id_card_expiry_date', today)
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching expired specialists:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredSpecialists?.length || 0} specialists with expired ID cards`);

    if (expiredSpecialists && expiredSpecialists.length > 0) {
      // Update each specialist to suspend them
      const suspensionPromises = expiredSpecialists.map(async (specialist) => {
        console.log(`Suspending specialist: ${specialist.name} (${specialist.phone}) - Expired: ${specialist.id_card_expiry_date}`);
        
        const { error: updateError } = await supabase
          .from('specialists')
          .update({
            is_active: false,
            suspension_type: 'temporary',
            suspension_reason: 'انتهت صلاحية البطاقة الشخصية - ID card expired',
            suspension_end_date: null,
          })
          .eq('id', specialist.id);

        if (updateError) {
          console.error(`Error suspending specialist ${specialist.id}:`, updateError);
          return { id: specialist.id, success: false, error: updateError.message };
        }

        return { id: specialist.id, success: true };
      });

      const results = await Promise.all(suspensionPromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Successfully suspended ${successCount} specialists`);
      if (failureCount > 0) {
        console.warn(`Failed to suspend ${failureCount} specialists`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Expired ID card check completed',
          total: expiredSpecialists.length,
          suspended: successCount,
          failed: failureCount,
          results,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'No expired ID cards found',
        total: 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in check-expired-cards function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
