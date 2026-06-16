import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { ArrowUpDown, Heart, Package, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ProductCard } from '@/components/ProductCard';
import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';
import { useLanguage } from '@/contexts/LanguageContext';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

export function Favorites() {
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<NamedCatalogOption[]>([]);
  const [universities, setUniversities] = useState<NamedCatalogOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sell' | 'rent'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-low' | 'price-high'>('recent');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchFavorites = async () => {
      try {
        const response = await fetch(`${API_URL}/favorites`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (response.ok) {
          const favorites = Array.isArray(data.favorites) ? data.favorites.filter(Boolean) : [];
          setFavoriteItems(favorites);
        }
      } catch (error) {
        toast.error('Failed to fetch favorites');
      }
    };

    const fetchCatalogs = async () => {
      try {
        const [categoryRows, universityRows] = await Promise.all([
          fetchPublicCatalog('categories'),
          fetchPublicCatalog('universities'),
        ]);
        setCategories(categoryRows);
        setUniversities(universityRows);
      } catch {
        setCategories([]);
        setUniversities([]);
      }
    };

    fetchFavorites();
    fetchCatalogs();
  }, [isAuthenticated, accessToken, navigate]);

  const handleRemoveFavorite = async (itemId: string) => {
    try {
      await fetch(`${API_URL}/favorites/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setFavoriteItems(prev => prev.filter(item => item?.id !== itemId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const items = favoriteItems.filter(Boolean).filter((item) => {
      const categoryName = resolveNamedCatalogLabel(categories, item?.category, '');
      const matchesSearch =
        !normalizedSearch ||
        [item?.title, item?.description, categoryName]
          .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      const matchesType = filterType === 'all' || item?.type === filterType;
      return matchesSearch && matchesType;
    });

    const sorted = [...items];
    if (sortBy === 'price-low') {
      sorted.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (sortBy === 'price-high') {
      sorted.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    } else {
      sorted.sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
    }

    return sorted;
  }, [categories, favoriteItems, filterType, searchQuery, sortBy]);

  const resolveLocationLabel = (item: any) =>
    resolveNamedCatalogLabel(
      universities,
      item?.location,
      item?.location ? String(item.location) : t('marketplace.campusPickup', 'Campus pickup'),
    );

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="w-full px-4 lg:px-8 xl:px-12">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('ui.saved_items', 'Saved Items')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('ui.saved_items_subtitle', 'Your curated collection of home essentials, tech finds, and practical daily-use items.')}
            </p>
            <p className="mt-2 text-sm font-semibold text-primary">{favoriteItems.length} {t('ui.items_saved_suffix', 'item(s) saved')}</p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ui.search_saved_items', 'Search saved items...')}
                className="h-10 rounded-xl border-border bg-input pl-9 text-foreground"
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'sell' | 'rent')}
                className="h-10 min-w-[155px] rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">{t('ui.all_types', 'All Types')}</option>
                <option value="sell">{t('ui.for_sale', 'For Sale')}</option>
                <option value="rent">{t('ui.for_rent', 'For Rent')}</option>
              </select>
            </div>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'price-low' | 'price-high')}
                className="h-10 min-w-[165px] rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="recent">{t('ui.recently_added', 'Recently Added')}</option>
                <option value="price-low">{t('ui.price_low_to_high', 'Price: Low to High')}</option>
                <option value="price-high">{t('ui.price_high_to_low', 'Price: High to Low')}</option>
              </select>
            </div>
          </div>
        </div>

        {favoriteItems.length === 0 ? (
          <Card className="rounded-2xl border border-border bg-card shadow-card">
            <CardContent className="py-14 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">{t('ui.no_saved_items_yet', 'No saved items yet')}</h3>
              <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
                {t('ui.start_browsing_and_save_items_that_match_what_you_', 'Start browsing and save items that match what you need for campus life.')}
              </p>
              <Button
                onClick={() => navigate('/marketplace')}
                className="rounded-xl px-6"
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {t('ui.browse_marketplace', 'Browse Marketplace')}
              </Button>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="rounded-2xl border border-border bg-card shadow-card">
            <CardContent className="py-14 text-center">
              <h3 className="mb-2 text-xl font-semibold text-foreground">{t('ui.no_items_match_your_search', 'No items match your search')}</h3>
              <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
                {t('ui.try_a_different_keyword_or_reset_your_filters_to_s', 'Try a different keyword or reset your filters to see all your saved items.')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setSortBy('recent');
                }}
                className="rounded-xl"
              >
                {t('ui.clear_filters', 'Clear Filters')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  isSaved
                  onSave={(id) => handleRemoveFavorite(id)}
                  onNavigate={() => navigate(`/item/${item.id}`)}
                  t={t}
                  formatCurrency={(n) => formatCurrency(Number(n || 0))}
                  resolveLocationLabel={resolveLocationLabel}
                />
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-dashed border-border bg-secondary px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground">{t('ui.finding_more_items', 'Finding more items?')}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                {t('ui.finding_more_items_subtitle', 'Keep browsing your favorite home essentials and discover more trusted marketplace deals.')}
              </p>
              <Button
                onClick={() => navigate('/marketplace')}
                className="mt-5 rounded-xl px-6"
              >
                {t('ui.browse_marketplace', 'Browse Marketplace')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

