import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const paymentLabel = (method: string) => {
  if (method === 'mtn-momo') return 'MTN MoMo';
  if (method === 'orange-money') return 'Orange Money';
  if (method === 'cash') return 'Cash';
  return method || 'Unknown';
};

export function BuyerReceipt() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const kind = searchParams.get('kind') === 'transaction' ? 'transaction' : 'order';
  const { currentUser, accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!id || !accessToken || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        if (kind === 'order') {
          const orderRes = await fetch(`${API_URL}/orders/${id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const orderData = await orderRes.json().catch(() => ({}));
          if (!orderRes.ok) {
            toast.error(orderData.error || 'Failed to load receipt');
            return;
          }
          if (orderData.order?.buyerId !== currentUser.id) {
            toast.error('You can only view your own receipts');
            navigate('/dashboard');
            return;
          }
          setReceipt({
            id: orderData.order.id,
            createdAt: orderData.order.createdAt,
            amount: orderData.order.amount,
            transactionFee: orderData.order.transactionFee || 0,
            totalCharged: orderData.order.totalCharged || orderData.order.amount || 0,
            paymentMethod: orderData.order.paymentMethod,
            status: orderData.order.statusLabel || orderData.order.status,
            reference: orderData.order.transactionRef,
            itemTitle: orderData.listing?.title || orderData.order.listingTitle || 'Item',
            sellerName: orderData.seller?.name || '-',
          });
          return;
        }

        const txnRes = await fetch(`${API_URL}/transactions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const txnData = await txnRes.json().catch(() => ({}));
        if (!txnRes.ok) {
          toast.error(txnData.error || 'Failed to load receipt');
          return;
        }

        const transaction = (txnData.transactions || []).find((tx: any) => tx.id === id || tx.orderId === id);
        if (!transaction || transaction.buyerId !== currentUser.id) {
          toast.error('Receipt not found');
          return;
        }

        setReceipt({
          id: transaction.id,
          createdAt: transaction.createdAt || transaction.timestamp,
          amount: transaction.amount,
          transactionFee: transaction.transactionFee || 0,
          totalCharged: transaction.totalCharged || transaction.amount || 0,
          paymentMethod: transaction.paymentMethod,
          status: transaction.statusLabel || transaction.status,
          reference: transaction.transactionRef,
          itemTitle: transaction.itemId || 'Transaction',
          sellerName: transaction.sellerId || '-',
        });
      } catch (_error) {
        toast.error('Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchReceipt();
  }, [accessToken, currentUser, id, kind, navigate]);

  const createdAtLabel = useMemo(() => {
    if (!receipt?.createdAt) return '-';
    return new Date(receipt.createdAt).toLocaleString();
  }, [receipt?.createdAt]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print / Save PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading receipt...</p>
          ) : !receipt ? (
            <p className="text-sm text-muted-foreground">Receipt not available.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Receipt ID:</span> {receipt.id}</p>
              <p><span className="text-muted-foreground">Date:</span> {createdAtLabel}</p>
              <p><span className="text-muted-foreground">Item:</span> {receipt.itemTitle}</p>
              <p><span className="text-muted-foreground">Seller:</span> {receipt.sellerName}</p>
              <p><span className="text-muted-foreground">Payment Method:</span> {paymentLabel(receipt.paymentMethod)}</p>
              <p><span className="text-muted-foreground">Reference:</span> {receipt.reference || '-'}</p>
              <p><span className="text-muted-foreground">Status:</span> {receipt.status || '-'}</p>
              <hr className="my-3" />
              <p><span className="text-muted-foreground">Base Amount:</span> {formatMoney(receipt.amount || 0)}</p>
              <p><span className="text-muted-foreground">Transaction Fee:</span> {formatMoney(receipt.transactionFee || 0)}</p>
              <p className="font-semibold"><span className="text-muted-foreground">Total Paid:</span> {formatMoney(receipt.totalCharged || 0)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
