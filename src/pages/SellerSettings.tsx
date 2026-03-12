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

export function SellerSettings() {
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
      const success = await updateProfile({ notificationPreferences });
      if (!success) {
        toast.error('Failed to save notification preferences');
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
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Seller Settings</CardTitle>
          <CardDescription>Change password and notification preferences.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seller-current-password">Current Password</Label>
            <Input
              id="seller-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-new-password">New Password</Label>
            <Input
              id="seller-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seller-confirm-password">Confirm New Password</Label>
            <Input
              id="seller-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            <Label htmlFor="seller-notif-orders">New order alerts</Label>
            <Switch
              id="seller-notif-orders"
              checked={notificationPreferences.orders}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, orders: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="seller-notif-messages">New message alerts</Label>
            <Switch
              id="seller-notif-messages"
              checked={notificationPreferences.messages}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, messages: Boolean(checked) }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="seller-notif-payouts">Payout status updates</Label>
            <Switch
              id="seller-notif-payouts"
              checked={notificationPreferences.payments}
              onCheckedChange={(checked) =>
                setNotificationPreferences((prev) => ({ ...prev, payments: Boolean(checked) }))
              }
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

