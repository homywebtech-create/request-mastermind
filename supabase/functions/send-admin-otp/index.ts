import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  email: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: OTPRequest = await req.json();
    console.log("Sending OTP to:", email);

    if (!email) {
      throw new Error("Email is required");
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate OTP code
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Store OTP in verification_codes table
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        phone: email, // Using phone field to store email
        code: otp,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw insertError;
    }

    // Send email with OTP
    const emailResponse = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [email],
      subject: "كود تسجيل الدخول - Admin Login Code",
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <h1 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">
                        🔐 كود تسجيل الدخول
                      </h1>
                      <p style="color: #666; margin: 0 0 30px 0; font-size: 16px; line-height: 1.5;">
                        استخدم الكود التالي لتسجيل الدخول إلى لوحة تحكم الأدمن
                      </p>
                      <div style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h2 style="color: #2563eb; margin: 0; font-size: 36px; letter-spacing: 8px; font-weight: bold;">
                          ${otp}
                        </h2>
                      </div>
                      <p style="color: #666; margin: 30px 0 0 0; font-size: 14px; line-height: 1.5;">
                        ⏱️ صالح لمدة 10 دقائق فقط<br>
                        🔒 لا تشارك هذا الكود مع أي شخص
                      </p>
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                      <p style="color: #999; font-size: 12px; margin: 0;">
                        إذا لم تطلب هذا الكود، يمكنك تجاهل هذه الرسالة بأمان
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        messageId: emailResponse.id 
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
    console.error("Error in send-admin-otp function:", error);
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
