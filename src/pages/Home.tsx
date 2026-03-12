import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ArrowRight, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { getCategoryById } from '@/data/mockData';
import { API_URL } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [featureTick, setFeatureTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const openMarketplace = (filters: MarketplaceRouteFilters = {}) => {
    navigate(buildMarketplaceUrl(filters));
  };

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async (silent = false) => {
      if (!silent && isMounted) {
        setLoading(true);
      }

      try {
        const [listingsResult, categoriesResult] = await Promise.allSettled([
          fetch(`${API_URL}/listings`),
          fetch(`${API_URL}/categories`),
        ]);

        if (listingsResult.status === 'fulfilled') {
          const response = listingsResult.value;
          const data = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(data.listings)) {
            if (isMounted) setListings(data.listings);
          } else if (!silent) {
            if (isMounted) setListings([]);
            toast.error(data.error || t('home.failedLoadListings', 'Failed to load home listings'));
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
        title: t('home.bestSellersCampusElectronics', 'Best Sellers in Campus Electronics'),
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

  return (
    <div className="bg-[#eef1f5] text-foreground dark:bg-slate-950">
      <section className="relative overflow-hidden border-b border-emerald-200/70 bg-gradient-to-r from-emerald-100 via-green-100 to-lime-200 dark:border-slate-800 dark:from-emerald-950/60 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-10">
          <div>
          <Badge className="mb-4 bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-700 dark:text-slate-100">
            {t('home.badge', 'CampusMarket Picks')}
          </Badge>
          <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-5xl dark:text-white">
            {t('home.heroTitle', 'Discover top student deals, rentals, and room essentials.')}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-700 md:text-base dark:text-slate-200">
            {t(
              'home.heroSubtitle',
              'Browse marketplace sections like your reference layout. Every card and row opens the marketplace with related results.',
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => openMarketplace()}>
              {t('home.exploreMarketplace', 'Explore marketplace')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="bg-white/80 backdrop-blur hover:bg-white dark:bg-slate-900"
              onClick={() => openMarketplace({ section: 'recommended-for-you', sort: 'recent' })}
            >
              {t('home.trendingNow', 'Trending now')}
            </Button>
          </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-6 px-4 py-8">
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[
            {
              id: 'rentals-near-you',
              title: t('home.rentalsNearYou', 'Rentals near you'),
              subtitle: t('home.rentalsSubtitle', 'Short-term and semester rentals from nearby campuses.'),
              cta: t('home.browseRentals', 'Browse rentals'),
              filters: { section: 'rentals-near-you', type: 'rent', sort: 'recent' } as MarketplaceRouteFilters,
              image: getFeatureImage(rentalsFeatureImages, 0),
            },
            {
              id: 'recommended-for-you',
              title: t('home.recommendedForYou', 'Recommended for you'),
              subtitle: t('home.recommendedSubtitle', 'Popular student picks based on what is trending now.'),
              cta: t('home.seeRecommendations', 'See recommendations'),
              filters: { section: 'recommended-for-you', sort: 'recent' } as MarketplaceRouteFilters,
              image: getFeatureImage(recommendedFeatureImages, 1),
            },
          ].map((card) => (
            <button
              key={card.id}
              className="group relative overflow-hidden rounded-3xl border border-white/60 text-left shadow-sm transition hover:shadow-xl"
              onClick={() => openMarketplace(card.filters)}
            >
              {card.image ? (
                <img src={card.image} alt={card.title} className="h-80 w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className="h-80 w-full bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                  {t('home.featuredSection', 'Featured Section')}
                </p>
                <h2 className="mt-2 text-2xl font-bold">{card.title}</h2>
                <p className="mt-2 text-sm text-white/90">{card.subtitle}</p>
                <p className="mt-4 inline-flex items-center text-sm font-semibold">
                  {card.cta}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </p>
              </div>
            </button>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('home.quickCategories', 'Quick Categories')}
              </p>
              <h2 className="text-xl font-bold">{t('home.shopByCategory', 'Shop by category')}</h2>
            </div>
            <Button variant="ghost" className="text-sm" onClick={() => openMarketplace({ section: 'quick-categories' })}>
              {t('home.seeAll', 'See all')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => openMarketplace({ section: 'quick-categories', category: category.id })}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-left transition hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <p className="text-sm font-semibold">{category.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t('home.openRelatedItems', 'Open related items')}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categoryShowcaseCards.map((card) => (
            <article
              key={card.id}
              className="rounded-none border border-slate-200 bg-[#f3f3f3] p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {card.variant !== 'tiles-only' && (
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-3xl font-bold leading-tight text-slate-900 dark:text-slate-100">{card.title}</h3>
                  </div>
                  <button
                    onClick={() => openMarketplace({ category: card.categoryId, section: card.id })}
                    className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {card.items.map((tile, tileIndex) => {
                  const tileImage = tile.image || getHomeDecorImage(tileIndex);
                  return (
                  <button
                    key={tile.id}
                    className="group text-left"
                    onClick={() => openMarketplace(tile.filters)}
                  >
                    <div className="aspect-square overflow-hidden border border-slate-300 bg-slate-200 transition group-hover:shadow-sm dark:border-slate-700 dark:bg-slate-700">
                      {tileImage ? (
                        <img src={tileImage} alt={tile.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-slate-200 dark:bg-slate-700" />
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
                      {tile.label}
                    </p>
                  </button>
                  );
                })}
              </div>
              {card.variant !== 'tiles-only' && (
                <button
                  className="mt-4 text-sm font-medium text-[#1663c7] hover:underline"
                  onClick={() => openMarketplace({ category: card.categoryId, section: card.id })}
                >
                  {card.linkLabel}
                </button>
              )}
            </article>
          ))}
        </section>

        {productRails.map((rail) => (
          <section
            key={rail.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{rail.title}</h3>
                <p className="text-xs text-muted-foreground">{rail.subtitle}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openMarketplace(rail.filters)}>
                {t('home.seeAll', 'See all')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {rail.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openMarketplace(item.filters)}
                  className="min-w-[140px] overflow-hidden rounded-2xl border border-slate-200 text-left transition hover:shadow-md dark:border-slate-700"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.label} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 w-full bg-slate-200 dark:bg-slate-700" />
                  )}
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-semibold">{item.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('home.aboutLabel', 'About us')}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {t('home.aboutTitle', 'Built for students, by students.')}
              </h3>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                {t(
                  'home.aboutBody',
                  'CampusMarket connects students across Cameroon universities to buy, sell, and rent essentials safely. Our goal is simple: make student life more affordable, trustworthy, and sustainable.',
                )}
              </p>
              <Button
                className="mt-4 bg-green-600 hover:bg-green-700"
                onClick={() => openMarketplace({ sort: 'recent' })}
              >
                {t('home.aboutCta', 'Explore marketplace community')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-semibold">{t('home.aboutPoint1Title', 'Affordable deals')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('home.aboutPoint1Body', 'Student-friendly pricing on everyday essentials.')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-semibold">{t('home.aboutPoint2Title', 'Trusted community')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('home.aboutPoint2Body', 'Verified users, transparent listings, and real reviews.')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-semibold">{t('home.aboutPoint3Title', 'Campus-focused')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('home.aboutPoint3Body', 'Designed around university life, rentals, and quick exchanges.')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 inline-flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="mr-1 h-3.5 w-3.5" />
                {t('home.localFocus', 'Local Focus')}
              </p>
              <h3 className="text-xl font-bold">{t('home.moreItemsAroundUniversity', 'More items around your university')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('home.keepBrowsing', 'Keep browsing to see fresh listings from students nearby.')}
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => openMarketplace({ section: 'local-focus', sort: 'recent' })}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('home.openMarketplaceFeed', 'Open marketplace feed')}
            </Button>
          </div>
        </section>

        {!loading && availableListings.length === 0 && (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold">{t('home.noListings', 'No listings available')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('home.noListingsSub', 'Add listings and this home layout will populate automatically with live data.')}
            </p>
            <Button className="mt-4 bg-green-600 hover:bg-green-700" onClick={() => openMarketplace()}>
              {t('home.exploreMarketplace', 'Explore marketplace')}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
