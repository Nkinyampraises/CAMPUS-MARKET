import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function BuyerReport() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();

  const [category, setCategory] = useState<'seller' | 'listing' | 'transaction' | 'scam_attempt'>('seller');
  const [orderId, setOrderId] = useState('');
  const [listingId, setListingId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
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
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Report Problem</CardTitle>
          <CardDescription>
            Report seller, listing, transaction, or scam attempt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="report-category">Report Type</Label>
            <select
              id="report-category"
              className="w-full border rounded-md h-10 px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as 'seller' | 'listing' | 'transaction' | 'scam_attempt')}
            >
              <option value="seller">Seller</option>
              <option value="listing">Listing</option>
              <option value="transaction">Transaction</option>
              <option value="scam_attempt">Scam Attempt</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="report-order">Order ID (optional)</Label>
            <Input id="report-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-listing">Listing ID (optional)</Label>
            <Input id="report-listing" value={listingId} onChange={(e) => setListingId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-target">Seller/User ID (optional)</Label>
            <Input id="report-target" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened..."
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={submitReport} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
