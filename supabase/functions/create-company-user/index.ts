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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyId, userData, permissions } = await req.json();

    if (!companyId || !userData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is an update operation
    if (userData.isUpdate && userData.companyUserId) {
      // Update existing company user
      const { error: updateError } = await supabaseAdmin
        .from('company_users')
        .update({
          full_name: userData.full_name,
          phone: userData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.companyUserId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete old permissions
      await supabaseAdmin
        .from('company_user_permissions')
        .delete()
        .eq('company_user_id', userData.companyUserId);

      // Insert new permissions
      if (permissions && permissions.length > 0) {
        const permissionsToInsert = permissions.map((permission: string) => ({
          company_user_id: userData.companyUserId,
          permission,
        }));

        await supabaseAdmin
          .from('company_user_permissions')
          .insert(permissionsToInsert);
      }

      return new Response(
        JSON.stringify({
          success: true,
          company_user_id: userData.companyUserId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the requesting user has permission to manage team
    const { data: requestingUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (requestingUserProfile?.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - wrong company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user has manage_team permission or is owner
    const { data: companyUser } = await supabaseAdmin
      .from('company_users')
      .select('is_owner')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!companyUser?.is_owner) {
      const { data: hasPermission } = await supabaseAdmin
        .from('company_user_permissions')
        .select('id')
        .eq('company_user_id', companyUser?.id)
        .eq('permission', 'manage_team')
        .maybeSingle();

      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - no manage_team permission' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let authUserId: string;

    // Check if user already exists by email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find(u => u.email === userData.email);

    if (existingUser) {
      authUserId = existingUser.id;
      console.log('User already exists:', authUserId);
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          phone: userData.phone,
        },
      });

      if (createError || !newUser?.user) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: createError?.message || 'Failed to create user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authUserId = newUser.user.id;
      console.log('Created new user:', authUserId);
    }

    // Update profile with company_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyId,
        phone: userData.phone,
        full_name: userData.full_name,
      })
      .eq('user_id', authUserId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Check if company_users record already exists
    const { data: existingCompanyUser } = await supabaseAdmin
      .from('company_users')
      .select('id')
      .eq('user_id', authUserId)
      .eq('company_id', companyId)
      .maybeSingle();

    let companyUserId: string;

    if (existingCompanyUser) {
      // Update existing record
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('company_users')
        .update({
          full_name: userData.full_name,
          email: userData.email,
          phone: userData.phone,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCompanyUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating company_users:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update company user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      companyUserId = updated.id;
    } else {
      // Create new company_users record
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('company_users')
        .insert({
          company_id: companyId,
          user_id: authUserId,
          full_name: userData.full_name,
          email: userData.email,
          phone: userData.phone,
          is_owner: false,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting company_users:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create company user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      companyUserId = inserted.id;
    }

    // Delete existing permissions
    await supabaseAdmin
      .from('company_user_permissions')
      .delete()
      .eq('company_user_id', companyUserId);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const permissionsToInsert = permissions.map((permission: string) => ({
        company_user_id: companyUserId,
        permission,
      }));

      const { error: permError } = await supabaseAdmin
        .from('company_user_permissions')
        .insert(permissionsToInsert);

      if (permError) {
        console.error('Error inserting permissions:', permError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        company_user_id: companyUserId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-company-user:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
