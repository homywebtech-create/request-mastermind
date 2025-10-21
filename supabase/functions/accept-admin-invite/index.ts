import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInviteRequest {
  email: string;
  token: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, password }: AcceptInviteRequest = await req.json();
    console.log("Accepting admin invite for:", email);

    if (!email || !token || !password) {
      throw new Error("Email, token, and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify token - code field now contains JSON with token and role
    const { data: inviteData, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", email)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError || !inviteData || inviteData.length === 0) {
      console.error("Invalid or expired token:", fetchError);
      return new Response(
        JSON.stringify({ error: "رابط الدعوة غير صحيح أو منتهي الصلاحية" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Parse the invite data to get token and role
    let inviteToken: string;
    let userRole: string = "admin"; // default role
    
    try {
      const parsedCode = JSON.parse(inviteData[0].code);
      inviteToken = parsedCode.token;
      userRole = parsedCode.role || "admin";
    } catch {
      // Fallback for old format (plain token string)
      inviteToken = inviteData[0].code;
    }

    // Verify the token matches
    if (inviteToken !== token) {
      console.error("Token mismatch");
      return new Response(
        JSON.stringify({ error: "رابط الدعوة غير صحيح" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Using role:", userRole);

    // Mark token as used
    await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", inviteData[0].id);

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log("User exists, updating password and ensuring admin role");
      userId = existingUser.id;

      // Update password
      await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
      });

      // Check if admin role exists
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Update or add role
      if (roleData) {
        await supabase
          .from("user_roles")
          .update({ role: userRole })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: userRole,
          });
      }
    } else {
      console.log("Creating new admin user");
      // Create admin user
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: "Admin User",
        }
      });

      if (createError) throw createError;

      userId = userData.user.id;

      // Add admin role with the specified role from invite
      await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: userRole,
        });
    }

    // Generate session for immediate login using anon key
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
      throw signInError;
    }

    console.log("Admin account setup completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in accept-admin-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
