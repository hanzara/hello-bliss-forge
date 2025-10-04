import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Pesapal Production URL
const PESAPAL_BASE_URL = 'https://pay.pesapal.com/v3';

interface PesapalTokenResponse {
  token: string;
  expiryDate: string;
  error?: any;
  status: string;
  message: string;
}

interface PesapalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  payment_status_code: string;
  currency: string;
  error?: any;
  status: string;
}

async function getAccessToken(consumerKey: string, consumerSecret: string): Promise<string> {
  console.log('=== Getting Pesapal Access Token ===');
  
  try {
    const response = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', response.status, response.statusText, errorText);
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }

    const data: PesapalTokenResponse = await response.json();
    
    if (data.error || data.status !== '200') {
      console.error('Token error:', data);
      throw new Error(data.message || 'Failed to get access token');
    }
    
    console.log('Access token obtained successfully');
    return data.token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

async function getTransactionStatus(
  accessToken: string,
  orderTrackingId: string
): Promise<PesapalTransactionStatus> {
  console.log('=== Getting Transaction Status ===');
  console.log('Order Tracking ID:', orderTrackingId);
  
  try {
    const response = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Status request failed:', response.status, errorText);
      throw new Error(`Failed to get transaction status: ${response.status}`);
    }

    const data: PesapalTransactionStatus = await response.json();
    console.log('Transaction status:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw error;
  }
}

serve(async (req) => {
  console.log('=== Pesapal Callback Received ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get credentials
    const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Pesapal credentials');
      return new Response('OK', { status: 200 });
    }

    // Parse callback data - Pesapal sends data as query parameters
    const url = new URL(req.url);
    const orderTrackingId = url.searchParams.get('OrderTrackingId');
    const merchantReference = url.searchParams.get('OrderMerchantReference');

    console.log('Callback params:', { orderTrackingId, merchantReference });

    if (!orderTrackingId) {
      console.log('No OrderTrackingId in callback');
      return new Response('OK', { status: 200 });
    }

    // Get access token
    const accessToken = await getAccessToken(consumerKey, consumerSecret);

    // Get transaction status
    const statusData = await getTransactionStatus(accessToken, orderTrackingId);

    // Determine status based on payment_status_code
    // 0 = Invalid, 1 = Completed, 2 = Failed, 3 = Reversed
    let status = 'pending';
    if (statusData.payment_status_code === '1') {
      status = 'success';
    } else if (statusData.payment_status_code === '2') {
      status = 'failed';
    } else if (statusData.payment_status_code === '3') {
      status = 'reversed';
    }

    // Update transaction status in database
    const { error: updateError } = await supabase
      .from('pesapal_transactions')
      .update({
        order_tracking_id: orderTrackingId,
        status: status,
        payment_method: statusData.payment_method,
        confirmation_code: statusData.confirmation_code,
        payment_account: statusData.payment_account,
        payment_status_description: statusData.payment_status_description,
        callback_data: statusData,
        transaction_date: statusData.created_date,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_reference', statusData.merchant_reference);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
    } else {
      console.log('Transaction updated successfully');
    }

    // If payment is successful, update user wallet
    if (status === 'success') {
      const { data: transaction } = await supabase
        .from('pesapal_transactions')
        .select('user_id, amount')
        .eq('merchant_reference', statusData.merchant_reference)
        .single();

      if (transaction) {
        // Update user wallet balance
        const { error: walletError } = await supabase.rpc('add_funds_to_wallet', {
          p_user_id: transaction.user_id,
          p_currency: 'KES',
          p_amount: transaction.amount,
          p_source: 'pesapal',
          p_reference: statusData.merchant_reference,
        });

        if (walletError) {
          console.error('Error updating wallet:', walletError);
        } else {
          console.log('Wallet updated successfully');
        }
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Callback error:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
