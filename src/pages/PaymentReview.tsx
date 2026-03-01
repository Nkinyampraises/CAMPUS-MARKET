import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

type PaymentContext = 'order' | 'subscription';

interface PaymentReviewState {
  context: PaymentContext;
  title: string;
  amount: number;
  paymentMethod: 'mtn-momo' | 'orange-money';
  fromName: string;
  fromPhone: string;
  payload: any;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0);

export function PaymentReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, refreshCurrentUser } = useAuth();
  const state = (location.state || null) as PaymentReviewState | null;

  const [submitting, setSubmitting] = useState(false);
  const [paymentMeta, setPaymentMeta] = useState({
    merchantName: 'nkinyampraisesncha',
    merchantNumber: '671562474',
    feePercent: 2,
    feeFlat: 0,
    sampleBaseAmount: 500,
    sampleFee: 10,
  });

  useEffect(() => {
    if (!state?.context) {
      navigate(-1);
      return;
    }
    const fetchMeta = async () => {
      try {
        const response = await fetch(`${API_URL}/payment-meta`);
        if (!response.ok) return;
        const data = await response.json();
        setPaymentMeta({
          merchantName: data?.merchant?.name || paymentMeta.merchantName,
          merchantNumber: data?.merchant?.number || paymentMeta.merchantNumber,
          feePercent: Number(data?.transactionFee?.percent) || paymentMeta.feePercent,
          feeFlat: Number(data?.transactionFee?.flat) || 0,
          sampleBaseAmount: Number(data?.transactionFee?.sampleBaseAmount) || 500,
          sampleFee: Number(data?.transactionFee?.sampleFee) || 10,
        });
      } catch (_error) {
        // Keep fallback.
      }
    };
    fetchMeta();
  }, [state?.context]);

  const feeAmount = useMemo(() => {
    const raw = (Number(state?.amount || 0) * paymentMeta.feePercent) / 100 + paymentMeta.feeFlat;
    return Math.round(raw);
  }, [state?.amount, paymentMeta.feePercent, paymentMeta.feeFlat]);

  const totalAmount = useMemo(() => Math.round(Number(state?.amount || 0) + feeAmount), [state?.amount, feeAmount]);

  const handleConfirm = async () => {
    if (!state || !accessToken) {
      toast.error('Missing payment session');
      return;
    }

    setSubmitting(true);
    try {
      if (state.context === 'order') {
        const response = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(state.payload),
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error || 'Payment failed');
          setSubmitting(false);
          return;
        }
        toast.success('Payment successful. Order created.');
        navigate(`/orders/${data.order?.id || ''}`);
        return;
      }

      const response = await fetch(`${API_URL}/subscription/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(state.payload),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Subscription payment failed');
        setSubmitting(false);
        return;
      }

      if (refreshCurrentUser) {
        await refreshCurrentUser();
      }
      toast.success('Subscription activated successfully');
      navigate('/dashboard');
    } catch (_error) {
      toast.error('Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!state) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Confirm Mobile Money Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <AlertDescription>
              For {paymentMeta.sampleBaseAmount} XAF, fee is {paymentMeta.sampleFee} XAF. Fees are auto-calculated.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border rounded-lg p-4">
              <p className="text-muted-foreground mb-2">From</p>
              <p className="font-semibold">{state.fromName}</p>
              <p>{state.fromPhone}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {state.paymentMethod === 'mtn-momo' ? 'MTN MoMo' : 'Orange Money'}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-muted-foreground mb-2">To</p>
              <p className="font-semibold">{paymentMeta.merchantName}</p>
              <p>{paymentMeta.merchantNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">Website Mobile Money Account</p>
            </div>
          </div>

          <div className="border rounded-lg p-4 text-sm">
            <p className="font-semibold mb-2">Transaction Summary</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purpose</span>
                <span className="font-medium">{state.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Amount</span>
                <span>{formatMoney(state.amount)} XAF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction Fee</span>
                <span>{formatMoney(feeAmount)} XAF</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t mt-2">
                <span>Total to Pay</span>
                <span>{formatMoney(totalAmount)} XAF</span>
              </div>
            </div>
          </div>

          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleConfirm} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Processing...' : 'Confirm and Pay'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
