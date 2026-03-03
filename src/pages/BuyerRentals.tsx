import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;
const RETURNED_KEY = 'buyerReturnedRentals';

const toDateLabel = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getRentalStatus = (order: any, returnedIds: Set<string>) => {
  if (returnedIds.has(order.id)) return 'ended';
  const end = order.rentalEndDate ? new Date(order.rentalEndDate) : null;
  if (!end || Number.isNaN(end.getTime())) return 'active';
  return end.getTime() < Date.now() ? 'ended' : 'active';
};

export function BuyerRentals() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rentals, setRentals] = useState<any[]>([]);
  const [returnedIds, setReturnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RETURNED_KEY) || '[]');
      if (Array.isArray(stored)) {
        setReturnedIds(new Set(stored.filter((id) => typeof id === 'string')));
      }
    } catch {
      setReturnedIds(new Set());
    }
  }, []);

  useEffect(() => {
    const fetchRentals = async () => {
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
          toast.error(data.error || 'Failed to load rentals');
          return;
        }

        const rentalOrders = (data.orders || []).filter(
          (order: any) =>
            order.buyerId === currentUser.id &&
            (order.listingType === 'rent' || order.rentalPeriod),
        );
        setRentals(rentalOrders);
      } catch (_error) {
        toast.error('Failed to load rentals');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchRentals();
  }, [accessToken, currentUser, navigate]);

  const markReturned = (orderId: string) => {
    const next = new Set(returnedIds);
    next.add(orderId);
    setReturnedIds(next);
    localStorage.setItem(RETURNED_KEY, JSON.stringify(Array.from(next)));
    toast.success('Rental marked as returned');
  };

  const rentalCountLabel = useMemo(() => `${rentals.length} rental${rentals.length === 1 ? '' : 's'}`, [rentals.length]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>My Rentals</CardTitle>
          <CardDescription>{rentalCountLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading rentals...</p>
          ) : rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rental orders found.</p>
          ) : (
            <div className="space-y-3">
              {rentals.map((order) => {
                const rentalStatus = getRentalStatus(order, returnedIds);
                return (
                  <div key={order.id} className="border rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold">{order.listingTitle || 'Rental item'}</p>
                      <p className="text-sm text-muted-foreground">
                        Rental period: {order.rentalPeriod || 'monthly'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Start: {toDateLabel(order.rentalStartDate)} · End: {toDateLabel(order.rentalEndDate)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={rentalStatus === 'active' ? 'default' : 'secondary'}>{rentalStatus}</Badge>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/buyer/rental-details/${order.id}`)}>
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={returnedIds.has(order.id)}
                        onClick={() => markReturned(order.id)}
                      >
                        {returnedIds.has(order.id) ? 'Returned' : 'Mark Returned'}
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
