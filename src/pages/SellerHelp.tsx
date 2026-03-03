import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

const FAQS = [
  {
    q: 'How do I mark an order delivered?',
    a: 'Open seller order details and use the Mark Delivered action to upload proof.',
  },
  {
    q: 'How do disputes work?',
    a: 'Open Seller Disputes, submit details for the order or rental, then track status updates.',
  },
  {
    q: 'How can I contact support?',
    a: 'Use the contact form below to send your issue to admin support.',
  },
];

export function SellerHelp() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const submitSupport = async () => {
    if (!accessToken) return;
    if (!subject.trim() || message.trim().length < 10) {
      toast.error('Provide a subject and at least 10 characters in your message');
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
          category: 'support_seller',
          description: `[${subject.trim()}] ${message.trim()}`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to submit support request');
        return;
      }
      setSubject('');
      setMessage('');
      toast.success('Support request sent');
    } catch (_error) {
      toast.error('Failed to submit support request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Seller Help</CardTitle>
          <CardDescription>FAQs and contact support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FAQS.map((item) => (
            <div key={item.q} className="border rounded-lg p-3">
              <p className="font-medium">{item.q}</p>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seller-help-subject">Subject</Label>
            <Input
              id="seller-help-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Order issue, payout issue, listing issue..."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-help-message">Message</Label>
            <Textarea
              id="seller-help-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue clearly..."
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" disabled={submitting} onClick={submitSupport}>
            {submitting ? 'Sending...' : 'Send to Admin Support'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

