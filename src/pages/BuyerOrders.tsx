import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { FileText, Store, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const normalizePurchaseStatus = (status: string) => {
  if (status === 'delivered_released') return 'delivered';
  if (status === 'refunded') return 'cancelled';
  if (status === 'paid_pending_delivery') return 'paid';
  return 'pending';
};

export function BuyerOrders() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!accessToken || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/orders`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(data.error || 'Failed to load orders');
          return;
        }

        const buyerOrders = (data.orders || []).filter((order: any) => order.buyerId === currentUser.id);
        setOrders(buyerOrders);
      } catch (_error) {
        toast.error('Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchOrders();
  }, [accessToken, currentUser, navigate]);

  const orderCountLabel = useMemo(() => `${orders.length} purchase${orders.length === 1 ? '' : 's'}`, [orders.length]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>My Orders / Purchases</CardTitle>
          <CardDescription>Show all purchase orders. {orderCountLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const normalized = normalizePurchaseStatus(order.status);
                const badgeVariant = normalized === 'delivered' ? 'default' : 'secondary';
                return (
                  <div key={order.id} className="border rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{order.listingTitle || 'Item'}</p>
                        <Badge variant={badgeVariant}>{normalized}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.createdAt || '').toLocaleString()} · {order.paymentMethod === 'mtn-momo' ? 'MTN MoMo' : 'Orange Money'}
                      </p>
                      <p className="text-sm text-muted-foreground">Reference: {order.transactionRef || '-'}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-blue-600 min-w-[100px]">{formatMoney(order.amount || 0)}</p>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Order
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/buyer/receipt/${order.id}?kind=order`)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Receipt
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/profile/${order.sellerId}`)}>
                        <Store className="h-4 w-4 mr-2" />
                        View Seller
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
