import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export function AdminUserDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const userId = id || searchParams.get('id') || '';
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
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
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <Button variant="ghost" onClick={() => navigate('/admin')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Admin
      </Button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading user details...</p>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">User not found.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Full Profile View</CardTitle>
              <CardDescription>{user.name}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {user.name || '-'}</p>
              <p><span className="text-muted-foreground">Email:</span> {user.email || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {user.phone || '-'}</p>
              <p><span className="text-muted-foreground">University:</span> {user.university || '-'}</p>
              <p><span className="text-muted-foreground">Student ID:</span> {user.studentId || '-'}</p>
              <p><span className="text-muted-foreground">Role:</span> {user.userType || '-'}</p>
              <p><span className="text-muted-foreground">Rating:</span> {Number(user.rating || 0).toFixed(2)} ({user.reviewCount || 0} reviews)</p>
              <p><span className="text-muted-foreground">Status:</span> {user.isBanned ? 'Banned' : 'Active'}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Activity Log</CardTitle>
                <CardDescription>Recent platform events</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity log entries.</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {activityLog.slice(0, 100).map((entry: any, index: number) => (
                      <div key={`${entry.type}-${entry.createdAt}-${index}`} className="border rounded p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant="secondary">{entry.type || 'activity'}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}
                          </span>
                        </div>
                        <p className="text-sm">{entry.message || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Listings</CardTitle>
              </CardHeader>
              <CardContent>
                {listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No listings.</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {listings.map((listing: any) => (
                      <div key={listing.id} className="border rounded p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{listing.title || listing.id}</p>
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
                <CardTitle>Reviews Received</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsReceived.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews received.</p>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {reviewsReceived.map((review: any) => (
                      <div key={review.id} className="border rounded p-3">
                        <p className="font-medium">{Number(review.rating || 0)} / 5</p>
                        <p className="text-sm text-muted-foreground">{review.comment || '-'}</p>
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
                <CardTitle>Transactions History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions.</p>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {transactionsHistory.map((transaction: any) => (
                      <div key={transaction.id} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{transaction.transactionRef || transaction.id}</p>
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
              <CardTitle>Reports Against User</CardTitle>
            </CardHeader>
            <CardContent>
              {reportsAgainstUser.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports against this user.</p>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                  {reportsAgainstUser.map((report: any) => (
                    <div key={report.id} className="border rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{report.category || 'report'}</Badge>
                        <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>{report.status || 'open'}</Badge>
                      </div>
                      <p className="text-sm mt-2">{report.description || '-'}</p>
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
