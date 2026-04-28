import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { ArrowUpDown, Heart, Package, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

export function Favorites() {
  const { currentUser, isAuthenticated, accessToken } = useAuth();
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

  const getActionLabel = (item: any) => {
    const categoryName = resolveNamedCatalogLabel(categories, item?.category, '').toLowerCase();
    if (item?.type === 'rent') return 'Schedule Tour';
    if (categoryName.includes('service') || categoryName.includes('tutor')) return 'Contact Tutor';
    return 'View Details';
  };

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f3f8f5] py-8">
      <div className="mx-auto w-full px-4 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#013b36]">Saved Items</h1>
            <p className="mt-1 text-sm text-[#55766b]">
              Your curated collection of home essentials, tech finds, and practical daily-use items.
            </p>
            <p className="mt-2 text-sm font-semibold text-[#0c6a5a]">{favoriteItems.length} item(s) saved</p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b8a81]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved items..."
                className="h-10 rounded-xl border-[#c7ddd2] bg-white pl-9 text-[#153c33]"
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b8a81]" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'sell' | 'rent')}
                className="h-10 min-w-[155px] rounded-xl border border-[#c7ddd2] bg-white pl-9 pr-8 text-sm text-[#173f36] outline-none transition-colors focus:border-[#0c6a5a]"
              >
                <option value="all">All Types</option>
                <option value="sell">For Sale</option>
                <option value="rent">For Rent</option>
              </select>
            </div>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b8a81]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'price-low' | 'price-high')}
                className="h-10 min-w-[165px] rounded-xl border border-[#c7ddd2] bg-white pl-9 pr-8 text-sm text-[#173f36] outline-none transition-colors focus:border-[#0c6a5a]"
              >
                <option value="recent">Recently Added</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {favoriteItems.length === 0 ? (
          <Card className="rounded-3xl border border-[#d2e4dc] bg-white">
            <CardContent className="py-14 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-[#7f9b92]" />
              <h3 className="mb-2 text-xl font-semibold text-[#113c32]">No saved items yet</h3>
              <p className="mx-auto mb-6 max-w-md text-sm text-[#59796f]">
                Start browsing and save items that match what you need for campus life.
              </p>
              <Button
                onClick={() => navigate('/marketplace')}
                className="rounded-xl bg-[#1FAF9A] px-6 text-white hover:bg-[#27b9a6]"
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Browse Marketplace
              </Button>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="rounded-3xl border border-[#d2e4dc] bg-white">
            <CardContent className="py-14 text-center">
              <h3 className="mb-2 text-xl font-semibold text-[#113c32]">No items match your search</h3>
              <p className="mx-auto mb-6 max-w-md text-sm text-[#59796f]">
                Try a different keyword or reset your filters to see all your saved items.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setSortBy('recent');
                }}
                className="rounded-xl border-[#b9d4c8] text-[#1FAF9A] hover:bg-[#edf7f2]"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const categoryLabel = resolveNamedCatalogLabel(categories, item?.category, 'General');
                const locationLabel = resolveNamedCatalogLabel(
                  universities,
                  item?.location,
                  item?.location ? String(item.location) : 'Campus pickup',
                );

                return (
                  <Card
                    key={item.id}
                    className={cn(
                      'w-full overflow-hidden rounded-2xl border border-[#d2e4dc] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                    )}
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-56 overflow-hidden bg-[#e8f1ec] md:h-auto md:w-[320px] lg:w-[360px]">
                        {item?.images?.[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item?.title || 'Saved item'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-[#6a8c82]">
                            No image available
                          </div>
                        )}
                        <button
                          onClick={() => handleRemoveFavorite(item.id)}
                          className="absolute right-3 top-3 rounded-full bg-white/95 p-1.5 shadow-sm transition-colors hover:bg-[#ffeef1]"
                          aria-label="Remove from favorites"
                        >
                          <Heart className="h-4 w-4 fill-[#e35166] text-[#e35166]" />
                        </button>
                      </div>

                      <CardContent className="flex flex-1 flex-col justify-between gap-4 p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6f9186]">
                              {categoryLabel}
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-[#0f3a31]">
                              {item?.title || 'Saved Item'}
                            </h3>
                          </div>
                          <Badge
                            className={cn(
                              'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] uppercase',
                              item?.status === 'available'
                                ? 'bg-[#dff6ea] text-[#0a7c56]'
                                : item?.status === 'sold'
                                  ? 'bg-[#eaedf0] text-[#51606d]'
                                  : 'bg-[#e4effc] text-[#2a5ca8]',
                            )}
                          >
                            {item?.status || 'available'}
                          </Badge>
                        </div>

                        <p className="line-clamp-3 text-sm text-[#5f7f75]">
                          {item?.description || 'No description provided.'}
                        </p>

                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-xs text-[#7b978e]">{locationLabel}</p>
                            <p className="text-2xl font-black tracking-tight text-[#004f3f]">
                              {formatCurrency(Number(item?.price || 0))}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full border-[#c5dace] text-[#366458]">
                            {item?.type === 'rent' ? 'Rent' : 'Sale'}
                          </Badge>
                        </div>

                        <Button
                          className="w-full rounded-xl bg-[#1FAF9A] text-sm font-semibold text-white hover:bg-[#27b9a6] md:w-[220px]"
                          onClick={() => navigate(`/item/${item.id}`)}
                        >
                          {getActionLabel(item)}
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-10 rounded-3xl border border-dashed border-[#c6d8cf] bg-[#f7fbf8] px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f3ec]">
                <Heart className="h-5 w-5 text-[#0c6a5a]" />
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-[#103d34]">Finding more items?</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-[#5f7f75]">
                Keep browsing your favorite home essentials and discover more trusted marketplace deals.
              </p>
              <Button
                onClick={() => navigate('/marketplace')}
                className="mt-5 rounded-xl bg-[#1FAF9A] px-6 text-white hover:bg-[#27b9a6]"
              >
                Browse Marketplace
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

