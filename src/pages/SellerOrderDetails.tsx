import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Flag, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const paymentMethodLabel = (method: string) => {
  if (method === 'mtn-momo') return 'MTN MoMo';
  if (method === 'orange-money') return 'Orange Money';
  if (method === 'cash') return 'Cash';
  return method || 'Unknown';
};

const mapStatus = (status: string) => {
  if (status === 'delivered_released') return 'delivered';
  if (status === 'refunded') return 'cancelled';
  if (status === 'paid_pending_delivery') return 'paid';
  return 'pending';
};

export function SellerOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
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
      return makeRequest(refreshedToken);
    } catch (error) {
      return {
        response: null as Response | null,
        data: { error: error instanceof Error ? error.message : 'Unable to reach server' },
      };
    }
  };

  const fetchDetails = async () => {
    if (!id || !accessToken || !currentUser) {
      setLoading(false);
      return;
    }

    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${id}`);
      if (!response) {
        toast.error(data.error || 'Failed to load order details');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to load order details');
        return;
      }
      if (data.order?.sellerId !== currentUser.id) {
        toast.error('You can only access your own seller orders');
        navigate('/seller/orders');
        return;
      }
      setOrderData(data);
    } catch (_error) {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchDetails();
  }, [id, currentUser, accessToken]);

  const applyDecision = async (decision: 'accepted' | 'rejected') => {
    if (!id) return;
    const reason = decision === 'rejected' ? (prompt('Reason for rejection (optional):') || '').trim() : '';
    setUpdating(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${id}/seller-decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      if (!response) {
        toast.error(data.error || 'Failed to update order');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to update order');
        return;
      }
      toast.success(decision === 'accepted' ? 'Order accepted' : 'Order rejected');
      await fetchDetails();
    } catch (_error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const markDelivered = async () => {
    if (!id) return;
    const proofInput = (prompt('Paste delivery proof image URL (optional):') || '').trim();
    const proofImageUrl = proofInput || 'https://placehold.co/800x500?text=Delivered';
    setUpdating(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${id}/seller-proof`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofImageUrl }),
      });
      if (!response) {
        toast.error(data.error || 'Failed to mark delivered');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to mark delivered');
        return;
      }
      toast.success('Order marked delivered');
      await fetchDetails();
    } catch (_error) {
      toast.error('Failed to mark delivered');
    } finally {
      setUpdating(false);
    }
  };

  const order = orderData?.order;
  const buyer = orderData?.buyer;
  const listing = orderData?.listing;
  const canMutate = useMemo(
    () => Boolean(order && order.status === 'paid_pending_delivery'),
    [order],
  );

  const openChat = () => {
    if (!buyer?.id || !order?.itemId) {
      toast.error('Buyer or listing details are missing');
      return;
    }
    navigate(`/messages?userId=${buyer.id}&itemId=${order.itemId}`);
  };

  const goToReport = () => {
    if (!order) return;
    const params = new URLSearchParams({
      orderId: order.id,
      listingId: order.itemId || '',
      targetUserId: order.buyerId || '',
    });
    navigate(`/seller/reports?${params.toString()}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Button variant="ghost" onClick={() => navigate('/seller/orders')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Orders
      </Button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading order details...</p>
      ) : !order ? (
        <p className="text-sm text-muted-foreground">Order details not found.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Order ID:</span> {order.id}</p>
              <p><span className="text-muted-foreground">Item:</span> {listing?.title || order.listingTitle || '-'}</p>
              <p><span className="text-muted-foreground">Amount:</span> {formatMoney(order.amount || 0)}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={order.status === 'delivered_released' ? 'default' : 'secondary'}>
                  {mapStatus(order.status)}
                </Badge>
              </div>
              <p><span className="text-muted-foreground">Created:</span> {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</p>
              <p><span className="text-muted-foreground">Pickup:</span> {order.pickupDate || '-'} {order.pickupTime || '-'}</p>
              <p><span className="text-muted-foreground">Location:</span> {order.pickupLocation || '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buyer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {buyer?.name || '-'}</p>
              <p><span className="text-muted-foreground">Email:</span> {buyer?.email || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {buyer?.phone || '-'}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={openChat}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat Buyer
                </Button>
                <Button variant="outline" onClick={goToReport}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report Buyer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Method:</span> {paymentMethodLabel(order.paymentMethod)}</p>
              <p><span className="text-muted-foreground">Reference:</span> {order.transactionRef || '-'}</p>
              <p><span className="text-muted-foreground">Transaction Fee:</span> {formatMoney(order.transactionFee || 0)}</p>
              <p><span className="text-muted-foreground">Total Charged:</span> {formatMoney(order.totalCharged || order.amount || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seller Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!canMutate || updating} onClick={() => applyDecision('accepted')}>
                Accept Order
              </Button>
              <Button variant="outline" disabled={!canMutate || updating} onClick={() => applyDecision('rejected')}>
                Reject Order
              </Button>
              <Button variant="outline" disabled={!canMutate || updating} onClick={markDelivered}>
                Mark Delivered
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

