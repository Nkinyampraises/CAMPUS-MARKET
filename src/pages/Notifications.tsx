import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function Notifications() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to load notifications');
        return;
      }
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (_error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [currentUser, accessToken]);

  const markAllAsRead = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to update notifications');
        return;
      }
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (_error) {
      toast.error('Failed to update notifications');
    }
  };

  const markSingleAsRead = async (notificationId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return;
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Keep silent for single item updates.
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button variant="outline" onClick={markAllAsRead} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4 mr-2" />
          Mark All Read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            New message received · Seller replied · Order confirmed · Payment successful · Rental ending soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className="w-full text-left border rounded-lg p-4 hover:bg-muted/40 transition-colors"
                  onClick={() => markSingleAsRead(notification.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold">{notification.title || 'Notification'}</p>
                    <div className="flex items-center gap-2">
                      {notification.read ? (
                        <Badge variant="secondary">Read</Badge>
                      ) : (
                        <Badge>New</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt || '').toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
