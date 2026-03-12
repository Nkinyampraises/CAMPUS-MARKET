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
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
const RECENTLY_VIEWED_KEY = 'recentlyViewedItemIds';
const VIEW_TRACKED_KEY = 'viewTrackedItemIds';

export function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const { t } = useLanguage();
  const [item, setItem] = useState<any>(null);
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`${API_URL}/listings/${id}`);
        const data = await response.json();
        if (response.ok) {
          setItem(data.listing);
          if (id) {
            try {
              const existing = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
              const list = Array.isArray(existing) ? existing.filter((entry) => typeof entry === 'string') : [];
              const deduped = [id, ...list.filter((entry) => entry !== id)].slice(0, 20);
              localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(deduped));
            } catch {
              // Ignore localStorage parsing issues.
            }

            try {
              const tracked = JSON.parse(localStorage.getItem(VIEW_TRACKED_KEY) || '[]');
              const trackedList = Array.isArray(tracked) ? tracked.filter((entry) => typeof entry === 'string') : [];
              if (!trackedList.includes(id)) {
                const viewResponse = await fetch(`${API_URL}/listings/${id}/view`, {
                  method: 'POST',
                });
                const viewData = await viewResponse.json().catch(() => ({}));
                if (viewResponse.ok) {
                  const nextTracked = [id, ...trackedList.filter((entry) => entry !== id)].slice(0, 400);
                  localStorage.setItem(VIEW_TRACKED_KEY, JSON.stringify(nextTracked));
                  setItem((prev: any) => {
                    if (!prev) return prev;
                    const serverCount = Number(viewData?.views);
                    return {
                      ...prev,
                      views: Number.isFinite(serverCount)
                        ? Math.max(0, Math.floor(serverCount))
                        : Math.max(0, Number(prev.views || 0) + 1),
                    };
                  });
                }
              }
            } catch {
              // Ignore view tracking errors.
            }
          }
        } else {
          toast.error(data.message || t('item.fetchDetailsFailed', 'Failed to fetch item details'));
        }
      } catch (error) {
        toast.error(t('item.fetchDetailsError', 'An error occurred while fetching item details.'));
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItem();
    }
  }, [id, t]);

  useEffect(() => {
    const fetchRelatedItems = async () => {
      if (!item?.id) {
        setRelatedItems([]);
        setRelatedLoading(false);
        return;
      }

      setRelatedLoading(true);

      try {
        const response = await fetch(`${API_URL}/listings`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.listings)) {
          setRelatedItems([]);
          return;
        }

        const allListings = (data.listings || []).filter(
          (entry: any) => entry?.id && entry.id !== item.id && (entry.status === 'available' || !entry.status),
        );

        const toRecentScore = (entry: any) => {
          const candidates = [entry?.createdAt, entry?.created_at, entry?.updatedAt, entry?.updated_at];
          for (const value of candidates) {
            if (!value) continue;
            const score = new Date(String(value)).getTime();
            if (Number.isFinite(score)) return score;
          }
          return 0;
        };

        const latestFour = allListings
          .slice()
          .sort((left: any, right: any) => {
            const scoreDiff = toRecentScore(right) - toRecentScore(left);
            if (scoreDiff !== 0) return scoreDiff;
            return String(right.id || '').localeCompare(String(left.id || ''));
          })
          .slice(0, 4);

        setRelatedItems(latestFour);
      } catch {
        setRelatedItems([]);
      } finally {
        setRelatedLoading(false);
      }
    };

    fetchRelatedItems();
  }, [item?.id, item?.category]);

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

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [item?.id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>{t('item.loading', 'Loading...')}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('item.notFound', 'Item not found')}</h1>
        <Button onClick={() => navigate('/marketplace')}>
          {t('item.backToMarketplace', 'Back to Marketplace')}
        </Button>
      </div>
    );
  }

  const categoryLabel = getCategoryById(item.category)?.name || item.category || 'General';
  const toMetricCount = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
  };
  const itemImages = Array.isArray(item?.images)
    ? item.images.filter((image: any) => typeof image === 'string' && image.trim())
    : [];
  const primaryImage = itemImages[selectedImageIndex] || itemImages[0] || '';

  const getCollageImages = (entry: any) => {
    const images = Array.isArray(entry?.images) ? entry.images.filter((image: any) => typeof image === 'string' && image.trim()) : [];
    if (images.length === 0) {
      const fallback = item?.images?.[0] || '';
      return Array.from({ length: 6 }, () => fallback);
    }

    const collage: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      collage.push(images[index % images.length]);
    }
    return collage;
  };

  const handleContactSeller = () => {
    if (!isAuthenticated) {
      toast.error(t('item.loginToContact', 'Please login to contact the seller'));
      navigate('/login');
      return;
    }
    navigate(`/messages?userId=${item.sellerId}&itemId=${item.id}`, { state: { item } });
    toast.success(t('item.messageOpened', 'Message opened'));
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      toast.error(t('item.loginToPurchase', 'Please login to make a purchase'));
      navigate('/login');
      return;
    }
    navigate(`/checkout/${item.id}`, { state: { item } });
  };

  const handleSaveItem = () => {
    if (!isAuthenticated) {
      toast.error(t('item.loginToSave', 'Please login to save items'));
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
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            toast.error(data.error || t('item.removeFavoriteFailed', 'Failed to remove favorite'));
            return;
          }
          setIsSaved(false);
          setItem((prev: any) => {
            if (!prev) return prev;
            const apiLikes = Number(data?.likesCount);
            return {
              ...prev,
              likesCount: Number.isFinite(apiLikes)
                ? Math.max(0, Math.floor(apiLikes))
                : Math.max(0, toMetricCount(prev.likesCount) - 1),
            };
          });
          toast.success(t('item.removedFavorites', 'Removed from favorites'));
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
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            toast.error(data.error || t('item.addFavoriteFailed', 'Failed to add favorite'));
            return;
          }
          setIsSaved(true);
          setItem((prev: any) => {
            if (!prev) return prev;
            const apiLikes = Number(data?.likesCount);
            return {
              ...prev,
              likesCount: Number.isFinite(apiLikes)
                ? Math.max(0, Math.floor(apiLikes))
                : toMetricCount(prev.likesCount) + 1,
            };
          });
          toast.success(t('item.addedFavorites', 'Added to favorites'));
        }
      } catch (error) {
        toast.error(t('item.updateFavoriteFailed', 'Failed to update favorites'));
      }
    };
    toggleFavorite();
  };

  return (
    <div className="bg-background min-h-screen overflow-x-hidden py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/marketplace')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('item.backToMarketplace', 'Back to Marketplace')}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image */}
            <Card className="overflow-hidden">
              <div className="relative h-64 sm:h-80 lg:h-96 bg-gray-100">
                <img
                  src={primaryImage}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <Badge 
                  className="absolute top-4 right-4"
                  variant={item.type === 'sell' ? 'default' : 'secondary'}
                >
                  {item.type === 'sell' ? t('item.forSale', 'For Sale') : t('item.forRent', 'For Rent')}
                </Badge>
                {item.condition === 'new' && (
                  <Badge className="absolute top-4 left-4 bg-green-600">
                    {t('item.new', 'New')}
                  </Badge>
                )}
              </div>
              {itemImages.length > 0 && (
                <div className="border-t bg-background p-3">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {itemImages.map((image: string, index: number) => (
                      <button
                        key={`${item.id}-thumb-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`overflow-hidden rounded-md border ${
                          index === selectedImageIndex
                            ? 'border-green-600 ring-2 ring-green-600/20'
                            : 'border-border'
                        }`}
                        aria-label={`View image ${index + 1}`}
                      >
                        <div className="aspect-square bg-gray-100">
                          <img src={image} alt={`${item.title} ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                    {toMetricCount(item.views)} {t('item.views', 'views')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4 text-rose-500" />
                    {toMetricCount(item.likesCount)} {t('item.likes', 'likes')}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Description */}
                <div>
                  <h2 className="font-semibold mb-2">{t('item.description', 'Description')}</h2>
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
                <h2 className="font-semibold mb-4">{t('item.sellerInfo', 'Seller Information')}</h2>
                
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
                          {t('item.verified', 'Verified')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {item.seller?.rating} ({item.seller?.reviewCount} {t('item.reviews', 'reviews')})
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
                        {item.type === 'sell' ? t('item.buyNow', 'Buy Now') : t('item.rentNow', 'Rent Now')}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleContactSeller}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {t('item.contactSeller', 'Contact Seller')}
                      </Button>
                      <Button
                        variant={isSaved ? 'default' : 'outline'}
                        className={`w-full ${isSaved ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        onClick={handleSaveItem}
                      >
                        <Heart className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                        {isSaved ? t('item.saved', 'Saved') : t('item.saveItem', 'Save Item')}
                      </Button>
                    </>
                  )}
                  {currentUser?.id === item.sellerId && (
                    <div className="p-4 rounded-lg text-center bg-blue-50 dark:bg-card">
                      <p className="text-sm font-medium text-blue-900 dark:text-foreground">
                        {t('item.yourListing', 'This is your listing')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Safety Tips */}
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-card dark:border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">{t('item.safetyTips', 'Safety Tips')}</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• {t('item.tip1', 'Meet in a public place on campus')}</li>
                  <li>• {t('item.tip2', 'Check item condition before payment')}</li>
                  <li>• {t('item.tip3', 'Use secure payment methods only')}</li>
                  <li>• {t('item.tip4', 'Report suspicious activity')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="mt-10 overflow-x-hidden rounded-xl border border-[#d7d7d7] bg-[#f1f1f1] p-5 sm:p-7">
          <h2 className="mb-5 font-serif text-3xl text-[#1f7a34] sm:text-4xl">{t('item.youMayAlsoLike', 'You may also like')}</h2>

          {relatedLoading ? (
            <div className="rounded-lg bg-white p-6 text-sm text-muted-foreground">
              {t('item.loadingRelated', 'Loading related items...')}
            </div>
          ) : relatedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {relatedItems.map((related) => (
                <button key={related.id} onClick={() => navigate(`/item/${related.id}`)} className="w-full min-w-0 overflow-hidden text-left">
                  <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                    <div className="grid grid-cols-3 gap-2">
                      {getCollageImages(related).map((image, index) => (
                        <div key={`${related.id}-img-${index}`} className="aspect-[3/4] overflow-hidden rounded-md bg-[#e8e8e8]">
                          <img src={image} alt={related.title} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 className="mt-3 line-clamp-3 break-words font-serif text-xl leading-snug text-[#1f7a34]">{related.title}</h3>
                  <p className="mt-1 break-words font-serif text-2xl text-[#1f7a34] sm:text-3xl">{formatCurrency(related.price)}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-6 text-sm text-muted-foreground">
              {t('item.noRelated', 'No related items available yet.')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
