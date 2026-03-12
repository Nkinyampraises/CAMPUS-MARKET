import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function Settings() {
  const navigate = useNavigate();
  const { currentUser, accessToken, updateProfile, refreshCurrentUser } = useAuth();

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

  if (!currentUser) {
    navigate('/login');
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
      const success = await updateProfile({
        notificationPreferences,
        privacyOptions: {
          ...privacyOptions,
          profileVisibility: privacyOptions.profileVisibility as 'public' | 'private',
        },
      });

      if (!success) {
        toast.error('Failed to save settings');
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
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Change password, notification preferences, and privacy options.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-messages">New message received</Label>
            <Switch
              id="notif-messages"
              checked={notificationPreferences.messages}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, messages: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-orders">Order updates</Label>
            <Switch
              id="notif-orders"
              checked={notificationPreferences.orders}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, orders: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-payments">Payment alerts</Label>
            <Switch
              id="notif-payments"
              checked={notificationPreferences.payments}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, payments: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-rentals">Rental reminders</Label>
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
          <CardTitle>Privacy Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="privacy-phone">Show phone on profile</Label>
            <Switch
              id="privacy-phone"
              checked={privacyOptions.showPhone}
              onCheckedChange={(checked) =>
                setPrivacyOptions((prev) => ({ ...prev, showPhone: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="privacy-email">Show email on profile</Label>
            <Switch
              id="privacy-email"
              checked={privacyOptions.showEmail}
              onCheckedChange={(checked) =>
                setPrivacyOptions((prev) => ({ ...prev, showEmail: Boolean(checked) }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-visibility">Profile visibility</Label>
            <select
              id="profile-visibility"
              className="w-full border rounded-md h-10 px-3 text-sm"
              value={privacyOptions.profileVisibility}
              onChange={(e) =>
                setPrivacyOptions((prev) => ({
                  ...prev,
                  profileVisibility: e.target.value === 'private' ? 'private' : 'public',
                }))
              }
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
