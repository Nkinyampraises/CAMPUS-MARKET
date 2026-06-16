import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export function Settings() {
  const navigate = useNavigate();
  const { currentUser, accessToken, updateProfile, refreshCurrentUser } = useAuth();
  const { t } = useLanguage();

  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [notificationPreferences, setNotificationPreferences] = useState({
    messages: currentUser?.notificationPreferences?.messages ?? true,
    orders: currentUser?.notificationPreferences?.orders ?? true,
    payments: currentUser?.notificationPreferences?.payments ?? true,
    rentals: currentUser?.notificationPreferences?.rentals ?? true,
  });

  const [privacyOptions, setPrivacyOptions] = useState({
    showPhone: currentUser?.privacyOptions?.showPhone ?? true,
    showEmail: currentUser?.privacyOptions?.showEmail ?? false,
    profileVisibility: currentUser?.privacyOptions?.profileVisibility ?? 'public',
  });

  const passwordValid = useMemo(
    () => newPassword.length >= 6 && newPassword === confirmPassword,
    [newPassword, confirmPassword],
  );

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  const handleChangePassword = async () => {
    if (!accessToken) return;
    if (!passwordValid) {
      toast.error('Password must be at least 6 characters and match confirmation');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to change password');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (_error) {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const result = await updateProfile({
        notificationPreferences,
        privacyOptions: {
          ...privacyOptions,
          profileVisibility: privacyOptions.profileVisibility as 'public' | 'private',
        },
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to save settings');
        return;
      }
      if (refreshCurrentUser) {
        await refreshCurrentUser();
      }
      toast.success('Settings updated');
    } catch (_error) {
      toast.error('Failed to save settings');
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.settings', 'Settings')}</CardTitle>
          <CardDescription>{t('ui.change_password_notification_preferences_and_priva', 'Change password, notification preferences, and privacy options.')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.change_password', 'Change Password')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">{t('ui.current_password', 'Current Password')}</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">{t('ui.new_password', 'New Password')}</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">{t('ui.confirm_new_password', 'Confirm New Password')}</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? t('ui.updating', 'Updating...') : t('ui.update_password', 'Update Password')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.notification_preferences', 'Notification Preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-messages">{t('ui.new_message_received', 'New message received')}</Label>
            <Switch
              id="notif-messages"
              checked={notificationPreferences.messages}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, messages: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-orders">{t('ui.order_updates', 'Order updates')}</Label>
            <Switch
              id="notif-orders"
              checked={notificationPreferences.orders}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, orders: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-payments">{t('ui.payment_alerts', 'Payment alerts')}</Label>
            <Switch
              id="notif-payments"
              checked={notificationPreferences.payments}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, payments: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-rentals">{t('ui.rental_reminders', 'Rental reminders')}</Label>
            <Switch
              id="notif-rentals"
              checked={notificationPreferences.rentals}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, rentals: Boolean(checked) }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.privacy_options', 'Privacy Options')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="privacy-phone">{t('ui.show_phone_on_profile', 'Show phone on profile')}</Label>
            <Switch
              id="privacy-phone"
              checked={privacyOptions.showPhone}
              onCheckedChange={(checked) =>
                setPrivacyOptions((prev) => ({ ...prev, showPhone: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="privacy-email">{t('ui.show_email_on_profile', 'Show email on profile')}</Label>
            <Switch
              id="privacy-email"
              checked={privacyOptions.showEmail}
              onCheckedChange={(checked) =>
                setPrivacyOptions((prev) => ({ ...prev, showEmail: Boolean(checked) }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-visibility">{t('ui.profile_visibility', 'Profile visibility')}</Label>
            <select
              id="profile-visibility"
              className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={privacyOptions.profileVisibility}
              onChange={(e) =>
                setPrivacyOptions((prev) => ({
                  ...prev,
                  profileVisibility: e.target.value === 'private' ? 'private' : 'public',
                }))
              }
            >
              <option value="public">{t('ui.public', 'Public')}</option>
              <option value="private">{t('ui.private', 'Private')}</option>
            </select>
          </div>
          <Button onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? t('ui.saving', 'Saving...') : t('ui.save_preferences', 'Save Preferences')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

