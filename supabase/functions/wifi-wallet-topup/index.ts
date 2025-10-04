import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopupRequest {
  amount: number;
  payment_method: string;
  phone_number?: string;
  payment_reference?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use regular client for user authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header found');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { amount, payment_method, phone_number, payment_reference }: TopupRequest = await req.json();

    console.log('Processing wallet topup:', { amount, payment_method, user_id: user.id });

    // Validate amount
    if (amount <= 0 || amount > 100000) { // Max KES 100,000
      throw new Error('Invalid amount. Must be between 1 and 100,000');
    }

    // Get or create buyer wallet - use admin client for write operations
    let { data: wallet, error: walletError } = await supabaseClient
      .from('buyer_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError && walletError.code === 'PGRST116') {
      // Wallet doesn't exist, create it using admin client
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('buyer_wallets')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create wallet: ${createError.message}`);
      }
      wallet = newWallet;
    } else if (walletError) {
      throw new Error(`Failed to get wallet: ${walletError.message}`);
    }

    // For M-Pesa payment, initiate STK Push
    if (payment_method === 'mpesa' && phone_number) {
      // Create M-Pesa transaction record using admin client
      const { data: mpesaTransaction, error: mpesaError } = await supabaseAdmin
        .from('mpesa_transactions')
        .insert([{
          user_id: user.id,
          transaction_type: 'stk_push',
          amount: amount,
          phone_number: phone_number,
          status: 'pending'
        }])
        .select()
        .single();

      if (mpesaError) {
        throw new Error(`M-Pesa transaction creation failed: ${mpesaError.message}`);
      }

      // In a real implementation, you would integrate with M-Pesa Daraja API here
      // For demo purposes, we'll simulate successful payment
      
      return new Response(JSON.stringify({
        success: true,
        transaction_id: mpesaTransaction.id,
        status: 'pending',
        message: 'M-Pesa payment initiated. Please complete payment on your phone.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For other payment methods, process immediately (demo purposes)
    const newBalance = (wallet.balance || 0) + amount;

    // Update wallet balance using admin client
    const { error: updateError } = await supabaseAdmin
      .from('buyer_wallets')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error(`Wallet update failed: ${updateError.message}`);
    }

    // Record wallet transaction using admin client
    const { error: transactionError } = await supabaseAdmin
      .from('wifi_wallet_transactions')
      .insert([{
        user_id: user.id,
        wallet_id: wallet.id,
        transaction_type: 'topup',
        amount: amount,
        description: `Wallet top-up via ${payment_method}`,
        payment_method: payment_method,
        payment_reference: payment_reference || crypto.randomUUID(),
        status: 'completed'
      }]);

    if (transactionError) {
      console.error('Transaction recording failed:', transactionError);
    }

    console.log('Wallet topup completed successfully:', { user_id: user.id, amount, new_balance: newBalance });

    return new Response(JSON.stringify({
      success: true,
      new_balance: newBalance,
      amount_added: amount,
      message: 'Wallet topped up successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in wifi-wallet-topup:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);