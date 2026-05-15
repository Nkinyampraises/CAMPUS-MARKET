import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { ArrowLeft, ArrowRight, Copy, CheckCircle2, Headset, Loader2, Lock, Phone, ShieldCheck, Smartphone, Zap } from 'lucide-react';
import { toast } from 'sonner';

const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);

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
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pushSent, setPushSent] = useState(false);
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

  // QR code that opens the phone dialer with the USSD code pre-filled.
  // User scans with phone camera → tap Call → enter PIN. Works on any device.
  const qrCodeUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(`tel:${ussdCode}`)}`,
    [ussdCode],
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ussdCode).then(() => {
      setCodeCopied(true);
      toast.success('USSD code copied!');
      setTimeout(() => setCodeCopied(false), 3000);
    });
  };

  const handleConfirm = async () => {
    if (!state || !accessToken) {
      toast.error('Missing payment session');
      return;
    }

    // ── USSD Mobile Money Payment (Real Money) ────────────────────────────────
    // Dials *126*9*merchantNumber*amount# on the user's phone.
    // Real XAF is transferred via MTN MoMo — no API or business account needed.
    if ((state.paymentMethod === 'mtn-momo' || state.paymentMethod === 'orange-money') && !ussdStarted) {
      if (isMobileDevice()) {
        // On mobile: open the phone dialer with the full USSD code pre-filled.
        // User just taps CALL then enters their PIN — payment is real and instant.
        setUssdStarted(true);
        try {
          window.location.href = `tel:${ussdCode.replace('#', '%23')}`;
        } catch (_e) { /* ignore if dialer unavailable */ }
        toast.success('📱 Dialer opened! Tap CALL then enter your MTN MoMo PIN to pay.');
        return; // Let user complete payment on their phone, then click again to finalise.
      } else {
        // On desktop: show the USSD code so user can dial from their phone.
        setShowDesktopModal(true);
        return;
      }
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

  // Desktop / laptop modal — shows a QR code the user scans with their phone.
  // Scanning opens the phone dialer with the USSD code already typed.
  // User just taps Call then enters their PIN. No copying, no typing.
  const DesktopPayModal = showDesktopModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f9f5]">
            <Smartphone className="h-7 w-7 text-[#05B43D]" />
          </div>
          <h3 className="text-xl font-extrabold text-[#111111]">Scan to Pay</h3>
          <p className="mt-1 text-sm text-[#8A8A8A]">
            Point your phone camera at the QR code below
          </p>
        </div>

        {/* QR Code */}
        <div className="mx-auto mb-5 flex w-fit flex-col items-center rounded-2xl border-2 border-[#05B43D] bg-[#f0fdf8] p-3">
          <img
            src={qrCodeUrl}
            alt="Scan to open MTN MoMo payment"
            className="h-52 w-52 rounded-xl"
          />
          <p className="mt-2 text-[11px] font-semibold text-[#018F2D]">
            {formatMoney(totalAmount)} FCFA — MTN MoMo
          </p>
        </div>

        {/* Steps */}
        <ol className="mb-5 space-y-2.5 text-sm text-[#4A4A4A]">
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#05B43D] text-xs font-bold text-white">1</span>
            Open your phone camera and scan the QR code
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#05B43D] text-xs font-bold text-white">2</span>
            Tap the link that appears — your dialer opens
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#05B43D] text-xs font-bold text-white">3</span>
            Tap <strong>Call</strong> then enter your <strong>MTN MoMo PIN</strong>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#018F2D] text-xs font-bold text-white">4</span>
            Come back here and click <strong>"I've Paid"</strong>
          </li>
        </ol>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            className="h-12 w-full rounded-xl bg-[#05B43D] text-base font-bold text-white hover:bg-[#018F2D]"
            onClick={() => { setUssdStarted(true); setShowDesktopModal(false); }}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            I've Paid — Confirm Order
          </Button>
          <Button variant="ghost" className="w-full text-[#4A4A4A] hover:bg-[#e6f9ee]" onClick={() => setShowDesktopModal(false)}>
            Cancel
          </Button>
        </div>

      </div>
    </div>
  ) : null;

  const receiverName = state.context === 'subscription'
    ? paymentMeta.merchantName || 'UNITRADE'
    : state.payload?.sellerName || 'Seller';
  const senderLabel = state.payload?.buyerStudentId || state.payload?.studentId || 'Student Account';
  const receiverLabel = state.context === 'subscription' ? 'Platform Account' : 'Verified Seller';
  const itemImage = state.payload?.itemImage || state.payload?.imageUrl || '/placeholder.svg';
  const paymentMethodLabel = state.paymentMethod === 'mtn-momo' ? 'MTN Mobile Money' : 'Orange Money';
  const confirmButtonText = submitting
    ? 'Processing...'
    : ussdStarted
      ? '✅ I\'ve Paid — Confirm Order'
      : 'Confirm Payment';

  return (
    <div className="min-h-screen bg-[#FFFFFF] py-7">
      {DesktopPayModal}
      <div className="w-full px-4 lg:px-8 xl:px-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3 text-[#4A4A4A] hover:bg-[#e6f9ee]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-extrabold tracking-tight text-[#111111]">Review your <span className="text-[#05B43D]">Payment</span></h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8A8A8A]">
          Verify the transaction details below before confirming. Funds will be held in escrow until item collection.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.92fr]">
          <div className="space-y-5">
            <Card className="rounded-3xl border border-[#DDE3E2] bg-white shadow-sm">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl border border-[#DDE3E2] bg-[#F3F5F4] p-4">
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-2xl border border-[#dbe8e1] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A8A8A]">Sender</p>
                      <p className="mt-1 text-sm font-extrabold text-[#111111]">{state.fromName}</p>
                      <p className="text-xs text-[#8A8A8A]">{senderLabel}</p>
                    </div>

                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#05B43D]">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </div>

                    <div className="rounded-2xl border border-[#dbe8e1] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A8A8A]">Receiver</p>
                      <p className="mt-1 text-sm font-extrabold text-[#111111]">{receiverName}</p>
                      <p className="text-xs text-[#8A8A8A]">{receiverLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#dbe8e1] bg-white p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={itemImage}
                        alt={state.title}
                        className="h-20 w-20 flex-shrink-0 rounded-xl object-cover shadow-sm"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            `https://placehold.co/80x80/e8f4ee/0d6e5c?text=${encodeURIComponent(state.title.charAt(0).toUpperCase())}`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-[#111111]">{state.title}</h3>
                        <p className="text-xs text-[#8A8A8A]">{paymentMethodLabel} • Escrow protected</p>
                        <span className="mt-1 inline-flex items-center rounded-full bg-[#f4dcac] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#664600]">
                          Academic Authenticated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="rounded-2xl border border-[#DDE3E2] bg-[#F3F5F4] shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-[#0f3b32]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f9ee]">
                        <Smartphone className="h-4 w-4 text-[#018F2D]" />
                      </span>
                      Mobile Money Authorization
                    </h3>
                    <p className="text-sm text-[#5f7c73]">
                      Please keep your phone ready. Fee example: {formatMoney(feeHintBaseAmount)} XAF + {formatMoney(feeHintAmount)} XAF.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${state.paymentMethod === 'mtn-momo' ? 'border-[#018F2D] bg-[#e6f9ee] text-[#018F2D]' : 'border-[#d5e4dd] bg-white text-[#355f55]'}`}>
                        MTN MOMO: {ussdCode}
                      </div>
                      <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${state.paymentMethod === 'orange-money' ? 'border-[#018F2D] bg-[#e6f9ee] text-[#018F2D]' : 'border-[#d5e4dd] bg-white text-[#355f55]'}`}>
                        ORANGE MONEY: *150#
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit rounded-3xl border border-[#DDE3E2] bg-white shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="text-2xl font-bold text-[#111111]">Payment Summary</h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-[#8A8A8A]">
                  <span>Item Price</span>
                  <span>{formatMoney(state.amount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-[#8A8A8A]">
                  <span>Platform Fee</span>
                  <span>{formatMoney(feeAmount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-[#8A8A8A]">
                  <span>Escrow Protection</span>
                  <span className="font-semibold text-[#05B43D]">FREE</span>
                </div>
              </div>

              <div className="border-t border-[#DDE3E2] pt-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#4A4A4A]">Total Payable</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8A8A8A]">Incl. VAT where applicable</p>
                  </div>
                  <p className="text-[2rem] font-black leading-none text-[#018F2D]">{formatMoney(totalAmount)} FCFA</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DDE3E2] bg-[#F3F5F4] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#018F2D]">
                  <ShieldCheck className="h-4 w-4 text-[#05B43D]" />
                  Buyer Protection Active.
                </p>
                <p className="mt-1 text-xs text-[#8A8A8A]">
                  Your money is safe until you confirm receipt of the item.
                </p>
              </div>

                <Button
                  className="h-12 w-full rounded-xl bg-[#05B43D] text-lg font-semibold text-white hover:bg-[#018F2D]"
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {confirmButtonText}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-[#4A4A4A] hover:bg-[#e6f9ee]"
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
