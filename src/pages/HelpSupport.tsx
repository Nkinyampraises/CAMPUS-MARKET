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

import { API_URL } from '@/lib/api';

const FAQS = [
  {
    q: 'How do I confirm an order?',
    a: 'Open the order details page and confirm delivery after the seller uploads proof.',
  },
  {
    q: 'How do I request a refund?',
    a: 'From order details, choose refund and include a clear issue reason.',
  },
  {
    q: 'How do I contact support?',
    a: 'Use the support form below. Your request is sent to admins as a support report.',
  },
];

export function HelpSupport() {
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
          category: 'support',
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
          <CardTitle>Help / Support</CardTitle>
          <CardDescription>FAQs and contact admin support form.</CardDescription>
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
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Payment issue, order issue, account issue..."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
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
