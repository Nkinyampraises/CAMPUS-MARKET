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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const state = (location.state || null) as PaymentReviewState | null;

  const [submitting, setSubmitting] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
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

  // Poll an order until Fapshi confirms (or fails). Returns 'paid' | 'failed' | 'timeout'.
  const pollOrderStatus = async (orderId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const status = data?.order?.status || '';
        if (status === 'paid_pending_delivery' || status === 'delivered_released') return 'paid';
        if (status === 'payment_failed' || status === 'refunded') return 'failed';
      } catch (_error) {
        // Keep polling — transient network errors are expected.
      }
    }
    return 'timeout';
  };

  const handleConfirm = async () => {
    if (!state || !accessToken) {
      toast.error('Missing payment session');
      return;
    }

    setSubmitting(true);
    try {
      // appOrigin lets the backend tell Fapshi where to send the buyer back after payment.
      const payload = { ...state.payload, appOrigin: window.location.origin };

      if (state.context === 'order') {
        // Backend creates an AWAITING_PAYMENT order and returns a Fapshi hosted
        // checkout link. We redirect the buyer there; on return the order page
        // self-reconciles the payment status.
        const { response, data } = await postWithAuthRetry(`${API_URL}/orders`, payload);
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

        const orderId = data.order?.id || '';
        const paymentLink = data.order?.paymentLink || '';
        // Mock/instant confirmation path.
        if (data.order?.status === 'paid_pending_delivery') {
          toast.success('Payment successful. Order created.');
          navigate(`/orders/${orderId}`);
          return;
        }
        // Live: redirect to Fapshi's hosted payment page.
        if (paymentLink) {
          toast.info('Redirecting to Fapshi to complete your payment…');
          window.location.href = paymentLink;
          return;
        }
        // Fallback: no link returned — poll the order status.
        setAwaitingApproval(true);
        toast.info('Waiting for your payment to be confirmed…');
        const result = await pollOrderStatus(orderId);
        if (result === 'paid') {
          toast.success('Payment confirmed. Order created.');
          navigate(`/orders/${orderId}`);
        } else if (result === 'failed') {
          toast.error('Payment was not completed. Please try again.');
        } else {
          toast.info('Payment is still processing. You can review this order shortly.');
          navigate(`/orders/${orderId}`);
        }
        return;
      }

      // Subscription payment via Fapshi hosted checkout.
      const { response, data } = await postWithAuthRetry(`${API_URL}/subscription/update`, payload);
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

      if (data.pending) {
        // Redirect to Fapshi to complete payment; the webhook activates the sub.
        if (data.paymentLink) {
          toast.info('Redirecting to Fapshi to complete your payment…');
          window.location.href = data.paymentLink;
          return;
        }
        toast.info('Your subscription activates once payment is confirmed.');
        navigate('/dashboard');
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
      setAwaitingApproval(false);
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
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-modal">

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">{t('ui.scan_to_pay', 'Scan to Pay')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('ui.point_your_phone_camera_at_the_qr_code_below', 'Point your phone camera at the QR code below')}
          </p>
        </div>

        {/* QR Code */}
        <div className="mx-auto mb-5 flex w-fit flex-col items-center rounded-2xl border-2 border-primary bg-primary-soft p-3">
          <img
            src={qrCodeUrl}
            alt="Scan to open MTN MoMo payment"
            className="h-52 w-52 rounded-xl"
          />
          <p className="mt-2 text-[11px] font-semibold text-primary-strong">
            {formatMoney(totalAmount)} FCFA — MTN MoMo
          </p>
        </div>

        {/* Steps */}
        <ol className="mb-5 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            {t('ui.open_your_phone_camera_and_scan_the_qr_code', 'Open your phone camera and scan the QR code')}
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            {t('payment.tapLinkDialer', 'Tap the link that appears — your dialer opens')}
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            {t('payment.tapCallEnterPin', 'Tap Call then enter your')} <strong>{t('ui.mtn_momo_pin', 'MTN MoMo PIN')}</strong>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-strong text-xs font-bold text-primary-foreground">4</span>
            {t('ui.come_back_here_and_click', 'Come back here and click')} <strong>{t('payment.ivePaid', "I've Paid")}</strong>
          </li>
        </ol>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => { setUssdStarted(true); setShowDesktopModal(false); }}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {t('payment.ivePaidConfirm', "I've Paid — Confirm Order")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setShowDesktopModal(false)}>
            {t('ui.cancel', 'Cancel')}
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
    ? (awaitingApproval ? 'Waiting for your approval…' : 'Processing...')
    : 'Confirm & Pay';

  return (
    <div className="min-h-screen bg-background py-7">
      {DesktopPayModal}
      <div className="w-full px-4 lg:px-8 xl:px-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('ui.back', 'Back')}
        </Button>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('ui.review_your', 'Review your')} <span className="text-primary">{t('ui.payment', 'Payment')}</span></h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t('payment.verifyDetails', 'Verify the transaction details below before confirming. Funds will be held in escrow until item collection.')}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.92fr]">
          <div className="space-y-5">
            <Card className="rounded-3xl border border-border bg-card shadow-card">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl border border-border bg-secondary p-4">
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-2xl border border-border bg-card p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("payment.sender", "Sender")}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{state.fromName}</p>
                      <p className="text-xs text-muted-foreground">{senderLabel}</p>
                    </div>

                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                      <ArrowRight className="h-4 w-4 text-primary-foreground" />
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("payment.receiver", "Receiver")}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{receiverName}</p>
                      <p className="text-xs text-muted-foreground">{receiverLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={itemImage}
                        alt={state.title}
                        className="h-20 w-20 flex-shrink-0 rounded-xl object-cover shadow-card"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            `https://placehold.co/80x80/e8f4ee/0d6e5c?text=${encodeURIComponent(state.title.charAt(0).toUpperCase())}`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">{state.title}</h3>
                        <p className="text-xs text-muted-foreground">{paymentMethodLabel} • {t('payment.escrowProtected', 'Escrow protected')}</p>
                        <span className="mt-1 inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#D97706]">
                          {t('ui.academic_authenticated', 'Academic Authenticated')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="rounded-2xl border border-border bg-secondary shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft">
                        <Smartphone className="h-4 w-4 text-primary" />
                      </span>
                      {t('ui.mobile_money_authorization', 'Mobile Money Authorization')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('payment.fapshiPrompt', "When you tap Confirm & Pay, you'll be taken to Fapshi's secure page to complete payment with Mobile Money. Your funds are then held in escrow until you confirm delivery.")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('payment.feeExample', 'Fee example')}: {formatMoney(feeHintBaseAmount)} XAF + {formatMoney(feeHintAmount)} XAF.
                    </p>
                    <div className="rounded-lg border border-primary bg-primary-soft px-3 py-2 text-xs font-semibold text-primary-strong">
                      {paymentMethodLabel} — {t('payment.viaFapshi', 'secure payment via Fapshi')}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit rounded-3xl border border-border bg-card shadow-card">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold text-foreground">{t("payment.summary", "Payment Summary")}</h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("payment.itemPrice", "Item Price")}</span>
                  <span>{formatMoney(state.amount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t('ui.platform_fee', 'Platform Fee')}</span>
                  <span>{formatMoney(feeAmount)} FCFA</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("payment.escrowProtection", "Escrow Protection")}</span>
                  <span className="font-semibold text-primary">{t('payment.free', 'FREE')}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("payment.totalPayable", "Total Payable")}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('ui.incl_vat_where_applicable', 'Incl. VAT where applicable')}</p>
                  </div>
                  <p className="text-[2rem] font-bold leading-none text-primary">{formatMoney(totalAmount)} FCFA</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {t('ui.buyer_protection_active', 'Buyer Protection Active.')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('ui.your_money_is_safe_until_you_confirm_receipt_of_th', 'Your money is safe until you confirm receipt of the item.')}
                </p>
              </div>

                <Button
                  size="lg"
                  className="h-12 w-full text-lg"
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {confirmButtonText}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                {t('ui.cancel_transaction', 'Cancel Transaction')}
              </Button>

              <div className="flex items-center justify-center gap-4 border-t border-border pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  {t('ui.secure', 'Secure')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {t('ui.instant', 'Instant')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Headset className="h-3.5 w-3.5" />
                  {t('payment.support247', '24/7 Support')}
                </span>
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                {t('payment.termsAgreement', 'By clicking "Confirm & Pay", you agree to the UNITRADE Academic Commerce Terms of Service and Escrow Agreement.')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
