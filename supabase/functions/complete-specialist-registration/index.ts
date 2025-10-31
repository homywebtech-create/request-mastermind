import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      specialist_id,
      token,
      name,
      phone,
      nationality,
      birth_date,
      experience_years,
      notes,
      id_card_expiry_date,
      countries_worked_in,
      has_cleaning_allergy,
      has_pet_allergy,
      languages_spoken,
      sub_service_ids,
      face_photo_url,
      full_body_photo_url,
      id_card_front_url,
      id_card_back_url,
    } = body || {};

    if (!specialist_id || !token || !Array.isArray(sub_service_ids)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate specialist eligibility
    const { data: specialist, error: specialistError } = await supabaseAdmin
      .from("specialists")
      .select("id, approval_status, registration_completed_at, is_active")
      .eq("id", specialist_id)
      .eq("registration_token", token)
      .maybeSingle();

    if (specialistError || !specialist) {
      return new Response(
        JSON.stringify({ error: "Specialist not found or invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (specialist.approval_status !== "pending" || specialist.registration_completed_at !== null) {
      return new Response(
        JSON.stringify({ error: "Registration not allowed for this specialist" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Replace specialties while registration_completed_at is still NULL
    const { error: delError } = await supabaseAdmin
      .from("specialist_specialties")
      .delete()
      .eq("specialist_id", specialist_id);

    if (delError) {
      return new Response(
        JSON.stringify({ error: delError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (sub_service_ids.length) {
      const rows = sub_service_ids.map((sid: string) => ({
        specialist_id,
        sub_service_id: sid,
      }));

      const { error: insError } = await supabaseAdmin
        .from("specialist_specialties")
        .insert(rows);

      if (insError) {
        return new Response(
          JSON.stringify({ error: insError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Update specialist and mark registration completed
    const { error: updError } = await supabaseAdmin
      .from("specialists")
      .update({
        name,
        phone,
        nationality,
        birth_date,
        experience_years,
        notes,
        id_card_expiry_date,
        countries_worked_in,
        has_cleaning_allergy,
        has_pet_allergy,
        languages_spoken,
        face_photo_url,
        full_body_photo_url,
        id_card_front_url,
        id_card_back_url,
        registration_completed_at: new Date().toISOString(),
      })
      .eq("id", specialist_id)
      .eq("registration_token", token);

    if (updError) {
      return new Response(
        JSON.stringify({ error: updError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unexpected error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});