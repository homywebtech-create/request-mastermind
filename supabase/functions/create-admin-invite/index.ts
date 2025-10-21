import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInviteRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: CreateInviteRequest = await req.json();
    console.log("Creating admin invite for:", email);

    if (!email) {
      throw new Error("Email is required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "admin_full", "admin_manager"]);

    if (!roleData || roleData.length === 0) {
      throw new Error("Only admins can create invites");
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      throw new Error("User already exists");
    }

    // Generate a secure token
    const token_bytes = new Uint8Array(32);
    crypto.getRandomValues(token_bytes);
    const invite_token = Array.from(token_bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Store invite token with expiry (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        phone: email, // Using phone field to store email
        code: invite_token,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error("Error storing invite:", insertError);
      throw insertError;
    }

    // Generate invite link
    const origin = `${req.headers.get('origin') || 'https://c9213afe-1e65-4593-8c57-2cfda087384c.lovableproject.com'}`;
    const inviteLink = `${origin}/set-password?token=${invite_token}&email=${encodeURIComponent(email)}`;

    console.log("Invite created successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        inviteLink,
        expiresAt: expiresAt.toISOString(),
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
    console.error("Error in create-admin-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes("Unauthorized") || error.message.includes("Only admins") ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
