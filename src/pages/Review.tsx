import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

type TransactionRecord = {
  id: string;
  orderId?: string;
  buyerId: string;
  sellerId: string;
  itemId?: string;
};

type SellerProfile = {
  id: string;
  name: string;
};

type ReviewRecord = {
  id: string;
  transactionId: string;
};

export function Review() {
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId') || searchParams.get('order');

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');

  const [transaction, setTransaction] = useState<TransactionRecord | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [itemTitle, setItemTitle] = useState('Item');
  const [existingReview, setExistingReview] = useState<ReviewRecord | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigate('/login');
      return;
    }

    if (!transactionId) {
      setError('Transaction not found');
      setBootLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setBootLoading(true);
        setError('');

        const transactionsRes = await fetch(`${API_URL}/transactions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const transactionsData = await transactionsRes.json().catch(() => ({}));
        if (!transactionsRes.ok) {
          setError(transactionsData.error || 'Failed to load transaction');
          return;
        }

        const found = (transactionsData.transactions || []).find(
          (txn: any) => txn?.id === transactionId || txn?.orderId === transactionId,
        );

        if (!found) {
          setError('Transaction not found');
          return;
        }

        if (found.buyerId !== currentUser.id) {
          setError('You can only review transactions where you are the buyer');
          return;
        }

        setTransaction(found);

        const requests: Promise<Response>[] = [
          fetch(`${API_URL}/users/${found.sellerId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${API_URL}/reviews/${found.sellerId}`),
        ];

        if (found.itemId) {
          requests.push(
            fetch(`${API_URL}/listings/${found.itemId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            }),
          );
        }

        const [sellerRes, sellerReviewsRes, listingRes] = await Promise.all(requests);

        if (sellerRes.ok) {
          const sellerData = await sellerRes.json().catch(() => ({}));
          if (sellerData?.user) {
            setSeller(sellerData.user);
          }
        }

        if (sellerReviewsRes.ok) {
          const reviewsData = await sellerReviewsRes.json().catch(() => ({}));
          const already = (reviewsData.reviews || []).find((r: any) => r?.transactionId === found.id);
          setExistingReview(already || null);
        }

        if (listingRes && listingRes.ok) {
          const listingData = await listingRes.json().catch(() => ({}));
          setItemTitle(listingData?.listing?.title || 'Item');
        }
      } catch (_err) {
        setError('Failed to load review details');
      } finally {
        setBootLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, currentUser, transactionId, accessToken, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!transaction) {
      setError('Transaction not found');
      return;
    }

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Comment must be at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          sellerId: transaction.sellerId,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to submit review');
        return;
      }

      toast.success('Review submitted successfully');
      navigate('/dashboard');
    } catch (_err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  if (bootLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p className="text-muted-foreground">Loading transaction...</p>
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{error}</h1>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Already Reviewed</h1>
        <p className="text-muted-foreground mb-4">You already submitted a review for this transaction.</p>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Leave a Review</CardTitle>
            <CardDescription>Share your experience with this seller</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Item</p>
                <p className="font-semibold mb-3">{itemTitle}</p>

                <p className="text-sm text-muted-foreground mb-1">Seller</p>
                <p className="font-semibold">{seller?.name || 'Seller'}</p>
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none transition-transform hover:scale-110"
                      disabled={loading}
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        } transition-colors`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Your Review</Label>
                <Textarea
                  id="comment"
                  placeholder="Share your experience... (minimum 10 characters)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">{comment.length}/500 characters</p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/dashboard')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={loading || rating === 0}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
