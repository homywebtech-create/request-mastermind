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
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the code
    const { data: verificationData, error: verificationError } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .lt('attempts', 5)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError || !verificationData) {
      console.error('Verification error:', verificationError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as verified
    await supabaseAdmin
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', verificationData.id);

    // Get specialist info
    const { data: specialist, error: specialistError } = await supabaseAdmin
      .from('specialists')
      .select('id, name, phone, company_id, is_active')
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (specialistError || !specialist) {
      console.error('Specialist error:', specialistError);
      return new Response(
        JSON.stringify({ error: 'No active specialist found with this phone number' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate specialist email and password
    const specialistEmail = `specialist_${specialist.id}@system.local`;
    const specialistPassword = `spec_${specialist.id}_${Date.now()}`;

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === specialistEmail);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      
      // Update profile with specialist info if needed
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            full_name: specialist.name,
            phone: specialist.phone,
            company_id: specialist.company_id
          })
          .eq('user_id', userId);
      }

      // Update password
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: specialistPassword
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: specialistEmail,
        password: specialistPassword,
        email_confirm: true,
        user_metadata: {
          full_name: specialist.name,
          phone: specialist.phone
        }
      });

      if (createError || !newUser) {
        console.error('User creation error:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;

      // Create or update profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: userId,
          full_name: specialist.name,
          phone: specialist.phone,
          company_id: specialist.company_id
        }, { onConflict: 'user_id' });

      // Assign specialist role
      await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'specialist'
        }, { onConflict: 'user_id,role' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        specialist: {
          id: specialist.id,
          name: specialist.name,
          phone: specialist.phone,
          company_id: specialist.company_id
        },
        credentials: {
          email: specialistEmail,
          password: specialistPassword
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-specialist-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
