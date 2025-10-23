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
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the JWT token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Authenticated user:', user.id, user.email);

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

    // Check if user is admin first
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = userRole && ['admin', 'admin_full', 'admin_manager'].includes(userRole.role);
    console.log('User role check:', { userId: user.id, role: userRole?.role, isAdmin });

    // If not admin, check if requesting user is company owner or has manage_team permission
    if (!isAdmin) {
      // First check if user's profile is linked to this company
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      console.log('Profile check:', { userId: user.id, profileCompanyId: profile?.company_id, requestedCompanyId: companyId });
      
      // Check if user exists in company_users table
      const { data: companyUser, error: companyUserError } = await supabaseAdmin
        .from('company_users')
        .select('id, is_owner')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .maybeSingle();

      console.log('Company user check:', { companyUser, error: companyUserError });

      if (companyUserError) {
        console.error('Error fetching company user:', companyUserError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify permissions', details: companyUserError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If user is not in company_users but their profile is linked to the company, they are the owner
      if (!companyUser && profile?.company_id === companyId) {
        console.log('User is company owner via profile link');
        // User is the company owner, allow the operation
      } else if (!companyUser) {
        console.error('User not authorized:', { userId: user.id, companyId });
        return new Response(
          JSON.stringify({ error: 'Unauthorized - not a member of this company' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (!companyUser.is_owner) {
        // If not owner, check for manage_team permission
        const { data: hasPermission } = await supabaseAdmin
          .from('company_user_permissions')
          .select('id')
          .eq('company_user_id', companyUser.id)
          .eq('permission', 'manage_team')
          .maybeSingle();

        console.log('Permission check:', { hasPermission });

        if (!hasPermission) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized - no manage_team permission' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
