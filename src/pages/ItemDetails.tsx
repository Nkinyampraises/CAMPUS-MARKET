import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import {
  MapPin,
  Calendar,
  Eye,
  Star,
  MessageSquare,
  ShoppingCart,
  ArrowLeft,
  Phone,
  Mail,
  Heart
} from 'lucide-react';
import {
  formatCurrency,
  getCategoryById,
  getUniversityName,
} from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`${API_URL}/listings/${id}`);
        const data = await response.json();
        if (response.ok) {
          setItem(data.listing);
        } else {
          toast.error(data.message || 'Failed to fetch item details');
        }
      } catch (error) {
        toast.error('An error occurred while fetching item details.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItem();
    }
  }, [id]);

  // Check if item is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (currentUser && id) {
        try {
          const response = await fetch(`${API_URL}/favorites`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const data = await response.json();
          const isFav = data.favorites?.some((fav: any) => fav.id === id);
          setIsSaved(!!isFav);
        } catch (e) {
          console.error("Failed to check favorite status");
        }
      }
    };
    checkFavoriteStatus();
  }, [currentUser, id, accessToken]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Item not found</h1>
        <Button onClick={() => navigate('/marketplace')}>
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const categoryLabel = getCategoryById(item.category)?.name || item.category || 'General';

  const handleContactSeller = () => {
    if (!isAuthenticated) {
      toast.error('Please login to contact the seller');
      navigate('/login');
      return;
    }
    navigate(`/messages?userId=${item.sellerId}&itemId=${item.id}`, { state: { item } });
    toast.success('Message opened');
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      toast.error('Please login to make a purchase');
      navigate('/login');
      return;
    }
    navigate(`/checkout/${item.id}`, { state: { item } });
  };

  const handleSaveItem = () => {
    if (!isAuthenticated) {
      toast.error('Please login to save items');
      navigate('/login');
      return;
    }

    if (!id || !currentUser) return;

    const toggleFavorite = async () => {
      try {
        if (isSaved) {
          // Remove from favorites
          const response = await fetch(`${API_URL}/favorites/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!response.ok) {
            toast.error('Failed to remove favorite');
            return;
          }
          setIsSaved(false);
          toast.success('Removed from favorites');
        } else {
          // Add to favorites
          const response = await fetch(`${API_URL}/favorites`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}` 
            },
            body: JSON.stringify({ itemId: id })
          });
          if (!response.ok) {
            toast.error('Failed to add favorite');
            return;
          }
          setIsSaved(true);
          toast.success('Added to favorites');
        }
      } catch (error) {
        toast.error('Failed to update favorites');
      }
    };
    toggleFavorite();
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/marketplace')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image */}
            <Card className="overflow-hidden">
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={item.images?.[0] || ''}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <Badge 
                  className="absolute top-4 right-4"
                  variant={item.type === 'sell' ? 'default' : 'secondary'}
                >
                  {item.type === 'sell' ? 'For Sale' : 'For Rent'}
                </Badge>
                {item.condition === 'new' && (
                  <Badge className="absolute top-4 left-4 bg-green-600">
                    New
                  </Badge>
                )}
              </div>
            </Card>

            {/* Details */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{categoryLabel}</p>
                    <h1 className="text-3xl font-bold mb-2">{item.title}</h1>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(item.price)}
                      {item.type === 'rent' && item.rentalPeriod && (
                        <span className="text-base font-normal text-muted-foreground">
                          /{item.rentalPeriod}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.condition}
                  </Badge>
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {item.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {item.views} views
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Description */}
                <div>
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Seller Info and Actions */}
          <div className="space-y-6">
            {/* Seller Card */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">Seller Information</h2>
                
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-green-100 text-green-600">
                      {item.seller?.name?.charAt(0) || 'S'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.seller?.name}</p>
                      {item.seller?.isVerified && (
                        <Badge variant="secondary" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {item.seller?.rating} ({item.seller?.reviewCount} reviews)
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {getUniversityName(
                      typeof item.seller?.university === 'string'
                        ? item.seller.university
                        : item.seller?.university?.name,
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {item.seller?.phone}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {item.seller?.email}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Action Buttons */}
                <div className="space-y-2">
                  {currentUser?.id !== item.sellerId && (
                    <>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={handleBuyNow}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {item.type === 'sell' ? 'Buy Now' : 'Rent Now'}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleContactSeller}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Seller
                      </Button>
                      <Button
                        variant={isSaved ? 'default' : 'outline'}
                        className={`w-full ${isSaved ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        onClick={handleSaveItem}
                      >
                        <Heart className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                        {isSaved ? 'Saved' : 'Save Item'}
                      </Button>
                    </>
                  )}
                  {currentUser?.id === item.sellerId && (
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-sm text-blue-900 font-medium">This is your listing</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Safety Tips */}
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Safety Tips</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Meet in a public place on campus</li>
                  <li>• Check item condition before payment</li>
                  <li>• Use secure payment methods only</li>
                  <li>• Report suspicious activity</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
