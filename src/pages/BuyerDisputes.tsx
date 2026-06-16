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
import { useLanguage } from '@/contexts/LanguageContext';

export function BuyerDisputes() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();
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
          <CardTitle>{t('ui.dispute_center', 'Dispute Center')}</CardTitle>
          <CardDescription>{t('ui.open_dispute_for_an_order_and_track_dispute_status', 'Open dispute for an order and track dispute status.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dispute-order">{t('ui.order', 'Order')}</Label>
            <select
              id="dispute-order"
              className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              <option value="">{t('ui.select_order', 'Select order')}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} · {order.listingTitle || 'Item'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispute-description">{t('ui.issue_details', 'Issue Details')}</Label>
            <Textarea
              id="dispute-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the dispute..."
            />
          </div>
          <Button disabled={submitting} onClick={openDispute}>
            {submitting ? t('ui.opening', 'Opening...') : t('ui.open_dispute', 'Open Dispute')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.my_disputes', 'My Disputes')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('ui.loading_disputes', 'Loading disputes...')}</p>
          ) : disputes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ui.no_disputes_yet', 'No disputes yet.')}</p>
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute: any) => (
                <div key={dispute.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{t('ui.order', 'Order')}: {dispute.orderId || '-'}</p>
                    <Badge
                      className={
                        dispute.status === 'resolved'
                          ? 'bg-[#DCFCE7] text-[#16A34A]'
                          : 'bg-[#FEF3C7] text-[#D97706]'
                      }
                    >
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

