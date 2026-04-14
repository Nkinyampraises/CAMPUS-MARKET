import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function BuyerDisputes() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [description, setDescription] = useState('');

  const fetchData = async () => {
    if (!accessToken || !currentUser) return;
    setLoading(true);
    try {
      const [ordersRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/orders`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/reports`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const ordersData = await ordersRes.json().catch(() => ({}));
      const reportsData = await reportsRes.json().catch(() => ({}));

      if (ordersRes.ok) {
        const buyerOrders = (ordersData.orders || []).filter((order: any) => order.buyerId === currentUser.id);
        setOrders(buyerOrders);
      }
      if (reportsRes.ok) {
        setReports(reportsData.reports || []);
      }
    } catch (_error) {
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [currentUser, accessToken]);

  const openDispute = async () => {
    if (!accessToken) return;
    if (!selectedOrderId) {
      toast.error('Select an order first');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Please provide at least 10 characters');
      return;
    }

    const order = orders.find((entry) => entry.id === selectedOrderId);
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          category: 'dispute',
          orderId: selectedOrderId,
          listingId: order?.itemId || '',
          targetUserId: order?.sellerId || '',
          description: description.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to open dispute');
        return;
      }
      toast.success('Dispute opened');
      setDescription('');
      setSelectedOrderId('');
      fetchData();
    } catch (_error) {
      toast.error('Failed to open dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const disputes = useMemo(
    () =>
      reports.filter((report: any) =>
        report.category === 'dispute' || report.category === 'transaction' || report.orderId,
      ),
    [reports],
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dispute Center</CardTitle>
          <CardDescription>Open dispute for an order and track dispute status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dispute-order">Order</Label>
            <select
              id="dispute-order"
              className="w-full border rounded-md h-10 px-3 text-sm"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              <option value="">Select order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} · {order.listingTitle || 'Item'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispute-description">Issue Details</Label>
            <Textarea
              id="dispute-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the dispute..."
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" disabled={submitting} onClick={openDispute}>
            {submitting ? 'Opening...' : 'Open Dispute'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading disputes...</p>
          ) : disputes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disputes yet.</p>
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute: any) => (
                <div key={dispute.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Order: {dispute.orderId || '-'}</p>
                    <Badge variant={dispute.status === 'resolved' ? 'default' : 'secondary'}>
                      {dispute.status || 'open'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{dispute.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(dispute.createdAt || '').toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
