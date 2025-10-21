import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code }: VerifyOTPRequest = await req.json();
    console.log("Verifying OTP for:", email);

    if (!email || !code) {
      throw new Error("Email and code are required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if code exists and is valid
    const { data: verificationData, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", email)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationData) {
      console.error("Invalid or expired code:", fetchError);
      return new Response(
        JSON.stringify({ error: "كود غير صحيح أو منتهي الصلاحية" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark code as verified
    await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verificationData.id);

    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    let authResponse;

    if (userExists) {
      // Generate magic link for existing user
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (error) throw error;
      authResponse = data;
    } else {
      // Create new admin user
      const randomPassword = Math.random().toString(36).slice(-12);
      
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: randomPassword,
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

      // Generate session
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (error) throw error;
      authResponse = data;
    }

    console.log("OTP verified successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: authResponse.properties?.access_token,
        refresh_token: authResponse.properties?.refresh_token,
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
    console.error("Error in verify-admin-otp function:", error);
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
