import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import {
  ArrowRight,
  Check,
  ChevronRight,
  MapPin,
  Sparkles,
  Star,
  ShieldCheck,
  CreditCard,
  Users,
  Utensils,
  Home as HomeIcon,
  Laptop,
  Armchair,
  BedDouble,
  BookOpen,
  Shirt,
  Sofa,
  Headphones,
} from 'lucide-react';

// ── Category icon + pastel tint mapping (matches reference design) ──
const CATEGORY_STYLES = [
  { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  { bg: 'bg-sky-50', fg: 'text-sky-600' },
  { bg: 'bg-teal-50', fg: 'text-teal-600' },
  { bg: 'bg-amber-50', fg: 'text-amber-600' },
  { bg: 'bg-indigo-50', fg: 'text-indigo-600' },
  { bg: 'bg-rose-50', fg: 'text-rose-600' },
];

const categoryIcon = (name: string) => {
  const n = (name || '').toLowerCase();
  if (/kitchen|utensil|cook/.test(n)) return Utensils;
  if (/home|decor|living/.test(n)) return HomeIcon;
  if (/electronic|tech|phone|laptop|computer|audio|headphone/.test(n)) return Laptop;
  if (/table|chair|desk/.test(n)) return Armchair;
  if (/bed|mattress/.test(n)) return BedDouble;
  if (/study|book|stationery/.test(n)) return BookOpen;
  if (/fashion|cloth|wear|apparel/.test(n)) return Shirt;
  if (/furniture|sofa|couch/.test(n)) return Sofa;
  return Headphones;
};

const looksLikeId = (value?: string) =>
  !value || /^(UNI|CAT|LOC|UB|UY)-[\d]+-[a-z0-9]+$/i.test(value) || /^\d+$/.test(value);
import { getCategoryById, getUniversityById } from '@/data/mockData';
import { API_URL, resolveClientAssetUrl } from '@/lib/api';
import verifiedSellerPhoto from '@/assets/image/studentpic.jpeg';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductCard } from '@/components/ProductCard';
import { cn } from '@/app/components/ui/utils';

type MarketplaceRouteFilters = {
  category?: string;
  q?: string;
  section?: string;
  sort?: 'recent' | 'price-low' | 'price-high';
  type?: 'sell' | 'rent';
};

type Listing = {
  id: string;
  title: string;
  description?: string;
  price?: number;
  category: string;
  type: 'sell' | 'rent';
  status?: string;
  createdAt?: string;
  views?: number;
  likesCount?: number;
  images?: string[];
};

type CategoryEntry = {
  id: string;
  name: string;
};

type TopSeller = {
  id: string;
  name: string;
  university?: string;
  rating: number;
  reviewCount: number;
  profilePicture?: string;
  sales: number;
};

type GridTile = {
  id: string;
  image: string;
  label: string;
  filters: MarketplaceRouteFilters;
};

type CategoryShowcaseCard = {
  id: string;
  categoryId: string;
  title: string;
  items: GridTile[];
  linkLabel: string;
  variant?: 'standard' | 'tiles-only';
};

type ProductRail = {
  id: string;
  title: string;
  subtitle: string;
  filters: MarketplaceRouteFilters;
  items: GridTile[];
};

const FEATURE_ROTATION_MS = 4500;
const HOME_REFRESH_MS = 20000;
const TILES_PER_PANEL = 4;
const ITEMS_PER_RAIL = 6;
const SHOWCASE_CATEGORY_COUNT = 7;
// Portrait used on the "Become a verified student seller" card.
// Sourced from src/assets/image/studentpic.jpeg — swap that file to change it.
const VERIFIED_SELLER_IMAGE = verifiedSellerPhoto;
const HOME_DECOR_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800',
  'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800',
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800',
];

const buildMarketplaceUrl = (filters: MarketplaceRouteFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.category) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  if (filters.section) params.set('section', filters.section);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.type) params.set('type', filters.type);

  const query = params.toString();
  return query ? `/marketplace?${query}` : '/marketplace';
};

const formatPrice = (value?: number) => {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const toCount = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

const byRecent = (left: Listing, right: Listing) =>
  String(right.createdAt || '').localeCompare(String(left.createdAt || ''));

const byTrending = (left: Listing, right: Listing) => {
  const leftScore = toCount(left.likesCount) + toCount(left.views);
  const rightScore = toCount(right.likesCount) + toCount(right.views);
  if (rightScore !== leftScore) return rightScore - leftScore;
  return byRecent(left, right);
};

const uniqueById = (items: Listing[]) => {
  const seen = new Set<string>();
  const result: Listing[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
};

const getFirstImage = (listing: Listing) => {
  const first = Array.isArray(listing.images) ? listing.images.find((image) => typeof image === 'string' && image.trim()) : '';
  return first || '';
};

const toTile = (listing: Listing, sectionId: string): GridTile => ({
  id: `${sectionId}-${listing.id}`,
  image: getFirstImage(listing),
  label: listing.title || 'Listing',
  filters: {
    category: String(listing.category || '').trim() || undefined,
    section: sectionId,
  },
});

const toRailTile = (listing: Listing, sectionId: string): GridTile => ({
  id: `${sectionId}-${listing.id}`,
  image: getFirstImage(listing),
  label: listing.title || 'Listing',
  filters: {
    category: String(listing.category || '').trim() || undefined,
    section: sectionId,
  },
});

export function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [topSellersData, setTopSellersData] = useState<TopSeller[]>([]);
  const [universitiesById, setUniversitiesById] = useState<Record<string, string>>({});
  const [featureTick, setFeatureTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const openMarketplace = (filters: MarketplaceRouteFilters = {}) => {
    navigate(buildMarketplaceUrl(filters));
  };

  // Resolve university id/name → readable university name (for product cards)
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/universities`)
      .then((r) => r.json())
      .catch(() => ({}))
      .then((data) => {
        if (!active) return;
        const map: Record<string, string> = {};
        if (Array.isArray(data?.universities)) {
          for (const u of data.universities) {
            if (u?.id && u?.name) {
              map[String(u.id).toLowerCase()] = u.name;
              map[String(u.name).toLowerCase()] = u.name;
            }
          }
        }
        setUniversitiesById(map);
      });
    return () => {
      active = false;
    };
  }, []);

  const resolveUniversityLabel = useCallback(
    (value?: string) => {
      const raw = String(value || '').trim();
      if (!raw) return t('home.onCampus', 'UNITRADE');
      const fromDb = universitiesById[raw.toLowerCase()];
      if (fromDb) return fromDb;
      const fromMock = getUniversityById(raw);
      if (fromMock) return fromMock.name;
      if (looksLikeId(raw)) return t('home.onCampus', 'UNITRADE');
      return raw;
    },
    [universitiesById, t],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async (silent = false) => {
      if (!silent && isMounted) {
        setLoading(true);
      }

      try {
        const [listingsResult, categoriesResult, topSellersResult] = await Promise.allSettled([
          fetch(`${API_URL}/listings`),
          fetch(`${API_URL}/categories`),
          fetch(`${API_URL}/top-sellers`),
        ]);

        if (listingsResult.status === 'fulfilled') {
          const response = listingsResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.listings)) {
            if (isMounted) setListings(data.listings);
          } else if (!silent) {
            if (isMounted) setListings([]);
            toast.error(data.details || data.error || t('home.failedLoadListings', 'Failed to load home listings'));
          }
        } else if (!silent) {
          if (isMounted) setListings([]);
          toast.error(t('home.unableReachListings', 'Unable to reach listings service'));
        }

        if (categoriesResult.status === 'fulfilled') {
          const response = categoriesResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.categories)) {
            const normalized = data.categories
              .map((entry: any) => ({
                id: String(entry?.id || '').trim(),
                name: String(entry?.name || '').trim(),
              }))
              .filter((entry: CategoryEntry) => entry.id && entry.name);
            if (isMounted) setCategories(normalized);
          }
        }

        if (topSellersResult.status === 'fulfilled') {
          const response = topSellersResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.sellers)) {
            const normalized: TopSeller[] = data.sellers
              .map((entry: any) => ({
                id: String(entry?.id || '').trim(),
                name: String(entry?.name || '').trim(),
                university: typeof entry?.university === 'string' ? entry.university : entry?.university?.name,
                rating: Number(entry?.rating) || 0,
                reviewCount: Number(entry?.reviewCount) || 0,
                profilePicture: entry?.profilePicture || '',
                sales: Number(entry?.sales) || 0,
              }))
              .filter((entry: TopSeller) => entry.name);
            if (isMounted) setTopSellersData(normalized);
          }
        }
      } catch {
        if (!silent) {
          if (isMounted) setListings([]);
          toast.error(t('home.unableLoadData', 'Unable to load home data'));
        }
      } finally {
        if (!silent && isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHomeData();
    const timer = setInterval(() => fetchHomeData(true), HOME_REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [t]);

  useEffect(() => {
    const timer = setInterval(() => setFeatureTick((value) => value + 1), FEATURE_ROTATION_MS);
    return () => clearInterval(timer);
  }, []);

  const categoryNameById = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const category of categories) {
      mapping[category.id] = category.name;
    }
    return mapping;
  }, [categories]);

  const availableListings = useMemo(
    () =>
      listings
        .filter((listing) => listing?.id && (listing.status === 'available' || !listing.status))
        .sort(byRecent),
    [listings],
  );

  const groupedByCategory = useMemo(() => {
    const grouped = new Map<string, Listing[]>();
    for (const listing of availableListings) {
      const categoryId = String(listing.category || '').trim();
      if (!categoryId) continue;
      const existing = grouped.get(categoryId) || [];
      existing.push(listing);
      grouped.set(categoryId, existing);
    }
    return grouped;
  }, [availableListings]);

  const categoriesBySize = useMemo(
    () => Array.from(groupedByCategory.entries()).sort((left, right) => right[1].length - left[1].length),
    [groupedByCategory],
  );

  const quickCategories = useMemo(
    () =>
      categoriesBySize.slice(0, 6).map(([categoryId]) => ({
        id: categoryId,
        name: categoryNameById[categoryId] || getCategoryById(categoryId)?.name || `Category ${categoryId}`,
      })),
    [categoriesBySize, categoryNameById],
  );

  const rentalsNearYou = useMemo(
    () => availableListings.filter((listing) => listing.type === 'rent'),
    [availableListings],
  );

  const recommendedForYou = useMemo(
    () => availableListings.slice().sort(byTrending),
    [availableListings],
  );

  const fallbackFeatureImages = useMemo(() => {
    const images = uniqueById(availableListings)
      .map((listing) => getFirstImage(listing))
      .filter(Boolean);
    return images;
  }, [availableListings]);

  const rentalsFeatureImages = useMemo(() => {
    const images = uniqueById(rentalsNearYou)
      .map((listing) => getFirstImage(listing))
      .filter(Boolean);
    return images.length > 0 ? images : fallbackFeatureImages;
  }, [fallbackFeatureImages, rentalsNearYou]);

  const recommendedFeatureImages = useMemo(() => {
    const images = uniqueById(recommendedForYou)
      .map((listing) => getFirstImage(listing))
      .filter(Boolean);
    return images.length > 0 ? images : fallbackFeatureImages;
  }, [fallbackFeatureImages, recommendedForYou]);

  const homeDecorCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of categories) {
      const name = String(category.name || '').toLowerCase();
      if (name.includes('decor') || (name.includes('home') && name.includes('decor'))) {
        ids.add(category.id);
      }
    }
    if (ids.size === 0) {
      const fallback = getCategoryById('6');
      if (fallback?.id) ids.add(fallback.id);
    }
    return Array.from(ids);
  }, [categories]);

  const homeDecorImages = useMemo(() => {
    const categorySet = new Set(homeDecorCategoryIds);
    const images = uniqueById(availableListings)
      .filter((listing) => categorySet.has(String(listing.category || '').trim()))
      .map((listing) => getFirstImage(listing))
      .filter(Boolean);
    const merged = [...images, ...HOME_DECOR_FALLBACK_IMAGES].filter(Boolean);
    return merged.length > 0 ? merged : HOME_DECOR_FALLBACK_IMAGES;
  }, [availableListings, homeDecorCategoryIds]);

  const getHomeDecorImage = useCallback(
    (index: number) => homeDecorImages[index % homeDecorImages.length] || '',
    [homeDecorImages],
  );

  const categoryShowcaseCards = useMemo(() => {
    const labels = [
      t('home.exploreThisCategory', 'Explore this category'),
      t('home.exploreAllProducts', 'Explore all products'),
      t('home.exploreMore', 'Explore more'),
      t('home.shopThisCategory', 'Shop this category'),
      t('home.browseLatestPicks', 'Browse latest picks'),
      t('home.seeCategoryItems', 'See category items'),
      t('home.discoverMore', 'Discover more'),
    ];

    const buildDecorFallbackTiles = (sectionId: string, count: number, startIndex: number): GridTile[] => {
      const decorCategoryId = homeDecorCategoryIds[0];
      return Array.from({ length: count }).map((_, index) => {
        const imageIndex = startIndex + index;
        const filters: MarketplaceRouteFilters = { section: sectionId };
        if (decorCategoryId) {
          filters.category = decorCategoryId;
        } else {
          filters.q = 'home decor';
        }
        return {
          id: `${sectionId}-home-decor-${imageIndex}`,
          image: getHomeDecorImage(imageIndex),
          label: t('home.homeDecorPick', 'Home decor pick'),
          filters,
        };
      });
    };

    const baseCards = categoriesBySize
      .slice(0, SHOWCASE_CATEGORY_COUNT)
      .map(([categoryId, entries], index): CategoryShowcaseCard => {
        const categoryName = categoryNameById[categoryId] || getCategoryById(categoryId)?.name || `Category ${index + 1}`;
        const sectionId = `category-showcase-${categoryId}`;
        const latestItems = entries.slice(0, TILES_PER_PANEL).map((listing) => toTile(listing, sectionId));
        const filledItems = latestItems.length < TILES_PER_PANEL
          ? [
              ...latestItems,
              ...buildDecorFallbackTiles(sectionId, TILES_PER_PANEL - latestItems.length, latestItems.length),
            ]
          : latestItems;

        return {
          id: sectionId,
          categoryId,
          title: categoryName,
          items: filledItems,
          linkLabel: `${labels[index % labels.length]} ${t('home.inCategory', 'in')} ${categoryName}`,
        };
      });

    const decorCategoryId = homeDecorCategoryIds[0];
    const decorCategoryName =
      (decorCategoryId && (categoryNameById[decorCategoryId] || getCategoryById(decorCategoryId)?.name)) ||
      t('home.homeDecorLabel', 'Home Decor');
    const columnsAtXl = 4;
    const remainder = baseCards.length % columnsAtXl;
    const fillerCount = baseCards.length > 0 && remainder !== 0 ? columnsAtXl - remainder : 0;
    const fillerCards: CategoryShowcaseCard[] = Array.from({ length: fillerCount }).map((_, index) => {
      const sectionId = `home-decor-fill-${index + 1}`;
      const items = buildDecorFallbackTiles(sectionId, TILES_PER_PANEL, index * TILES_PER_PANEL);
      return {
        id: sectionId,
        categoryId: decorCategoryId || getCategoryById('6')?.id || '',
        title: decorCategoryName,
        items,
        linkLabel: `${t('home.shopThisCategory', 'Shop this category')} ${t('home.inCategory', 'in')} ${decorCategoryName}`,
        variant: 'tiles-only',
      };
    });

    return [...baseCards, ...fillerCards];
  }, [categoriesBySize, categoryNameById, getHomeDecorImage, homeDecorCategoryIds, t]);

  const electronicsRail = useMemo(() => {
    const electronicsCategories = categoriesBySize
      .map(([categoryId]) => categoryId)
      .filter((categoryId) => {
        const name = (categoryNameById[categoryId] || getCategoryById(categoryId)?.name || '').toLowerCase();
        return (
          name.includes('electronic') ||
          name.includes('tech') ||
          name.includes('computer') ||
          name.includes('accessories')
        );
      });

    const source = electronicsCategories.length > 0
      ? uniqueById(
          electronicsCategories.flatMap((categoryId) => groupedByCategory.get(categoryId) || []),
        ).sort(byTrending)
      : recommendedForYou;

    return source.slice(0, ITEMS_PER_RAIL);
  }, [categoriesBySize, categoryNameById, groupedByCategory, recommendedForYou]);

  const rentalsRail = useMemo(
    () => uniqueById(rentalsNearYou).slice(0, ITEMS_PER_RAIL),
    [rentalsNearYou],
  );

  const homeKitchenRail = useMemo(() => {
    const homeKitchenCategories = categoriesBySize
      .map(([categoryId]) => categoryId)
      .filter((categoryId) => {
        const name = (categoryNameById[categoryId] || getCategoryById(categoryId)?.name || '').toLowerCase();
        return (
          name.includes('home') ||
          name.includes('kitchen') ||
          name.includes('decor') ||
          name.includes('bed') ||
          name.includes('table')
        );
      });

    const source = homeKitchenCategories.length > 0
      ? uniqueById(
          homeKitchenCategories.flatMap((categoryId) => groupedByCategory.get(categoryId) || []),
        ).sort(byTrending)
      : availableListings;

    return source.slice(0, ITEMS_PER_RAIL);
  }, [availableListings, categoriesBySize, categoryNameById, groupedByCategory]);

  const productRails: ProductRail[] = useMemo(
    () => [
      {
        id: 'best-sellers-campus-electronics',
        title: t('home.bestSellersCampusElectronics', 'Best Sellers in UNITRADE Electronics'),
        subtitle: t('home.bestSellersCampusElectronicsSub', 'Most viewed electronics from nearby universities.'),
        filters: { section: 'best-sellers-campus-electronics' },
        items: electronicsRail.map((listing) => toRailTile(listing, 'best-sellers-campus-electronics')),
      },
      {
        id: 'popular-rentals-this-week',
        title: t('home.popularRentalsThisWeek', 'Popular rentals this week'),
        subtitle: t('home.popularRentalsThisWeekSub', 'Flexible rental options for semester life.'),
        filters: { section: 'popular-rentals-this-week', type: 'rent' },
        items: rentalsRail.map((listing) => toRailTile(listing, 'popular-rentals-this-week')),
      },
      {
        id: 'best-sellers-home-kitchen',
        title: t('home.bestSellersHomeKitchen', 'Best Sellers in Home & Kitchen'),
        subtitle: t('home.bestSellersHomeKitchenSub', 'Everyday household picks for shared apartments.'),
        filters: { section: 'best-sellers-home-kitchen' },
        items: homeKitchenRail.map((listing) => toRailTile(listing, 'best-sellers-home-kitchen')),
      },
    ].filter((rail) => rail.items.length > 0),
    [electronicsRail, homeKitchenRail, rentalsRail, t],
  );

  const getFeatureImage = (images: string[], position: number) => {
    if (!images.length) return '';
    return images[(featureTick + position) % images.length];
  };

  const heroSlides = useMemo(
    () => [
      {
        id: 'hero-student-deals',
        title: t('home.amazonHero1Title', 'UNITRADE deals worth checking today'),
        subtitle: t(
          'home.amazonHero1Subtitle',
          'Shop the most saved listings from students around your university community.',
        ),
        image: getFeatureImage(recommendedFeatureImages, 0) || getHomeDecorImage(0),
        filters: { section: 'hero-student-deals', sort: 'recent' } as MarketplaceRouteFilters,
        cta: t('home.amazonHero1Cta', 'Shop now'),
      },
      {
        id: 'hero-rentals-picks',
        title: t('home.amazonHero2Title', 'Flexible rentals for semester life'),
        subtitle: t(
          'home.amazonHero2Subtitle',
          'From appliances to furniture, discover short-term rentals nearby.',
        ),
        image: getFeatureImage(rentalsFeatureImages, 0) || getHomeDecorImage(1),
        filters: { section: 'hero-rentals-picks', type: 'rent', sort: 'recent' } as MarketplaceRouteFilters,
        cta: t('home.amazonHero2Cta', 'Browse rentals'),
      },
      {
        id: 'hero-dorm-upgrades',
        title: t('home.amazonHero3Title', 'Upgrade your room with trusted picks'),
        subtitle: t(
          'home.amazonHero3Subtitle',
          'Find electronics, decor, and study essentials from verified UNITRADE sellers.',
        ),
        image: getHomeDecorImage(2),
        filters: { section: 'hero-dorm-upgrades' } as MarketplaceRouteFilters,
        cta: t('home.amazonHero3Cta', 'See trending picks'),
      },
    ],
    [getFeatureImage, getHomeDecorImage, recommendedFeatureImages, rentalsFeatureImages, t],
  );

  const activeHeroSlide = heroSlides[featureTick % heroSlides.length];
  const topShowcaseCards = categoryShowcaseCards.slice(0, 4);
  const lowerShowcaseCards = categoryShowcaseCards.slice(4, 8);
  const railTop = productRails[0];
  const railBottom = productRails.slice(1);

  const spotlightListing = useMemo(() => {
    if (recommendedForYou.length > 0) {
      return recommendedForYou[featureTick % recommendedForYou.length];
    }
    return availableListings[0];
  }, [availableListings, featureTick, recommendedForYou]);

  const spotlightPrice = spotlightListing?.price ? formatPrice(spotlightListing.price) : null;

  const popularListings = useMemo(
    () => recommendedForYou.slice(0, ITEMS_PER_RAIL),
    [recommendedForYou],
  );

  const bestSellerRows = useMemo(
    () => recommendedForYou.slice(0, 4),
    [recommendedForYou],
  );

  const bestSellers = useMemo(() => {
    // Prefer real completed-sales data from the backend leaderboard.
    if (topSellersData.length > 0) {
      return topSellersData
        .slice(0, 4)
        .map((s) => ({
          name: s.name,
          university: s.university,
          rating: s.rating,
          reviewCount: s.reviewCount,
          avatar: s.profilePicture || '',
          sales: s.sales,
        }));
    }

    // Fallback (before sales data exists): rank sellers by their live listing count.
    const map = new Map<
      string,
      { name: string; university?: string; rating: number; reviewCount: number; avatar?: string; sales: number }
    >();
    for (const listing of availableListings) {
      const s: any = (listing as any).seller;
      if (!s?.name) continue;
      const key = String(s.id || s.name);
      const existing =
        map.get(key) || {
          name: String(s.name),
          university: typeof s.university === 'string' ? s.university : s.university?.name,
          rating: Number(s.rating) || 0,
          reviewCount: Number(s.reviewCount) || 0,
          avatar: s.profilePicture || s.avatar || '',
          sales: 0,
        };
      existing.sales += 1;
      map.set(key, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.sales - a.sales)
      .slice(0, 4);
  }, [topSellersData, availableListings]);

  const categoryCount = useCallback(
    (id: string) => (groupedByCategory.get(id) || []).length,
    [groupedByCategory],
  );

  const collageImages = useMemo(() => {
    const imgs = uniqueById(availableListings).map(getFirstImage).filter(Boolean);
    return [...imgs, ...HOME_DECOR_FALLBACK_IMAGES].filter(Boolean).slice(0, 30);
  }, [availableListings]);

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] space-y-10 px-4 py-6 sm:px-6 lg:py-10">
        {/* ── Hero row ── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Left: mint marketing card */}
          <article className="animate-fade-up sheen relative isolate flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-soft via-primary-soft to-[#DDF0E4] p-6 sm:p-8">
            {/* Decorative depth */}
            <div className="pointer-events-none absolute -right-12 -top-12 -z-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 right-1/4 -z-10 h-36 w-36 rounded-full bg-[var(--teal)]/10 blur-3xl" />
            <span className="relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary shadow-sm">
              <Sparkles className="h-3 w-3" />
              {t('home.welcomeToUnitrade', 'Welcome to UNITRADE')}
            </span>
            <h1 className="mt-4 max-w-md text-2xl font-extrabold leading-[1.1] text-foreground sm:text-[2.1rem]">
              {t('home.heroTitlePart1', 'UNITRADE deals')}{' '}
              <span className="text-primary">{t('home.heroTitlePart2', 'worth checking')}</span>{' '}
              {t('home.heroTitlePart3', 'today')}
            </h1>
            <p className="mt-2.5 max-w-sm text-sm text-muted-foreground">
              {t('home.heroSubtitle', 'Buy and sell safely with students from your university community.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => openMarketplace({ section: 'hero-student-deals', sort: 'recent' })}>
                {t('home.shopNow', 'Shop now')}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="bg-card" onClick={() => navigate('/add-listing')}>
                {t('home.sellItem', 'Sell item')}
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-primary/10 pt-5">
              {[
                { icon: ShieldCheck, title: t('home.trustVerifiedTitle', 'Verified Students'), sub: t('home.trustVerifiedSub', '100% verified') },
                { icon: CreditCard, title: t('home.trustSecureTitle', 'Secure Payments'), sub: t('home.trustSecureSub', 'Safe & protected') },
                { icon: Users, title: t('home.trustCommunityTitle', 'University Community'), sub: t('home.trustCommunitySub', 'Trusted network') },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-foreground">{title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Right: lifestyle image card with overlay */}
          <article
            className="animate-fade-up group relative min-h-[230px] overflow-hidden rounded-2xl border border-border bg-card shadow-card"
            style={{ animationDelay: '0.12s' }}
          >
            {activeHeroSlide.image ? (
              <img
                src={activeHeroSlide.image}
                alt={activeHeroSlide.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-accent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
            <div className="relative flex h-full flex-col justify-center p-6 sm:p-8">
              <h2 className="max-w-[210px] text-lg font-extrabold uppercase leading-tight tracking-wide text-white sm:text-xl">
                {t('home.nextFavoriteTitle', 'Your next favorite item is here')}
              </h2>
              <p className="mt-2 max-w-[230px] text-xs text-white/85 sm:text-sm">
                {t('home.nextFavoriteSub', 'From electronics to home essentials, find it all on UNITRADE.')}
              </p>
              <div className="mt-4">
                <Button onClick={() => openMarketplace({ section: 'hero-explore', sort: 'recent' })}>
                  {t('home.exploreMarketplace', 'Explore marketplace')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                {heroSlides.map((slide, index) => (
                  <span
                    key={slide.id}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      index === featureTick % heroSlides.length ? 'w-5 bg-primary' : 'w-1.5 bg-white/60',
                    )}
                  />
                ))}
              </div>
            </div>
          </article>
        </section>

        {/* ── Browse by category ── */}
        {quickCategories.length > 0 && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                {t('home.browseByCategory', 'Browse by category')}
              </h2>
              <button
                type="button"
                onClick={() => openMarketplace({ section: 'quick-categories' })}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-strong hover:underline"
              >
                {t('home.seeAllCategories', 'See all categories')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {quickCategories.map((category, index) => {
                const Icon = categoryIcon(category.name);
                const style = CATEGORY_STYLES[index % CATEGORY_STYLES.length];
                const count = categoryCount(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => openMarketplace({ section: 'quick-categories', category: category.id })}
                    className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-5 text-center shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-elevated"
                  >
                    <span className={cn('flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110', style.bg, style.fg)}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="line-clamp-1 text-sm font-bold text-foreground">{category.name}</span>
                    <span className="text-xs font-medium text-primary">
                      {count > 0 ? `${count}+ ${t('home.items', 'items')}` : t('home.browse', 'Browse')}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Popular on campus (mint panel) ── */}
        {popularListings.length > 0 && (
          <section className="rounded-3xl bg-primary-soft p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                {t('home.popularOnCampus', 'Popular on UNITRADE')}
              </h2>
              <button
                type="button"
                onClick={() => openMarketplace({ section: 'popular-on-campus', sort: 'recent' })}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {t('home.seeAllDeals', 'See all deals')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {popularListings.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  isSaved={false}
                  onSave={() => {}}
                  onNavigate={() =>
                    openMarketplace({
                      section: 'popular-on-campus',
                      category: String(item.category || '').trim() || undefined,
                    })
                  }
                  t={t}
                  formatCurrency={(value: number) => formatPrice(value) || ''}
                  resolveLocationLabel={(it) => resolveUniversityLabel(it?.seller?.university)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Top categories (image tiles) ── */}
        {topShowcaseCards.length > 0 && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                {t('home.topCategories', 'Top categories')}
              </h2>
              <button
                type="button"
                onClick={() => openMarketplace({ section: 'top-categories' })}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-strong hover:underline"
              >
                {t('home.seeAll', 'See all')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {topShowcaseCards.slice(0, 6).map((card, cardIndex) => {
                const tileImage = card.items[0]?.image || getHomeDecorImage(cardIndex);
                const count = categoryCount(card.categoryId);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => openMarketplace({ category: card.categoryId, section: card.id })}
                    className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border shadow-card"
                  >
                    {tileImage ? (
                      <img
                        src={tileImage}
                        alt={card.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-accent" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                      <p className="line-clamp-1 text-sm font-bold text-white">{card.title}</p>
                      <p className="text-xs text-white/80">
                        {count > 0 ? `${count}+ ${t('home.items', 'items')}` : t('home.explore', 'Explore')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Wide promo banner (forest green + image collage) ── */}
        <section className="overflow-hidden rounded-2xl border border-border shadow-card">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            {/* Left: forest panel */}
            <div className="relative isolate flex min-h-[250px] flex-col justify-center bg-gradient-to-br from-forest to-forest-dark p-7 text-white sm:min-h-[280px] sm:p-9">
              <div className="pointer-events-none absolute -left-10 -top-10 -z-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 left-1/3 -z-10 h-36 w-36 rounded-full bg-[var(--teal)]/15 blur-3xl" />
              <h2 className="text-2xl font-extrabold leading-tight sm:text-[1.9rem]">
                {t('home.promoBannerTitle', 'Shop your UNITRADE. Save more.')}
              </h2>
              <p className="mt-3 max-w-xs text-sm text-white/80">
                {t('home.promoBannerSub', 'Discover great finds from verified students near you — no shipping, just UNITRADE pickup.')}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => openMarketplace({ section: 'promo-banner', sort: 'recent' })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/90"
                >
                  {t('home.shopNow', 'Shop now')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Right: image collage arranged exactly like the reference */}
            <div className="bg-primary-soft p-4 sm:p-5">
              {(() => {
                const len = Math.max(1, collageImages.length);
                // Rotate which photo each tile shows on every feature tick (~4.5s).
                const pic = (i: number) => collageImages[(featureTick * 6 + i) % len] || '';
                const tile = 'overflow-hidden rounded-xl border border-white/60 bg-card shadow-sm';
                const Img = ({ i }: { i: number }) => {
                  const src = pic(i);
                  return (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      loading="lazy"
                      className="img-fade h-full w-full object-cover"
                    />
                  );
                };
                return (
                  <div className="flex h-full items-stretch gap-2.5 sm:gap-3">
                    {/* Col 1: single, vertically centered */}
                    <div className="flex flex-1 items-center">
                      <div className={cn(tile, 'aspect-[4/5] w-full')}>
                        <Img i={0} />
                      </div>
                    </div>
                    {/* Col 2: two stacked (top & bottom) */}
                    <div className="flex flex-1 flex-col justify-between gap-2.5 sm:gap-3">
                      <div className={cn(tile, 'aspect-[5/4]')}>
                        <Img i={1} />
                      </div>
                      <div className={cn(tile, 'aspect-square')}>
                        <Img i={2} />
                      </div>
                    </div>
                    {/* Col 3: single tall, full height */}
                    <div className={cn(tile, 'flex-1')}>
                      <Img i={3} />
                    </div>
                    {/* Col 4: two stacked (hidden on smallest screens) */}
                    <div className="hidden flex-1 flex-col justify-between gap-2.5 sm:flex sm:gap-3">
                      <div className={cn(tile, 'aspect-square')}>
                        <Img i={4} />
                      </div>
                      <div className={cn(tile, 'aspect-[5/4]')}>
                        <Img i={5} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* ── Deal of the day + Local focus ── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          {/* Deal of the day */}
          <article className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card shadow-card sm:grid-cols-2">
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t('home.dealOfTheDay', 'Deal of the day')}
              </p>
              <h3 className="mt-2 text-2xl font-extrabold capitalize leading-tight text-foreground">
                {spotlightListing?.title || t('home.featuredDeal', 'Featured deal')}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {spotlightListing?.description || t('home.dealFallbackSub', 'A great pick from a verified student seller.')}
              </p>
              {spotlightPrice && (
                <p className="mt-3 text-2xl font-black text-[#D9480F]">{spotlightPrice}</p>
              )}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() =>
                    spotlightListing?.id ? navigate(`/item/${spotlightListing.id}`) : openMarketplace()
                  }
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-300"
                >
                  {t('home.grabThisDeal', 'Grab this deal')}
                </button>
              </div>
            </div>
            <div className="relative min-h-[180px] bg-muted">
              {spotlightListing && getFirstImage(spotlightListing) ? (
                <img
                  src={getFirstImage(spotlightListing)}
                  alt={spotlightListing.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-accent" />
              )}
            </div>
          </article>

          {/* Local focus */}
          <article className="flex flex-col justify-center rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {t('home.localFocus', 'Local focus')}
            </p>
            <h3 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
              {t('home.localFocusTitle', 'More items around your university')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('home.localFocusSub', 'Keep browsing to see fresh listings from students nearby.')}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => openMarketplace({ section: 'local-focus', sort: 'recent' })}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-forest-dark"
              >
                <Sparkles className="h-4 w-4" />
                {t('home.openMarketplaceFeed', 'Open marketplace feed')}
              </button>
            </div>
          </article>
        </section>

        {/* ── Best sellers (people) + verified seller CTA ── */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {t('home.bestSellersInCampus', 'Best sellers in UNITRADE')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/marketplace')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {t('home.seeAll', 'See all')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-1">
              {bestSellers.length > 0 ? (
                bestSellers.map((s, i) => (
                  <li
                    key={`${s.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary-soft">
                      {s.avatar ? (
                        <img src={resolveClientAssetUrl(s.avatar)} alt={s.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(() => {
                          const uni = resolveUniversityLabel(s.university);
                          return uni === t('home.onCampus', 'UNITRADE')
                            ? t('home.verifiedSellerLabel', 'Verified seller')
                            : uni;
                        })()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {s.rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {s.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {s.sales}+ {t('home.sales', 'sales')}
                      </span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {t('home.noSellersYet', 'Sellers will appear here as listings are added.')}
                </li>
              )}
            </ul>
          </article>

          <article className="relative isolate flex flex-col justify-center overflow-hidden rounded-2xl border border-[#EADFCB] bg-gradient-to-br from-[#F8F1E4] via-[var(--cream)] to-[#F3E6D2] p-7 sm:p-8 md:pr-44">
            <div className="pointer-events-none absolute -right-10 -top-10 -z-10 h-40 w-40 rounded-full bg-[var(--cream-warm)]/60 blur-3xl" />
            <img
              src={VERIFIED_SELLER_IMAGE}
              alt={t('home.verifiedSellerImageAlt', 'Verified student seller')}
              loading="lazy"
              className="pointer-events-none absolute bottom-0 right-0 hidden h-[96%] w-auto max-w-[44%] object-contain object-bottom drop-shadow-xl [mask-image:linear-gradient(to_right,transparent,black_20%)] md:block"
            />
            <div className="relative z-10 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="max-w-xs text-2xl font-extrabold leading-tight text-foreground">
                {t('home.becomeVerifiedSeller', 'Become a verified student seller')}
              </h2>
            </div>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {t('home.becomeVerifiedSellerSub', 'Verify your student status to build trust and unlock more features.')}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                t('home.sellerBenefit1', 'Higher visibility'),
                t('home.sellerBenefit2', 'Build credibility'),
                t('home.sellerBenefit3', 'Sell with confidence'),
              ].map((benefit, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="font-medium text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button onClick={() => navigate('/register')}>
                {t('home.verifyNow', 'Verify now')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </article>
        </section>

        {/* ── "Don't miss out" banner (light) ── */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {t('home.dontMissDeals', "Don't miss out on amazing deals")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('home.dontMissDealsSub', 'Join thousands of students finding great deals every day.')}
              </p>
            </div>
          </div>
          <Button size="lg" className="shrink-0" onClick={() => openMarketplace()}>
            {t('home.exploreMarketplace', 'Explore marketplace')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        {!loading && availableListings.length === 0 && (
          <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-card">
            <h3 className="text-xl font-semibold text-foreground">{t('home.noListings', 'No listings available')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('home.noListingsSub', 'Add listings and this home layout will populate automatically with live data.')}
            </p>
            <Button className="mt-4" onClick={() => openMarketplace()}>
              {t('home.exploreMarketplace', 'Explore marketplace')}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}