import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

const mapStatus = (order: any): 'pending' | 'paid' | 'delivered' | 'cancelled' => {
  if (order?.status === 'delivered_released') return 'delivered';
  if (order?.status === 'refunded') return 'cancelled';
  if (order?.status === 'paid_pending_delivery' && (order?.sellerAcceptedAt || order?.sellerProofUploaded)) return 'paid';
  return 'pending';
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export function SellerOrders() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [orders, setOrders] = useState<any[]>([]);

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

  const fetchOrders = async () => {
    if (!accessToken || !currentUser) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/orders');
      if (!response) {
        toast.error(data.error || 'Failed to load orders');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to load orders');
        return;
      }

      const sellerOrders = (data.orders || []).filter(
        (order: any) => order.sellerId === currentUser.id && order.listingType !== 'rent',
      );
      setOrders(sellerOrders);
    } catch (_error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchOrders();
  }, [currentUser, accessToken]);

  const applyDecision = async (orderId: string, decision: 'accepted' | 'rejected') => {
    const reason = decision === 'rejected' ? (prompt('Reason for rejection (optional):') || '').trim() : '';
    setUpdatingId(orderId);
    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${orderId}/seller-decision`, {
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
      await fetchOrders();
    } catch (_error) {
      toast.error('Failed to update order');
    } finally {
      setUpdatingId('');
    }
  };

  const markDelivered = async (orderId: string) => {
    const proofInput = (prompt('Paste delivery proof image URL (optional):') || '').trim();
    const proofImageUrl = proofInput || 'https://placehold.co/800x500?text=Delivered';
    setUpdatingId(orderId);
    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${orderId}/seller-proof`, {
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
      await fetchOrders();
    } catch (_error) {
      toast.error('Failed to mark delivered');
    } finally {
      setUpdatingId('');
    }
  };

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      ),
    [orders],
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Seller Orders</CardTitle>
          <CardDescription>Show all purchase orders from buyers.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : sortedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3">Order</th>
                    <th className="text-left p-3">Buyer</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
                    const normalizedStatus = mapStatus(order);
                    const locked = order.status === 'delivered_released' || order.status === 'refunded';
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="p-3 min-w-[220px]">
                          <p className="font-medium">{order.listingTitle || 'Order'}</p>
                          <p className="text-xs text-muted-foreground">{order.id}</p>
                        </td>
                        <td className="p-3">{order.buyerName || '-'}</td>
                        <td className="p-3 font-semibold text-green-600">{formatMoney(order.amount || 0)}</td>
                        <td className="p-3">
                          <Badge variant={normalizedStatus === 'delivered' ? 'default' : 'secondary'}>
                            {normalizedStatus}
                          </Badge>
                        </td>
                        <td className="p-3">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/seller/order-details/${order.id}`)}>
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={locked || updatingId === order.id}
                              onClick={() => applyDecision(order.id, 'accepted')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={locked || updatingId === order.id}
                              onClick={() => applyDecision(order.id, 'rejected')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={locked || updatingId === order.id}
                              onClick={() => markDelivered(order.id)}
                            >
                              Mark Delivered
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
