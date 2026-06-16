import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Eye } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
const RECENTLY_VIEWED_KEY = 'recentlyViewedItemIds';

const formatMoney = (value: number) =>
  `${Math.round(value || 0).toLocaleString('fr-FR')} FCFA`;

export function RecentlyViewed() {
  const { t } = useLanguage();
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

  const resolveLocationLabel = (item: any) =>
    item?.location ? String(item.location) : t('marketplace.campusPickup', 'Campus pickup');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('ui.recently_viewed_items', 'Recently Viewed Items')}
          </h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="h-4 w-4 text-primary" />
            {t('ui.items_you_recently_browsed', 'Items you recently browsed')}
          </p>
        </div>
        <Button variant="outline" onClick={clearHistory}>
          {t('ui.clear_history', 'Clear History')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('ui.loading_items', 'Loading items...')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ui.no_recently_viewed_items_yet', 'No recently viewed items yet.')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              isSaved={false}
              onSave={() => {}}
              onNavigate={() => navigate(`/item/${item.id}`)}
              t={t}
              formatCurrency={formatMoney}
              resolveLocationLabel={resolveLocationLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
