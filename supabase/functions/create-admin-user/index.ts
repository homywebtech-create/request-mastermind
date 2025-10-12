import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, full_name, phone, role } = await req.json()

    // Validate required fields
    if (!email || !full_name || !role) {
      throw new Error('Email, full_name, and role are required')
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
    }

    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string;

    if (existingUser) {
      console.log('User already exists:', existingUser.id)
      userId = existingUser.id

      // Check if user has role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      // If no role or different role, update it
      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert([{
            user_id: userId,
            role: role
          }])
        
        if (roleError) {
          console.error('Role assignment error:', roleError)
          throw roleError
        }
      } else if (existingRole.role !== role) {
        const { error: roleUpdateError } = await supabaseAdmin
          .from('user_roles')
          .update({ role: role })
          .eq('user_id', userId)
        
        if (roleUpdateError) {
          console.error('Role update error:', roleUpdateError)
        }
      }

      // Update profile
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_active: false,
          email: email,
          full_name: full_name,
          phone: phone || null
        })
        .eq('user_id', userId)

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError)
      }

      // Resend invite email
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name,
            phone: phone || '',
          },
          redirectTo: `${req.headers.get('origin') || 'http://localhost:8080'}/set-password`
        }
      )

      if (inviteError) {
        console.error('Invite resend error:', inviteError)
      }

    } else {
      // Create new user with admin API and send invite email (bypasses signup restrictions)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name,
            phone: phone || '',
          },
          redirectTo: `${req.headers.get('origin') || 'http://localhost:8080'}/set-password`
        }
      )

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user')

      console.log('User created successfully:', authData.user.id)
      userId = authData.user.id

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert([{
          user_id: userId,
          role: role
        }])

      if (roleError) {
        console.error('Role assignment error:', roleError)
        throw roleError
      }

      // Update profile to inactive and store email
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_active: false,
          email: email
        })
        .eq('user_id', userId)

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: existingUser ? 'User updated and invitation resent.' : 'User created successfully. Invitation email sent.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error creating admin user:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
