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
  feeOverride?: number;
  payload: any;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0);

export function PaymentReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, refreshCurrentUser, refreshAuthToken, logout } = useAuth();
  const state = (location.state || null) as PaymentReviewState | null;

  const [submitting, setSubmitting] = useState(false);
  const [ussdStarted, setUssdStarted] = useState(false);
  const [paymentMeta, setPaymentMeta] = useState({
    merchantName: 'nkinyampraisesncha',
    merchantNumber: '671562474',
    feePercent: 2,
    feeFlat: 0,
    sampleBaseAmount: 24,
    sampleFee: 1,
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
          sampleBaseAmount: Number(data?.transactionFee?.sampleBaseAmount) || 24,
          sampleFee: Number(data?.transactionFee?.sampleFee) || 1,
        });
      } catch (_error) {
        // Keep fallback.
      }
    };
    fetchMeta();
  }, [state?.context]);

  const feeAmount = useMemo(() => {
    if (Number.isFinite(Number(state?.feeOverride)) && Number(state?.feeOverride) >= 0) {
      return Math.round(Number(state?.feeOverride));
    }
    const raw = (Number(state?.amount || 0) * paymentMeta.feePercent) / 100 + paymentMeta.feeFlat;
    return Math.round(raw);
  }, [state?.amount, state?.feeOverride, paymentMeta.feePercent, paymentMeta.feeFlat]);

  const totalAmount = useMemo(() => Math.round(Number(state?.amount || 0) + feeAmount), [state?.amount, feeAmount]);
  const ussdCode = useMemo(
    () => `*126*9*${String(paymentMeta.merchantNumber || '').replace(/[^\d]/g, '')}*${totalAmount}#`,
    [paymentMeta.merchantNumber, totalAmount],
  );

  const postWithAuthRetry = async (url: string, payload: any) => {
    if (!accessToken) {
      return { response: null as Response | null, data: { error: 'Missing payment session' } };
    }

    const makeRequest = async (token: string) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      } catch (error) {
        return {
          response: null as Response | null,
          data: {
            error:
              error instanceof Error
                ? error.message
                : 'Unable to reach payment server. Ensure API is running on http://localhost:8002',
          },
        };
      }
    };

    const firstAttempt = await makeRequest(accessToken);
    if (!firstAttempt.response || firstAttempt.response.status !== 401) {
      return firstAttempt;
    }

    const refreshedToken = await refreshAuthToken();
    if (!refreshedToken) {
      return firstAttempt;
    }

    return makeRequest(refreshedToken);
  };

  const handleConfirm = async () => {
    if (!state || !accessToken) {
      toast.error('Missing payment session');
      return;
    }

    if (state.paymentMethod === 'mtn-momo' && !ussdStarted) {
      setUssdStarted(true);
      try {
        const telTarget = `tel:${ussdCode.replace('#', '%23')}`;
        window.location.href = telTarget;
      } catch (_error) {
        // Keep flow available even if dialer launch fails.
      }
      toast.info('Dial completed payment in Mobile Money, then tap Confirm and Pay again.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentPayload = state.paymentMethod === 'mtn-momo'
        ? {
            ...state.payload,
            paymentChannel: 'ussd',
            paymentReference: `USSD-${Date.now()}`,
            ussdCode,
          }
        : state.payload;

      if (state.context === 'order') {
        const { response, data } = await postWithAuthRetry(`${API_URL}/orders`, paymentPayload);
        if (!response) {
          toast.error(data.error || 'Missing payment session');
          return;
        }
        if (response.status === 401) {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/login');
          return;
        }
        if (!response.ok) {
          toast.error(data.error || 'Payment failed');
          return;
        }
        toast.success('Payment successful. Order created.');
        navigate(`/orders/${data.order?.id || ''}`);
        return;
      }

      const { response, data } = await postWithAuthRetry(`${API_URL}/subscription/update`, paymentPayload);
      if (!response) {
        toast.error(data.error || 'Missing payment session');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Subscription payment failed');
        return;
      }

      if (refreshCurrentUser) {
        await refreshCurrentUser();
      }
      toast.success('Subscription activated successfully');
      navigate('/dashboard');
    } catch (_error) {
      toast.error('Payment request could not be completed right now');
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

          {state.paymentMethod === 'mtn-momo' ? (
            <Alert>
              <AlertDescription>
                USSD: <span className="font-mono">{ussdCode}</span>. First tap opens Mobile Money; second tap confirms in escrow.
              </AlertDescription>
            </Alert>
          ) : null}

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
            {submitting ? 'Processing...' : state.paymentMethod === 'mtn-momo' && !ussdStarted ? 'Open Mobile Money' : 'Confirm and Pay'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
