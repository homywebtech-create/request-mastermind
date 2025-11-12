import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookMessage {
  from: string;
  text: {
    body: string;
  };
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 [TIP CONFIRMATION] Webhook received');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook body
    const body = await req.json();
    console.log('📦 Webhook body:', JSON.stringify(body, null, 2));

    // Extract message data from WhatsApp webhook format
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log('⚠️ No messages in webhook');
      return new Response(JSON.stringify({ status: 'no_messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message: WebhookMessage = messages[0];
    const customerPhone = message.from;
    const messageText = message.text?.body?.trim().toLowerCase();

    console.log(`📱 Customer phone: ${customerPhone}`);
    console.log(`💬 Message text: ${messageText}`);

    // Find customer by phone
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('whatsapp_number', customerPhone)
      .single();

    if (customerError || !customer) {
      console.log('❌ Customer not found:', customerError);
      return new Response(JSON.stringify({ status: 'customer_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Customer found: ${customer.id}`);

    // Find pending tip confirmations for this customer (last 48 hours)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: pendingTips, error: tipsError } = await supabase
      .from('payment_confirmations')
      .select('id, order_id, difference_amount, specialist_id')
      .eq('customer_id', customer.id)
      .eq('difference_reason', 'tip')
      .is('customer_confirmed_at', null)
      .gte('created_at', twoDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (tipsError || !pendingTips || pendingTips.length === 0) {
      console.log('⚠️ No pending tip confirmations found');
      return new Response(JSON.stringify({ status: 'no_pending_tips' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${pendingTips.length} pending tip(s)`);

    // Take the most recent pending tip
    const tip = pendingTips[0];

    // Determine customer response (نعم/yes/موافق/ok = confirmed)
    const confirmedKeywords = ['نعم', 'yes', 'موافق', 'ok', 'اوافق', 'أوافق', 'تمام', 'صح'];
    const rejectedKeywords = ['لا', 'no', 'رفض', 'ارفض', 'أرفض'];

    let isConfirmed: boolean | null = null;

    for (const keyword of confirmedKeywords) {
      if (messageText.includes(keyword)) {
        isConfirmed = true;
        break;
      }
    }

    if (isConfirmed === null) {
      for (const keyword of rejectedKeywords) {
        if (messageText.includes(keyword)) {
          isConfirmed = false;
          break;
        }
      }
    }

    if (isConfirmed === null) {
      console.log('⚠️ Could not determine customer response');
      return new Response(JSON.stringify({ status: 'unclear_response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Customer response: ${isConfirmed ? 'CONFIRMED' : 'REJECTED'}`);

    // Update payment confirmation
    const { error: updateError } = await supabase
      .from('payment_confirmations')
      .update({
        customer_confirmed_at: new Date().toISOString(),
        status: isConfirmed ? 'confirmed' : 'rejected',
      })
      .eq('id', tip.id);

    if (updateError) {
      console.error('❌ Failed to update payment confirmation:', updateError);
      throw updateError;
    }

    console.log('✅ Payment confirmation updated');

    // If confirmed, add tip to specialist's wallet
    if (isConfirmed) {
      // Get current specialist wallet balance
      const { data: specialist, error: specialistError } = await supabase
        .from('specialists')
        .select('wallet_balance')
        .eq('id', tip.specialist_id)
        .single();

      if (specialistError || !specialist) {
        console.error('❌ Failed to get specialist:', specialistError);
        throw specialistError;
      }

      const currentBalance = Number(specialist.wallet_balance) || 0;
      const newBalance = currentBalance + Number(tip.difference_amount);

      console.log(`💰 Updating specialist wallet: ${currentBalance} + ${tip.difference_amount} = ${newBalance}`);

      // Update specialist wallet
      const { error: walletError } = await supabase
        .from('specialists')
        .update({ wallet_balance: newBalance })
        .eq('id', tip.specialist_id);

      if (walletError) {
        console.error('❌ Failed to update specialist wallet:', walletError);
        throw walletError;
      }

      // Record wallet transaction
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          specialist_id: tip.specialist_id,
          order_id: tip.order_id,
          transaction_type: 'tip',
          amount: tip.difference_amount,
          balance_after: newBalance,
          description: `إكرامية من العميل للطلب #${tip.order_id.slice(-6)}`,
        });

      if (transactionError) {
        console.error('❌ Failed to record transaction:', transactionError);
        throw transactionError;
      }

      console.log('✅ Tip added to specialist wallet and transaction recorded');

      // Send confirmation message to customer
      const confirmationMessage = `✅ شكراً لتأكيدك! تم إضافة الإكرامية لحساب المحترفة بنجاح 🌟`;
      
      await sendWhatsAppMessage(customerPhone, confirmationMessage);
      console.log('✅ Confirmation message sent to customer');
    } else {
      // If rejected, return amount to customer wallet
      console.log('💳 Tip rejected, adding to customer wallet');

      // Get or create customer wallet
      const { data: existingWallet } = await supabase
        .from('customer_wallets')
        .select('id, balance')
        .eq('customer_id', customer.id)
        .single();

      if (existingWallet) {
        // Update existing wallet
        const newBalance = Number(existingWallet.balance) + Number(tip.difference_amount);
        
        const { error: walletError } = await supabase
          .from('customer_wallets')
          .update({ balance: newBalance })
          .eq('id', existingWallet.id);

        if (walletError) throw walletError;

        // Record transaction
        await supabase
          .from('customer_wallet_transactions')
          .insert({
            customer_id: customer.id,
            payment_confirmation_id: tip.id,
            order_id: tip.order_id,
            transaction_type: 'credit',
            amount: tip.difference_amount,
            balance_after: newBalance,
            description: `إلغاء إكرامية - تم إضافته للمحفظة من الطلب #${tip.order_id.slice(-6)}`,
          });
      } else {
        // Create new wallet
        await supabase
          .from('customer_wallets')
          .insert({
            customer_id: customer.id,
            balance: tip.difference_amount,
          });

        // Record transaction
        await supabase
          .from('customer_wallet_transactions')
          .insert({
            customer_id: customer.id,
            payment_confirmation_id: tip.id,
            order_id: tip.order_id,
            transaction_type: 'credit',
            amount: tip.difference_amount,
            balance_after: tip.difference_amount,
            description: `إلغاء إكرامية - تم إضافته للمحفظة من الطلب #${tip.order_id.slice(-6)}`,
          });
      }

      // Send rejection confirmation to customer
      const rejectionMessage = `تم تسجيل ردك. المبلغ الإضافي (${tip.difference_amount} ر.ق) تم إضافته لمحفظتك لاستخدامه في الطلبات المستقبلية 💳`;
      
      await sendWhatsAppMessage(customerPhone, rejectionMessage);
      console.log('✅ Amount added to customer wallet and message sent');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [TIP CONFIRMATION] Process completed successfully');

    return new Response(
      JSON.stringify({ 
        status: 'success',
        action: isConfirmed ? 'tip_confirmed' : 'tip_rejected',
        amount: tip.difference_amount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ [TIP CONFIRMATION] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(to: string, message: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    await supabase.functions.invoke('send-whatsapp', {
      body: { to, message }
    });
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
  }
}
