import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const formatMoney = (value: number) =>
  `${Math.round(value || 0).toLocaleString('fr-FR')} FCFA`;

const paymentLabel = (method: string) => {
  if (method === 'mtn-momo') return 'MTN MoMo';
  if (method === 'orange-money') return 'Orange Money';
  if (method === 'cash') return 'Cash';
  return method || 'Unknown';
};

export function BuyerPayments() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filterMethod, setFilterMethod] = useState<'all' | 'mtn-momo' | 'orange-money' | 'cash'>('all');

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!accessToken || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/transactions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(data.error || 'Failed to load payment history');
          return;
        }
        const myTransactions = (data.transactions || []).filter((tx: any) => tx.buyerId === currentUser.id);
        setTransactions(myTransactions);
      } catch (_error) {
        toast.error('Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchTransactions();
  }, [accessToken, currentUser, navigate]);

  const filtered = useMemo(() => {
    if (filterMethod === 'all') return transactions;
    return transactions.filter((tx) => tx.paymentMethod === filterMethod);
  }, [transactions, filterMethod]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.payment_history', 'Payment History')}</CardTitle>
          <CardDescription>{t('ui.all_your_transaction_records', 'All your transaction records')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <label htmlFor="payment-method-filter" className="text-sm text-muted-foreground">{t('ui.filter_by', 'Filter by:')}</label>
            <select
              id="payment-method-filter"
              className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as 'all' | 'mtn-momo' | 'orange-money' | 'cash')}
            >
              <option value="all">All</option>
              <option value="mtn-momo">{t('ui.mtn_momo', 'MTN MoMo')}</option>
              <option value="orange-money">{t('ui.orange_money', 'Orange Money')}</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('ui.loading_transactions', 'Loading transactions...')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ui.no_transactions_found_for_this_filter', 'No transactions found for this filter.')}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{transaction.listingTitle || transaction.itemId || t('ui.transaction', 'Transaction')}</p>
                      <Badge variant="secondary">{paymentLabel(transaction.paymentMethod)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('ui.reference', 'Reference:')} {transaction.transactionRef || '-'}</p>
                    <p className="text-sm text-muted-foreground">{t('ui.status', 'Status:')} {transaction.statusLabel || transaction.status || '-'}</p>
                    <p className="text-sm text-muted-foreground">{new Date(transaction.createdAt || transaction.timestamp || '').toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-primary">{formatMoney(transaction.amount || 0)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/buyer/receipt/${transaction.id}?kind=transaction`)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('ui.download_receipt', 'Download Receipt')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
