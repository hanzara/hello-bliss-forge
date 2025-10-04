import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, Plus, ArrowUpRight, ArrowDownLeft, 
  Smartphone, Wallet, AlertCircle, Loader2,
  TrendingUp, Clock, DollarSign
} from 'lucide-react';

interface WalletData {
  id: string;
  balance: number;
  pending_balance: number;
  total_spent: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  payment_method: string;
  status: string;
  created_at: string;
}

export const WifiWallet: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (user) {
      fetchWalletData();
      fetchTransactions();
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      let { data: wallet, error } = await supabase
        .from('buyer_wallets')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Wallet doesn't exist, create it
        const { data: newWallet, error: createError } = await supabase
          .from('buyer_wallets')
          .insert([{ user_id: user?.id }])
          .select()
          .single();

        if (createError) throw createError;
        wallet = newWallet;
      } else if (error) {
        throw error;
      }

      setWallet(wallet);
    } catch (error: any) {
      console.error('Error fetching wallet:', error);
      toast({
        title: "Error",
        description: "Failed to load wallet data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('wifi_wallet_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleTopup = async () => {
    if (!topupAmount || !paymentMethod) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(topupAmount);
    if (amount <= 0 || amount > 100000) {
      toast({
        title: "Error",
        description: "Amount must be between 1 and 100,000 KES",
        variant: "destructive"
      });
      return;
    }

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      toast({
        title: "Error",
        description: "Phone number is required for M-Pesa payment",
        variant: "destructive"
      });
      return;
    }

    setTopupLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('wifi-wallet-topup', {
        body: {
          amount: amount,
          payment_method: paymentMethod,
          phone_number: phoneNumber || null
        }
      });

      if (error) throw error;

      if (data.success) {
        if (data.status === 'pending') {
          toast({
            title: "Payment Initiated",
            description: data.message,
          });
        } else {
          toast({
            title: "Top-up Successful",
            description: `KES ${amount} has been added to your wallet`,
          });
          
          // Refresh wallet data
          fetchWalletData();
          fetchTransactions();
        }
        
        setShowTopupModal(false);
        setTopupAmount('');
        setPhoneNumber('');
      } else {
        throw new Error(data.error || 'Top-up failed');
      }
    } catch (error: any) {
      console.error('Top-up error:', error);
      toast({
        title: "Top-up Failed",
        description: error.message || "Failed to top up wallet",
        variant: "destructive"
      });
    } finally {
      setTopupLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case 'purchase':
        return <ArrowDownLeft className="h-4 w-4 text-red-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'topup':
        return 'text-green-600';
      case 'purchase':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-12 bg-gray-200 rounded w-1/2"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                WiFi Wallet Balance
              </div>
              <Dialog open={showTopupModal} onOpenChange={setShowTopupModal}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Top Up
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Top Up Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount (KES)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        min="1"
                        max="100000"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="payment-method">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="card">Credit/Debit Card</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMethod === 'mpesa' && (
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="254712345678"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    )}

                    <Button 
                      onClick={handleTopup} 
                      disabled={topupLoading}
                      className="w-full"
                    >
                      {topupLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Top Up KES ${topupAmount || '0'}`
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {formatAmount(wallet?.balance || 0)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {wallet?.pending_balance && wallet.pending_balance > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Pending: {formatAmount(wallet.pending_balance)}</span>
                  </div>
                  <span>•</span>
                </>
              )}
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>Total Spent: {formatAmount(wallet?.total_spent || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setShowTopupModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Money
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Smartphone className="h-4 w-4 mr-2" />
              M-Pesa Integration
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your wallet activity will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize">{transaction.payment_method}</span>
                        <Badge 
                          variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className={`font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                    {transaction.transaction_type === 'topup' ? '+' : '-'}
                    {formatAmount(Math.abs(transaction.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};