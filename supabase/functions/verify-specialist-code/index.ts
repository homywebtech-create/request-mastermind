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
    const { phone, code } = await req.json();

    console.log("=== Specialist Verification Process ===");
    console.log("1. Phone:", phone);
    console.log("2. Code:", code);
    console.log("3. Current time:", new Date().toISOString());

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "الرجاء إدخال رقم الهاتف وكود التحقق" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the code
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .lt("attempts", 5)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("4. Verification found:", JSON.stringify(verification, null, 2));
    console.log("5. Verify error:", verifyError);

    if (verifyError || !verification) {
      return new Response(
        JSON.stringify({ error: "كود التحقق غير صحيح أو منتهي الصلاحية" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Mark code as verified
    await supabaseAdmin
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verification.id);

    // Get specialist info
    const { data: specialist, error: specialistError } = await supabaseAdmin
      .from("specialists")
      .select("id, name, phone, company_id")
      .eq("phone", phone)
      .eq("is_active", true)
      .single();

    console.log("6. Specialist found:", specialist?.name);

    if (specialistError || !specialist) {
      return new Response(
        JSON.stringify({ error: "لم يتم العثور على عامل مسجل بهذا الرقم" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Generate specialist credentials with cryptographically secure password
    const email = `specialist_${specialist.id}@system.local`;
    // Use crypto.getRandomValues for secure random password generation
    const passwordBytes = new Uint8Array(32);
    crypto.getRandomValues(passwordBytes);
    const password = btoa(String.fromCharCode(...passwordBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .slice(0, 32);

    console.log("7. Checking if user exists in auth...");

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users.find(u => u.email === email);

    console.log("8. User found in auth:", userExists?.id);

    if (userExists) {
      // Update existing user password
      console.log("10. Updating user password...");
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userExists.id,
        { password }
      );

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "فشل تحديث بيانات المستخدم" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      console.log("11. Password updated successfully");

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name: specialist.name,
          phone: specialist.phone,
          company_id: specialist.company_id
        })
        .eq("user_id", userExists.id);

    } else {
      // Create new user
      console.log("9. Creating new user...");
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: specialist.name,
          phone: specialist.phone,
        }
      });

      if (createError || !newUser) {
        console.error("Create error:", createError);
        return new Response(
          JSON.stringify({ error: "فشل إنشاء حساب المستخدم" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Create/update profile
      await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: newUser.user.id,
          full_name: specialist.name,
          phone: specialist.phone,
          company_id: specialist.company_id
        });

      // Assign specialist role
      await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: newUser.user.id,
          role: "specialist"
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        specialist: {
          id: specialist.id,
          name: specialist.name,
          phone: specialist.phone,
        },
        credentials: { email, password }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "حدث خطأ غير متوقع" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
