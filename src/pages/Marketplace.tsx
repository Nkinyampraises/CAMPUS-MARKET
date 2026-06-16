import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import { Slider } from '@/app/components/ui/slider';
import {
  MapPin, X, SlidersHorizontal, LayoutGrid, List, GraduationCap,
  Laptop, BookOpen, Sofa, Shirt, Wrench, Package, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';

const ITEMS_PER_PAGE = 12;

const CONDITION_OPTIONS = [
  { id: 'new', label: 'New' },
  { id: 'like new', label: 'Like New' },
  { id: 'good', label: 'Good' },
];

const PRICE_SLIDER_MAX = 100000;

const categoryIcon = (name: string) => {
  const n = (name || '').toLowerCase();
  if (/electronic|tech|phone|laptop|computer/.test(n)) return Laptop;
  if (/book|textbook|stationery|study/.test(n)) return BookOpen;
  if (/furniture|sofa|chair|table|bed/.test(n)) return Sofa;
  if (/fashion|cloth|wear|apparel/.test(n)) return Shirt;
  if (/service/.test(n)) return Wrench;
  return Package;
};
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/app/components/ui/utils';
import { ProductCard } from '@/components/ProductCard';

import { API_URL } from '@/lib/api';
import { universities as mockUniversities, getUniversityById, getCategoryById } from '@/data/mockData';

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
  { id: '100-500', label: '100,000 – 500,000 FCFA', min: 100000, max: 500000 },
  { id: '500-1000', label: '500,000 – 1,000,000 FCFA', min: 500000, max: 1000000 },
  { id: '1000', label: '1,000,000+ FCFA', min: 1000000, max: Infinity },
];

// ── Marketplace ──────────────────────────────────────────────────────────────
export function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, accessToken, refreshAuthToken } = useAuth();
  const { t } = useLanguage();

  // ── State (all unchanged) ─────────────────────────────────────────────────
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

  // UI-only: mobile sidebar toggle + view mode + extra filters (match reference)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(PRICE_SLIDER_MAX);
  const [currentPage, setCurrentPage] = useState(1);
  const headerHeight = useHeaderHeight();

  // ── Sync URL params → state (unchanged) ──────────────────────────────────
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

  // ── Fetch data (unchanged) ────────────────────────────────────────────────
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
          {
            const resolved: Record<string, string> = {};
            const list: NamedOption[] = [];

            mockUniversities.forEach((uni: any) => {
              const id   = String(uni?.id || '').trim().toLowerCase();
              const name = String(uni?.name || '').trim();
              if (id && name) { resolved[id] = name; list.push({ id, name }); }
              if (name)       { resolved[name.toLowerCase()] = name; }
              if (uni?.location) { resolved[String(uni.location).toLowerCase()] = name; }
            });

            if (response.ok && Array.isArray(data.universities)) {
              data.universities.forEach((entry: any) => {
                const id   = String(entry?.id || '').trim().toLowerCase();
                const name = String(entry?.name || '').trim();
                if (id && name) {
                  resolved[id] = name;
                  if (!list.find((l) => l.id === id)) list.push({ id, name });
                }
                if (name) { resolved[name.toLowerCase()] = name; }
              });
            }

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

  // ── Label resolvers (all unchanged) ──────────────────────────────────────
  const sectionLabel = useMemo(() => {
    const raw = String(searchParams.get('section') || '').trim();
    if (!raw) return '';
    return raw
      .split(/[-_ ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [searchParams]);

  const resolveCategoryLabel = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return t('marketplace.categoryNotSpecified', 'Category not specified');
    const fromBackend = categoriesById[raw.toLowerCase()];
    if (fromBackend) return fromBackend;
    const fromMock = getCategoryById(raw);
    if (fromMock) return fromMock.name;
    if (/^\d+$/.test(raw)) return t('marketplace.categoryNotSpecified', 'Category not specified');
    return raw;
  };

  // Category options built from the categories the listings ACTUALLY use,
  // so every option returns results regardless of legacy vs backend IDs.
  const categoryOptions = useMemo(() => {
    const notSpecified = t('marketplace.categoryNotSpecified', 'Category not specified');
    const byName = new Map<string, { id: string; name: string }>();
    for (const item of listings) {
      const raw = String(item.category || '').trim();
      if (!raw) continue;
      const name = resolveCategoryLabel(raw);
      if (!name || name === notSpecified) continue;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { id: raw, name });
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, categoriesById, t]);

  const resolveUniversityLabel = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return t('marketplace.universityNotSpecified', 'University not specified');
    const fromMap = universitiesById[raw.toLowerCase()];
    if (fromMap) return fromMap;
    const fromMock = getUniversityById(raw);
    if (fromMock) return fromMock.name;
    if (/^\d+$/.test(raw) || /^(UNI|CAT|LOC|UB|UY)-[\d]+-[a-z0-9]+$/i.test(raw)) {
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
    if (!rawLocation) return t('marketplace.locationNotSpecified', 'Location not specified');
    const fromMap = universitiesById[rawLocation.toLowerCase()];
    if (fromMap) return fromMap;
    const fromMock = getUniversityById(rawLocation);
    if (fromMock) return fromMock.name;
    if (/^\d+$/.test(rawLocation) || /^(UNI|CAT|LOC|UB|UY)-[\d]+-[a-z0-9]+$/i.test(rawLocation)) {
      return t('marketplace.locationNotSpecified', 'Location not specified');
    }
    return rawLocation;
  };

  // ── Auth-retry request helper (unchanged) ─────────────────────────────────
  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
    const token = accessToken || localStorage.getItem('accessToken');
    if (!token) return { response: null as Response | null, data: { error: 'Unauthorized' } };

    const makeRequest = (authToken: string) =>
      fetch(`${API_URL}${path}`, {
        ...init,
        headers: { ...(init?.headers || {}), Authorization: `Bearer ${authToken}` },
      });

    let response = await makeRequest(token);
    let data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      const refreshed = await refreshAuthToken();
      if (!refreshed) return { response, data };
      response = await makeRequest(refreshed);
      data = await response.json().catch(() => ({}));
    }

    return { response, data };
  };

  // ── Favorites (unchanged) ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!isAuthenticated || !accessToken) { setSavedItems(new Set()); return; }
      try {
        const { response, data } = await requestWithAuthRetry('/favorites');
        if (!response.ok || !Array.isArray(data.favorites)) {
          if (response.status !== 401) toast.error(data.error || t('marketplace.failedLoadLikes', 'Failed to load liked items'));
          else setSavedItems(new Set());
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
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!accessToken) { toast.error(t('marketplace.loginToLike', 'Please login to like items')); return; }

    const wasSaved = savedItems.has(itemId);
    const endpoint = wasSaved ? `/favorites/${itemId}` : '/favorites';
    const method = wasSaved ? 'DELETE' : 'POST';

    try {
      const { response, data } = await requestWithAuthRetry(endpoint, {
        method,
        headers: { ...(wasSaved ? {} : { 'Content-Type': 'application/json' }) },
        ...(wasSaved ? {} : { body: JSON.stringify({ itemId }) }),
      });
      if (!response.ok) {
        if (response.status === 401) { toast.error(t('marketplace.loginToLike', 'Please login to like items')); navigate('/login'); }
        else toast.error(data.error || t('marketplace.failedUpdateLike', 'Failed to update like'));
        return;
      }
      setSavedItems((prev) => {
        const next = new Set(prev);
        wasSaved ? next.delete(itemId) : next.add(itemId);
        return next;
      });
      setListings((prev) =>
        prev.map((listing) => {
          if (listing.id !== itemId) return listing;
          const apiLikes = Number(data?.likesCount);
          const fallback = wasSaved ? Math.max(0, toCount(listing.likesCount) - 1) : toCount(listing.likesCount) + 1;
          return { ...listing, likesCount: Number.isFinite(apiLikes) ? Math.max(0, Math.floor(apiLikes)) : fallback };
        }),
      );
    } catch {
      toast.error(t('marketplace.failedUpdateLike', 'Failed to update like'));
    }
  };

  // ── Filtering & sorting (unchanged) ──────────────────────────────────────
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

    if (selectedConditions.size > 0) {
      filtered = filtered.filter((item) =>
        selectedConditions.has(String(item.condition || '').trim().toLowerCase()),
      );
    }

    if (verifiedOnly) {
      filtered = filtered.filter((item) => Boolean(item.seller?.isVerified || item.seller?.university));
    }

    if (maxPrice < PRICE_SLIDER_MAX) {
      filtered = filtered.filter((item) => Number(item.price || 0) <= maxPrice);
    }

    if (sortBy === 'price-low') filtered = filtered.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sortBy === 'price-high') filtered = filtered.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sortBy === 'recent') filtered = filtered.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return filtered;
  }, [searchQuery, selectedCategory, selectedType, selectedPriceRange, selectedUniversity, selectedConditions, verifiedOnly, maxPrice, sortBy, listings, categoriesById, universitiesById, t]);

  const saleCount  = useMemo(() => filteredItems.filter((item) => item.type === 'sell').length, [filteredItems]);
  const rentCount  = useMemo(() => filteredItems.filter((item) => item.type === 'rent').length, [filteredItems]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pagedItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredItems, currentPage],
  );
  // Reset to first page whenever the result set changes (filters / search / sort)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedType, selectedPriceRange, selectedUniversity, selectedConditions, verifiedOnly, maxPrice, sortBy]);
  // Keep the current page valid if the list shrinks
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const window = 1; // pages to show either side of current
    for (let p = 1; p <= totalPages; p += 1) {
      if (p === 1 || p === totalPages || (p >= currentPage - window && p <= currentPage + window)) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis');
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory !== 'all' || selectedType !== 'all' ||
    selectedPriceRange !== 'all' || selectedUniversity !== 'all' || sortBy !== 'recent' ||
    selectedConditions.size > 0 || verifiedOnly || maxPrice < PRICE_SLIDER_MAX,
  );

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedPriceRange('all');
    setSelectedUniversity('all');
    setSelectedType('all');
    setSortBy('recent');
    setSelectedConditions(new Set());
    setVerifiedOnly(false);
    setMaxPrice(PRICE_SLIDER_MAX);
  };

  const toggleCondition = (id: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Sidebar inner content (forest green — consistent with dashboards) ──────
  const SidebarContent = () => (
    <div className="flex flex-col text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-lg font-bold text-sidebar-foreground">
          {t('marketplace.filters', 'Filters')}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-sidebar-primary-foreground hover:text-white"
          >
            {t('marketplace.resetAll', 'Reset all')}
          </button>
        )}
      </div>

      <div className="space-y-5 px-5 pb-5 pt-4">
        {/* University */}
        <div>
          <p className="mb-2 text-sm font-bold text-sidebar-foreground">
            {t('marketplace.university', 'University')}
          </p>
          <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
            <SelectTrigger className="h-10 rounded-xl border-white/15 bg-white/10 text-sm text-sidebar-foreground">
              <span className="flex items-center gap-2 truncate">
                <GraduationCap className="h-4 w-4 shrink-0 text-sidebar-primary-foreground" />
                <SelectValue placeholder={t('marketplace.allUniversities', 'All Universities')} />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('marketplace.allUniversities', 'All Universities')}</SelectItem>
              {universitiesList.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categories */}
        <div>
          <p className="mb-2 text-sm font-bold text-sidebar-foreground">
            {t('marketplace.categories', 'Categories')}
          </p>
          <div className="space-y-1">
            {categoryOptions.map((cat) => {
              const Icon = categoryIcon(cat.name);
              const checked = selectedCategory === cat.id;
              return (
                <label
                  key={cat.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/10"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => setSelectedCategory(checked ? 'all' : cat.id)}
                    className="border-white/40 data-[state=checked]:border-sidebar-primary-foreground data-[state=checked]:bg-sidebar-primary-foreground data-[state=checked]:text-sidebar"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
                  <span className="truncate text-sm text-sidebar-foreground/90">{cat.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Listing Type (segmented All / Buy / Rent) */}
        <div>
          <p className="mb-2 text-sm font-bold text-sidebar-foreground">
            {t('marketplace.listingType', 'Listing Type')}
          </p>
          <div className="flex gap-1 rounded-xl bg-white/10 p-1">
            {[
              { value: 'all', label: t('marketplace.all', 'All') },
              { value: 'sell', label: t('marketplace.buy', 'Buy') },
              { value: 'rent', label: t('marketplace.rent', 'Rent') },
            ].map(({ value, label }) => {
              const active = selectedType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedType(value)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-bold transition-all duration-150',
                    active
                      ? 'bg-sidebar-primary-foreground text-forest shadow-sm'
                      : 'text-sidebar-foreground/70 hover:text-white',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition */}
        <div>
          <p className="mb-2 text-sm font-bold text-sidebar-foreground">
            {t('marketplace.condition', 'Condition')}
          </p>
          <div className="space-y-1">
            {CONDITION_OPTIONS.map((opt) => {
              const checked = selectedConditions.has(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/10"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCondition(opt.id)}
                    className="border-white/40 data-[state=checked]:border-sidebar-primary-foreground data-[state=checked]:bg-sidebar-primary-foreground data-[state=checked]:text-sidebar"
                  />
                  <span className="text-sm text-sidebar-foreground/90">
                    {t(`marketplace.condition_${opt.id.replace(/\s/g, '_')}`, opt.label)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Price Range slider */}
        <div>
          <p className="mb-3 text-sm font-bold text-sidebar-foreground">
            {t('marketplace.priceRangeFcfa', 'Price Range (FCFA)')}
          </p>
          <Slider
            value={[maxPrice]}
            min={0}
            max={PRICE_SLIDER_MAX}
            step={5000}
            onValueChange={(value) => setMaxPrice(value[0])}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-sidebar-foreground/70">
            <span>0</span>
            <span>
              {maxPrice >= PRICE_SLIDER_MAX
                ? '100,000+'
                : new Intl.NumberFormat('en-US').format(maxPrice)}
            </span>
          </div>
        </div>

        {/* Verified Students Only */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-sidebar-foreground">
            {t('marketplace.verifiedStudentsOnly', 'Verified Students Only')}
          </span>
          <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
        </div>

        {/* Apply Filters */}
        <Button
          className="w-full bg-sidebar-primary-foreground font-bold text-forest hover:bg-white"
          onClick={() => setSidebarOpen(false)}
        >
          {t('marketplace.applyFilters', 'Apply Filters')}
        </Button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex gap-6">

          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ── Sidebar (white card) ─────────────────────────────────────── */}
          <aside
            className={cn(
              'z-50 transition-transform duration-300 ease-in-out',
              'fixed inset-y-0 left-0 w-80',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
              // Desktop: sits below the sticky header (lower z so it never covers the navbar)
              'lg:relative lg:inset-auto lg:z-30 lg:w-72 lg:shrink-0 lg:translate-x-0',
            )}
          >
            <div
              className="h-full overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:h-auto lg:overflow-visible lg:rounded-2xl lg:border lg:shadow-card"
              style={{ top: headerHeight + 16 }}
            >
              {/* Mobile close button */}
              <div className="flex items-center justify-between border-b border-sidebar-border p-4 lg:hidden">
                <span className="text-sm font-bold text-sidebar-foreground">
                  {t('marketplace.filters', 'Filters')}
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-full p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent />
            </div>
          </aside>

          {/* ── Results area ─────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1">

            {/* Results header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile filter toggle */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-2 rounded-xl border-border bg-card text-xs font-semibold text-primary transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground lg:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {t('marketplace.filters', 'Filters')}
                  {hasActiveFilters && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      !
                    </span>
                  )}
                </Button>

                {/* Results count */}
                <p className="text-base font-bold text-foreground">
                  {filteredItems.length} {t('marketplace.results', 'results')}
                  {searchQuery && (
                    <span className="font-normal text-muted-foreground">
                      {' '}{t('marketplace.for', 'for')}{' '}
                      <span className="font-semibold text-foreground">"{searchQuery}"</span>
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort by */}
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
                    {t('marketplace.sortBy', 'Sort by')}
                  </span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 w-40 rounded-xl border-border bg-card text-xs font-semibold text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">{t('marketplace.recent', 'Newest')}</SelectItem>
                      <SelectItem value="price-low">{t('marketplace.priceLow', 'Price: Low to High')}</SelectItem>
                      <SelectItem value="price-high">{t('marketplace.priceHigh', 'Price: High to Low')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* View toggle */}
                <div className="hidden items-center gap-1 rounded-xl border border-border bg-card p-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                      viewMode === 'grid'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                      viewMode === 'list'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Product grid ──────────────────────────────────────────── */}
            {filteredItems.length > 0 ? (
              <>
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid grid-cols-1 gap-4 sm:grid-cols-2',
                )}
              >
                {pagedItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    isSaved={savedItems.has(item.id)}
                    onSave={handleSaveItem}
                    onNavigate={() => navigate(`/item/${item.id}`)}
                    t={t}
                    formatCurrency={formatCurrency}
                    resolveLocationLabel={resolveLocationLabel}
                    variant="market"
                  />
                ))}
              </div>

              {/* ── Pagination ───────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          'flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors',
                          p === currentPage
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'border border-border bg-card text-foreground hover:border-primary hover:text-primary',
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              </>
            ) : (
              /* ── Empty state ─────────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
                  <SlidersHorizontal className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-foreground">
                  {t('marketplace.noItems', 'No items found')}
                </h3>
                <p className="mb-6 max-w-xs text-sm text-muted-foreground">
                  {t('marketplace.tryFilters', 'Try adjusting your search or filters to find what you\'re looking for.')}
                </p>
                {hasActiveFilters && (
                  <Button type="button" onClick={clearAllFilters} className="px-6">
                    {t('marketplace.clearFilters', 'Clear all filters')}
                  </Button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
