import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== Verification Process ===');
    console.log('1. Phone:', phone);
    console.log('2. Code:', code);
    console.log('3. Current time:', new Date().toISOString());

    // Check verification code
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    console.log('4. Verification found:', verification);
    console.log('5. Verify error:', verifyError);

    if (verifyError) {
      console.error('Error checking verification:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as verified using admin client
    await supabaseAdmin
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', verification.id);

    // Get company info
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('phone', phone)
      .eq('is_active', true)
      .single();

    if (companyError || !company) {
      console.error('Company not found:', companyError);
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('6. Company found:', company.name);

    // Check if user exists in profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('phone', phone)
      .maybeSingle();

    console.log('7. Profile found:', profile);

    // Generate email and password
    const companyEmail = `${phone.replace('+', '')}@company.local`;
    const companyPassword = `${phone}_${company.id}`;

    let authUser;
    
    if (!profile) {
      // Create new user
      console.log('8. Creating new user...');
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: companyEmail,
        password: companyPassword,
        email_confirm: true,
        user_metadata: {
          full_name: company.name,
          phone: phone,
        },
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        return new Response(
          JSON.stringify({ error: signUpError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authUser = authData.user;

      // Update profile with company_id
      await supabaseAdmin
        .from('profiles')
        .update({ company_id: company.id })
        .eq('user_id', authUser.id);

      console.log('9. User created:', authUser.id);
    } else {
      // Get existing user
      const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
      
      if (getUserError || !user) {
        console.error('Get user error:', getUserError);
        return new Response(
          JSON.stringify({ error: 'Failed to get user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authUser = user;
      console.log('9. Existing user:', authUser.id);
    }

    // Generate session token
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: companyEmail,
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('10. Session created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        company: {
          id: company.id,
          name: company.name,
        },
        user: {
          id: authUser.id,
          email: authUser.email,
        },
        session: sessionData.properties,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-company-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});