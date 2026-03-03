import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Eye } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;
const RECENTLY_VIEWED_KEY = 'recentlyViewedItemIds';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export function RecentlyViewed() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const fetchItems = async () => {
    const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    const itemIds = Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];

    if (itemIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const requests = itemIds.map((id) =>
        fetch(`${API_URL}/listings/${id}`)
          .then((res) => res.json().catch(() => ({})))
          .then((data) => data?.listing || null),
      );
      const loadedItems = await Promise.all(requests);
      const filtered = loadedItems.filter(Boolean);
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const clearHistory = () => {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
    setItems([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button variant="outline" onClick={clearHistory}>
          Clear History
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-4">Recently Viewed Items</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading items...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recently viewed items yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-video bg-gray-100 overflow-hidden">
                <img src={item.images?.[0] || ''} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold line-clamp-1">{item.title}</p>
                  <Badge variant="secondary">
                    <Eye className="h-3 w-3 mr-1" />
                    {item.views || 0}
                  </Badge>
                </div>
                <p className="text-green-600 font-bold">{formatMoney(item.price || 0)}</p>
                <Button className="w-full" onClick={() => navigate(`/item/${item.id}`)}>
                  View Item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
