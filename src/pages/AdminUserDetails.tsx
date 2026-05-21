import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value || 0);

export function AdminUserDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const userId = id || searchParams.get('id') || '';
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!userId || !accessToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/details`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(data.error || 'Failed to load user details');
          return;
        }
        setDetails(data);
      } catch (_error) {
        toast.error('Failed to load user details');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchDetails();
  }, [userId, accessToken, currentUser]);

  const user = details?.user;
  const activityLog = details?.activityLog || [];
  const listings = details?.listings || [];
  const reviewsReceived = details?.reviewsReceived || [];
  const transactionsHistory = details?.transactionsHistory || [];
  const reportsAgainstUser = details?.reportsAgainstUser || [];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-3 py-8 sm:px-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('ui.loading_user_details', 'Loading user details...')}</p>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">{t('ui.user_not_found', 'User not found.')}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('ui.full_profile_view', 'Full Profile View')}</CardTitle>
              <CardDescription>{user.name}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p className="break-words"><span className="text-muted-foreground">{t('ui.name', 'Name:')}</span> {user.name || '-'}</p>
              <p className="break-all"><span className="text-muted-foreground">{t('ui.email', 'Email:')}</span> {user.email || '-'}</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.phone', 'Phone:')}</span> {user.phone || '-'}</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.university', 'University:')}</span> {user.university || '-'}</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.student_id', 'Student ID:')}</span> {user.studentId || '-'}</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.role', 'Role:')}</span> {user.userType || '-'}</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.rating', 'Rating:')}</span> {Number(user.rating || 0).toFixed(2)} ({user.reviewCount || 0} reviews)</p>
              <p className="break-words"><span className="text-muted-foreground">{t('ui.status', 'Status:')}</span> {user.isBanned ? 'Banned' : 'Active'}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('ui.user_activity_log', 'User Activity Log')}</CardTitle>
                <CardDescription>{t('ui.recent_platform_events', 'Recent platform events')}</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ui.no_activity_log_entries', 'No activity log entries.')}</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {activityLog.slice(0, 100).map((entry: any, index: number) => (
                      <div key={`${entry.type}-${entry.createdAt}-${index}`} className="border rounded p-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="secondary">{entry.type || 'activity'}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}
                          </span>
                        </div>
                        <p className="text-sm break-words">{entry.message || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('ui.user_listings', 'User Listings')}</CardTitle>
              </CardHeader>
              <CardContent>
                {listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ui.no_listings', 'No listings.')}</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {listings.map((listing: any) => (
                      <div key={listing.id} className="border rounded p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium break-words">{listing.title || listing.id}</p>
                          <Badge variant={listing.status === 'available' ? 'default' : 'secondary'}>
                            {listing.status || '-'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {listing.category || '-'} - Views: {Number(listing.views || 0)}
                        </p>
                        <p className="text-sm font-semibold text-green-600 mt-1">
                          {formatMoney(Number(listing.price || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('ui.reviews_received', 'Reviews Received')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsReceived.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ui.no_reviews_received', 'No reviews received.')}</p>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {reviewsReceived.map((review: any) => (
                      <div key={review.id} className="border rounded p-3">
                        <p className="font-medium">{Number(review.rating || 0)} / 5</p>
                        <p className="text-sm text-muted-foreground break-words">{review.comment || '-'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {review.timestamp ? new Date(review.timestamp).toLocaleString() : '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('ui.transactions_history', 'Transactions History')}</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ui.no_transactions', 'No transactions.')}</p>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {transactionsHistory.map((transaction: any) => (
                      <div key={transaction.id} className="border rounded p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium break-words">{transaction.transactionRef || transaction.id}</p>
                          <Badge variant="secondary">{transaction.status || '-'}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-green-600 mt-1">
                          {formatMoney(Number(transaction.amount || 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaction.createdAt || transaction.timestamp
                            ? new Date(transaction.createdAt || transaction.timestamp).toLocaleString()
                            : '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('ui.reports_against_user', 'Reports Against User')}</CardTitle>
            </CardHeader>
            <CardContent>
              {reportsAgainstUser.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('ui.no_reports_against_this_user', 'No reports against this user.')}</p>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                  {reportsAgainstUser.map((report: any) => (
                    <div key={report.id} className="border rounded p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="secondary">{report.category || 'report'}</Badge>
                        <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>{report.status || 'open'}</Badge>
                      </div>
                      <p className="text-sm mt-2 break-words">{report.description || '-'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.createdAt ? new Date(report.createdAt).toLocaleString() : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
