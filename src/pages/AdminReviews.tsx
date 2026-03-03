import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function AdminReviews() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);

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

  const fetchReviews = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/admin/reviews');
      if (!response) {
        toast.error(data.error || 'Failed to load reviews');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(
          response.status === 404
            ? 'Reviews endpoint not found. Restart server and try again.'
            : data.error || 'Failed to load reviews',
        );
        return;
      }
      setReviews(data.reviews || []);
    } catch (_error) {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchReviews();
  }, [currentUser, accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((review) => {
      const haystack = [
        review?.reviewerName,
        review?.sellerName,
        review?.comment,
        review?.id,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }, [reviews, search]);

  const deleteReview = async (reviewId: string) => {
    if (!confirm('Delete this review?')) return;
    setBusyId(reviewId);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
      });
      if (!response) {
        toast.error(data.error || 'Failed to delete review');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete review');
        return;
      }
      toast.success('Review deleted');
      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (_error) {
      toast.error('Failed to delete review');
    } finally {
      setBusyId('');
    }
  };

  const blockReviewer = async (reviewId: string) => {
    setBusyId(reviewId);
    try {
      const { response, data } = await requestWithAuthRetry(
        `/admin/reviews/${encodeURIComponent(reviewId)}/block-reviewer`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        },
      );
      if (!response) {
        toast.error(data.error || 'Failed to block reviewer');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to block reviewer');
        return;
      }
      toast.success('Reviewer blocked');
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, reviewerIsBlocked: true }
            : review,
        ),
      );
    } catch (_error) {
      toast.error('Failed to block reviewer');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/admin')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Admin
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Admin Reviews</CardTitle>
          <CardDescription>View all reviews, delete abusive reviews, and block spam reviewers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <input
              className="w-full border rounded-md h-10 px-3 text-sm"
              placeholder="Search reviewer, seller, comment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reviews...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((review) => (
                <div key={review.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{Number(review.rating || 0)} / 5</Badge>
                      {review.reviewerIsBlocked ? <Badge variant="destructive">Reviewer Blocked</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.timestamp ? new Date(review.timestamp).toLocaleString() : '-'}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{review.comment || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    Reviewer: {review.reviewerName || '-'} | Seller: {review.sellerName || '-'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === review.id}
                      onClick={() => deleteReview(review.id)}
                    >
                      Delete Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === review.id || review.reviewerIsBlocked}
                      onClick={() => blockReviewer(review.id)}
                    >
                      Block Reviewer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
