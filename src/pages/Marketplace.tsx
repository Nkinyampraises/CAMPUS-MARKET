import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Search, Filter, MapPin, Eye, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { categories, getCategoryById } from '@/data/mockData';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

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
  images?: string[];
  rentalPeriod?: string;
  seller?: {
    id: string;
    name: string;
  };
};

export function Marketplace() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch(`${API_URL}/listings`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setListings([]);
          toast.error(data.error || 'Failed to fetch listings from database');
          return;
        }
        setListings(Array.isArray(data.listings) ? data.listings : []);
      } catch (error) {
        setListings([]);
        const message = error instanceof Error ? error.message : '';
        toast.error(message || 'Unable to reach listings service');
      }
    };

    fetchListings();
  }, []);

  const handleSaveItem = (itemId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
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
          <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">Browse items from students across Cameroon universities</p>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sell">For Sale</SelectItem>
                <SelectItem value="rent">For Rent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery('')}>
                Search: {searchQuery} x
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCategory('all')}>
                {getCategoryById(selectedCategory)?.name} x
              </Badge>
            )}
            {selectedType !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedType('all')}>
                {selectedType === 'sell' ? 'For Sale' : 'For Rent'} x
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
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
                  className="overflow-hidden border border-border hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    <img
                      src={item.images?.[0] || ''}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className="absolute top-2 right-2" variant={item.type === 'sell' ? 'default' : 'secondary'}>
                      {item.type === 'sell' ? 'For Sale' : 'For Rent'}
                    </Badge>
                    {item.condition === 'new' && <Badge className="absolute top-2 left-2 bg-green-600">New</Badge>}
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

                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{categoryLabel}</p>
                    <h3 className="font-semibold mb-2 line-clamp-2">{item.title}</h3>
                    <p className="text-lg font-bold text-green-600 mb-2">
                      {formatCurrency(item.price)}
                      {item.type === 'rent' && item.rentalPeriod && (
                        <span className="text-sm font-normal text-muted-foreground">/{item.rentalPeriod}</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      {item.location || 'Campus'}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                          <span className="text-xs font-medium text-green-600">{(seller?.name || 'S').charAt(0)}</span>
                        </div>
                        <span className="text-muted-foreground">{seller?.name || 'Unknown Seller'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {item.views || 0}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/item/${item.id}`);
                      }}
                    >
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
