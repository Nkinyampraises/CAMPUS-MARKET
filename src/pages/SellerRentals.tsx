import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const dateLabel = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const rentalStatus = (order: any) => {
  if (order?.status === 'refunded') return 'cancelled';
  if (order?.rentalReturnStatus === 'ended') return 'ended';
  const end = order?.rentalEndDate ? new Date(order.rentalEndDate) : null;
  if (end && !Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return 'ended';
  return 'active';
};

export function SellerRentals() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [rentals, setRentals] = useState<any[]>([]);

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

  const fetchRentals = async () => {
    if (!currentUser || !accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/orders');
      if (!response) {
        toast.error(data.error || 'Failed to load rentals');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to load rentals');
        return;
      }

      const sellerRentals = (data.orders || []).filter(
        (order: any) =>
          order.sellerId === currentUser.id &&
          (order.listingType === 'rent' || Boolean(order.rentalPeriod)),
      );
      setRentals(sellerRentals);
    } catch (_error) {
      toast.error('Failed to load rentals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchRentals();
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
        toast.error(data.error || 'Failed to update rental');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to update rental');
        return;
      }
      toast.success(decision === 'accepted' ? 'Rental accepted' : 'Rental rejected');
      await fetchRentals();
    } catch (_error) {
      toast.error('Failed to update rental');
    } finally {
      setUpdatingId('');
    }
  };

  const markReturned = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const { response, data } = await requestWithAuthRetry(`/orders/${orderId}/seller-returned`, {
        method: 'PUT',
      });
      if (!response) {
        toast.error(data.error || 'Failed to mark returned');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to mark returned');
        return;
      }
      toast.success('Rental marked returned');
      await fetchRentals();
    } catch (_error) {
      toast.error('Failed to mark returned');
    } finally {
      setUpdatingId('');
    }
  };

  const sortedRentals = useMemo(
    () =>
      [...rentals].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      ),
    [rentals],
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Seller Rentals</CardTitle>
          <CardDescription>Show all rental transactions with actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading rentals...</p>
          ) : sortedRentals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rental transactions found.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Rental Start</th>
                    <th className="text-left p-3">Rental End</th>
                    <th className="text-left p-3">Buyer</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRentals.map((order) => {
                    const status = rentalStatus(order);
                    const locked = order.status === 'refunded' || order.rentalReturnStatus === 'ended';
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="p-3 min-w-[220px]">
                          <p className="font-medium">{order.listingTitle || 'Rental item'}</p>
                          <p className="text-xs text-muted-foreground">{order.id}</p>
                        </td>
                        <td className="p-3">{dateLabel(order.rentalStartDate)}</td>
                        <td className="p-3">{dateLabel(order.rentalEndDate)}</td>
                        <td className="p-3">{order.buyerName || '-'}</td>
                        <td className="p-3">
                          <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge>
                        </td>
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
                              Accept Rental
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
                              onClick={() => markReturned(order.id)}
                            >
                              Mark Returned
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

