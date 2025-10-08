import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, TrendingUp, Calendar, Settings, MessageSquare, CreditCard, Bell, Shield, Wallet as WalletIcon } from 'lucide-react';
import CurrencyDisplay from '@/components/CurrencyDisplay';
import Navigation from '@/components/Navigation';
import { useChamas } from '@/hooks/useChamas';
import { useChamaMembers } from '@/hooks/useChamaMembers';
import { useChamaRoles } from '@/hooks/useChamaRoles';
import { useChamaWalletOps } from '@/hooks/useChamaWalletOps';
import { useChamaNotifications } from '@/hooks/useChamaNotifications';
import { WalletCards } from '@/components/chama/WalletCards';
import { ContributionLeaderboard } from '@/components/chama/ContributionLeaderboard';
import { RoleBasedDashboard } from '@/components/chama/RoleBasedDashboard';
import { LoanManagementPanel } from '@/components/chama/LoanManagementPanel';
import { RealtimeContributionFeed } from '@/components/chama/RealtimeContributionFeed';
import { useCSVExportChama } from '@/hooks/useCSVExportChama';
import { useChamaLoans } from '@/hooks/useChamaLoans';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const ChamaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: chamas, isLoading } = useChamas();
  const { data: members } = useChamaMembers(id!);
  const { userRole, isAdmin, isTreasurer, isSecretary } = useChamaRoles(id!);
  const walletOps = useChamaWalletOps();
  const { notifications, unreadCount, markAllAsRead } = useChamaNotifications(id);
  const { exportContributions, exportLoans } = useCSVExportChama();
  const { loans } = useChamaLoans(id!);

  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Find the specific chama by ID
  const chama = chamas?.find(c => c.id === id);
  const myMembership = members?.find(m => m.user_id === user?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!chama) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Chama Not Found</h1>
            <p className="text-gray-600 mb-6">The chama you're looking for doesn't exist or you don't have access to it.</p>
            <Button onClick={() => navigate('/chamas')} className="bg-gradient-to-r from-blue-600 to-green-600">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chamas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/chamas')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chamas
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              {chama.name}
            </h1>
            <p className="text-muted-foreground mt-1">{chama.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
            {userRole && (
              <Badge variant={isAdmin ? 'default' : 'secondary'} className="ml-auto">
                {userRole.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={chama.total_savings || 0} className="text-2xl font-bold" />
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chama.current_members}/{chama.max_members}</div>
              <p className="text-xs text-muted-foreground">
                Active members
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contribution</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={chama.contribution_amount} className="text-2xl font-bold" />
              <p className="text-xs text-muted-foreground">
                {chama.contribution_frequency}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Meeting</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Jan 15</div>
              <p className="text-xs text-muted-foreground">
                Monthly meeting
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Cards */}
        {myMembership && (
          <WalletCards
            chamaId={id!}
            savingsBalance={myMembership.savings_balance || 0}
            mgrBalance={myMembership.mgr_balance || 0}
            withdrawalLocked={myMembership.withdrawal_locked || false}
            canUnlock={isAdmin}
          />
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/50 backdrop-blur-sm">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <RoleBasedDashboard
              chamaId={id!}
              userRole={userRole?.role || 'member'}
              isAdmin={isAdmin}
              isTreasurer={isTreasurer}
              isSecretary={isSecretary}
            />
            
            <div className="grid gap-4 md:grid-cols-2">
              <RealtimeContributionFeed chamaId={id!} />
              <ContributionLeaderboard 
                chamaId={id!} 
                canDownload={isAdmin || isTreasurer}
                canVerify={isAdmin || isTreasurer}
                userRole={userRole?.role || 'member'}
              />
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Members ({chama.current_members})</CardTitle>
                <CardDescription>
                  Manage chama members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Member management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contributions" className="space-y-4">
            <ContributionLeaderboard 
              chamaId={id!} 
              canDownload={isAdmin || isTreasurer}
            />
          </TabsContent>

          <TabsContent value="loans" className="space-y-4">
            {loans && loans.length > 0 && (isAdmin || isTreasurer) && (
              <LoanManagementPanel
                chamaId={id!}
                loans={loans}
              />
            )}
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Loan Management</CardTitle>
                  {(isAdmin || isTreasurer) && loans && loans.length > 0 && (
                    <Button
                      onClick={() => exportLoans(id!, chama.name)}
                      variant="outline"
                      size="sm"
                    >
                      Export Loans
                    </Button>
                  )}
                </div>
                <CardDescription>
                  View and manage chama loans
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!loans || loans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active loans</p>
                ) : (
                  <div className="space-y-3">
                    {loans.map((loan: any) => (
                      <div key={loan.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{loan.borrower_name}</p>
                            <p className="text-sm text-muted-foreground">
                              KES {loan.amount?.toLocaleString()} • {loan.status}
                            </p>
                          </div>
                          <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
                            {loan.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Chama Settings</CardTitle>
                <CardDescription>
                  Configure chama rules and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Basic Information</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{new Date(chama.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={chama.status === 'active' ? 'default' : 'secondary'}>
                          {chama.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="capitalize">{chama.contribution_frequency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Top Up Dialog */}
        <Dialog open={showTopUpDialog} onOpenChange={setShowTopUpDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Top Up MGR Wallet</DialogTitle>
              <DialogDescription>
                Transfer funds from your Savings wallet to your MGR wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Available: <CurrencyDisplay amount={myMembership?.savings_balance || 0} />
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  walletOps.mutate({
                    operation: 'topup',
                    chamaId: id!,
                    amount: parseFloat(topUpAmount)
                  });
                  setShowTopUpDialog(false);
                  setTopUpAmount('');
                }}
                disabled={!topUpAmount || walletOps.isPending}
              >
                Top Up
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw Dialog */}
        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw from MGR Wallet</DialogTitle>
              <DialogDescription>
                Withdraw funds to your mobile money or bank account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Available: <CurrencyDisplay amount={myMembership?.mgr_balance || 0} />
                </p>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="airtel">Airtel Money</SelectItem>
                    <SelectItem value="bank">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  walletOps.mutate({
                    operation: 'withdraw',
                    chamaId: id!,
                    amount: parseFloat(withdrawAmount),
                    paymentMethod
                  });
                  setShowWithdrawDialog(false);
                  setWithdrawAmount('');
                }}
                disabled={!withdrawAmount || walletOps.isPending}
              >
                Withdraw
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Send Dialog */}
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send to Member</DialogTitle>
              <DialogDescription>
                Transfer funds from your MGR wallet to another member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Recipient</Label>
                <Select value={sendRecipient} onValueChange={setSendRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members?.filter(m => m.user_id !== user?.id).map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {(m.profiles as any)?.email || 'Member'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Available: <CurrencyDisplay amount={myMembership?.mgr_balance || 0} />
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  walletOps.mutate({
                    operation: 'send',
                    chamaId: id!,
                    amount: parseFloat(sendAmount),
                    recipient: sendRecipient
                  });
                  setShowSendDialog(false);
                  setSendAmount('');
                  setSendRecipient('');
                }}
                disabled={!sendAmount || !sendRecipient || walletOps.isPending}
              >
                Send
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChamaDetailPage;