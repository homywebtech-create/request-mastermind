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

    // Verify token
    const { data: inviteData, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", email)
      .eq("code", token)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !inviteData) {
      console.error("Invalid or expired token:", fetchError);
      return new Response(
        JSON.stringify({ error: "رابط الدعوة غير صحيح أو منتهي الصلاحية" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark token as used
    await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", inviteData.id);

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

    // Add admin role
    await supabase
      .from("user_roles")
      .insert({
        user_id: userData.user.id,
        role: "admin",
      });

    // Generate session for immediate login
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) throw sessionError;

    console.log("Admin account created successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: sessionData.properties?.access_token,
        refresh_token: sessionData.properties?.refresh_token,
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
