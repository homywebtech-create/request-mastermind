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
      console.log("4. Missing phone or code");
      return new Response(
        JSON.stringify({ error: "الرجاء إدخال رقم الهاتف وكود التحقق" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("5. Supabase client created");

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

    console.log("6. Verification query result:", {
      found: !!verification,
      error: verifyError?.message,
      verificationId: verification?.id
    });

    if (verifyError) {
      console.error("7. Verify error:", verifyError);
      return new Response(
        JSON.stringify({ error: "حدث خطأ أثناء التحقق من الكود: " + verifyError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!verification) {
      console.log("8. No valid verification found");
      return new Response(
        JSON.stringify({ error: "كود التحقق غير صحيح أو منتهي الصلاحية" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("9. Marking code as verified");
    
    // Mark code as verified
    const { error: updateError } = await supabaseAdmin
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verification.id);

    if (updateError) {
      console.error("10. Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "حدث خطأ أثناء تحديث الكود: " + updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("11. Getting specialist info");

    // Get specialist info
    const { data: specialist, error: specialistError } = await supabaseAdmin
      .from("specialists")
      .select("id, name, phone, company_id")
      .eq("phone", phone)
      .eq("is_active", true)
      .single();

    console.log("12. Specialist query result:", {
      found: !!specialist,
      error: specialistError?.message,
      specialistName: specialist?.name
    });

    if (specialistError) {
      console.error("13. Specialist error:", specialistError);
      return new Response(
        JSON.stringify({ error: "حدث خطأ أثناء البحث عن المحترف: " + specialistError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!specialist) {
      console.log("14. No specialist found");
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

    console.log("15. Checking if user exists in auth...");

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users.find(u => u.email === email);

    console.log("16. User found in auth:", userExists?.id);

    if (userExists) {
      // Update existing user password
      console.log("17. Updating user password...");
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        userExists.id,
        { password }
      );

      if (updatePasswordError) {
        console.error("18. Update password error:", updatePasswordError);
        return new Response(
          JSON.stringify({ error: "فشل تحديث بيانات المستخدم: " + updatePasswordError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      console.log("19. Password updated successfully");

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
      console.log("20. Creating new user...");
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
        console.error("21. Create error:", createError);
        return new Response(
          JSON.stringify({ error: "فشل إنشاء حساب المستخدم: " + (createError?.message || 'Unknown error') }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      console.log("22. User created successfully");

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

    console.log("23. Returning success response");

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
    console.error("ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message || "حدث خطأ غير متوقع" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
