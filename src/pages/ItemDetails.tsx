import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import {
  MapPin,
  Star,
  MessageSquare,
  Heart,
  ChevronRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
  formatCurrency,
  getCategoryById,
  getUniversityById,
  getUniversityName,
} from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductCard } from '@/components/ProductCard';
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
  const [dbCategories, setDbCategories] = useState<Record<string, string>>({});
  const [dbUniversities, setDbUniversities] = useState<Record<string, string>>({});

  // Load real categories and universities from the database once
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/categories`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_URL}/universities`).then(r => r.json()).catch(() => ({})),
    ]).then(([catData, uniData]) => {
      if (Array.isArray(catData?.categories)) {
        const map: Record<string, string> = {};
        for (const c of catData.categories) {
          if (c?.id && c?.name) { map[c.id] = c.name; map[c.name] = c.name; }
        }
        setDbCategories(map);
      }
      if (Array.isArray(uniData?.universities)) {
        const map: Record<string, string> = {};
        for (const u of uniData.universities) {
          if (u?.id && u?.name) { map[u.id] = u.name; map[u.name] = u.name; }
        }
        setDbUniversities(map);
      }
    });
  }, []);

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

  // Resolve category name: check DB categories first, then static mockData, then raw value
  const categoryLabel = dbCategories[item.category]
    || getCategoryById(item.category)?.name
    || item.category?.replace(/^CAT-[\d]+-[a-z0-9]+$/i, '') // strip raw CAT- IDs
    || 'General';

  // Resolve university name
  const resolveUniversity = (val?: string) => {
    if (!val) return '';
    return dbUniversities[val] || getUniversityById(val)?.name || getUniversityName(val) || val.replace(/^UNI-[\d]+-[a-z0-9]+$/i, '');
  };
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
    return 0;
  })();

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

  const sellerRatingValue = Number(item.seller?.rating || 0);

  return (
    <div className="min-h-screen bg-[var(--cream)] py-6">
      <div className="mx-auto max-w-[1180px] px-4 lg:px-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <button type="button" className="hover:text-primary" onClick={() => navigate('/')}>
            {t('ui.home', 'Home')}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button type="button" className="hover:text-primary" onClick={() => navigate('/marketplace')}>
            {categoryLabel}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="max-w-[240px] truncate text-foreground">{item.title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          {/* ── LEFT: gallery ── */}
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="relative aspect-[4/3] bg-muted">
                {primaryImage ? (
                  <img src={primaryImage} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t('ui.no_image_available', 'No image available')}
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm">
                  {item.condition || t('item.used', 'Used')}
                </span>
              </div>
            </div>

            {visibleThumbnails.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {visibleThumbnails.map((image: string, index: number) => (
                  <button
                    key={`${item.id}-thumb-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      'relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-all sm:h-20 sm:w-20',
                      index === selectedImageIndex ? 'border-primary' : 'border-border hover:border-primary/40',
                    )}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={image} alt={`${item.title} ${index + 1}`} className="h-full w-full object-cover" />
                    {index === visibleThumbnails.length - 1 && remainingThumbnailCount > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">
                        +{remainingThumbnailCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: details + seller ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              {/* Status + posted */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-strong">
                  {item.type === 'sell' ? t('item.forSale', 'For Sale') : t('item.forRent', 'For Rent')}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('ui.posted', 'Posted')} {postedLabel}
                </span>
              </div>

              {/* Title */}
              <h1 className="mt-3 text-2xl font-extrabold leading-tight text-foreground sm:text-[1.75rem]">
                {item.title}
              </h1>

              {/* Rating + verified */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3.5 w-3.5',
                          i < Math.round(sellerRatingValue) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-foreground">{sellerRatingValue.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({item.seller?.reviewCount || 0} {t('ui.reviews', 'reviews')})
                  </span>
                </div>
                {item.seller?.isVerified && (
                  <span className="flex items-center gap-1 text-xs font-bold text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    {t('marketplace.verifiedStudent', 'Verified Student')}
                  </span>
                )}
              </div>

              {/* Price */}
              <p className="mt-3 text-[2rem] font-black leading-none text-primary">
                {formatCurrency(Number(item.price || 0))}
              </p>

              <div className="my-4 border-t border-border" />

              {/* Condition + Location */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-foreground">{t('item.condition', 'Condition')}:</span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
                    {item.condition || t('item.used', 'Used')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-foreground">{t('item.location', 'Location')}:</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {resolveUniversity(item.location || item.seller?.university) || t('item.campusZone', 'Campus')}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.description || t('item.noDescription', 'No description available for this listing yet.')}
              </p>

              {/* Actions */}
              {currentUser?.id !== item.sellerId ? (
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="w-full rounded-xl bg-forest py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-forest-dark"
                  >
                    {item.type === 'sell' ? t('item.buyNow', 'Buy Now') : t('item.rentNow', 'Rent Now')}
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleContactSeller}
                      className="flex-1 rounded-xl border-2 border-primary py-3 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {t('item.messageSeller', 'Message Seller')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveItem}
                      aria-label={isSaved ? 'Remove from favorites' : 'Save item'}
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors',
                        isSaved
                          ? 'border-destructive bg-destructive/10 text-destructive'
                          : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
                      )}
                    >
                      <Heart className={cn('h-5 w-5', isSaved && 'fill-current')} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-border bg-accent p-3 text-center text-sm font-medium text-accent-foreground">
                  {t('item.yourListing', 'This is your listing')}
                </div>
              )}
            </div>

            {/* Seller card */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <Avatar className="h-12 w-12 border border-border">
                {item.seller?.profilePicture ? (
                  <AvatarImage src={item.seller.profilePicture} alt={item.seller?.name || 'Seller'} />
                ) : null}
                <AvatarFallback className="bg-primary-soft font-bold text-primary">
                  {item.seller?.name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-foreground">{item.seller?.name || t('item.seller', 'Seller')}</p>
                  {item.seller?.isVerified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">{sellerRatingValue.toFixed(1)}</span>
                  <span>• {t('item.verifiedSeller', 'Verified seller')}</span>
                </p>
              </div>
              {currentUser?.id !== item.sellerId && (
                <button
                  type="button"
                  onClick={handleContactSeller}
                  aria-label="Message seller"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--teal-light)]/30 text-forest transition-colors hover:bg-[var(--teal-light)]/50"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── You May Also Like ── */}
        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-foreground">{t('item.youMayAlsoLike', 'You May Also Like')}</h2>
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t('ui.view_all', 'View All')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {relatedLoading ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              {t('item.loadingRelated', 'Loading related items...')}
            </div>
          ) : relatedItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {relatedItems.map((related) => (
                <ProductCard
                  key={related.id}
                  item={related}
                  isSaved={false}
                  onSave={() => {}}
                  onNavigate={() => navigate(`/item/${related.id}`)}
                  t={t}
                  formatCurrency={formatCurrency}
                  resolveLocationLabel={(it) => resolveUniversity(it.location || it.seller?.university) || it.location || ''}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              {t('item.noRelated', 'No related items available yet.')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
