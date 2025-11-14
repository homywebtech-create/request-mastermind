import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const META_CATALOG_ID = Deno.env.get("META_CATALOG_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SpecialistProduct {
  specialistId: string;
  specialistName: string;
  specialistImageUrl?: string;
  companyName: string;
  quotedPrice: number;
  productRetailerId: string; // Product ID in Meta Catalog
}

interface CarouselRequest {
  to: string;
  header_text: string;
  body_text: string;
  footer_text?: string;
  product_retailer_ids: string[]; // Product IDs from Meta Catalog (specialist IDs)
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, header_text, body_text, footer_text, product_retailer_ids }: CarouselRequest = await req.json();

    console.log("📱 Sending WhatsApp carousel to:", to);
    console.log("🔢 Number of products:", product_retailer_ids?.length);

    // Validate input
    if (!to || !body_text || !product_retailer_ids || product_retailer_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, body_text, and product_retailer_ids" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for WhatsApp credentials
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      console.error("❌ Missing WhatsApp credentials");
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for catalog ID
    if (!META_CATALOG_ID) {
      console.error("❌ Missing Meta Catalog ID");
      return new Response(
        JSON.stringify({ error: "Meta Catalog ID not configured. Please add META_CATALOG_ID to secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (remove + and spaces)
    const cleanPhone = to.replace(/\+/g, "").replace(/\s/g, "");

    // Limit to 10 products (WhatsApp API limit)
    const limitedProductIds = product_retailer_ids.slice(0, 10);

    // Build product sections for multi-product message
    const productSections = limitedProductIds.map(retailerId => ({
      product_retailer_id: retailerId
    }));

    // Construct the multi-product message payload
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: header_text
        },
        body: {
          text: body_text
        },
        footer: footer_text ? {
          text: footer_text
        } : undefined,
        action: {
          catalog_id: META_CATALOG_ID,
          sections: [
            {
              title: "Available Professionals",
              product_items: productSections
            }
          ]
        }
      }
    };

    console.log("📤 Sending carousel message payload:", JSON.stringify(messagePayload, null, 2));

    // Send the message via WhatsApp Business API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const responseData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error("❌ WhatsApp API error:", responseData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send WhatsApp carousel",
          details: responseData 
        }),
        { status: whatsappResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Carousel sent successfully:", responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.messages?.[0]?.id,
        data: responseData 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error in send-whatsapp-carousel function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
