import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function SellerReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, accessToken } = useAuth();

  const [category, setCategory] = useState<'buyer' | 'listing_issue' | 'transaction_dispute'>('buyer');
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || '');
  const [listingId, setListingId] = useState(searchParams.get('listingId') || '');
  const [targetUserId, setTargetUserId] = useState(searchParams.get('targetUserId') || '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const submitReport = async () => {
    if (!accessToken) return;
    if (description.trim().length < 10) {
      toast.error('Please provide at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          category,
          orderId: orderId.trim(),
          listingId: listingId.trim(),
          targetUserId: targetUserId.trim(),
          description: description.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to submit report');
        return;
      }
      setOrderId('');
      setListingId('');
      setTargetUserId('');
      setDescription('');
      toast.success('Report submitted');
    } catch (_error) {
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.seller_reports', 'Seller Reports')}</CardTitle>
          <CardDescription>{t('ui.report_buyer_listing_issues_or_transaction_dispute', 'Report buyer, listing issues, or transaction disputes.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seller-report-category">{t('ui.report_type', 'Report Type')}</Label>
            <select
              id="seller-report-category"
              className="w-full border rounded-md h-10 px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as 'buyer' | 'listing_issue' | 'transaction_dispute')}
            >
              <option value="buyer">{t('ui.buyer', 'Buyer')}</option>
              <option value="listing_issue">{t('ui.listing_issue', 'Listing Issue')}</option>
              <option value="transaction_dispute">{t('ui.transaction_dispute', 'Transaction Dispute')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="seller-report-order">{t('ui.order_id_optional', 'Order ID (optional)')}</Label>
            <Input id="seller-report-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-report-listing">{t('ui.listing_id_optional', 'Listing ID (optional)')}</Label>
            <Input id="seller-report-listing" value={listingId} onChange={(e) => setListingId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-report-target">{t('ui.buyer_user_id_optional', 'Buyer/User ID (optional)')}</Label>
            <Input id="seller-report-target" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-report-description">{t('ui.description', 'Description')}</Label>
            <Textarea
              id="seller-report-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened..."
            />
          </div>
          <Button className="bg-[#05B43D] hover:bg-[#018F2D]" onClick={submitReport} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

