import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Search, Filter, MapPin, Heart, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeImageUrl } from '@/lib/images';
import { ResilientImage } from '@/components/ResilientImage';

import { API_URL } from '@/lib/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
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

type NamedOption = {
  id: string;
  name: string;
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
const PRICE_RANGE_OPTIONS = [
  { id: 'all', label: 'Any Price', min: 0, max: Infinity },
  { id: 'under-100', label: 'Under 100,000 FCFA', min: 0, max: 100000 },
  { id: '100-500', label: '100,000 - 500,000 FCFA', min: 100000, max: 500000 },
  { id: '500-1000', label: '500,000 - 1,000,000 FCFA', min: 500000, max: 1000000 },
  { id: '1000', label: '1,000,000+ FCFA', min: 1000000, max: Infinity },
];

export function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, accessToken, refreshAuthToken } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [listings, setListings] = useState<Listing[]>([]);
  const [categoriesById, setCategoriesById] = useState<Record<string, string>>({});
  const [categoriesList, setCategoriesList] = useState<NamedOption[]>([]);
  const [universitiesById, setUniversitiesById] = useState<Record<string, string>>({});
  const [universitiesList, setUniversitiesList] = useState<NamedOption[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const query = String(searchParams.get('q') || '').trim();
    const rawType = String(searchParams.get('type') || '').toLowerCase();
    const rawCategory = String(searchParams.get('category') || '').trim();
    const rawPrice = String(searchParams.get('price') || '').toLowerCase();
    const rawUniversity = String(searchParams.get('university') || '').trim();
    const rawSort = String(searchParams.get('sort') || '').toLowerCase();

    const normalizedCategory = rawCategory.toLowerCase();
    const categoryById = categoriesList.find((cat) => cat.id.toLowerCase() === normalizedCategory)?.id;
    const categoryByName = categoriesList.find((cat) => cat.name.toLowerCase() === normalizedCategory)?.id;

    setSearchQuery(query);
    setSelectedType(MARKETPLACE_TYPES.has(rawType) ? rawType : 'all');
    setSelectedCategory(categoryById || categoryByName || 'all');
    setSelectedPriceRange(PRICE_RANGE_OPTIONS.some((range) => range.id === rawPrice) ? rawPrice : 'all');
    setSelectedUniversity(rawUniversity || 'all');
    setSortBy(MARKETPLACE_SORTS.has(rawSort) ? rawSort : 'recent');
  }, [searchParams, categoriesList]);

  useEffect(() => {
    const fetchMarketplaceData = async () => {
      try {
        const [listingsResult, universitiesResult, categoriesResult] = await Promise.allSettled([
          fetch(`${API_URL}/listings`),
          fetch(`${API_URL}/universities`),
          fetch(`${API_URL}/categories`),
        ]);

        if (listingsResult.status === 'fulfilled') {
          const response = listingsResult.value;
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setListings([]);
            toast.error(
              data.details || data.error || t('marketplace.failedFetchListings', 'Failed to fetch listings from database'),
            );
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
            const list: NamedOption[] = [];
            data.universities.forEach((entry: any) => {
              const id = String(entry?.id || '').trim().toLowerCase();
              const name = String(entry?.name || '').trim();
              if (id && name) {
                resolved[id] = name;
                list.push({ id, name });
              }
              if (name) {
                resolved[name.toLowerCase()] = name;
              }
            });
            setUniversitiesById(resolved);
            setUniversitiesList(list);
          }
        }

        if (categoriesResult.status === 'fulfilled') {
          const response = categoriesResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.categories)) {
            const resolved: Record<string, string> = {};
            const list: NamedOption[] = [];
            data.categories.forEach((entry: any) => {
              const id = String(entry?.id || '').trim().toLowerCase();
              const name = String(entry?.name || '').trim();
              if (id && name) {
                resolved[id] = name;
                list.push({ id, name });
              }
              if (name) {
                resolved[name.toLowerCase()] = name;
              }
            });
            setCategoriesById(resolved);
            setCategoriesList(list);
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

  const resolveCategoryLabel = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return t('marketplace.categoryNotSpecified', 'Category not specified');
    }

    const fromBackend = categoriesById[raw.toLowerCase()];
    if (fromBackend) {
      return fromBackend;
    }

    if (/^\d+$/.test(raw)) {
      return t('marketplace.categoryNotSpecified', 'Category not specified');
    }

    return raw;
  };

  const resolveUniversityLabel = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return t('marketplace.universityNotSpecified', 'University not specified');
    }

    const fromBackend = universitiesById[raw.toLowerCase()];
    if (fromBackend) {
      return fromBackend;
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

    if (/^\d+$/.test(rawLocation)) {
      return t('marketplace.locationNotSpecified', 'Location not specified');
    }

    return rawLocation;
  };

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

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!isAuthenticated || !accessToken) {
        setSavedItems(new Set());
        return;
      }

      try {
        const { response, data } = await requestWithAuthRetry('/favorites');
        if (!response.ok || !Array.isArray(data.favorites)) {
          if (response.status !== 401) {
            toast.error(data.error || t('marketplace.failedLoadLikes', 'Failed to load liked items'));
          } else {
            setSavedItems(new Set());
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
  }, [isAuthenticated, accessToken, refreshAuthToken, t]);

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
    const endpoint = wasSaved ? `/favorites/${itemId}` : '/favorites';
    const method = wasSaved ? 'DELETE' : 'POST';

    try {
      const { response, data } = await requestWithAuthRetry(endpoint, {
        method,
        headers: {
          ...(wasSaved ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(wasSaved ? {} : { body: JSON.stringify({ itemId }) }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t('marketplace.loginToLike', 'Please login to like items'));
          navigate('/login');
        } else {
          toast.error(data.error || t('marketplace.failedUpdateLike', 'Failed to update like'));
        }
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
    let filtered = listings.filter((item) => String(item.status || 'available').toLowerCase() === 'available');

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          String(item.title || '').toLowerCase().includes(query) ||
          String(item.description || '').toLowerCase().includes(query),
      );
    }

    if (selectedCategory !== 'all') {
      const selectedRaw = selectedCategory.toLowerCase();
      const selectedLabel = resolveCategoryLabel(selectedCategory).toLowerCase();
      filtered = filtered.filter((item) => {
        const itemRaw = String(item.category || '').trim().toLowerCase();
        const itemLabel = resolveCategoryLabel(item.category).toLowerCase();
        return (
          itemRaw === selectedRaw ||
          itemLabel === selectedRaw ||
          itemRaw === selectedLabel ||
          itemLabel === selectedLabel
        );
      });
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    if (selectedPriceRange !== 'all') {
      const selectedRange = PRICE_RANGE_OPTIONS.find((range) => range.id === selectedPriceRange);
      if (selectedRange) {
        filtered = filtered.filter((item) => {
          const price = Number(item.price || 0);
          return price >= selectedRange.min && price < selectedRange.max;
        });
      }
    }

    if (selectedUniversity !== 'all') {
      const rawFilter = selectedUniversity.toLowerCase();
      const selectedLabel = (universitiesById[rawFilter] || rawFilter).toLowerCase();
      filtered = filtered.filter((item) => {
        const itemUniversity = String(item.seller?.university || '').trim().toLowerCase();
        const itemUniversityLabel = resolveUniversityLabel(item.seller?.university).toLowerCase();
        return (
          itemUniversity === rawFilter ||
          itemUniversityLabel === rawFilter ||
          itemUniversity === selectedLabel ||
          itemUniversityLabel === selectedLabel
        );
      });
    }

    if (sortBy === 'price-low') {
      filtered = filtered.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-high') {
      filtered = filtered.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'recent') {
      filtered = filtered.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    return filtered;
  }, [searchQuery, selectedCategory, selectedType, selectedPriceRange, selectedUniversity, sortBy, listings, categoriesById, universitiesById, t]);

  const saleCount = useMemo(
    () => filteredItems.filter((item) => item.type === 'sell').length,
    [filteredItems],
  );
  const rentCount = useMemo(
    () => filteredItems.filter((item) => item.type === 'rent').length,
    [filteredItems],
  );
  const totalVisibleLikes = useMemo(
    () => filteredItems.reduce((total, item) => total + toCount(item.likesCount), 0),
    [filteredItems],
  );
  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory !== 'all' || selectedType !== 'all' || selectedPriceRange !== 'all' || selectedUniversity !== 'all' || sortBy !== 'recent',
  );

  return (
    <div className="min-h-screen bg-[#f8f4f2] py-10">
      <div className="mx-auto w-full max-w-none px-4 lg:px-6">
        <section className="mb-6 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold text-[#1f1f1f]">{t('marketplace.title', 'Student Marketplace')}</h1>
            <p className="mt-2 text-sm text-[#6a6a6a]">
              {t(
                'marketplace.subtitle',
                'Find the best deals on campus. Verified student sellers from top universities in Cameroon.',
              )}
            </p>
          </div>
          <div className="min-w-[200px]">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">
              {t('marketplace.sortBy', 'Sort by')}
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="mt-2 h-10 rounded-full border-[#e6e0dc] bg-white text-sm text-[#2a2a2a] shadow-sm">
                <SelectValue placeholder={t('marketplace.recent', 'Newest Arrivals')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('marketplace.recent', 'Newest Arrivals')}</SelectItem>
                <SelectItem value="price-low">{t('marketplace.priceLow', 'Price: Low to High')}</SelectItem>
                <SelectItem value="price-high">{t('marketplace.priceHigh', 'Price: High to Low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-3xl border border-[#eee8e4] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8c8c]" />
              <Input
                type="text"
                placeholder={t('marketplace.searchPlaceholder', 'Search by item name, category or campus...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded-full border-[#ece6e2] bg-[#fbfaf9] pl-11 text-sm text-[#2c2c2c] shadow-sm"
              />
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-nowrap">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10 min-w-[180px] rounded-full border-[#ece6e2] bg-[#fbfaf9] text-xs font-semibold text-[#3a3a3a] shadow-sm">
                  <Filter className="mr-2 h-4 w-4 text-[#6f6f6f]" />
                  <SelectValue placeholder={t('marketplace.category', 'Category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('marketplace.allCategories', 'All Categories')}</SelectItem>
                  {categoriesList.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
                <SelectTrigger className="h-10 min-w-[180px] rounded-full border-[#ece6e2] bg-[#fbfaf9] text-xs font-semibold text-[#3a3a3a] shadow-sm">
                  <SelectValue placeholder={t('marketplace.priceRange', 'Price Range')} />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_RANGE_OPTIONS.map((range) => (
                    <SelectItem key={range.id} value={range.id}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
                <SelectTrigger className="h-10 min-w-[180px] rounded-full border-[#ece6e2] bg-[#fbfaf9] text-xs font-semibold text-[#3a3a3a] shadow-sm">
                  <SelectValue placeholder={t('marketplace.university', 'University')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('marketplace.allUniversities', 'All Universities')}</SelectItem>
                  {universitiesList.map((university) => (
                    <SelectItem key={university.id} value={university.id}>
                      {university.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selectedCategory !== 'all' && (
              <Badge className="rounded-full bg-[#e5f6f0] px-3 py-1 text-xs font-medium text-[#1e7b5a]">
                {resolveCategoryLabel(selectedCategory)}
                <button
                  className="ml-2 rounded-full p-0.5 hover:bg-white/60"
                  onClick={() => setSelectedCategory('all')}
                  aria-label="Clear category"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedUniversity !== 'all' && (
              <Badge className="rounded-full bg-[#e5f6f0] px-3 py-1 text-xs font-medium text-[#1e7b5a]">
                {universitiesById[selectedUniversity.toLowerCase()] || selectedUniversity}
                <button
                  className="ml-2 rounded-full p-0.5 hover:bg-white/60"
                  onClick={() => setSelectedUniversity('all')}
                  aria-label="Clear university"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedPriceRange !== 'all' && (
              <Badge className="rounded-full bg-[#e5f6f0] px-3 py-1 text-xs font-medium text-[#1e7b5a]">
                {PRICE_RANGE_OPTIONS.find((range) => range.id === selectedPriceRange)?.label || selectedPriceRange}
                <button
                  className="ml-2 rounded-full p-0.5 hover:bg-white/60"
                  onClick={() => setSelectedPriceRange('all')}
                  aria-label="Clear price range"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {searchQuery && (
              <Badge className="rounded-full bg-[#e5f6f0] px-3 py-1 text-xs font-medium text-[#1e7b5a]">
                {t('marketplace.searchLabel', 'Search')}: {searchQuery}
                <button
                  className="ml-2 rounded-full p-0.5 hover:bg-white/60"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedPriceRange('all');
                  setSelectedUniversity('all');
                  setSelectedType('all');
                  setSortBy('recent');
                }}
                className="h-7 rounded-full px-3 text-xs font-semibold text-[#1e7b5a] hover:bg-[#e5f6f0]"
              >
                {t('marketplace.clearAll', 'Clear all')}
              </Button>
            )}
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#8a8a8a]">
          <span>{t('marketplace.itemsFound', '{{count}} item(s) found', { count: filteredItems.length })}</span>
          <div className="hidden items-center gap-4 text-[11px] text-[#9a9a9a] lg:flex">
            <span>{t('marketplace.forSale', 'For Sale')}: {saleCount}</span>
            <span>{t('marketplace.forRent', 'For Rent')}: {rentCount}</span>
            <span>{t('marketplace.likes', 'Likes')}: {totalVisibleLikes}</span>
          </div>
        </div>

        {filteredItems.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredItems.map((item) => {
              const seller = item.seller || null;
              const isSaved = savedItems.has(item.id);
              const primaryImage = normalizeImageUrl(item.images?.[0]);

              return (
                <Card
                  key={item.id}
                  className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-[#efe7e1] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f0ebe8]">
                    {primaryImage ? (
                      <ResilientImage
                        src={primaryImage}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        fallback={
                          <div className="flex h-full items-center justify-center text-xs text-[#8a8a8a]">
                            No image available
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8a8a8a]">
                        No image available
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveItem(item.id);
                      }}
                      className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm transition-colors hover:bg-[#ffe7ec]"
                      aria-label={isSaved ? 'Remove from favorites' : 'Save item'}
                    >
                      <Heart className={`h-4 w-4 ${isSaved ? 'fill-[#e35166] text-[#e35166]' : 'text-[#8a8a8a]'}`} />
                    </button>
                    {item.seller?.university && (
                      <Badge className="absolute left-3 bottom-3 rounded-full bg-[#111111] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                        {t('marketplace.verifiedStudent', 'Verified Student')}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="flex-1 space-y-3 p-4">
                    <h3 className="line-clamp-1 text-sm font-semibold text-[#1f1f1f]">{item.title}</h3>
                    <p className="line-clamp-2 text-xs text-[#777777]">
                      {item.description || t('marketplace.noDescription', 'No description provided.')}
                    </p>
                    <p className="text-lg font-semibold text-[#111111]">{formatCurrency(item.price)}</p>
                    <div className="flex items-center gap-2 text-xs text-[#8a8a8a]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {resolveLocationLabel(item)}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between p-4 pt-0 text-xs text-[#7a7a7a]">
                    <span className="truncate">{seller?.name || t('marketplace.unknownSeller', 'Unknown Seller')}</span>
                    <button
                      className="text-xs font-semibold text-[#1e7b5a] hover:text-[#155c44]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/item/${item.id}`);
                      }}
                    >
                      {t('marketplace.viewDetails', 'View Details')}
                    </button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-6 rounded-3xl border border-[#efe7e1] bg-white shadow-sm">
            <CardContent className="py-12 text-center">
              <Filter className="mx-auto mb-4 h-10 w-10 text-[#9a9a9a]" />
              <h3 className="mb-2 text-lg font-semibold text-[#1f1f1f]">{t('marketplace.noItems', 'No items found')}</h3>
              <p className="mx-auto mb-6 max-w-md text-sm text-[#7a7a7a]">
                {t('marketplace.tryFilters', 'Try adjusting your search or filters')}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedType('all');
                    setSortBy('recent');
                  }}
                  className="rounded-full border-[#e6e0dc] text-[#1e7b5a] hover:bg-[#e5f6f0]"
                >
                  {t('marketplace.clearFilters', 'Clear Filters')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
