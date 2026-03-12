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
import { ArrowLeft, Loader2 } from 'lucide-react';
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
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-4">Administrators cannot create listings.</p>
        <Button onClick={() => navigate('/admin')}>Go to Admin Dashboard</Button>
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

  return (
    <div className="bg-background min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Listing</CardTitle>
            <CardDescription>
              List an item to sell or rent to fellow students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Item Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="e.g., Comfortable Single Bed with Mattress"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your item in detail. Include condition, age, and any important information..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={5}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select onValueChange={(value) => handleChange('category', value)} required>
                  <SelectTrigger>
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

              {/* Type (Sell or Rent) */}
              <div className="space-y-2">
                <Label>Listing Type *</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value) => handleChange('type', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sell" id="sell" />
                    <Label htmlFor="sell" className="font-normal cursor-pointer">
                      For Sale
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rent" id="rent" />
                    <Label htmlFor="rent" className="font-normal cursor-pointer">
                      For Rent
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Rental Period (if type is rent) */}
              {formData.type === 'rent' && (
                <div className="space-y-2">
                  <Label htmlFor="rentalPeriod">Rental Period</Label>
                  <Select 
                    value={formData.rentalPeriod}
                    onValueChange={(value) => handleChange('rentalPeriod', value)}
                  >
                    <SelectTrigger>
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

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (FCFA) *
                  {formData.type === 'rent' && (
                    <span className="text-muted-foreground ml-1">
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
                  required
                />
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label htmlFor="condition">Condition *</Label>
                <Select 
                  value={formData.condition}
                  onValueChange={(value) => handleChange('condition', value)}
                  required
                >
                  <SelectTrigger>
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

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select onValueChange={(value) => handleChange('location', value)} required>
                  <SelectTrigger>
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

              {/* Image Upload */}
              <ImageUploader 
                images={formData.images}
                onChange={handleImagesChange}
                maxImages={5}
                type="listing"
              />

              {/* Submit Button */}
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
                <Button 
                  type="submit" 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
