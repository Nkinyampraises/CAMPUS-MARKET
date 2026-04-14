import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react';
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

  const heroSlides = useMemo(
    () => [
      {
        id: 'hero-student-deals',
        title: t('home.amazonHero1Title', 'Campus deals worth checking today'),
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
          'Find electronics, decor, and study essentials from verified campus sellers.',
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

  return (
    <div className="bg-[#eaeded] text-[#0f1111]">
      <div className="mx-auto max-w-[1500px]">
        <section className="relative h-[330px] overflow-hidden bg-white sm:h-[430px] lg:h-[520px]">
          {activeHeroSlide.image ? (
            <img src={activeHeroSlide.image} alt={activeHeroSlide.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-[#1d3557] via-[#457b9d] to-[#a8dadc]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_45%,rgba(234,237,237,0.96)_100%)]" />

          <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-between sm:inset-x-4">
            <button
              type="button"
              aria-label={t('home.previousSlide', 'Previous slide')}
              onClick={() => setFeatureTick((value) => value - 1)}
              className="inline-flex h-12 w-9 items-center justify-center rounded-md border border-[#f7fafa] bg-white/50 text-[#111111] shadow-md backdrop-blur hover:bg-white/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={t('home.nextSlide', 'Next slide')}
              onClick={() => setFeatureTick((value) => value + 1)}
              className="inline-flex h-12 w-9 items-center justify-center rounded-md border border-[#f7fafa] bg-white/50 text-[#111111] shadow-md backdrop-blur hover:bg-white/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="absolute left-4 top-6 max-w-xl rounded-md bg-white/82 p-4 text-[#111111] shadow-lg backdrop-blur sm:left-8 sm:top-10 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#394149]">
              {t('home.featuredToday', 'Featured Today')}
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">{activeHeroSlide.title}</h1>
            <p className="mt-2 text-sm text-[#2d3741] sm:text-base">{activeHeroSlide.subtitle}</p>
            <Button
              onClick={() => openMarketplace(activeHeroSlide.filters)}
              className="mt-4 h-9 rounded-full bg-[#ffd814] px-4 text-sm font-semibold text-[#0f1111] shadow-none hover:bg-[#f7ca00]"
            >
              {activeHeroSlide.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        <div className="relative -mt-20 space-y-5 px-3 pb-8 sm:px-5 lg:px-7">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {topShowcaseCards.map((card) => (
              <article key={card.id} className="flex min-h-[370px] flex-col bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
                <h2 className="line-clamp-2 min-h-[3.2rem] text-[1.25rem] font-bold leading-6 text-[#0f1111]">{card.title}</h2>
                <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
                  {card.items.slice(0, 4).map((tile, tileIndex) => {
                    const tileImage = tile.image || getHomeDecorImage(tileIndex);
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => openMarketplace(tile.filters)}
                        className="group text-left"
                      >
                        <div className="aspect-square overflow-hidden bg-[#f3f3f3]">
                          {tileImage ? (
                            <img src={tileImage} alt={tile.label} className="h-full w-full object-cover transition group-hover:scale-105" />
                          ) : (
                            <div className="h-full w-full bg-[#eceff1]" />
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-[#0f1111]">{tile.label}</p>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => openMarketplace({ category: card.categoryId, section: card.id })}
                  className="mt-3 text-left text-sm font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  {t('home.seeMore', 'See more')}
                </button>
              </article>
            ))}
          </section>

          <section className="bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[1.35rem] font-bold text-[#0f1111]">{t('home.shopByCategory', 'Shop by category')}</h3>
                <p className="text-sm text-[#4b5663]">
                  {t('home.amazonCategorySub', 'Jump into departments with one click, just like a storefront aisle.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openMarketplace({ section: 'quick-categories' })}
                className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
              >
                {t('home.seeAll', 'See all')}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => openMarketplace({ section: 'quick-categories', category: category.id })}
                  className="rounded-lg border border-[#d5d9d9] bg-white px-3 py-1.5 text-sm font-medium text-[#0f1111] transition hover:border-[#0f1111] hover:bg-[#f9fafb]"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </section>

          {railTop && (
            <section className="bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[1.35rem] font-bold text-[#0f1111]">{railTop.title}</h3>
                  <p className="text-sm text-[#4b5663]">{railTop.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openMarketplace(railTop.filters)}
                  className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  {t('home.seeAllDeals', 'See all deals')}
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {railTop.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openMarketplace(item.filters)}
                    className="min-w-[170px] max-w-[170px] text-left"
                  >
                    <div className="aspect-square overflow-hidden border border-[#edf0f1] bg-[#f6f8f8]">
                      {item.image ? (
                        <img src={item.image} alt={item.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-[#eff2f2]" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-[#0f1111]">{item.label}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <article className="relative overflow-hidden bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
              <div className="grid items-center gap-4 md:grid-cols-[1.3fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#565d66]">
                    {t('home.dealOfTheDay', 'Deal of the day')}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[#0f1111]">
                    {spotlightListing?.title || t('home.freshCampusDeals', 'Fresh campus deals are live now')}
                  </h3>
                  <p className="mt-2 text-sm text-[#44505d]">
                    {spotlightListing?.description ||
                      t('home.dealOfTheDaySub', 'New listings are arriving constantly. Explore the latest highlights.')}
                  </p>
                  {spotlightPrice && <p className="mt-2 text-2xl font-bold text-[#b12704]">{spotlightPrice}</p>}
                  <Button
                    onClick={() =>
                      openMarketplace({
                        section: 'deal-of-the-day',
                        category: spotlightListing?.category,
                      })
                    }
                    className="mt-4 h-9 rounded-full bg-[#ffd814] px-4 text-sm font-semibold text-[#0f1111] shadow-none hover:bg-[#f7ca00]"
                  >
                    {t('home.grabDeal', 'Grab this deal')}
                  </Button>
                </div>
                <div className="overflow-hidden border border-[#edf0f1] bg-[#f4f7f7]">
                  {spotlightListing?.images?.[0] ? (
                    <img src={spotlightListing.images[0]} alt={spotlightListing.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/3] h-full w-full bg-gradient-to-br from-[#dfe7ed] to-[#f7fafb]" />
                  )}
                </div>
              </div>
            </article>

            <article className="bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
              <p className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-[#565d66]">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                {t('home.localFocus', 'Local Focus')}
              </p>
              <h3 className="mt-2 text-[1.35rem] font-bold text-[#0f1111]">
                {t('home.moreItemsAroundUniversity', 'More items around your university')}
              </h3>
              <p className="mt-2 text-sm text-[#44505d]">
                {t('home.keepBrowsing', 'Keep browsing to see fresh listings from students nearby.')}
              </p>
              <Button
                onClick={() => openMarketplace({ section: 'local-focus', sort: 'recent' })}
                className="mt-4 h-9 rounded-full bg-[#232f3e] px-4 text-sm font-semibold text-white shadow-none hover:bg-[#111a25]"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t('home.openMarketplaceFeed', 'Open marketplace feed')}
              </Button>
            </article>
          </section>

          {lowerShowcaseCards.length > 0 && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {lowerShowcaseCards.map((card) => (
                <article key={card.id} className="flex min-h-[370px] flex-col bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
                  {card.variant !== 'tiles-only' ? (
                    <h2 className="line-clamp-2 min-h-[3.2rem] text-[1.25rem] font-bold leading-6 text-[#0f1111]">{card.title}</h2>
                  ) : (
                    <h2 className="line-clamp-2 min-h-[3.2rem] text-[1.25rem] font-bold leading-6 text-[#0f1111]">
                      {t('home.discoverMore', 'Discover more')}
                    </h2>
                  )}
                  <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
                    {card.items.slice(0, 4).map((tile, tileIndex) => {
                      const tileImage = tile.image || getHomeDecorImage(tileIndex + 3);
                      return (
                        <button
                          key={tile.id}
                          type="button"
                          onClick={() => openMarketplace(tile.filters)}
                          className="group text-left"
                        >
                          <div className="aspect-square overflow-hidden bg-[#f3f3f3]">
                            {tileImage ? (
                              <img src={tileImage} alt={tile.label} className="h-full w-full object-cover transition group-hover:scale-105" />
                            ) : (
                              <div className="h-full w-full bg-[#eceff1]" />
                            )}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-[#0f1111]">{tile.label}</p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => openMarketplace({ category: card.categoryId || undefined, section: card.id })}
                    className="mt-3 text-left text-sm font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
                  >
                    {t('home.exploreThisCategory', 'Explore this category')}
                  </button>
                </article>
              ))}
            </section>
          )}

          {railBottom.map((rail) => (
            <section key={rail.id} className="bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[1.35rem] font-bold text-[#0f1111]">{rail.title}</h3>
                  <p className="text-sm text-[#4b5663]">{rail.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openMarketplace(rail.filters)}
                  className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  {t('home.seeAll', 'See all')}
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {rail.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openMarketplace(item.filters)}
                    className="min-w-[170px] max-w-[170px] text-left"
                  >
                    <div className="aspect-square overflow-hidden border border-[#edf0f1] bg-[#f6f8f8]">
                      {item.image ? (
                        <img src={item.image} alt={item.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-[#eff2f2]" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-[#0f1111]">{item.label}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {!loading && availableListings.length === 0 && (
            <section className="border border-dashed border-[#a6b0b7] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
              <h3 className="text-xl font-semibold text-[#0f1111]">{t('home.noListings', 'No listings available')}</h3>
              <p className="mt-2 text-sm text-[#44505d]">
                {t('home.noListingsSub', 'Add listings and this home layout will populate automatically with live data.')}
              </p>
              <Button
                className="mt-4 h-10 rounded-full bg-[#ffd814] px-5 text-sm font-semibold text-[#0f1111] shadow-none hover:bg-[#f7ca00]"
                onClick={() => openMarketplace()}
              >
                {t('home.exploreMarketplace', 'Explore marketplace')}
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}



