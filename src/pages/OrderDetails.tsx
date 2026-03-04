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
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Order #{order.id}</CardTitle>
                <CardDescription>{listing?.title || 'Listing'}</CardDescription>
              </div>
              <Badge variant={order.status === 'delivered_released' ? 'default' : 'secondary'}>
                {order.statusLabel || order.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{formatMoney(order.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Escrow Status</p>
                <p className="font-medium">{escrow?.status || 'pending'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pickup Date</p>
                <p className="font-medium">{order.pickupDate || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pickup Time</p>
                <p className="font-medium">{order.pickupTime || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Pickup Point</p>
                <p className="font-medium">{order.pickupLocation || '-'}</p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Buyer confirms receipt only after seller uploads delivery proof. Pending escrow funds cannot be withdrawn.
              </AlertDescription>
            </Alert>

            {proofImageUrl ? (
              <div className="space-y-2">
                <Label>Delivery Proof</Label>
                <img
                  src={proofImageUrl}
                  alt="Delivery proof"
                  className="w-full max-w-sm rounded-md border object-cover"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No delivery proof uploaded yet.</p>
            )}

            {permissions?.canSellerUploadProof ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Seller Delivery Confirmation</CardTitle>
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
                    className="bg-green-600 hover:bg-green-700"
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Buyer Confirmation</CardTitle>
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
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleBuyerConfirm}
                      disabled={saving || !receivedConfirmed}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Confirm Delivery
                    </Button>
                    <Button
                      variant="destructive"
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buyer Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {order.buyerProfilePicture || buyer?.profilePicture ? (
                <img
                  src={order.buyerProfilePicture || buyer?.profilePicture}
                  alt={buyer?.name || order.buyerName || 'Buyer'}
                  className="h-14 w-14 rounded-full object-cover border"
                />
              ) : null}
              <p><span className="text-muted-foreground">Name:</span> {buyer?.name || order.buyerName || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {order.buyerPhoneNumber || buyer?.phone || '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seller Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-muted-foreground">Name:</span> {seller?.name || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {seller?.phone || '-'}</p>
            </CardContent>
          </Card>

          {permissions?.isSeller ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seller Wallet</CardTitle>
                <CardDescription>Pending funds cannot be withdrawn.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>
                  <span className="text-muted-foreground">Pending Balance:</span>{' '}
                  {formatMoney(sellerWallet?.pendingBalance || 0)}
                </p>
                <p>
                  <span className="text-muted-foreground">Available Balance:</span>{' '}
                  {formatMoney(sellerWallet?.availableBalance || 0)}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
