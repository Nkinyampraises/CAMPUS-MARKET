import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { categories, locations } from '@/data/mockData';
import { ImageUploader } from '@/components/ImageUploader';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

type ListingType = 'sell' | 'rent';
type RentalPeriod = 'daily' | 'weekly' | 'monthly';
type ListingStatus = 'available' | 'sold' | 'rented' | 'reserved' | 'inactive';
type Condition = 'new' | 'like-new' | 'good' | 'fair';

export function SellerEditListing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    type: 'sell' as ListingType,
    rentalPeriod: 'monthly' as RentalPeriod,
    location: '',
    condition: 'good' as Condition,
    status: 'available' as ListingStatus,
    images: [] as string[],
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

  useEffect(() => {
    const fetchListing = async () => {
      if (!id || !currentUser || !accessToken) {
        setLoading(false);
        return;
      }

      try {
        const { response, data } = await requestWithAuthRetry('/listings/user');
        if (!response) {
          toast.error(data.error || 'Failed to load listing');
          return;
        }
        if (response.status === 401) {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/login');
          return;
        }
        if (!response.ok) {
          toast.error(data.error || 'Failed to load listing');
          return;
        }

        const listing = (data.listings || []).find((entry: any) => entry.id === id);
        if (!listing) {
          toast.error('Listing not found');
          navigate('/seller/manage-listings');
          return;
        }

        setFormData({
          title: listing.title || '',
          description: listing.description || '',
          category: listing.category || '',
          price: String(listing.price || ''),
          type: listing.type === 'rent' ? 'rent' : 'sell',
          rentalPeriod: listing.rentalPeriod === 'daily' || listing.rentalPeriod === 'weekly' ? listing.rentalPeriod : 'monthly',
          location: listing.location || '',
          condition: listing.condition === 'new' || listing.condition === 'like-new' || listing.condition === 'fair' ? listing.condition : 'good',
          status: listing.status === 'sold' || listing.status === 'rented' || listing.status === 'reserved' || listing.status === 'inactive'
            ? listing.status
            : 'available',
          images: Array.isArray(listing.images) ? listing.images : [],
        });
      } catch (_error) {
        toast.error('Failed to load listing');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchListing();
  }, [id, currentUser, accessToken]);

  const priceLabel = useMemo(() => {
    if (formData.type === 'rent') {
      if (formData.rentalPeriod === 'daily') return 'per day';
      if (formData.rentalPeriod === 'weekly') return 'per week';
      return 'per month';
    }
    return '';
  }, [formData.type, formData.rentalPeriod]);

  const removeImage = (imageUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((image) => image !== imageUrl),
    }));
  };

  const saveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const normalizedPrice = formData.price.replace(/\s+/g, '').replace(',', '.');
    const parsedPrice = Number(normalizedPrice);

    if (!formData.title || !formData.description || !formData.category || !formData.location) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          price: parsedPrice,
          type: formData.type,
          rentalPeriod: formData.type === 'rent' ? formData.rentalPeriod : '',
          location: formData.location,
          condition: formData.condition,
          status: formData.status,
          images: formData.images,
        }),
      });

      if (!response) {
        toast.error(data.error || 'Failed to update listing');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to update listing');
        return;
      }

      toast.success('Listing updated');
      navigate('/seller/manage-listings');
    } catch (_error) {
      toast.error('Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading listing...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/seller/manage-listings')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Listings
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Edit Listing</CardTitle>
            <CardDescription>Edit listing details, images, and status.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveListing} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as ListingStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">available</SelectItem>
                      <SelectItem value="sold">sold</SelectItem>
                      <SelectItem value="rented">rented</SelectItem>
                      <SelectItem value="reserved">reserved</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as ListingType }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sell">sell</SelectItem>
                      <SelectItem value="rent">rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'rent' ? (
                  <div className="space-y-2">
                    <Label>Rental Period</Label>
                    <Select
                      value={formData.rentalPeriod}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, rentalPeriod: value as RentalPeriod }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">daily</SelectItem>
                        <SelectItem value="weekly">weekly</SelectItem>
                        <SelectItem value="monthly">monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (FCFA) {priceLabel ? `(${priceLabel})` : ''}</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="any"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select value={formData.condition} onValueChange={(value) => setFormData((prev) => ({ ...prev, condition: value as Condition }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">new</SelectItem>
                      <SelectItem value="like-new">like-new</SelectItem>
                      <SelectItem value="good">good</SelectItem>
                      <SelectItem value="fair">fair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={formData.location} onValueChange={(value) => setFormData((prev) => ({ ...prev, location: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Images</Label>
                <ImageUploader
                  images={formData.images}
                  onChange={(images) => setFormData((prev) => ({ ...prev, images }))}
                  maxImages={8}
                  type="listing"
                />
                {formData.images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {formData.images.map((image) => (
                      <div key={image} className="border rounded p-2 space-y-2">
                        <img src={image} alt="Listing" className="w-full h-20 object-cover rounded" />
                        <Button size="sm" variant="outline" className="w-full" type="button" onClick={() => removeImage(image)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/seller/manage-listings')} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {saving ? 'Saving...' : 'Update Listing'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

