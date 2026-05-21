import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface Payout {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  transactionCount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  canBePaid: boolean;
  status: 'pending' | 'partial' | 'paid';
  lastPaidAt: string | null;
  lastPaidAmount: number;
}

interface PlatformRevenueWallet {
  wallet: {
    userId: string;
    availableBalance: number;
    pendingBalance: number;
    updatedAt: string;
  };
  withdrawableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  withdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    provider: string;
    phoneNumber: string;
    createdAt: string;
    reference?: string;
  }>;
  defaultPhoneNumber?: string;
}

const EMPTY_PLATFORM_WALLET: PlatformRevenueWallet = {
  wallet: {
    userId: 'platform-admin-wallet',
    availableBalance: 0,
    pendingBalance: 0,
    updatedAt: new Date(0).toISOString(),
  },
  withdrawableBalance: 0,
  pendingBalance: 0,
  totalWithdrawn: 0,
  withdrawals: [],
  defaultPhoneNumber: '',
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount || 0);

export function AdminPayouts() {
  const { accessToken, refreshAuthToken, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [platformWallet, setPlatformWallet] = useState<PlatformRevenueWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [withdrawingPlatformRevenue, setWithdrawingPlatformRevenue] = useState(false);
  const [platformWithdrawAmount, setPlatformWithdrawAmount] = useState('');
  const [platformWithdrawPhone, setPlatformWithdrawPhone] = useState('');
  const [platformWithdrawProvider, setPlatformWithdrawProvider] = useState<'mtn-momo' | 'orange-money'>('mtn-momo');
  const [platformWalletError, setPlatformWalletError] = useState<string | null>(null);

  const requestWithAuthRetry = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!accessToken) {
        return { response: null as Response | null, data: { error: 'Unauthorized' } };
      }

      const makeRequest = async (token: string) => {
        const response = await fetch(`${API_URL}${path}`, {
          ...(init || {}),
          headers: {
            ...(init?.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      };

      try {
        const firstAttempt = await makeRequest(accessToken);
        if (firstAttempt.response.status !== 401) {
          return firstAttempt;
        }

        const refreshedToken = await refreshAuthToken();
        if (!refreshedToken) {
          return firstAttempt;
        }

        return await makeRequest(refreshedToken);
      } catch (error) {
        return {
          response: null as Response | null,
          data: { error: error instanceof Error ? error.message : 'Unable to reach server' },
        };
      }
    },
    [accessToken, refreshAuthToken],
  );

  const handleSessionExpired = useCallback(() => {
    toast.error('Session expired. Please log in again.');
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const fetchPayouts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [payoutResult, platformWalletResult] = await Promise.all([
        requestWithAuthRetry('/admin/payouts'),
        requestWithAuthRetry('/admin/platform-wallet'),
      ]);

      if (payoutResult.response?.status === 401 || platformWalletResult.response?.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!payoutResult.response?.ok) {
        toast.error(payoutResult.data.error || 'Failed to load payouts');
      } else {
        setPayouts(Array.isArray(payoutResult.data?.payouts) ? payoutResult.data.payouts : []);
      }

      if (!platformWalletResult.response?.ok) {
        const isMissingRoute = platformWalletResult.response?.status === 404;
        const message = isMissingRoute
          ? 'Platform wallet endpoint unavailable. Restart backend to load latest admin routes.'
          : (platformWalletResult.data.error || 'Failed to load platform revenue wallet');
        setPlatformWalletError(message);
        setPlatformWallet((prev) => prev || EMPTY_PLATFORM_WALLET);
        if (!isMissingRoute) {
          toast.error(message);
        }
      } else {
        setPlatformWallet(platformWalletResult.data as PlatformRevenueWallet);
        setPlatformWithdrawPhone((prev) => prev || platformWalletResult.data.defaultPhoneNumber || '');
        setPlatformWalletError(null);
      }
    } catch (error) {
      toast.error('Failed to load payouts');
      setPlatformWallet((prev) => prev || EMPTY_PLATFORM_WALLET);
      setPlatformWalletError('Unable to reach platform wallet service');
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestWithAuthRetry, handleSessionExpired]);

  useEffect(() => {
    void fetchPayouts();
  }, [fetchPayouts]);

  const totals = useMemo(() => {
    return payouts.reduce(
      (acc, payout) => {
        acc.gross += payout.grossAmount || 0;
        acc.net += payout.netAmount || 0;
        acc.pending += payout.pendingAmount || 0;
        acc.paid += payout.paidAmount || 0;
        return acc;
      },
      { gross: 0, net: 0, pending: 0, paid: 0 },
    );
  }, [payouts]);

  const handleMarkPaid = async (payout: Payout) => {
    if (!accessToken || payout.pendingAmount <= 0) return;
    setProcessingId(payout.sellerId);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/payouts/${payout.sellerId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: payout.pendingAmount }),
      });
      if (!response) {
        toast.error(data.error || 'Unable to reach server');
        return;
      }
      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to process payout');
        return;
      }

      setPayouts((prev) =>
        prev.map((item) => (item.sellerId === payout.sellerId ? data.payout : item)),
      );
      toast.success(`Payout processed for ${payout.sellerName}`);
    } catch (error) {
      toast.error('Failed to process payout');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePlatformRevenueWithdraw = async () => {
    if (!accessToken || !platformWallet) return;

    const normalizedAmount = platformWithdrawAmount.replace(/\s+/g, '').replace(',', '.');
    const amount = Number(normalizedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid withdrawal amount');
      return;
    }
    if (amount > Number(platformWallet.withdrawableBalance || 0)) {
      toast.error('Amount exceeds available platform revenue balance');
      return;
    }
    if (!platformWithdrawPhone.trim()) {
      toast.error('Enter a mobile money number');
      return;
    }

    setWithdrawingPlatformRevenue(true);
    try {
      const { response, data } = await requestWithAuthRetry('/admin/platform-wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          provider: platformWithdrawProvider,
          phoneNumber: platformWithdrawPhone,
        }),
      });
      if (!response) {
        toast.error(data.error || 'Unable to reach server');
        return;
      }
      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to withdraw platform revenue');
        setPlatformWalletError(data.error || 'Failed to withdraw platform revenue');
        return;
      }

      setPlatformWallet(data as PlatformRevenueWallet);
      setPlatformWalletError(null);
      setPlatformWithdrawAmount('');
      const status = String(data?.withdrawal?.status || '').toLowerCase();
      if (status === 'processing' || status === 'pending') {
        toast.info(
          '⚠️ No payment API configured. The platform fees are already in your MTN MoMo merchant account (671562474). To withdraw: open MTN MoMo app → Transfer → enter your personal number and amount.',
          { duration: 10000 }
        );
      } else {
        toast.success(
          '✅ Recorded as withdrawn. Remember: platform fees collected via USSD are already in MoMo account 671562474 — transfer manually to your personal account.',
          { duration: 8000 }
        );
      }
      await fetchPayouts();
    } catch (error) {
      toast.error('Failed to withdraw platform revenue');
    } finally {
      setWithdrawingPlatformRevenue(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info banner — explains how platform fees are collected */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">💡 How Platform Revenue Works</p>
        <p>Platform fees (from transactions and subscriptions) are collected via USSD and go directly into the merchant MTN MoMo account <strong>671562474</strong>. To access your funds, open your MTN MoMo app and transfer to your personal account. The "Withdraw" button below records the withdrawal in the system.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.platform_revenue_wallet', 'Platform Revenue Wallet')}</CardTitle>
          <CardDescription>{t('ui.withdraw_platform_revenue_directly_to_the_admin_mo', 'Withdraw platform revenue directly to the admin mobile money account.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platformWalletError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {platformWalletError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('ui.available_revenue', 'Available Revenue')}</p>
              <p className="text-xl font-bold text-green-600">
                {formatMoney(platformWallet?.withdrawableBalance || 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('ui.pending_balance', 'Pending Balance')}</p>
              <p className="text-xl font-bold text-orange-600">
                {formatMoney(platformWallet?.pendingBalance || 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('ui.total_withdrawn', 'Total Withdrawn')}</p>
              <p className="text-xl font-bold">{formatMoney(platformWallet?.totalWithdrawn || 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="platform-withdraw-amount">{t('ui.withdrawal_amount_xaf', 'Withdrawal Amount (XAF)')}</Label>
              <Input
                id="platform-withdraw-amount"
                type="number"
                min={0}
                step="any"
                placeholder="5000"
                value={platformWithdrawAmount}
                onChange={(e) => setPlatformWithdrawAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-withdraw-phone">{t('ui.mobile_money_number', 'Mobile Money Number')}</Label>
              <Input
                id="platform-withdraw-phone"
                placeholder="671234567"
                value={platformWithdrawPhone}
                onChange={(e) => setPlatformWithdrawPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-withdraw-provider">{t('ui.provider', 'Provider')}</Label>
              <select
                id="platform-withdraw-provider"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={platformWithdrawProvider}
                onChange={(e) => setPlatformWithdrawProvider(e.target.value as 'mtn-momo' | 'orange-money')}
              >
                <option value="mtn-momo">{t('ui.mtn_mobile_money', 'MTN Mobile Money')}</option>
                <option value="orange-money">{t('ui.orange_money', 'Orange Money')}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Current provider payout mode may be real (CamPay) or mock depending on backend configuration.
            </p>
            <Button
              className="bg-[#05B43D] hover:bg-[#018F2D]"
              disabled={
                loading ||
                withdrawingPlatformRevenue ||
                !platformWallet ||
                Boolean(platformWalletError) ||
                Number(platformWallet.withdrawableBalance || 0) <= 0
              }
              onClick={handlePlatformRevenueWithdraw}
            >
              {withdrawingPlatformRevenue ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('ui.processing', 'Processing...')}
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  {t('ui.withdraw_revenue', 'Withdraw Revenue')}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('ui.recent_platform_withdrawals', 'Recent Platform Withdrawals')}</p>
            {(platformWallet?.withdrawals || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('ui.no_platform_withdrawals_yet', 'No platform withdrawals yet.')}</p>
            ) : (
              <div className="space-y-2">
                {(platformWallet?.withdrawals || []).slice(0, 5).map((withdrawal) => (
                  <div key={withdrawal.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{formatMoney(Number(withdrawal.amount || 0))}</p>
                      <p className="text-xs text-muted-foreground">
                        {withdrawal.provider === 'orange-money' ? 'Orange Money' : 'MTN Mobile Money'} • {withdrawal.phoneNumber}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>{new Date(withdrawal.createdAt).toLocaleString()}</p>
                      <p className="uppercase">{withdrawal.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('ui.gross_volume', 'Gross Volume')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(totals.gross)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('ui.net_payouts', 'Net Payouts')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(totals.net)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('ui.already_paid', 'Already Paid')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">{formatMoney(totals.paid)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('ui.pending_payout', 'Pending Payout')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-600">{formatMoney(totals.pending)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{t('ui.payout_queue', 'Payout Queue')}</CardTitle>
              <CardDescription>{t('ui.process_payouts_from_seller_available_wallet_balan', 'Process payouts from seller available wallet balances.')}</CardDescription>
            </div>
            <Button variant="outline" onClick={fetchPayouts} disabled={loading}>
              {t('ui.refresh', 'Refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('ui.loading_payouts', 'Loading payouts...')}</div>
          ) : payouts.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('ui.no_payout_data_yet', 'No payout data yet.')}</div>
          ) : (
            payouts.map((payout) => (
              <div key={payout.sellerId} className="border rounded-lg p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{payout.sellerName}</div>
                    <div className="text-xs text-muted-foreground break-all">{payout.sellerEmail}</div>
                  </div>
                  <Badge variant={payout.status === 'paid' ? 'secondary' : 'outline'}>{payout.status}</Badge>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-5">
                  <div>
                    <p className="text-muted-foreground">{t('ui.transactions', 'Transactions')}</p>
                    <p className="font-medium">{payout.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ui.gross', 'Gross')}</p>
                    <p className="font-medium">{formatMoney(payout.grossAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net</p>
                    <p className="font-medium">{formatMoney(payout.netAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="font-medium text-green-600">{formatMoney(payout.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ui.pending', 'Pending')}</p>
                    <p className="font-medium text-orange-600">{formatMoney(payout.pendingAmount)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground break-words">
                    Last payout:{' '}
                    {payout.lastPaidAt ? `${new Date(payout.lastPaidAt).toLocaleString()} (${formatMoney(payout.lastPaidAmount)})` : 'Never'}
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-[#05B43D] hover:bg-[#018F2D] sm:w-auto"
                    disabled={processingId === payout.sellerId || payout.pendingAmount <= 0 || !payout.canBePaid}
                    onClick={() => handleMarkPaid(payout)}
                  >
                    {processingId === payout.sellerId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('ui.processing', 'Processing...')}
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-2 h-4 w-4" />
                        {payout.pendingAmount > 0 ? `Pay ${formatMoney(payout.pendingAmount)}` : 'Paid'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

