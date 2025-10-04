import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Pesapal Production URLs
const PESAPAL_BASE_URL = 'https://pay.pesapal.com/v3';

interface PesapalTokenResponse {
  token: string;
  expiryDate: string;
  error?: any;
  status: string;
  message: string;
}

interface PesapalOrderRequest {
  id: string;
  currency: string;
  amount: number;
  description: string;
  callback_url: string;
  notification_id: string;
  billing_address: {
    email_address: string;
    phone_number: string;
    country_code: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    line_1?: string;
    line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    zip_code?: string;
  };
}

interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: any;
  status: string;
  message: string;
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

async function registerIPN(accessToken: string, ipnUrl: string, ipnType: string = 'GET'): Promise<string> {
  console.log('=== Registering IPN ===');
  
  try {
    const response = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: ipnType,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IPN registration failed:', response.status, errorText);
      throw new Error(`Failed to register IPN: ${response.status}`);
    }

    const data = await response.json();
    console.log('IPN registered successfully:', data);
    return data.ipn_id;
  } catch (error) {
    console.error('Error registering IPN:', error);
    throw error;
  }
}

async function submitOrderRequest(
  accessToken: string,
  orderRequest: PesapalOrderRequest
): Promise<PesapalOrderResponse> {
  console.log('=== Submitting Pesapal Order Request ===');
  console.log('Order Request:', JSON.stringify(orderRequest, null, 2));
  
  try {
    const response = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderRequest),
    });

    const responseData: PesapalOrderResponse = await response.json();
    console.log('Pesapal Order Response:', JSON.stringify(responseData, null, 2));

    if (!response.ok || responseData.error || responseData.status !== '200') {
      console.error('Order submission failed:', response.status, responseData);
      return {
        ...responseData,
        error: responseData.error || responseData.message || `Order submission failed: ${response.status}`,
      } as PesapalOrderResponse;
    }

    return responseData;
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
}

serve(async (req) => {
  console.log('=== Pesapal Integration Function Called ===');
  console.log('Request method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const { 
      action, 
      amount, 
      phoneNumber, 
      email, 
      firstName, 
      lastName,
      description,
      transactionId,
      userId 
    } = requestBody;

    console.log('=== Processing Pesapal Action ===');
    console.log('Action:', action);
    console.log('Amount:', amount);

    // Get Pesapal credentials from environment variables
    const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');

    console.log('=== Checking Credentials ===');
    console.log('Consumer Key exists:', !!consumerKey);
    console.log('Consumer Secret exists:', !!consumerSecret);

    if (!consumerKey || !consumerSecret) {
      console.error('=== MISSING CREDENTIALS ===');
      
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Pesapal credentials not configured',
        details: 'PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET must be set in Edge Function secrets'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'submit_order') {
      // Validate input
      if (!phoneNumber || !amount || !email || !firstName || !lastName) {
        console.error('Missing required parameters');
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Missing parameters',
          details: 'phoneNumber, amount, email, firstName, and lastName are required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (amount < 1) {
        console.error('Invalid amount:', amount);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Invalid amount',
          details: 'Amount must be at least 1 KES'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get access token
      const accessToken = await getAccessToken(consumerKey, consumerSecret);
      
      // Register IPN (callback URL)
      const ipnUrl = `${supabaseUrl}/functions/v1/pesapal-callback`;
      const ipnId = await registerIPN(accessToken, ipnUrl);

      // Create transaction record in database
      const merchantReference = transactionId || `TXN${Date.now()}`;
      
      const { error: dbError } = await supabase
        .from('pesapal_transactions')
        .insert({
          user_id: userId,
          merchant_reference: merchantReference,
          amount: amount,
          phone_number: phoneNumber,
          email: email,
          status: 'pending',
          transaction_type: 'payment',
        });

      if (dbError) {
        console.error('Database error:', dbError);
      }

      // Format phone number
      let formattedPhone = phoneNumber.replace(/\s+/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+254' + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // Submit order request
      const orderRequest: PesapalOrderRequest = {
        id: merchantReference,
        currency: 'KES',
        amount: amount,
        description: description || 'Payment',
        callback_url: `${supabaseUrl}/functions/v1/pesapal-callback`,
        notification_id: ipnId,
        billing_address: {
          email_address: email,
          phone_number: formattedPhone,
          country_code: 'KE',
          first_name: firstName,
          last_name: lastName,
        },
      };

      const orderResponse = await submitOrderRequest(accessToken, orderRequest);
      
      if (orderResponse.error) {
        return new Response(JSON.stringify({
          success: false,
          error: orderResponse.error,
          message: orderResponse.message,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update transaction with order tracking ID
      await supabase
        .from('pesapal_transactions')
        .update({
          order_tracking_id: orderResponse.order_tracking_id,
        })
        .eq('merchant_reference', merchantReference);

      return new Response(JSON.stringify({
        success: true,
        order_tracking_id: orderResponse.order_tracking_id,
        merchant_reference: orderResponse.merchant_reference,
        redirect_url: orderResponse.redirect_url,
        message: 'Order submitted successfully. Redirect user to complete payment.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('Invalid action:', action);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Invalid action',
      details: `Supported actions: submit_order. Received: ${action}`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== FUNCTION ERROR ===');
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Full error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Please check the function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
