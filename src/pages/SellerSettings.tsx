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

export function SellerSettings() {
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
        body: JSON.stringify({ currentPassword, newPassword }),
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
      const result = await updateProfile({ notificationPreferences });
      if (!result.success) {
        toast.error(result.error || 'Failed to save notification preferences');
        return;
      }
      await refreshCurrentUser();
      toast.success('Notification preferences updated');
    } catch (_error) {
      toast.error('Failed to save notification preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.seller_settings', 'Seller Settings')}</CardTitle>
          <CardDescription>{t('ui.change_password_and_notification_preferences', 'Change password and notification preferences.')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.change_password', 'Change Password')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seller-current-password">{t('ui.current_password', 'Current Password')}</Label>
            <PasswordInput
              id="seller-current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-new-password">{t('ui.new_password', 'New Password')}</Label>
            <PasswordInput
              id="seller-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-confirm-password">{t('ui.confirm_new_password', 'Confirm New Password')}</Label>
            <PasswordInput
              id="seller-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button className="bg-[#05B43D] hover:bg-[#018F2D]" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.notification_preferences', 'Notification Preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="seller-notif-orders">{t('ui.new_order_alerts', 'New order alerts')}</Label>
            <Switch
              id="seller-notif-orders"
              checked={notificationPreferences.orders}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, orders: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="seller-notif-messages">{t('ui.new_message_alerts', 'New message alerts')}</Label>
            <Switch
              id="seller-notif-messages"
              checked={notificationPreferences.messages}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, messages: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="seller-notif-payouts">{t('ui.payout_status_updates', 'Payout status updates')}</Label>
            <Switch
              id="seller-notif-payouts"
              checked={notificationPreferences.payments}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, payments: Boolean(checked) }))
              }
            />
          </div>
          <Button className="bg-[#05B43D] hover:bg-[#018F2D]" onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

