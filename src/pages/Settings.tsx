import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Input } from '@/app/components/ui/input';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';

export function Settings() {
  const navigate = useNavigate();
  const { currentUser, accessToken, updateProfile, refreshCurrentUser, changeEmail, verifyEmailCode } = useAuth();
  const { t } = useLanguage();

  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Step-up challenge shown when changing the password requires confirmation
  // (authenticator/backup code for 2FA users, or an emailed code otherwise).
  const [pwChallenge, setPwChallenge] = useState(false);
  const [pwChallengeType, setPwChallengeType] = useState<'totp' | 'email'>('email');
  const [pwChallengeInfo, setPwChallengeInfo] = useState('');
  const [pwChallengeCode, setPwChallengeCode] = useState('');

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

  // Change-email flow (gated by a step-up challenge, then verify the new address).
  const [emailNew, setEmailNew] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailChallenge, setEmailChallenge] = useState(false);
  const [emailChallengeType, setEmailChallengeType] = useState<'totp' | 'email'>('email');
  const [emailChallengeInfo, setEmailChallengeInfo] = useState('');
  const [emailChallengeCode, setEmailChallengeCode] = useState('');
  const [emailVerifyStep, setEmailVerifyStep] = useState(false);
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailVerifyInfo, setEmailVerifyInfo] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

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
          ...(pwChallenge ? { challengeCode: pwChallengeCode.trim() } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to change password');
        return;
      }

      // A step-up confirmation is required before the change is applied.
      if (data?.success === false && data?.requiresChallenge) {
        setPwChallenge(true);
        setPwChallengeType(data?.challengeType === 'totp' ? 'totp' : 'email');
        setPwChallengeInfo(
          data?.verificationCode
            ? `Your confirmation code is ${data.verificationCode}`
            : data?.message ||
                (data?.challengeType === 'totp'
                  ? 'Enter the code from your authenticator app to confirm.'
                  : 'Enter the confirmation code we emailed you.'),
        );
        if (data?.error) toast.error(data.error);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwChallenge(false);
      setPwChallengeCode('');
      setPwChallengeInfo('');
      toast.success('Password changed successfully');
    } catch (_error) {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!emailNew.trim() || !emailPassword) {
      toast.error('Enter your new email and current password');
      return;
    }
    setChangingEmail(true);
    try {
      const result = await changeEmail(
        emailNew.trim(),
        emailPassword,
        emailChallenge ? emailChallengeCode.trim() : undefined,
      );

      if (result.requiresChallenge) {
        setEmailChallenge(true);
        setEmailChallengeType(result.challengeType === 'totp' ? 'totp' : 'email');
        setEmailChallengeInfo(
          result.verificationCode
            ? `Your confirmation code is ${result.verificationCode}`
            : result.message ||
                (result.challengeType === 'totp'
                  ? 'Enter the code from your authenticator app to confirm.'
                  : 'Enter the confirmation code we emailed you.'),
        );
        if (result.error) toast.error(result.error);
        return;
      }

      if (!result.success) {
        toast.error(result.error || 'Could not change email');
        return;
      }

      // Email changed — now verify the new address with the code that was sent.
      toast.success(result.message || 'Email updated. Verify your new address.');
      setEmailChallenge(false);
      setEmailChallengeCode('');
      setEmailVerifyStep(true);
      setEmailVerifyInfo(
        result.verificationCode
          ? `Your verification code is ${result.verificationCode}`
          : 'Enter the 6-digit code we sent to your new email address.',
      );
    } catch (_error) {
      toast.error('Could not change email');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleVerifyNewEmail = async () => {
    if (emailVerifyCode.trim().length !== 6) {
      toast.error('Enter the 6-digit verification code');
      return;
    }
    setChangingEmail(true);
    try {
      const result = await verifyEmailCode(emailNew.trim().toLowerCase(), emailVerifyCode.trim());
      if (!result.success) {
        toast.error(result.error || 'Invalid verification code');
        return;
      }
      toast.success('New email verified successfully');
      setEmailVerifyStep(false);
      setEmailVerifyCode('');
      setEmailNew('');
      setEmailPassword('');
      if (refreshCurrentUser) await refreshCurrentUser();
    } catch (_error) {
      toast.error('Could not verify new email');
    } finally {
      setChangingEmail(false);
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
          {pwChallenge && (
            <div className="space-y-1 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
              <Alert>
                <AlertDescription>{pwChallengeInfo}</AlertDescription>
              </Alert>
              <Label htmlFor="pw-challenge-code">{t('ui.confirmation_code', 'Confirmation Code')}</Label>
              <Input
                id="pw-challenge-code"
                maxLength={pwChallengeType === 'totp' ? 14 : 6}
                placeholder={pwChallengeType === 'totp' ? 'Authenticator or backup code' : '000000'}
                value={pwChallengeCode}
                onChange={(e) =>
                  setPwChallengeCode(
                    pwChallengeType === 'totp'
                      ? e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 14)
                      : e.target.value.replace(/\D/g, '').slice(0, 6),
                  )
                }
              />
            </div>
          )}
          <Button onClick={handleChangePassword} disabled={changingPassword || (pwChallenge && pwChallengeCode.trim().length < 6)}>
            {changingPassword
              ? t('ui.updating', 'Updating...')
              : pwChallenge
                ? t('ui.confirm_change', 'Confirm Change')
                : t('ui.update_password', 'Update Password')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.change_email', 'Change Email')}</CardTitle>
          <CardDescription>{t('ui.current_email', 'Current email')}: {currentUser.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailVerifyStep ? (
            <>
              <Alert>
                <AlertDescription>{emailVerifyInfo}</AlertDescription>
              </Alert>
              <div className="space-y-1">
                <Label htmlFor="email-verify-code">{t('ui.verification_code', 'Verification Code')}</Label>
                <Input
                  id="email-verify-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={emailVerifyCode}
                  onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <Button onClick={handleVerifyNewEmail} disabled={changingEmail}>
                {changingEmail ? t('ui.verifying', 'Verifying...') : t('ui.verify_email', 'Verify Email')}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="new-email">{t('ui.new_email', 'New Email')}</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={emailNew}
                  onChange={(e) => setEmailNew(e.target.value)}
                  placeholder="you@university.edu"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email-current-password">{t('ui.current_password', 'Current Password')}</Label>
                <PasswordInput
                  id="email-current-password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Current password"
                />
              </div>
              {emailChallenge && (
                <div className="space-y-1 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
                  <Alert>
                    <AlertDescription>{emailChallengeInfo}</AlertDescription>
                  </Alert>
                  <Label htmlFor="email-challenge-code">{t('ui.confirmation_code', 'Confirmation Code')}</Label>
                  <Input
                    id="email-challenge-code"
                    maxLength={emailChallengeType === 'totp' ? 14 : 6}
                    placeholder={emailChallengeType === 'totp' ? 'Authenticator or backup code' : '000000'}
                    value={emailChallengeCode}
                    onChange={(e) =>
                      setEmailChallengeCode(
                        emailChallengeType === 'totp'
                          ? e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 14)
                          : e.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                  />
                </div>
              )}
              <Button
                onClick={handleChangeEmail}
                disabled={changingEmail || (emailChallenge && emailChallengeCode.trim().length < 6)}
              >
                {changingEmail
                  ? t('ui.updating', 'Updating...')
                  : emailChallenge
                    ? t('ui.confirm_change', 'Confirm Change')
                    : t('ui.update_email', 'Update Email')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <TwoFactorSettings />

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

