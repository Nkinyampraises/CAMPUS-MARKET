import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
const RETURNED_KEY = 'buyerReturnedRentals';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function RentalDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [extensionReason, setExtensionReason] = useState('');
  const [returnedIds, setReturnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RETURNED_KEY) || '[]');
      if (Array.isArray(stored)) {
        setReturnedIds(new Set(stored.filter((entry) => typeof entry === 'string')));
      }
    } catch {
      setReturnedIds(new Set());
    }
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id || !accessToken || !currentUser) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/orders/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(data.error || 'Failed to load rental details');
          return;
        }
        if (data.order?.buyerId !== currentUser.id) {
          toast.error('You can only view your own rental details');
          navigate('/buyer/rentals');
          return;
        }
        setOrderData(data);
      } catch (_error) {
        toast.error('Failed to load rental details');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchDetails();
  }, [accessToken, currentUser, id, navigate]);

  const listing = orderData?.listing;
  const order = orderData?.order;
  const rentalPeriod = listing?.rentalPeriod || 'monthly';
  const startDate = useMemo(() => {
    const pickupDate = toDate(order?.pickupDate);
    return pickupDate || toDate(order?.createdAt);
  }, [order?.pickupDate, order?.createdAt]);
  const endDate = useMemo(() => {
    if (!startDate) return null;
    const end = new Date(startDate.getTime());
    if (rentalPeriod === 'daily') {
      end.setDate(end.getDate() + 1);
    } else if (rentalPeriod === 'weekly') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end;
  }, [rentalPeriod, startDate]);

  const isReturned = Boolean(order?.id && returnedIds.has(order.id));
  const status = isReturned ? 'ended' : endDate && endDate.getTime() < Date.now() ? 'ended' : 'active';

  const markReturned = () => {
    if (!order?.id) return;
    const next = new Set(returnedIds);
    next.add(order.id);
    setReturnedIds(next);
    localStorage.setItem(RETURNED_KEY, JSON.stringify(Array.from(next)));
    toast.success('Marked as returned');
  };

  const requestExtension = async () => {
    if (!accessToken || !order?.id) return;
    if (extensionReason.trim().length < 10) {
      toast.error('Please provide at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          category: 'rental_extension',
          orderId: order.id,
          listingId: order.itemId,
          targetUserId: order.sellerId,
          description: extensionReason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to request extension');
        return;
      }
      setExtensionReason('');
      toast.success('Extension request sent');
    } catch (_error) {
      toast.error('Failed to request extension');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Button variant="ghost" onClick={() => navigate('/buyer/rentals')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Rentals
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Rental Details</CardTitle>
          <CardDescription>Track rental status and request extension</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading rental details...</p>
          ) : !order ? (
            <p className="text-sm text-muted-foreground">Rental details not found.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Item:</span> {listing?.title || order.listingTitle || '-'}</p>
              <p><span className="text-muted-foreground">Rental period:</span> {rentalPeriod}</p>
              <p><span className="text-muted-foreground">Rental start:</span> {startDate ? startDate.toLocaleDateString() : '-'}</p>
              <p><span className="text-muted-foreground">Rental end:</span> {endDate ? endDate.toLocaleDateString() : '-'}</p>
              <p><span className="text-muted-foreground">Total rental cost:</span> {formatMoney(order.amount || 0)}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge>
              </div>
              <p><span className="text-muted-foreground">Return tracking:</span> {isReturned ? 'Returned by buyer' : 'Not returned yet'}</p>
              <div className="pt-2">
                <Button variant="outline" onClick={markReturned} disabled={isReturned}>
                  {isReturned ? 'Already Returned' : 'Mark Returned'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Extension</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="extension-reason">Reason</Label>
            <Textarea
              id="extension-reason"
              rows={4}
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              placeholder="Why do you need a rental extension?"
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" disabled={submitting || loading || !order} onClick={requestExtension}>
            {submitting ? 'Submitting...' : 'Request Extension'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
