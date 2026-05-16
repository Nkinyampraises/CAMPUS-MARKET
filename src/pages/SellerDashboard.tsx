import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { DollarSign, Heart, MessageSquare, Package, Plus, ShoppingBag, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const formatMoney = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value) || 0)} FCFA`;

export function SellerDashboard() {
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sales' | 'listings' | 'messages'>('sales');

  const [myListings, setMyListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>({ availableBalance: 0, pendingBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState(currentUser?.phone || '');
  const [withdrawProvider, setWithdrawProvider] = useState<'mtn-momo' | 'orange-money'>('mtn-momo');
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
    if (!accessToken) {
      return { response: null as Response | null, data: { error: 'Unauthorized' } };
    }

    const makeRequest = async (token: string) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...(init || {}),
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
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
      const [listingsResult, ordersResult, messagesResult, walletResult] = await Promise.all([
        requestWithAuthRetry('/listings/user'),
        requestWithAuthRetry('/orders'),
        requestWithAuthRetry('/messages'),
        requestWithAuthRetry('/wallet'),
      ]);

      if (
        listingsResult.response?.status === 401 ||
        ordersResult.response?.status === 401 ||
        messagesResult.response?.status === 401 ||
        walletResult.response?.status === 401
      ) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }

      if (
        !listingsResult.response ||
        !ordersResult.response ||
        !messagesResult.response ||
        !walletResult.response
      ) {
        const message =
          listingsResult.data?.error ||
          ordersResult.data?.error ||
          messagesResult.data?.error ||
          walletResult.data?.error ||
          'Unable to reach server. Ensure API is running and reachable from this device.';
        toast.error(message);
        return;
      }

      if (listingsResult.response.ok) {
        const data = listingsResult.data;
        setMyListings(data.listings || []);
      } else {
        toast.error(listingsResult.data?.details || listingsResult.data?.error || 'Failed to load listings');
      }
      if (ordersResult.response.ok) {
        const data = ordersResult.data;
        const sales = (data.orders || []).filter((order: any) => order.sellerId === currentUser?.id);
        setOrders(sales);
      } else {
        toast.error(ordersResult.data?.error || 'Failed to load orders');
      }
      if (messagesResult.response.ok) {
        const data = messagesResult.data;
        setMessages(data.messages || []);
      } else {
        toast.error(messagesResult.data?.error || 'Failed to load messages');
      }
      if (walletResult.response.ok) {
        const data = walletResult.data;
        setWallet(data.wallet || { availableBalance: 0, pendingBalance: 0 });
      } else {
        toast.error(walletResult.data?.error || 'Failed to load wallet');
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
    const totalListings = myListings.length;
    const activeListings = myListings.filter((item) => item.status === 'available').length;
    const pendingEscrowOrders = orders.filter((order) => order.status === 'paid_pending_delivery').length;
    const releasedOrders = orders.filter((order) => order.status === 'delivered_released').length;
    return {
      totalListings,
      activeListings,
      pendingEscrowOrders,
      releasedOrders,
    };
  }, [myListings, orders]);

  const handleDeleteListing = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      const { response, data } = await requestWithAuthRetry(`/listings/${itemId}`, {
        method: 'DELETE',
      });
      if (!response) {
        toast.error(data?.error || 'Unable to reach server');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to remove listing');
        return;
      }
      toast.success('Listing removed');
      setMyListings((prev) => prev.filter((item) => item.id !== itemId));
    } catch (_error) {
      toast.error('Failed to remove listing');
    }
  };

  const handleWithdraw = async () => {
    if (!accessToken) return;
    const normalizedAmount = withdrawAmount.replace(/\s+/g, '').replace(',', '.');
    const amount = Number(normalizedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setWithdrawing(true);
    try {
      const { response, data } = await requestWithAuthRetry('/wallet/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          provider: withdrawProvider,
          phoneNumber: withdrawPhone,
        }),
      });
      if (!response) {
        toast.error(data?.error || 'Unable to reach server');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Withdrawal failed');
        return;
      }
      const withdrawalStatus = String(data?.withdrawal?.status || '').toLowerCase();
      if (withdrawalStatus === 'processing') {
        toast.success('Withdrawal submitted. Mobile money payout is processing.');
      } else {
        toast.success('Withdrawal completed');
      }
      setWithdrawAmount('');
      setWallet(data.wallet || wallet);
      await fetchData();
    } catch (_error) {
      toast.error('Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-[#111111]"><span className="text-[#05B43D]">{t('ui.seller', 'Seller')}</span> {t('ui.dashboard', 'Dashboard')}</h1>
            <p className="text-muted-foreground">Gérer les annonces, preuves de livraison et libérations de dépôt fiduciaire.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowWithdrawDialog(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              {t('ui.withdraw_funds', 'Withdraw Funds')}
            </Button>
            <Button className="w-full bg-[#05B43D] hover:bg-[#018F2D] sm:w-auto" onClick={() => navigate('/add-listing')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('ui.add_new_listing', 'Add New Listing')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("seller.totalListings", "Listings")}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalListings}</div>
              <p className="text-xs text-muted-foreground">{stats.activeListings} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("seller.pendingOrders", "Pending Escrow")}</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingEscrowOrders}</div>
              <p className="text-xs text-muted-foreground">{t('ui.en_attente_de_confirmation_acheteur', 'En attente de confirmation acheteur')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("order.confirmed", "Released Orders")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.releasedOrders}</div>
              <p className="text-xs text-muted-foreground">Dépôt fiduciaire libéré</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("payment.summary", "Pending Balance")}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatMoney(wallet.pendingBalance || 0)}</div>
              <p className="text-xs text-muted-foreground">Bloqué en dépôt fiduciaire</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("seller.totalEarnings", "Available Balance")}</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMoney(wallet.availableBalance || 0)}</div>
              <p className="text-xs text-muted-foreground">Prêt pour retrait</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sales' | 'listings' | 'messages')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales">Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="listings">My Listings ({myListings.length})</TabsTrigger>
            <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            {orders.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('ui.buyer_orders', 'Buyer Orders')}</CardTitle>
                  <CardDescription>{t('ui.upload_delivery_proof_from_each_order_page_to_unlo', 'Upload delivery proof from each order page to unlock confirmation.')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-lg p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{order.listingTitle || order.itemTitle || 'Order Item'}</p>
                          <Badge variant={order.status === 'delivered_released' ? 'default' : 'secondary'}>
                            {order.statusLabel || order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Buyer: {order.buyerName || 'Buyer'} • Pickup: {order.pickupDate || '-'} {order.pickupTime || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt || '').toLocaleString()} • {order.paymentMethod === 'mtn-momo' ? 'MTN MoMo' : 'Orange Money'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-green-600">{formatMoney(order.amount || 0)}</p>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/seller/order-details/${order.id}`)}>
                          {t('ui.open_order', 'Open Order')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('ui.aucune_vente_pour_l_instant', 'Aucune vente pour l\'instant')}</h3>
                  <p className="text-muted-foreground">Vos commandes acheteurs apparaîtront ici.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="listings">
            {myListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myListings.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img src={item.images?.[0]} alt={item.title} className="w-full h-full object-cover" />
                      <Badge className="absolute top-2 right-2" variant={item.status === 'available' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2">{item.title}</h3>
                      <p className="text-lg font-bold text-green-600 mb-3">{formatMoney(item.price || 0)}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/item/${item.id}`)}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteListing(item.id)}>
                          {t('ui.delete', 'Delete')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('ui.no_listings_yet', 'No listings yet')}</h3>
                  <Button className="bg-[#05B43D] hover:bg-[#018F2D]" onClick={() => navigate('/add-listing')}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('ui.add_listing', 'Add Listing')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>{t('ui.messages', 'Messages')}</CardTitle>
                <CardDescription>{t('ui.chat_with_buyers', 'Chat with buyers.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="bg-[#05B43D] hover:bg-[#018F2D] w-full" onClick={() => navigate('/messages')}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t('ui.open_messages', 'Open Messages')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('ui.retirer_les_fonds', 'Retirer les fonds')}</DialogTitle>
            <DialogDescription>{t('ui.only_available_balance_can_be_withdrawn_to_mobile_', 'Only available balance can be withdrawn to mobile money.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <p className="text-sm text-muted-foreground">{t("payment.summary", "Pending Balance")}</p>
                <p className="text-xl font-semibold text-orange-600">{formatMoney(wallet.pendingBalance || 0)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-sm text-muted-foreground">{t("seller.totalEarnings", "Available Balance")}</p>
                <p className="text-xl font-semibold text-green-600">{formatMoney(wallet.availableBalance || 0)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t('ui.amount', 'Amount')}</Label>
                <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="5000" type="number" min={0} step="any" />
              </div>
              <div className="space-y-2">
                <Label>{t('ui.phone_number', 'Phone Number')}</Label>
                <Input value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} placeholder="671234567" />
              </div>
              <div className="space-y-2">
                <Label>{t('ui.provider', 'Provider')}</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={withdrawProvider}
                  onChange={(e) => setWithdrawProvider(e.target.value as 'mtn-momo' | 'orange-money')}
                >
                  <option value="mtn-momo">{t('ui.mtn_momo', 'MTN MoMo')}</option>
                  <option value="orange-money">{t('ui.orange_money', 'Orange Money')}</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                {t('ui.cancel', 'Cancel')}
              </Button>
              <Button className="bg-[#05B43D] hover:bg-[#018F2D]" disabled={withdrawing} onClick={handleWithdraw}>
                {withdrawing ? 'Processing...' : 'Withdraw to Mobile Money'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

