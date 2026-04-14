import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';
import { categories, locations } from '@/data/mockData';
import { ImageUploader } from '@/components/ImageUploader';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function AddListing() {
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    type: 'sell' as 'sell' | 'rent',
    rentalPeriod: 'monthly' as 'daily' | 'weekly' | 'monthly',
    location: '',
    condition: 'good' as 'new' | 'like-new' | 'good' | 'fair',
    images: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (currentUser?.role === 'admin') {
    return (
      <div className="min-h-screen bg-[#f5f7f6] px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#d3e3dc] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0b1f1a]">Access Denied</h1>
          <p className="mt-3 text-[#4f6b62]">Administrators cannot create listings.</p>
          <Button className="mt-6 bg-[#0f6f58] text-white hover:bg-[#0d5f4b]" onClick={() => navigate('/admin')}>
            Go to Admin Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedPrice = formData.price.replace(/\s+/g, '').replace(',', '.');
    const parsedPrice = Number(normalizedPrice);

    // Validation
    if (!formData.title || !formData.description || !formData.category || !formData.price || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price: parsedPrice,
          type: formData.type,
          rentalPeriod: formData.type === 'rent' ? formData.rentalPeriod : undefined,
          location: formData.location,
          condition: formData.condition,
          images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'],
        }),
      });

      if (response.ok) {
        toast.success('Listing created successfully!');
        navigate('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create listing');
      }
    } catch (err) {
      console.error('Create listing error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImagesChange = (images: string[]) => {
    setFormData(prev => ({ ...prev, images }));
  };

  const completionItems = [
    { label: 'Title and description', complete: Boolean(formData.title.trim() && formData.description.trim()) },
    { label: 'Category and location', complete: Boolean(formData.category && formData.location) },
    { label: 'Price and condition', complete: Boolean(formData.price && formData.condition) },
    { label: 'At least one photo', complete: formData.images.length > 0 },
  ];
  const completedCount = completionItems.filter((item) => item.complete).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);
  const parsedPreviewPrice = Number(formData.price.replace(/\s+/g, '').replace(',', '.'));

  return (
    <div className="min-h-screen bg-[#f5f7f6] py-8">
      <div className="mx-auto w-full max-w-[1220px] px-4 lg:px-6">
        <section className="mb-6 rounded-2xl border border-[#d3e3dc] bg-white p-6 shadow-sm sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f5ef] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#0f6f58]">
            <Sparkles className="h-3.5 w-3.5" />
            Seller Studio
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#0b1f1a] sm:text-4xl">Create a New Listing</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4f6b62]">
                Add clear details, good photos, and accurate pricing to attract serious buyers faster.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="border-[#bdd8cd] text-[#124a3b] hover:bg-[#f3faf7]"
            >
              Cancel
            </Button>
          </div>
        </section>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0b1f1a]">Basic Details</CardTitle>
                <CardDescription>Tell students what you are listing and why it is worth buying.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Item Title *</Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="e.g., Comfortable Single Bed with Mattress"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your item in detail. Include condition, age, and any important information..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={5}
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0b1f1a]">Listing Setup</CardTitle>
                <CardDescription>Set category, location, condition, and the best pricing model.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleChange('category', value)} required>
                    <SelectTrigger className="border-[#cfe0d8] bg-white">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select value={formData.location} onValueChange={(value) => handleChange('location', value)} required>
                    <SelectTrigger className="border-[#cfe0d8] bg-white">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <Select value={formData.condition} onValueChange={(value) => handleChange('condition', value)} required>
                    <SelectTrigger className="border-[#cfe0d8] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like-new">Like New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">
                    Price (FCFA) *
                    {formData.type === 'rent' && (
                      <span className="ml-1 text-[#5f7a71]">
                        per {formData.rentalPeriod === 'daily' ? 'day' : formData.rentalPeriod === 'weekly' ? 'week' : 'month'}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="e.g., 45000"
                    value={formData.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    min="0"
                    step="any"
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Listing Type *</Label>
                  <RadioGroup
                    value={formData.type}
                    onValueChange={(value) => handleChange('type', value)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Label htmlFor="sell" className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#cfe0d8] bg-[#f7fcfa] p-3">
                      <RadioGroupItem value="sell" id="sell" />
                      <span className="font-medium text-[#0f2c24]">For Sale</span>
                    </Label>
                    <Label htmlFor="rent" className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#cfe0d8] bg-[#f7fcfa] p-3">
                      <RadioGroupItem value="rent" id="rent" />
                      <span className="font-medium text-[#0f2c24]">For Rent</span>
                    </Label>
                  </RadioGroup>
                </div>

                {formData.type === 'rent' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rentalPeriod">Rental Period</Label>
                    <Select value={formData.rentalPeriod} onValueChange={(value) => handleChange('rentalPeriod', value)}>
                      <SelectTrigger className="border-[#cfe0d8] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0b1f1a]">Photos</CardTitle>
                <CardDescription>Upload up to five clear images from different angles.</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader images={formData.images} onChange={handleImagesChange} maxImages={5} type="listing" />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#c2d9cf] text-[#124a3b] hover:bg-[#f3faf7]"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-[#0f6f58] text-white hover:bg-[#0d5f4b]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Listing'
                )}
              </Button>
            </div>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#0b1f1a]">Completion</CardTitle>
                <CardDescription>{completedCount} of {completionItems.length} steps complete</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-2 rounded-full bg-[#e5efeb]">
                  <div className="h-2 rounded-full bg-[#0f6f58]" style={{ width: `${completionPercent}%` }} />
                </div>
                <div className="space-y-2">
                  {completionItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                      {item.complete ? (
                        <CheckCircle2 className="h-4 w-4 text-[#0f6f58]" />
                      ) : (
                        <Circle className="h-4 w-4 text-[#8aa69c]" />
                      )}
                      <span className={item.complete ? 'text-[#0f2c24]' : 'text-[#5f7a71]'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#0b1f1a]">Listing Preview</CardTitle>
                <CardDescription>Quick summary before publishing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#4f6b62]">
                <p><span className="font-medium text-[#0f2c24]">Title:</span> {formData.title || 'Not set'}</p>
                <p><span className="font-medium text-[#0f2c24]">Type:</span> {formData.type === 'rent' ? 'For Rent' : 'For Sale'}</p>
                <p><span className="font-medium text-[#0f2c24]">Category:</span> {formData.category || 'Not selected'}</p>
                <p><span className="font-medium text-[#0f2c24]">Location:</span> {formData.location || 'Not selected'}</p>
                <p>
                  <span className="font-medium text-[#0f2c24]">Price:</span>{' '}
                  {Number.isFinite(parsedPreviewPrice) && parsedPreviewPrice > 0
                    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(parsedPreviewPrice)} FCFA`
                    : 'Not set'}
                </p>
                <p><span className="font-medium text-[#0f2c24]">Photos:</span> {formData.images.length}/5</p>
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </div>
  );
}
