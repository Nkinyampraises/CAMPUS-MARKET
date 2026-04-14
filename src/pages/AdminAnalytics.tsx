import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

function BarList({
  items,
  labelKey,
  valueKey,
}: {
  items: any[];
  labelKey: string;
  valueKey: string;
}) {
  const maxValue = useMemo(
    () => Math.max(1, ...items.map((item) => Number(item?.[valueKey] || 0))),
    [items, valueKey],
  );

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No data available.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const value = Number(item?.[valueKey] || 0);
        const width = `${Math.max(4, Math.round((value / maxValue) * 100))}%`;
        return (
          <div key={`${item?.[labelKey]}-${value}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{item?.[labelKey] || '-'}</span>
              <span className="text-muted-foreground">{value}</span>
            </div>
            <div className="w-full h-2 rounded bg-gray-100 overflow-hidden">
              <div className="h-2 bg-green-600 rounded" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminAnalytics() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>({
    dailyListingsPosted: [],
    dailyTransactions: [],
    topCategories: [],
    topUniversities: [],
    topSellers: [],
  });

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

  const fetchAnalytics = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/admin/analytics');
      if (!response) {
        toast.error(data.error || 'Failed to load analytics');
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
            ? 'Analytics endpoint not found. Restart server and try again.'
            : data.error || 'Failed to load analytics',
        );
        return;
      }
      setAnalytics({
        dailyListingsPosted: data.dailyListingsPosted || [],
        dailyTransactions: data.dailyTransactions || [],
        topCategories: data.topCategories || [],
        topUniversities: data.topUniversities || [],
        topSellers: data.topSellers || [],
      });
    } catch (_error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAnalytics();
  }, [currentUser, accessToken]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-3 py-8 sm:px-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Analytics</CardTitle>
          <CardDescription>
            Daily listings, daily transactions, top categories, top universities, and top sellers.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">Loading analytics...</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Listings Posted</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={analytics.dailyListingsPosted} labelKey="date" valueKey="count" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={analytics.dailyTransactions} labelKey="date" valueKey="count" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={analytics.topCategories} labelKey="name" valueKey="count" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Universities</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={analytics.topUniversities} labelKey="name" valueKey="count" />
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Top Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3">Seller</th>
                      <th className="text-left p-3">Orders</th>
                      <th className="text-left p-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.topSellers || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-3 text-muted-foreground">No seller analytics available.</td>
                      </tr>
                    ) : (
                      analytics.topSellers.map((seller: any) => (
                        <tr key={seller.sellerId} className="border-t">
                          <td className="p-3">{seller.sellerName || seller.sellerId || '-'}</td>
                          <td className="p-3">{Number(seller.count || 0)}</td>
                          <td className="p-3">{Number(seller.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
