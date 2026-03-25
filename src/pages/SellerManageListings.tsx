import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

type ListingStatus = 'available' | 'sold' | 'rented' | 'reserved' | 'inactive';

export function SellerManageListings() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ListingStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sell' | 'rent'>('all');

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

  const fetchListings = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/listings/user');
      if (!response) {
        toast.error(data.details || data.error || 'Failed to load listings');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.details || data.error || 'Failed to load listings');
        return;
      }
      setListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (_error) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchListings();
  }, [currentUser, accessToken]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(listings.map((listing) => listing.category).filter(Boolean)));
    unique.sort((a, b) => String(a).localeCompare(String(b)));
    return unique;
  }, [listings]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesCategory = categoryFilter === 'all' || listing.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
      const matchesType = typeFilter === 'all' || listing.type === typeFilter;
      return matchesCategory && matchesStatus && matchesType;
    });
  }, [listings, categoryFilter, statusFilter, typeFilter]);

  const updateStatus = async (id: string, status: ListingStatus) => {
    const { response, data } = await requestWithAuthRetry(`/listings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response) {
      toast.error(data.error || 'Failed to update listing');
      return;
    }
    if (!response.ok) {
      toast.error(data.error || 'Failed to update listing');
      return;
    }
    toast.success(`Listing marked as ${status}`);
    setListings((prev) => prev.map((listing) => (listing.id === id ? { ...listing, status } : listing)));
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return;

    const { response, data } = await requestWithAuthRetry(`/listings/${id}`, { method: 'DELETE' });
    if (!response) {
      toast.error(data.error || 'Failed to delete listing');
      return;
    }
    if (!response.ok) {
      toast.error(data.error || 'Failed to delete listing');
      return;
    }

    toast.success('Listing deleted');
    setListings((prev) => prev.filter((listing) => listing.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate('/add-listing')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Listing
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Listings</CardTitle>
          <CardDescription>Table view of all seller listings with filters and actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="listing-category" className="text-sm text-muted-foreground">Category</label>
              <select
                id="listing-category"
                className="w-full border rounded-md h-10 px-3 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="listing-status" className="text-sm text-muted-foreground">Status</label>
              <select
                id="listing-status"
                className="w-full border rounded-md h-10 px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ListingStatus)}
              >
                <option value="all">All</option>
                <option value="available">available</option>
                <option value="sold">sold</option>
                <option value="rented">rented</option>
                <option value="reserved">reserved</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="listing-type" className="text-sm text-muted-foreground">Type</label>
              <select
                id="listing-type"
                className="w-full border rounded-md h-10 px-3 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'sell' | 'rent')}
              >
                <option value="all">All</option>
                <option value="sell">sell</option>
                <option value="rent">rent</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading listings...</p>
          ) : filteredListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No listings found for current filters.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3">Title</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Views</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((listing) => (
                    <tr key={listing.id} className="border-t">
                      <td className="p-3 font-medium min-w-[240px]">{listing.title || 'Listing'}</td>
                      <td className="p-3">{listing.category || '-'}</td>
                      <td className="p-3">{listing.type || '-'}</td>
                      <td className="p-3">
                        <Badge variant={listing.status === 'available' ? 'default' : 'secondary'}>
                          {listing.status || '-'}
                        </Badge>
                      </td>
                      <td className="p-3">{Number(listing.views || 0)}</td>
                      <td className="p-3">{listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/item/${listing.id}`)}>View</Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/seller/edit-listing/${listing.id}`)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => deleteListing(listing.id)}>Delete</Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(listing.id, 'sold')}>Mark Sold</Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(listing.id, 'rented')}>Mark Rented</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
