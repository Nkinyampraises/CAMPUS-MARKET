import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Bell, Banknote, Flag, Heart, MessageSquare, PackageCheck, ShieldAlert, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value || 0);

export function BuyerDashboard() {
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const safeFavoriteItems = useMemo(() => favoriteItems.filter(Boolean), [favoriteItems]);

  const getWithAuthRetry = async (endpoint: string) => {
    if (!accessToken) {
      return { response: null as Response | null, data: { error: 'Unauthorized' } };
    }

    const makeRequest = async (token: string) => {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    try {
      const firstAttempt = await makeRequest(accessToken);
      if (firstAttempt.response.status !== 401) {
        return firstAttempt;
      }

      const refreshedToken = await refreshAuthToken();
      if (!refreshedToken) {
        return firstAttempt;
      }

      return makeRequest(refreshedToken);
    } catch (error) {
      return {
        response: null as Response | null,
        data: { error: error instanceof Error ? error.message : 'Unable to reach server' },
      };
    }
  };

  const fetchData = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const [ordersResult, favoritesResult] = await Promise.all([
        getWithAuthRetry('/orders'),
        getWithAuthRetry('/favorites'),
      ]);

      if (ordersResult.response?.status === 401 || favoritesResult.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }

      if (!ordersResult.response || !favoritesResult.response) {
        const message =
          ordersResult.data?.error ||
          favoritesResult.data?.error ||
          'Unable to reach server. Ensure API is running and reachable from this device.';
        toast.error(message);
        return;
      }

      if (ordersResult.response.ok) {
        const data = ordersResult.data;
        const myOrders = (data.orders || []).filter((order: any) => order.buyerId === currentUser?.id);
        setOrders(myOrders);
      } else {
        toast.error(ordersResult.data?.error || 'Failed to load orders');
      }

      if (favoritesResult.response.ok) {
        const data = favoritesResult.data;
        const favorites = Array.isArray(data.favorites) ? data.favorites.filter(Boolean) : [];
        setFavoriteItems(favorites);
      } else {
        toast.error(favoritesResult.data?.error || 'Failed to load favorites');
      }
    } catch (_error) {
      toast.error('Unable to load dashboard data right now');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [currentUser, accessToken]);

  const stats = useMemo(() => {
    const pending = orders.filter((order) => order.status === 'paid_pending_delivery').length;
    const released = orders.filter((order) => order.status === 'delivered_released').length;
    const refunded = orders.filter((order) => order.status === 'refunded').length;
    const totalSpent = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
    return { pending, released, refunded, totalSpent };
  }, [orders]);

  if (!currentUser) return null;

  if (loading) {
    return (
      <div className="bg-background min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">{t("common.loading", "Loading...")}</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"><span className="text-primary">{t('ui.buyer', 'Buyer')}</span> {t('ui.dashboard', 'Dashboard')}</h1>
            <p className="text-muted-foreground">{t('ui.escrow_protected_purchases_for', 'Escrow-protected purchases for')} {currentUser.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-card transition-shadow hover:shadow-elevated">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{t("buyer.totalOrders", "Total Orders")}</p>
                <div className="mt-2 text-2xl font-bold text-foreground">{orders.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t('ui.escrow_transactions', 'Escrow transactions')}</p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ShoppingBag className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="shadow-card transition-shadow hover:shadow-elevated">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{t("buyer.pendingDelivery", "Pending Delivery")}</p>
                <div className="mt-2 text-2xl font-bold text-foreground">{stats.pending}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t('ui.en_attente_de_confirmation_vendeur', 'Pending Vendor Confirmation')}</p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <PackageCheck className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="shadow-card transition-shadow hover:shadow-elevated">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{t("buyer.totalSpent", "Total Spent")}</p>
                <div className="mt-2 text-2xl font-bold text-foreground">{formatMoney(stats.totalSpent)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t('ui.sur_toutes_les_commandes', 'All Order Lists')}</p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Banknote className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="shadow-card transition-shadow hover:shadow-elevated">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{t("buyer.savedItems", "Saved Items")}</p>
                <div className="mt-2 text-2xl font-bold text-foreground">{favoriteItems.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t('ui.articles_en_liste_de_souhaits', 'Wishlist Items')}</p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Heart className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
            <TabsList>
              <TabsTrigger value="orders">{t('ui.mes_commandes', 'My orders')}</TabsTrigger>
              <TabsTrigger value="favorites">Saved Items ({safeFavoriteItems.length})</TabsTrigger>
              <TabsTrigger value="messages">{t('ui.messages', 'Messages')}</TabsTrigger>
            </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {orders.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('ui.escrow_orders', 'Escrow Orders')}</CardTitle>
                  <CardDescription>{t('ui.statut_de_paiement_et_flux_de_confirmation_de_livr', 'Payment status and delivery confirmation flow.')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">{order.listingTitle || 'Item'}</p>
                            <Badge variant={order.status === 'delivered_released' ? 'default' : 'secondary'}>
                              {order.statusLabel || order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Pickup: {order.pickupDate || '-'} at {order.pickupTime || '-'} • {order.pickupLocation || '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt || order.timestamp || '').toLocaleString()} • {order.paymentMethod === 'mtn-momo' ? 'MTN MoMo' : 'Orange Money'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-primary">{formatMoney(order.amount || 0)}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            {t('ui.view_order', 'View Order')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('ui.no_orders_yet', 'No orders yet')}</h3>
                  <p className="text-muted-foreground mb-4">{t('ui.start_shopping_to_create_your_first_escrow_protect', 'Start shopping to create your first escrow-protected order.')}</p>
                  <Button onClick={() => navigate('/marketplace')}>
                    {t('ui.browse_marketplace', 'Browse Marketplace')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {safeFavoriteItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {safeFavoriteItems.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden shadow-card hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => navigate(`/item/${item.id}`)}>
                    <div className="aspect-square relative overflow-hidden bg-muted">
                      <img src={item?.images?.[0]} alt={item?.title || 'Saved item'} className="w-full h-full object-cover" />
                      <Badge className="absolute top-2 right-2">{item.status}</Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2 text-foreground">{item.title || 'Untitled item'}</h3>
                      <p className="text-lg font-bold text-primary mb-3">{formatMoney(item.price || 0)}</p>
                      <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigate(`/item/${item.id}`); }}>
                        {t('ui.view_details', 'View Details')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('ui.no_saved_items', 'No saved items')}</h3>
                  <p className="text-muted-foreground mb-4">{t('ui.save_items_while_browsing', 'Save items while browsing.')}</p>
                  <Button onClick={() => navigate('/marketplace')}>
                    {t('ui.browse_marketplace', 'Browse Marketplace')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>{t('ui.messages', 'Messages')}</CardTitle>
                <CardDescription>{t('ui.chat_with_sellers_about_your_orders', 'Chat with sellers about your orders.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate('/messages')}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t('ui.open_messages', 'Open Messages')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

