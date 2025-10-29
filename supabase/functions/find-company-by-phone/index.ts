import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== Find Company ===');
    console.log('1. Searching for phone:', phone);

    // البحث في جدول الشركات أولاً
    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('id, name, phone')
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (companyData) {
      console.log('2. Company found:', companyData.name);
      return new Response(
        JSON.stringify({ 
          success: true, 
          company: companyData,
          type: 'company'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // البحث في جدول company_users
    console.log('2. Not found in companies, searching company_users...');
    
    const { data: allUsers } = await supabaseAdmin
      .from('company_users')
      .select(`
        id,
        phone,
        full_name,
        company_id,
        companies (
          id,
          name,
          is_active
        )
      `)
      .eq('is_active', true);

    console.log('3. All users count:', allUsers?.length);

    if (allUsers) {
      const activeUsers = allUsers.filter(u => u.companies?.is_active === true);
      console.log('4. Active users count:', activeUsers.length);
      
      // البحث بعدة طرق
      const phoneClean = phone.replace(/\s+/g, '').trim();
      const phoneWithoutPlus = phoneClean.replace(/\+/g, '');
      
      const user = activeUsers.find(u => {
        const userPhone = u.phone?.replace(/\s+/g, '').trim() || '';
        const userPhoneWithoutPlus = userPhone.replace(/\+/g, '');
        
        return userPhone === phoneClean || 
               userPhoneWithoutPlus === phoneWithoutPlus ||
               userPhone.endsWith(phoneClean.replace(/^\+?\d{1,4}/, ''));
      });

      if (user && user.companies) {
        console.log('5. Company user found:', user.full_name);
        return new Response(
          JSON.stringify({ 
            success: true, 
            company: {
              id: user.companies.id,
              name: user.companies.name,
              phone: phoneClean
            },
            type: 'company_user',
            user: {
              id: user.id,
              full_name: user.full_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('6. No company found');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Phone number is not registered' 
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
