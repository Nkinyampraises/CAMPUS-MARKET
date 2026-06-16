import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export function AdminReviews() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const { t } = useLanguage();
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
    <div className="container mx-auto max-w-7xl px-3 py-8 sm:px-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.admin_reviews', 'Admin Reviews')}</CardTitle>
          <CardDescription>{t('ui.view_all_reviews_delete_abusive_reviews_and_block_', 'View all reviews, delete abusive reviews, and block spam reviewers.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full max-w-sm">
            <input
              className="w-full rounded-md h-10 border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('ui.search_reviewer_seller_comment', 'Search reviewer, seller, comment...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('ui.loading_reviews', 'Loading reviews...')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ui.no_reviews_found', 'No reviews found.')}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:bg-accent">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#D97706]">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {Number(review.rating || 0)} / 5
                      </span>
                      {review.reviewerIsBlocked ? (
                        <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-medium text-[#DC2626]">
                          {t('ui.reviewer_blocked', 'Reviewer Blocked')}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.timestamp ? new Date(review.timestamp).toLocaleString() : '-'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-2 break-words">{review.comment || '-'}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {t('ui.reviewer', 'Reviewer')}: {review.reviewerName || '-'} | {t('ui.seller', 'Seller')}: {review.sellerName || '-'}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={busyId === review.id}
                      onClick={() => deleteReview(review.id)}
                    >
                      {t('ui.delete_review', 'Delete Review')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full sm:w-auto"
                      disabled={busyId === review.id || review.reviewerIsBlocked}
                      onClick={() => blockReviewer(review.id)}
                    >
                      {t('ui.block_reviewer', 'Block Reviewer')}
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
