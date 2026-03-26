import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Loader2, MailCheck } from 'lucide-react';
import { API_URL } from '@/lib/api';

type ConfirmationStatus = 'loading' | 'success' | 'error';

export function ConfirmEmail() {
  const [status, setStatus] = useState<ConfirmationStatus>('loading');
  const [message, setMessage] = useState('Confirming your email...');

  const token = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('token') || '';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const confirmEmail = async () => {
      if (!token) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Invalid or missing confirmation token.');
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/confirm-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!cancelled) {
            setStatus('error');
            setMessage(data.error || 'Failed to confirm email.');
          }
          return;
        }

        if (!cancelled) {
          setStatus('success');
          setMessage(data.message || 'Email confirmed successfully. You can now log in.');
        }
      } catch (_error) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Failed to confirm email.');
        }
      }
    };

    confirmEmail();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              {status === 'loading' ? (
                <Loader2 className="h-6 w-6 text-green-600 animate-spin" />
              ) : (
                <MailCheck className="h-6 w-6 text-green-600" />
              )}
            </div>
          </div>
          <CardTitle>Confirm your email</CardTitle>
          <CardDescription>We’re checking your confirmation link.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full bg-green-600 hover:bg-green-700">
            <Link to="/login">Go to login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
