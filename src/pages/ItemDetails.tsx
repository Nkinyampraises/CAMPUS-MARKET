import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import {
  MapPin,
  Calendar,
  Eye,
  Star,
  MessageSquare,
  ShoppingCart,
  Heart,
  ChevronRight,
  Shield,
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
  const { currentUser, isAuthenticated, accessToken, refreshAuthToken } = useAuth();
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

  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
    const token = accessToken || localStorage.getItem('accessToken');
    if (!token) {
      return { response: null as Response | null, data: { error: 'Unauthorized' } };
    }

    const makeRequest = (authToken: string) =>
      fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${authToken}`,
        },
      });

    let response = await makeRequest(token);
    let data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      const refreshed = await refreshAuthToken();
      if (!refreshed) {
        return { response, data };
      }

      response = await makeRequest(refreshed);
      data = await response.json().catch(() => ({}));
    }

    return { response, data };
  };

  // Check if item is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (currentUser && id) {
        try {
          const { response, data } = await requestWithAuthRetry('/favorites');
          if (!response?.ok) {
            return;
          }
          const isFav = data.favorites?.some((fav: any) => fav.id === id);
          setIsSaved(!!isFav);
        } catch (e) {
          console.error("Failed to check favorite status");
        }
      }
    };
    checkFavoriteStatus();
  }, [currentUser, id, accessToken, refreshAuthToken]);

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
  const postedLabel = (() => {
    if (!item?.createdAt) return 'Recently posted';
    const created = new Date(item.createdAt);
    if (!Number.isFinite(created.getTime())) return 'Recently posted';

    const diffMs = Date.now() - created.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return created.toLocaleDateString();
  })();

  const thumbnails = itemImages.length > 0 ? itemImages : primaryImage ? [primaryImage] : [];
  const visibleThumbnails = thumbnails.slice(0, 4);
  const remainingThumbnailCount = Math.max(0, thumbnails.length - 4);

  const comparePrice = (() => {
    const actual = Number(item?.price || 0);
    const compare = Number(item?.originalPrice || item?.compareAtPrice || 0);
    if (Number.isFinite(compare) && compare > actual) return compare;
    if (actual > 0) return Math.round(actual * 1.15);
    return 0;
  })();

  const relatedFallbackImage = primaryImage || 'https://placehold.co/640x480?text=No+Image';
  const getRelatedImage = (entry: any) => {
    if (Array.isArray(entry?.images)) {
      const valid = entry.images.find((img: any) => typeof img === 'string' && img.trim());
      if (valid) return valid;
    }
    return relatedFallbackImage;
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
          const { response, data } = await requestWithAuthRetry(`/favorites/${id}`, {
            method: 'DELETE',
          });
          if (!response?.ok) {
            if (response?.status === 401) {
              toast.error(t('item.loginToSave', 'Please login to save items'));
              navigate('/login');
            } else {
              toast.error(data.error || t('item.removeFavoriteFailed', 'Failed to remove favorite'));
            }
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
          const { response, data } = await requestWithAuthRetry('/favorites', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemId: id })
          });
          if (!response?.ok) {
            if (response?.status === 401) {
              toast.error(t('item.loginToSave', 'Please login to save items'));
              navigate('/login');
            } else {
              toast.error(data.error || t('item.addFavoriteFailed', 'Failed to add favorite'));
            }
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
    <div className="min-h-screen bg-[#f6f8f7] py-7">
      <div className="mx-auto w-full max-w-[1220px] px-4 lg:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#5d7b72]">
          <button type="button" className="hover:text-[#0c6a5a]" onClick={() => navigate('/marketplace')}>
            Marketplace
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-[#92aba3]" />
          <span>{categoryLabel}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#92aba3]" />
          <span className="max-w-[240px] truncate text-[#0f3a31]">{item.title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,1fr)]">
          <div className="space-y-3">
            <Card className="overflow-hidden rounded-2xl border border-[#d7e6de] bg-white shadow-sm">
              <div className="relative aspect-[16/10] bg-[#e9efec]">
                {primaryImage ? (
                  <img src={primaryImage} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#6f8d84]">No image available</div>
                )}
                <Badge className="absolute right-3 top-3 rounded-full bg-[#e8f8ef] px-3 py-1 text-[10px] uppercase tracking-wide text-[#0c6a5a] hover:bg-[#d9f3e5]">
                  {item.type === 'sell' ? t('item.forSale', 'For Sale') : t('item.forRent', 'For Rent')}
                </Badge>
              </div>
            </Card>

            {visibleThumbnails.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {visibleThumbnails.map((image: string, index: number) => (
                  <button
                    key={`${item.id}-thumb-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative overflow-hidden rounded-lg border ${
                      index === selectedImageIndex
                        ? 'border-[#0c6a5a] ring-2 ring-[#0c6a5a]/20'
                        : 'border-[#d6e4dd]'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <div className="aspect-[4/3] bg-[#ebf2ef]">
                      <img src={image} alt={`${item.title} ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                  </button>
                ))}
                {remainingThumbnailCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedImageIndex(4)}
                    className="flex aspect-[4/3] items-center justify-center rounded-lg border border-[#d6e4dd] bg-[#f0f5f2] text-sm font-semibold text-[#4c6d63]"
                  >
                    +{remainingThumbnailCount}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl border border-[#d7e6de] bg-white shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <Badge variant="secondary" className="rounded-full bg-[#ebf5f1] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[#37685b]">
                    {categoryLabel}
                  </Badge>
                  <h1 className="text-3xl font-extrabold leading-tight text-[#072c25]">{item.title}</h1>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <p className="text-[2rem] font-black leading-none text-[#004f3f]">{formatCurrency(Number(item.price || 0))}</p>
                    {comparePrice > 0 && (
                      <p className="text-sm font-medium text-[#80988f] line-through">{formatCurrency(comparePrice)}</p>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[#5f7f75]">
                    {item.description || 'No description available for this listing yet.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[#d5e5dd] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7d968d]">{t('item.condition', 'Condition')}</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-[#123b32]">{item.condition || 'Used'}</p>
                  </div>
                  <div className="rounded-xl border border-[#d5e5dd] bg-[#f9fcfa] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#7d968d]">Posted</p>
                    <p className="mt-1 text-sm font-semibold text-[#123b32]">{postedLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-[#55766c]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{item.location || 'Campus zone'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    <span>{toMetricCount(item.views)} views</span>
                  </div>
                </div>

                {currentUser?.id !== item.sellerId ? (
                  <div className="space-y-2.5">
                    <Button className="h-11 w-full rounded-lg bg-[#0c6a5a] text-[15px] font-semibold text-white hover:bg-[#0a594c]" onClick={handleBuyNow}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {item.type === 'sell' ? t('item.buyNow', 'Buy Now') : t('item.rentNow', 'Rent Now')}
                    </Button>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button
                        variant="outline"
                        className="h-10 rounded-lg border-[#c9ddd3] text-[#1a4a3f] hover:bg-[#f0f7f3]"
                        onClick={item.type === 'rent' ? handleBuyNow : handleContactSeller}
                      >
                        {item.type === 'rent'
                          ? `${t('item.rentNow', 'Rent')} (${String(item.rentalPeriod || 'weekly').replace(/^\w/, (value: string) => value.toUpperCase())})`
                          : t('item.contactSeller', 'Contact Seller')}
                      </Button>
                      <Button
                        variant="outline"
                        className={`h-10 rounded-lg border-[#c9ddd3] ${isSaved ? 'bg-[#fff0f3] text-[#c3324b]' : 'text-[#1a4a3f] hover:bg-[#f0f7f3]'}`}
                        onClick={handleSaveItem}
                      >
                        <Heart className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                        {isSaved ? t('item.saved', 'Saved') : t('item.saveItem', 'Save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#bfd8d0] bg-[#eef7f4] p-3 text-center text-sm font-medium text-[#215347]">
                    {t('item.yourListing', 'This is your listing')}
                  </div>
                )}

                <div className="rounded-xl border border-[#d4e4dc] bg-[#fbfdfc] p-3.5">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-[#cfe1d8]">
                      {item.seller?.profilePicture ? <AvatarImage src={item.seller.profilePicture} alt={item.seller?.name || 'Seller'} /> : null}
                      <AvatarFallback className="bg-[#dff1e9] text-[#0f5a4b]">
                        {item.seller?.name?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-[#143d33]">{item.seller?.name || 'Seller'}</p>
                        {item.seller?.isVerified ? (
                          <Badge className="rounded-full bg-[#fff0cd] px-2 py-0 text-[10px] font-semibold text-[#8a5b00]">Verified</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-[#6c877f]">
                        <Star className="mr-1 inline h-3.5 w-3.5 fill-[#f5b301] text-[#f5b301]" />
                        {item.seller?.rating || '0.0'} ({item.seller?.reviewCount || 0} reviews)
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-[#617f76]">
                    <MapPin className="h-3.5 w-3.5" />
                    {getUniversityName(
                      typeof item.seller?.university === 'string'
                        ? item.seller.university
                        : item.seller?.university?.name,
                    )}
                  </div>
                  {currentUser?.id !== item.sellerId && (
                    <Button
                      className="h-9 w-full rounded-lg bg-[#0c6a5a] text-sm font-semibold text-white hover:bg-[#0a594c]"
                      onClick={handleContactSeller}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Contact Seller
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#e6d7ba] bg-[#fffaf1]">
              <CardContent className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#6c4f12]">
                  <Shield className="h-4 w-4" />
                  {t('item.safetyTips', 'Safety Tips')}
                </h3>
                <ul className="space-y-1.5 text-xs text-[#6a5a33]">
                  <li>• {t('item.tip1', 'Meet in a public place on campus')}</li>
                  <li>• {t('item.tip2', 'Check item condition before payment')}</li>
                  <li>• {t('item.tip3', 'Use secure payment methods only')}</li>
                  <li>• {t('item.tip4', 'Report suspicious activity')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="mt-10 rounded-2xl border border-[#d9e8e0] bg-white p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0e3d34]">Related Deals</h2>
              <p className="text-sm text-[#708a81]">Recommended for your search in {categoryLabel}.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-[#0c6a5a] hover:bg-[#ebf6f1]" onClick={() => navigate('/marketplace')}>
              View All
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {relatedLoading ? (
            <div className="rounded-lg border border-[#e2eee8] bg-[#f9fcfb] p-6 text-sm text-[#658078]">
              {t('item.loadingRelated', 'Loading related items...')}
            </div>
          ) : relatedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedItems.map((related) => (
                <button
                  key={related.id}
                  type="button"
                  onClick={() => navigate(`/item/${related.id}`)}
                  className="overflow-hidden rounded-xl border border-[#d6e5dd] bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#edf3f0]">
                    <img src={getRelatedImage(related)} alt={related.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-[#183f35]">{related.title}</h3>
                    <p className="text-xs uppercase text-[#88a097]">{getCategoryById(related.category)?.name || 'General'}</p>
                    <p className="text-sm font-bold text-[#0a5f4f]">{formatCurrency(Number(related.price || 0))}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e2eee8] bg-[#f9fcfb] p-6 text-sm text-[#658078]">
              {t('item.noRelated', 'No related items available yet.')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
