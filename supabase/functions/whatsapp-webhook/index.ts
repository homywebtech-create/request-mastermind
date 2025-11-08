import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "mobo_verify_token_2024";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Handle webhook verification (GET request from WhatsApp)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("🔍 Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("✅ Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    } else {
      console.log("❌ Webhook verification failed");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Handle incoming messages (POST request from WhatsApp)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("📨 Received webhook:", JSON.stringify(body, null, 2));

      // Extract message data from WhatsApp webhook
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages?.[0];

      if (!messages) {
        console.log("⚠️ No messages found in webhook");
        return new Response(JSON.stringify({ status: "no_messages" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messageType = messages.type;
      const fromNumber = messages.from;

      console.log("📱 Message from:", fromNumber, "Type:", messageType);

      // Initialize Supabase client
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Handle location messages
      if (messageType === "location") {
        const location = messages.location;
        const latitude = location.latitude;
        const longitude = location.longitude;
        const address = location.address || null;
        const name = location.name || null;

        console.log("📍 Location received:", { latitude, longitude, address, name });

        // Find the most recent pending order for this customer
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            customer:customers!inner(whatsapp_number)
          `)
          .eq("customers.whatsapp_number", fromNumber)
          .in("status", ["pending", "waiting_quotes", "quoted"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (ordersError) {
          console.error("❌ Error fetching orders:", ordersError);
          throw ordersError;
        }

        if (!orders || orders.length === 0) {
          console.log("⚠️ No pending orders found for this customer");
          return new Response(
            JSON.stringify({ 
              status: "no_order", 
              message: "No pending orders found for this customer" 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const order = orders[0];
        console.log("📦 Updating order:", order.order_number);

        // Update order with location data
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            customer_latitude: latitude,
            customer_longitude: longitude,
            customer_location_address: address,
            customer_location_name: name,
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("❌ Error updating order:", updateError);
          throw updateError;
        }

        console.log("✅ Location saved successfully for order:", order.order_number);

        return new Response(
          JSON.stringify({
            status: "success",
            message: "Location saved successfully",
            order_id: order.id,
            order_number: order.order_number,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // Handle text messages (for future use)
      if (messageType === "text") {
        const text = messages.text.body;
        console.log("💬 Text message received:", text);
        // Can be used for customer responses, feedback, etc.
      }

      return new Response(
        JSON.stringify({ status: "received", message_type: messageType }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
