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

    // البحث عن الشركة أو المستخدم
    let company: any = null;
    let companyUser: any = null;

    // البحث في جدول الشركات أولاً
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (companyData) {
      company = companyData;
      console.log('6. Company found:', company.name);
    } else {
      // البحث في جدول company_users
      console.log('6. Not found in companies, searching company_users...');
      
      // جلب جميع مستخدمي الشركات النشطين للمقارنة
      const { data: allUsers, error: usersError } = await supabaseAdmin
        .from('company_users')
        .select(`
          id,
          phone,
          full_name,
          company_id,
          companies!inner (
            id,
            name,
            is_active
          )
        `)
        .eq('is_active', true)
        .eq('companies.is_active', true);

      if (!usersError && allUsers) {
        // استخراج الرقم بدون رمز الدولة
        const phoneWithoutCountryCode = phone.replace(/^\+?\d{1,4}/, '');
        console.log('7. Searching for phone:', phone, 'or short version:', phoneWithoutCountryCode);
        
        // البحث بعدة طرق
        const userData = allUsers.find(u => 
          u.phone === phone || 
          u.phone === phoneWithoutCountryCode ||
          u.phone?.replace(/^\+?\d{1,4}/, '') === phoneWithoutCountryCode ||
          phone.endsWith(u.phone || '')
        );

        if (userData && userData.companies) {
          companyUser = userData;
          company = {
            id: userData.companies.id,
            name: userData.companies.name
          };
          console.log('8. Company user found:', companyUser.full_name, 'for company:', company.name);
        }
      }
    }

    if (!company) {
      console.error('Company or company user not found');
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('8. Final company:', company.name);

    // Generate company credentials with cryptographically secure password
    const companyEmail = `${phone.replace('+', '')}@company.local`;
    // Use crypto.getRandomValues for secure random password generation
    const passwordBytes = new Uint8Array(32);
    crypto.getRandomValues(passwordBytes);
    const companyPassword = btoa(String.fromCharCode(...passwordBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .slice(0, 32);

    console.log('9. Checking if user exists in auth...');

    // First, check if user exists in auth.users by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = users?.find(u => u.email === companyEmail);

    let authUser;
    
    if (existingAuthUser) {
      // User exists in auth, use it
      console.log('10. User found in auth:', existingAuthUser.id);
      authUser = existingAuthUser;

      // Check if profile exists
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id, company_id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      // Update profile with company_id if needed
      if (profile && !profile.company_id) {
        console.log('11. Updating profile with company_id');
        await supabaseAdmin
          .from('profiles')
          .update({ company_id: company.id, phone: phone })
          .eq('user_id', authUser.id);
      }

      // إذا كان المستخدم من company_users، ربط الحسابين
      if (companyUser) {
        const { data: existingCompanyUser } = await supabaseAdmin
          .from('company_users')
          .select('user_id')
          .eq('id', companyUser.id)
          .maybeSingle();

        if (existingCompanyUser && !existingCompanyUser.user_id) {
          console.log('12. Linking company_user with auth user');
          await supabaseAdmin
            .from('company_users')
            .update({ user_id: authUser.id })
            .eq('id', companyUser.id);
        }
      }
    } else {
      // Create new user
      console.log('10. Creating new user...');
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: companyEmail,
        password: companyPassword,
        email_confirm: true,
        user_metadata: {
          full_name: companyUser ? companyUser.full_name : company.name,
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
      console.log('11. Updating profile with company_id');
      await supabaseAdmin
        .from('profiles')
        .update({ 
          company_id: company.id, 
          phone: phone,
          full_name: companyUser ? companyUser.full_name : company.name
        })
        .eq('user_id', authUser.id);

      // إذا كان المستخدم من company_users، ربط الحسابين
      if (companyUser) {
        console.log('12. Linking company_user with auth user');
        await supabaseAdmin
          .from('company_users')
          .update({ user_id: authUser.id })
          .eq('id', companyUser.id);
      }

      console.log('13. User created:', authUser.id);
    }

    // تحديث كلمة المرور للمستخدم
    console.log('14. Updating user password...');
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: companyPassword }
    );

    if (updateError) {
      console.error('Update password error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('15. Password updated successfully');

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
        credentials: {
          email: companyEmail,
          password: companyPassword,
        },
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