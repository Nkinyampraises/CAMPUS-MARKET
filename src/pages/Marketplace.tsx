import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Search, Filter, MapPin, Eye, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { categories, getCategoryById, getLocationById, getUniversityName } from '@/data/mockData';
import { useLanguage } from '@/contexts/LanguageContext';

import { API_URL } from '@/lib/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  type: 'sell' | 'rent';
  condition?: string;
  status?: string;
  createdAt?: string;
  location?: string;
  views?: number;
  likesCount?: number;
  images?: string[];
  rentalPeriod?: string;
  seller?: {
    id: string;
    name: string;
    university?: string;
    rating?: number;
    reviewCount?: number;
  };
};

const toCount = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
};

const MARKETPLACE_TYPES = new Set(['sell', 'rent']);
const MARKETPLACE_SORTS = new Set(['recent', 'price-low', 'price-high']);

export function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, accessToken } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [listings, setListings] = useState<Listing[]>([]);
  const [universitiesById, setUniversitiesById] = useState<Record<string, string>>({});
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const query = String(searchParams.get('q') || '').trim();
    const rawType = String(searchParams.get('type') || '').toLowerCase();
    const rawCategory = String(searchParams.get('category') || '').trim();
    const rawSort = String(searchParams.get('sort') || '').toLowerCase();

    const categoryById = categories.find((cat) => cat.id === rawCategory)?.id;
    const categoryByName = categories.find((cat) => cat.name.toLowerCase() === rawCategory.toLowerCase())?.id;

    setSearchQuery(query);
    setSelectedType(MARKETPLACE_TYPES.has(rawType) ? rawType : 'all');
    setSelectedCategory(categoryById || categoryByName || 'all');
    setSortBy(MARKETPLACE_SORTS.has(rawSort) ? rawSort : 'recent');
  }, [searchParams]);

  useEffect(() => {
    const fetchMarketplaceData = async () => {
      try {
        const [listingsResult, universitiesResult] = await Promise.allSettled([
          fetch(`${API_URL}/listings`),
          fetch(`${API_URL}/universities`),
        ]);

        if (listingsResult.status === 'fulfilled') {
          const response = listingsResult.value;
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setListings([]);
            toast.error(data.error || t('marketplace.failedFetchListings', 'Failed to fetch listings from database'));
          } else {
            setListings(Array.isArray(data.listings) ? data.listings : []);
          }
        } else {
          setListings([]);
          toast.error(t('marketplace.unableReachListings', 'Unable to reach listings service'));
        }

        if (universitiesResult.status === 'fulfilled') {
          const response = universitiesResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.universities)) {
            const resolved: Record<string, string> = {};
            data.universities.forEach((entry: any) => {
              const id = String(entry?.id || '').trim().toLowerCase();
              const name = String(entry?.name || '').trim();
              if (id && name) {
                resolved[id] = name;
              }
              if (name) {
                resolved[name.toLowerCase()] = name;
              }
            });
            setUniversitiesById(resolved);
          }
        }
      } catch {
        setListings([]);
        toast.error(t('marketplace.unableLoadData', 'Unable to load marketplace data'));
      }
    };

    fetchMarketplaceData();
  }, [t]);

  const sectionLabel = useMemo(() => {
    const raw = String(searchParams.get('section') || '').trim();
    if (!raw) {
      return '';
    }
    return raw
      .split(/[-_ ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [searchParams]);

  const resolveUniversityLabel = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return t('marketplace.universityNotSpecified', 'University not specified');
    }

    const fromBackend = universitiesById[raw.toLowerCase()];
    if (fromBackend) {
      return fromBackend;
    }

    const fallback = getUniversityName(raw);
    if (fallback && fallback !== raw) {
      return fallback;
    }

    // Avoid showing numeric IDs directly on cards.
    if (/^\d+$/.test(raw)) {
      return t('marketplace.universityNotSpecified', 'University not specified');
    }

    return raw;
  };

  const resolveLocationLabel = (item: Listing) => {
    const sellerUniversity = resolveUniversityLabel(item.seller?.university);
    if (sellerUniversity !== t('marketplace.universityNotSpecified', 'University not specified')) {
      return sellerUniversity;
    }

    const rawLocation = String(item.location || '').trim();
    if (!rawLocation) {
      return t('marketplace.locationNotSpecified', 'Location not specified');
    }

    const fallbackLocation = getLocationById(rawLocation);
    if (fallbackLocation) {
      return fallbackLocation.name;
    }

    if (/^\d+$/.test(rawLocation)) {
      return t('marketplace.locationNotSpecified', 'Location not specified');
    }

    return rawLocation;
  };

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!isAuthenticated || !accessToken) {
        setSavedItems(new Set());
        return;
      }

      try {
        const response = await fetch(`${API_URL}/favorites`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.favorites)) {
          if (response.status !== 401) {
            toast.error(data.error || t('marketplace.failedLoadLikes', 'Failed to load liked items'));
          }
          return;
        }

        const next = new Set<string>(
          data.favorites
            .map((entry: any) => String(entry?.id || '').trim())
            .filter((entry: string) => entry.length > 0),
        );
        setSavedItems(next);
      } catch {
        toast.error(t('marketplace.failedLoadLikes', 'Failed to load liked items'));
      }
    };

    fetchFavorites();
  }, [isAuthenticated, accessToken, t]);

  const handleSaveItem = async (itemId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!accessToken) {
      toast.error(t('marketplace.loginToLike', 'Please login to like items'));
      return;
    }

    const wasSaved = savedItems.has(itemId);
    const endpoint = wasSaved ? `${API_URL}/favorites/${itemId}` : `${API_URL}/favorites`;
    const method = wasSaved ? 'DELETE' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          ...(wasSaved ? {} : { 'Content-Type': 'application/json' }),
          Authorization: `Bearer ${accessToken}`,
        },
        ...(wasSaved ? {} : { body: JSON.stringify({ itemId }) }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || t('marketplace.failedUpdateLike', 'Failed to update like'));
        return;
      }

      setSavedItems((prev) => {
        const next = new Set(prev);
        if (wasSaved) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });

      setListings((prev) =>
        prev.map((listing) => {
          if (listing.id !== itemId) return listing;
          const apiLikes = Number(data?.likesCount);
          const fallback = wasSaved
            ? Math.max(0, toCount(listing.likesCount) - 1)
            : toCount(listing.likesCount) + 1;
          return {
            ...listing,
            likesCount: Number.isFinite(apiLikes) ? Math.max(0, Math.floor(apiLikes)) : fallback,
          };
        }),
      );
    } catch {
      toast.error(t('marketplace.failedUpdateLike', 'Failed to update like'));
    }
  };

  const filteredItems = useMemo(() => {
    let filtered = listings.filter((item) => item.status === 'available');

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          String(item.title || '').toLowerCase().includes(query) ||
          String(item.description || '').toLowerCase().includes(query),
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    if (sortBy === 'price-low') {
      filtered = filtered.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-high') {
      filtered = filtered.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'recent') {
      filtered = filtered.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    return filtered;
  }, [searchQuery, selectedCategory, selectedType, sortBy, listings]);

  return (
    <div className="bg-background min-h-screen py-8 text-foreground">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{t('marketplace.title', 'Marketplace')}</h1>
            {sectionLabel && <Badge variant="outline">{t('marketplace.section', 'Section')}: {sectionLabel}</Badge>}
          </div>
          <p className="text-muted-foreground">
            {t('marketplace.subtitle', 'Browse items from students across Cameroon universities')}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('marketplace.searchPlaceholder', 'Search items...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t('marketplace.allCategories', 'All Categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('marketplace.allCategories', 'All Categories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder={t('marketplace.allTypes', 'All Types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('marketplace.allTypes', 'All Types')}</SelectItem>
                <SelectItem value="sell">{t('marketplace.forSale', 'For Sale')}</SelectItem>
                <SelectItem value="rent">{t('marketplace.forRent', 'For Rent')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder={t('marketplace.sortBy', 'Sort by')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('marketplace.recent', 'Most Recent')}</SelectItem>
                <SelectItem value="price-low">{t('marketplace.priceLow', 'Price: Low to High')}</SelectItem>
                <SelectItem value="price-high">{t('marketplace.priceHigh', 'Price: High to Low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery('')}>
                {t('marketplace.searchLabel', 'Search')}: {searchQuery} x
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCategory('all')}>
                {getCategoryById(selectedCategory)?.name} x
              </Badge>
            )}
            {selectedType !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedType('all')}>
                {selectedType === 'sell' ? t('marketplace.forSale', 'For Sale') : t('marketplace.forRent', 'For Rent')} x
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'marketplace.itemsFound',
              '{{count}} item(s) found',
              { count: filteredItems.length },
            )}
          </p>
        </div>

        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const seller = item.seller || null;
              const categoryLabel = getCategoryById(item.category)?.name || item.category || 'General';

              return (
                <Card
                  key={item.id}
                  className="overflow-hidden border border-border hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div className="relative h-44 sm:h-48 overflow-hidden bg-muted">
                    <img
                      src={item.images?.[0] || ''}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className="absolute top-2 right-2" variant={item.type === 'sell' ? 'default' : 'secondary'}>
                      {item.type === 'sell' ? t('marketplace.forSale', 'For Sale') : t('marketplace.forRent', 'For Rent')}
                    </Badge>
                    {item.condition === 'new' && (
                      <Badge className="absolute top-2 left-2 bg-green-600">{t('marketplace.new', 'New')}</Badge>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveItem(item.id);
                      }}
                      className="absolute bottom-2 right-2 p-2 bg-card/95 rounded-full shadow-md hover:bg-accent transition-colors"
                    >
                      <Heart className={`h-5 w-5 ${savedItems.has(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  </div>

                  <CardContent className="p-3 flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{categoryLabel}</p>
                    <h3 className="font-semibold mb-1 line-clamp-2">{item.title}</h3>
                    <p className="text-base font-bold text-green-600 mb-2">
                      {formatCurrency(item.price)}
                      {item.type === 'rent' && item.rentalPeriod && (
                        <span className="text-sm font-normal text-muted-foreground">/{item.rentalPeriod}</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      {resolveLocationLabel(item)}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                          <span className="text-xs font-medium text-green-600">{(seller?.name || 'S').charAt(0)}</span>
                        </div>
                        <span className="text-muted-foreground">{seller?.name || t('marketplace.unknownSeller', 'Unknown Seller')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {toCount(item.views)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-rose-500" />
                          {toCount(item.likesCount)}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 pt-0">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/item/${item.id}`);
                      }}
                    >
                      {t('marketplace.viewDetails', 'View Details')}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('marketplace.noItems', 'No items found')}</h3>
            <p className="text-muted-foreground">{t('marketplace.tryFilters', 'Try adjusting your search or filters')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
