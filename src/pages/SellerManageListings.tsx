import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

type ListingStatus = 'available' | 'sold' | 'rented' | 'reserved' | 'inactive';
type NamedOption = { id: string; name: string };

export function SellerManageListings() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [categoryCatalog, setCategoryCatalog] = useState<NamedOption[]>([]);
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
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.categories)) {
          return;
        }
        const next = data.categories
          .map((entry: any) => ({
            id: String(entry?.id || '').trim(),
            name: String(entry?.name || '').trim(),
          }))
          .filter((entry: NamedOption) => entry.id && entry.name);
        setCategoryCatalog(next);
      } catch {
        // Keep UI functional even if catalog lookup fails.
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchCategories();
    fetchListings();
  }, [currentUser, accessToken, navigate]);

  const normalizeCategory = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const fromId = categoryCatalog.find((category) => String(category.id) === raw);
    if (fromId) return String(fromId.id);
    const fromName = categoryCatalog.find((category) => category.name.toLowerCase() === raw.toLowerCase());
    if (fromName) return String(fromName.id);
    return raw;
  };

  const getCategoryLabel = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    const fromId = categoryCatalog.find((category) => String(category.id) === raw);
    if (fromId) return fromId.name;
    const fromName = categoryCatalog.find((category) => category.name.toLowerCase() === raw.toLowerCase());
    return fromName?.name || raw;
  };

  const categoryOptions = useMemo(() => {
    const options = categoryCatalog.map((category) => ({
      value: String(category.id),
      label: category.name,
    }));
    const knownValues = new Set(options.map((option) => option.value));

    listings.forEach((listing) => {
      const raw = String(listing.category ?? '').trim();
      if (!raw) return;

      const normalizedValue = normalizeCategory(raw);
      if (knownValues.has(normalizedValue)) return;

      options.push({
        value: normalizedValue,
        label: getCategoryLabel(raw),
      });
      knownValues.add(normalizedValue);
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [listings]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const listingCategory = normalizeCategory(listing.category);
      const matchesCategory = categoryFilter === 'all' || listingCategory === categoryFilter;
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
      <div className="mb-4 flex justify-end">
        <Button className="bg-[#1FAF9A] hover:bg-[#27b9a6]" onClick={() => navigate('/add-listing')}>
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
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
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
                      <td className="p-3">{getCategoryLabel(listing.category)}</td>
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

