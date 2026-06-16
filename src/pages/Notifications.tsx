import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export function Notifications() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();
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
      <div className="mb-4 flex items-center justify-end">
        <Button variant="outline" onClick={markAllAsRead} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4 mr-2" />
          {t('ui.mark_all_read', 'Mark All Read')}
        </Button>
      </div>

      <Card className="border border-border bg-card shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t('ui.notifications', 'Notifications')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('notifications.description', 'New message received · Seller replied · Order confirmed · Payment successful · Rental ending soon')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('ui.loading_notifications', 'Loading notifications...')}</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ui.no_notifications_yet', 'No notifications yet.')}</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 rounded-lg border border-border p-4 transition-colors ${notification.read ? 'bg-card' : 'bg-accent'}`}
                >
                  <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                    <Bell className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-foreground">{notification.title || t('notifications.fallbackTitle', 'Notification')}</p>
                      <div className="flex items-center gap-2">
                        {notification.read ? (
                          <Badge variant="secondary">{t('notifications.read', 'Read')}</Badge>
                        ) : (
                          <Badge>{t('notifications.new', 'New')}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{notification.message}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt || '').toLocaleString()}
                      </p>
                      {!notification.read ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => markSingleAsRead(notification.id)}
                        >
                          {t('notifications.markRead', 'Mark as read')}
                        </Button>
                      ) : null}
                    </div>
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
