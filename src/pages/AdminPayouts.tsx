import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

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

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

export function AdminPayouts() {
  const { accessToken } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPayouts = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/admin/payouts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to load payouts');
        return;
      }
      setPayouts(data.payouts || []);
    } catch (error) {
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [accessToken]);

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
      const response = await fetch(`${API_URL}/admin/payouts/${payout.sellerId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ amount: payout.pendingAmount }),
      });
      const data = await response.json();
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gross Volume</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(totals.gross)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Payouts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(totals.net)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Already Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">{formatMoney(totals.paid)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Payout</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-600">{formatMoney(totals.pending)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payout Queue</CardTitle>
              <CardDescription>Process payouts from seller available wallet balances.</CardDescription>
            </div>
            <Button variant="outline" onClick={fetchPayouts} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading payouts...</div>
          ) : payouts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No payout data yet.</div>
          ) : (
            payouts.map((payout) => (
              <div key={payout.sellerId} className="border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium">{payout.sellerName}</div>
                    <div className="text-xs text-muted-foreground">{payout.sellerEmail}</div>
                  </div>
                  <Badge variant={payout.status === 'paid' ? 'secondary' : 'outline'}>{payout.status}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-muted-foreground">Transactions</p>
                    <p className="font-medium">{payout.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross</p>
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
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-medium text-orange-600">{formatMoney(payout.pendingAmount)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Last payout:{' '}
                    {payout.lastPaidAt ? `${new Date(payout.lastPaidAt).toLocaleString()} (${formatMoney(payout.lastPaidAmount)})` : 'Never'}
                  </div>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={processingId === payout.sellerId || payout.pendingAmount <= 0 || !payout.canBePaid}
                    onClick={() => handleMarkPaid(payout)}
                  >
                    {processingId === payout.sellerId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
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
