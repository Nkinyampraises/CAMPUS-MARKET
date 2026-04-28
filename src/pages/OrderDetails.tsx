import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { CalendarClock, CreditCard, Loader2, MapPin, ShieldCheck, Upload, UserRound, Wallet } from 'lucide-react';
import { MeetupMap } from '@/components/MeetupMap';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');

  const [receivedConfirmed, setReceivedConfirmed] = useState(false);
  const [satisfactionConfirmed, setSatisfactionConfirmed] = useState(false);
  const [issueReason, setIssueReason] = useState('');

  const fetchOrder = async () => {
    if (!id || !accessToken) return;
    try {
      const response = await fetch(`${API_URL}/orders/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to load order');
        navigate('/dashboard');
        return;
      }
      setOrderData(data);
      setProofUrl(data.order?.deliveryProofUrl || data.escrow?.proof_image_url || '');
    } catch (_error) {
      toast.error('Failed to load order');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchOrder();
  }, [id, accessToken, currentUser]);

  const handleUploadProof = async (file: File | null) => {
    if (!file || !accessToken) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Select a valid image file');
      return;
    }
    if (file.size > 5242880) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setProofUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'delivery-proof');

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to upload proof');
        return;
      }
      setProofUrl(data.url || '');
      toast.success('Delivery proof uploaded');
    } catch (_error) {
      toast.error('Failed to upload proof');
    } finally {
      setProofUploading(false);
    }
  };

  const handleSellerSubmitProof = async () => {
    if (!proofUrl || !accessToken || !id) {
      toast.error('Upload proof image first');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/orders/${id}/seller-proof`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ proofImageUrl: proofUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to save delivery proof');
        return;
      }
      toast.success('Delivery proof submitted');
      await fetchOrder();
    } catch (_error) {
      toast.error('Failed to save delivery proof');
    } finally {
      setSaving(false);
    }
  };

  const handleBuyerConfirm = async () => {
    if (!accessToken || !id) return;
    if (!receivedConfirmed) {
      toast.error('Please confirm that you received the item first');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/orders/${id}/buyer-confirm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          receivedConfirmed,
          satisfactionConfirmed,
          issueReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to process confirmation');
        return;
      }
      toast.success(
        satisfactionConfirmed
          ? 'Escrow released successfully'
          : 'Refund request processed',
      );
      await fetchOrder();
    } catch (_error) {
      toast.error('Failed to process confirmation');
    } finally {
      setSaving(false);
    }
  };

  const handleDirectRefund = async () => {
    if (!accessToken || !id) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/orders/${id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: issueReason || 'Buyer requested refund',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Refund failed');
        return;
      }
      toast.success('Refund processed');
      await fetchOrder();
    } catch (_error) {
      toast.error('Refund failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2" />
        Loading order...
      </div>
    );
  }

  if (!orderData?.order) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Order not found</p>
      </div>
    );
  }

  const { order, escrow, listing, buyer, seller, permissions, sellerWallet } = orderData;
  const proofImageUrl = order.deliveryProofUrl || escrow?.proof_image_url || '';
  const listingImage = Array.isArray(listing?.images)
    ? listing.images.find((image: any) => typeof image === 'string' && image.trim())
    : '';

  const orderStatusText = String(order.statusLabel || order.status || 'Pending').replace(/_/g, ' ');
  const escrowStatusText = String(escrow?.status || 'pending').replace(/_/g, ' ');

  const orderStatusClass = (() => {
    const value = String(order.status || '').toLowerCase();
    if (value.includes('released') || value.includes('delivered')) return 'bg-[#e8f8ef] text-[#0b7a56]';
    if (value.includes('refund')) return 'bg-[#ffedf2] text-[#bf2e4a]';
    return 'bg-[#fff5de] text-[#8b6113]';
  })();

  const escrowStatusClass = (() => {
    const value = String(escrow?.status || '').toLowerCase();
    if (value.includes('released')) return 'bg-[#e8f8ef] text-[#0b7a56]';
    if (value.includes('refund')) return 'bg-[#ffedf2] text-[#bf2e4a]';
    return 'bg-[#edf6ff] text-[#215ea6]';
  })();

  return (
    <div className="min-h-screen bg-[#f5f7f6] py-8">
      <div className="mx-auto w-full max-w-[1220px] px-4 lg:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#082f28]">Order Details</h1>
            <p className="mt-1 text-sm text-[#5f7e75]">Track escrow status, delivery proof, and confirmation steps.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${orderStatusClass}`}>
              {orderStatusText}
            </Badge>
            <Badge className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${escrowStatusClass}`}>
              Escrow: {escrowStatusText}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-2xl border border-[#dae7e1] bg-[#edf3f0]">
                    {listingImage ? (
                      <img
                        src={listingImage}
                        alt={listing?.title || 'Listing'}
                        className="aspect-[4/3] h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-sm text-[#6b897f]">
                        No image available
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[#729087]">Order #{order.id}</p>
                      <h2 className="mt-1 text-2xl font-extrabold leading-tight text-[#103a31]">
                        {listing?.title || 'Listing'}
                      </h2>
                      <p className="mt-2 text-sm text-[#68867d]">{listing?.description || 'Escrow protected marketplace transaction.'}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Amount</p>
                        <p className="mt-1 text-lg font-black text-[#0b5d4c]">{formatMoney(order.amount)}</p>
                      </div>
                      <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Created</p>
                        <p className="mt-1 text-sm font-semibold text-[#1b4a3f]">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-[#103a31]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#fff4de]">
                    <CalendarClock className="h-4 w-4 text-[#8b5a00]" />
                  </span>
                  Pickup Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Pickup Date</p>
                    <p className="mt-1 text-sm font-semibold text-[#1b4a3f]">{order.pickupDate || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Pickup Time</p>
                    <p className="mt-1 text-sm font-semibold text-[#1b4a3f]">{order.pickupTime || '-'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                  <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-[#7f988f]">
                    <MapPin className="h-3.5 w-3.5" />
                    Pickup Point
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1b4a3f]">{order.pickupLocation || '-'}</p>
                </div>

                {order.pickupLocation ? (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#355f55]">Pickup Location Map</Label>
                    <MeetupMap
                      compact
                      locationName={order.pickupLocation}
                      address={order.pickupAddress}
                      latitude={order.pickupLatitude}
                      longitude={order.pickupLongitude}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-[#103a31]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e9f5ef]">
                    <CreditCard className="h-4 w-4 text-[#0b6a5a]" />
                  </span>
                  Delivery & Escrow Confirmation
                </CardTitle>
                <CardDescription>Seller uploads proof, then buyer confirms to release escrow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-[#c7dfd3] bg-[#f5fcf8] text-[#224f44]">
                  <ShieldCheck className="h-4 w-4 text-[#0f8057]" />
                  <AlertDescription>
                    Buyer confirms receipt only after seller uploads delivery proof. Pending escrow funds cannot be withdrawn.
                  </AlertDescription>
                </Alert>

                {proofImageUrl ? (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#355f55]">Delivery Proof</Label>
                    <img
                      src={proofImageUrl}
                      alt="Delivery proof"
                      className="w-full max-w-md rounded-xl border border-[#d6e4de] object-cover"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#c9dcd3] bg-[#f9fcfa] p-4 text-sm text-[#66837a]">
                    No delivery proof uploaded yet.
                  </div>
                )}

                {permissions?.canSellerUploadProof ? (
                  <Card className="rounded-xl border border-[#d6e4de] bg-[#fcfefd] shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-[#134037]">Seller Delivery Confirmation</CardTitle>
                      <CardDescription>Upload buyer handover proof to enable buyer confirmation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={proofUploading || saving}
                        onChange={(e) => handleUploadProof(e.target.files?.[0] || null)}
                      />
                      <Button
                        onClick={handleSellerSubmitProof}
                        disabled={!proofUrl || saving || proofUploading}
                        className="h-10 rounded-lg bg-[#1FAF9A] text-white hover:bg-[#27b9a6]"
                      >
                        {proofUploading || saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Mark as Delivered
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {permissions?.isBuyer && order.status === 'paid_pending_delivery' ? (
                  <Card className="rounded-xl border border-[#d6e4de] bg-[#fcfefd] shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-[#134037]">Buyer Confirmation</CardTitle>
                      <CardDescription>Confirm only if you have received the item and are satisfied.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="received-check"
                          checked={receivedConfirmed}
                          onCheckedChange={(checked) => setReceivedConfirmed(Boolean(checked))}
                        />
                        <Label htmlFor="received-check">I have received this product.</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="satisfied-check"
                          checked={satisfactionConfirmed}
                          onCheckedChange={(checked) => setSatisfactionConfirmed(Boolean(checked))}
                        />
                        <Label htmlFor="satisfied-check">I am satisfied with this product.</Label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="issue-reason">Issue / Refund reason (if not satisfied)</Label>
                        <Textarea
                          id="issue-reason"
                          value={issueReason}
                          onChange={(e) => setIssueReason(e.target.value)}
                          placeholder="Describe the issue for refund review..."
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="h-10 rounded-lg bg-[#1FAF9A] text-white hover:bg-[#27b9a6]"
                          onClick={handleBuyerConfirm}
                          disabled={saving || !receivedConfirmed}
                        >
                          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Confirm Delivery
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-10 rounded-lg"
                          onClick={handleDirectRefund}
                          disabled={saving}
                        >
                          Request Refund
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-[#103a31]">
                  <UserRound className="h-4 w-4 text-[#0c6a5a]" />
                  Buyer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  {order.buyerProfilePicture || buyer?.profilePicture ? (
                    <img
                      src={order.buyerProfilePicture || buyer?.profilePicture}
                      alt={buyer?.name || order.buyerName || 'Buyer'}
                      className="h-12 w-12 rounded-full border border-[#cadcd3] object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f4ee] text-[#0f6a5a]">
                      <UserRound className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-[#123e34]">{buyer?.name || order.buyerName || '-'}</p>
                    <p className="text-xs text-[#67847a]">{order.buyerPhoneNumber || buyer?.phone || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-[#103a31]">
                  <UserRound className="h-4 w-4 text-[#0c6a5a]" />
                  Seller Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-[#6a857d]">Name:</span> <span className="font-medium text-[#143f35]">{seller?.name || '-'}</span></p>
                <p><span className="text-[#6a857d]">Phone:</span> <span className="font-medium text-[#143f35]">{seller?.phone || '-'}</span></p>
              </CardContent>
            </Card>

            {permissions?.isSeller ? (
              <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-[#103a31]">
                    <Wallet className="h-4 w-4 text-[#0c6a5a]" />
                    Seller Wallet
                  </CardTitle>
                  <CardDescription>Pending funds cannot be withdrawn.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Pending Balance</p>
                    <p className="mt-1 font-semibold text-[#133f35]">{formatMoney(sellerWallet?.pendingBalance || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-[#d8e6df] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7f988f]">Available Balance</p>
                    <p className="mt-1 font-semibold text-[#133f35]">{formatMoney(sellerWallet?.availableBalance || 0)}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
