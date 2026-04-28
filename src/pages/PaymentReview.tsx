import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { ArrowLeft, ArrowRight, Headset, Loader2, Lock, ShieldCheck, Smartphone, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

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
    sampleBaseAmount: 500,
    sampleFee: 0,
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
          sampleFee: Number(data?.transactionFee?.sampleFee) || 0,
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
  const feeHintBaseAmount = useMemo(() => {
    if (state?.context === 'subscription') {
      return Math.round(Number(state?.amount || 0));
    }
    return Math.round(Number(paymentMeta.sampleBaseAmount || 0));
  }, [state?.context, state?.amount, paymentMeta.sampleBaseAmount]);
  const feeHintAmount = useMemo(() => {
    if (state?.context === 'subscription') {
      return feeAmount;
    }
    return Math.round(Number(paymentMeta.sampleFee || 0));
  }, [state?.context, feeAmount, paymentMeta.sampleFee]);
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
                : 'Unable to reach payment server. Ensure API is running and reachable from this device.',
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
      toast.info('Mobile Money opened. Finalizing your subscription on the platform...');
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

  const receiverName = state.context === 'subscription'
    ? paymentMeta.merchantName || 'UNITRADE'
    : state.payload?.sellerName || 'Seller';
  const senderLabel = state.payload?.buyerStudentId || state.payload?.studentId || 'Student Account';
  const receiverLabel = state.context === 'subscription' ? 'Platform Account' : 'Verified Seller';
  const itemImage = state.payload?.itemImage || state.payload?.imageUrl || '/placeholder.svg';
  const paymentMethodLabel = state.paymentMethod === 'mtn-momo' ? 'MTN Mobile Money' : 'Orange Money';
  const confirmButtonText = submitting
    ? 'Processing...'
    : state.paymentMethod === 'mtn-momo' && !ussdStarted
      ? 'Open Mobile Money'
      : 'Confirm & Pay';

  return (
    <div className="min-h-screen bg-[#f5f7f6] py-7">
      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3 text-[#2e5950] hover:bg-[#e8f4ee]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-[2.1rem] font-black tracking-tight text-[#082d26]">Review your payment</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5f7e75]">
          Verify the transaction details below before confirming. Funds will be held in escrow until item collection.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.92fr]">
          <div className="space-y-5">
            <Card className="rounded-3xl border border-[#d6e4dd] bg-white shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl border border-[#dfeae5] bg-[#f9fcfa] p-4">
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-2xl border border-[#dbe8e1] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7c958c]">Sender</p>
                      <p className="mt-1 text-sm font-extrabold text-[#123a31]">{state.fromName}</p>
                      <p className="text-xs text-[#6f8b82]">{senderLabel}</p>
                    </div>

                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1FAF9A]">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </div>

                    <div className="rounded-2xl border border-[#dbe8e1] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7c958c]">Receiver</p>
                      <p className="mt-1 text-sm font-extrabold text-[#123a31]">{receiverName}</p>
                      <p className="text-xs text-[#6f8b82]">{receiverLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#dbe8e1] bg-white p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={itemImage}
                        alt={state.title}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-[#0f3a31]">{state.title}</h3>
                        <p className="text-xs text-[#728e85]">{paymentMethodLabel} • Escrow protected</p>
                        <span className="mt-1 inline-flex items-center rounded-full bg-[#f4dcac] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#664600]">
                          Academic Authenticated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="rounded-2xl border border-[#cde0d7] bg-[#f7fbf8] shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-[#0f3b32]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#dff0e8]">
                        <Smartphone className="h-4 w-4 text-[#0b6a5a]" />
                      </span>
                      Mobile Money Authorization
                    </h3>
                    <p className="text-sm text-[#5f7c73]">
                      Please keep your phone ready. Fee example: {formatMoney(feeHintBaseAmount)} XAF + {formatMoney(feeHintAmount)} XAF.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${state.paymentMethod === 'mtn-momo' ? 'border-[#0c6a5a] bg-[#eaf8f2] text-[#0c6a5a]' : 'border-[#d5e4dd] bg-white text-[#355f55]'}`}>
                        MTN MOMO: {ussdCode}
                      </div>
                      <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${state.paymentMethod === 'orange-money' ? 'border-[#0c6a5a] bg-[#eaf8f2] text-[#0c6a5a]' : 'border-[#d5e4dd] bg-white text-[#355f55]'}`}>
                        ORANGE MONEY: *150#
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit rounded-3xl border border-[#d6e4dd] bg-white shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="text-2xl font-bold text-[#123a31]">Payment Summary</h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-[#5b7a71]">
                  <span>Item Price</span>
                  <span>{formatMoney(state.amount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-[#5b7a71]">
                  <span>Platform Fee</span>
                  <span>{formatMoney(feeAmount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-[#5b7a71]">
                  <span>Escrow Protection</span>
                  <span className="font-semibold text-[#0d7a56]">FREE</span>
                </div>
              </div>

              <div className="border-t border-[#d9e6df] pt-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2f584f]">Total Payable</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#839b93]">Incl. VAT where applicable</p>
                  </div>
                  <p className="text-[2rem] font-black leading-none text-[#0a5a49]">{formatMoney(totalAmount)} FCFA</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d8e7df] bg-[#f7fbf8] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#1f5649]">
                  <ShieldCheck className="h-4 w-4 text-[#0f7a57]" />
                  Buyer Protection Active.
                </p>
                <p className="mt-1 text-xs text-[#67837a]">
                  Your money is safe until you confirm receipt of the item.
                </p>
              </div>

                <Button
                  className="h-12 w-full rounded-xl bg-[#1FAF9A] text-lg font-semibold text-white hover:bg-[#27b9a6]"
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {confirmButtonText}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-[#476f65] hover:bg-[#edf6f2]"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                Cancel Transaction
              </Button>

              <div className="flex items-center justify-center gap-4 border-t border-[#e1ece7] pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#7f9890]">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  Secure
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  Instant
                </span>
                <span className="inline-flex items-center gap-1">
                  <Headset className="h-3.5 w-3.5" />
                  24/7 Support
                </span>
              </div>

              <p className="text-center text-[11px] text-[#8aa096]">
                By clicking "Confirm & Pay", you agree to the UNITRADE Academic Commerce Terms of Service and Escrow Agreement.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
