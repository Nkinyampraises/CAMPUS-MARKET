import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import type { SecurityStatus } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Loader2, ShieldCheck, Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type SetupState = {
  secret: string;
  otpauthUri: string;
};

export function TwoFactorSettings() {
  const { getSecurityStatus, setupTotp, enableTotp, disableTotp, regenerateBackupCodes } = useAuth();
  const { t } = useLanguage();

  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);

  // Enrollment (off -> on) state.
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [enableCode, setEnableCode] = useState('');

  // Disable (on -> off) state.
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableInfo, setDisableInfo] = useState('');

  // Backup codes shown once after enable/regenerate.
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    const next = await getSecurityStatus();
    setStatus(next);
    setLoadingStatus(false);
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginSetup = async () => {
    setBusy(true);
    try {
      const result = await setupTotp();
      if (!result.success || !result.secret || !result.otpauthUri) {
        toast.error(result.error || 'Could not start two-factor setup');
        return;
      }
      setSetup({ secret: result.secret, otpauthUri: result.otpauthUri });
      setEnableCode('');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (enableCode.trim().length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const result = await enableTotp(enableCode.trim());
      if (!result.success) {
        toast.error(result.error || 'Could not enable two-factor authentication');
        return;
      }
      toast.success('Two-factor authentication enabled.');
      setSetup(null);
      setEnableCode('');
      setBackupCodes(result.backupCodes && result.backupCodes.length ? result.backupCodes : null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  // Two-step disable: first call (no code) triggers/asks for a challenge; second
  // call submits the code.
  const handleDisable = async () => {
    setBusy(true);
    try {
      if (!disabling) {
        const result = await disableTotp();
        if (result.success) {
          toast.success('Two-factor authentication disabled.');
          await loadStatus();
          return;
        }
        if (result.requiresChallenge) {
          setDisabling(true);
          setDisableInfo(
            (result as any).verificationCode
              ? `Your confirmation code is ${(result as any).verificationCode}`
              : result.message || 'Enter the confirmation code to disable two-factor.',
          );
          return;
        }
        toast.error(result.error || 'Could not disable two-factor authentication');
        return;
      }

      const result = await disableTotp(disableCode.trim());
      if (!result.success) {
        toast.error(result.error || 'Invalid confirmation code');
        return;
      }
      toast.success('Two-factor authentication disabled.');
      setDisabling(false);
      setDisableCode('');
      setDisableInfo('');
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    if (busy) return;
    if (checked) {
      if (!status?.twoFactorEnabled && !setup) {
        beginSetup();
      }
    } else if (status?.twoFactorEnabled) {
      handleDisable();
    }
  };

  const handleRegenerate = async (challengeCode?: string) => {
    setBusy(true);
    try {
      const result = await regenerateBackupCodes(challengeCode);
      if (result.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
        toast.success('New backup codes generated. Save them now.');
        await loadStatus();
        return;
      }
      if (result.requiresChallenge) {
        const code = window.prompt(
          result.challengeType === 'totp'
            ? 'Enter your authenticator code to generate new backup codes:'
            : 'Enter the confirmation code we emailed you:',
        );
        if (code) {
          await handleRegenerate(code.trim());
        }
        return;
      }
      toast.error(result.error || 'Could not regenerate backup codes');
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard?.writeText(backupCodes.join('\n')).then(
      () => toast.success('Backup codes copied'),
      () => toast.error('Could not copy codes'),
    );
  };

  const enabled = Boolean(status?.twoFactorEnabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t('ui.two_factor_authentication', 'Two-Factor Authentication')}
        </CardTitle>
        <CardDescription>
          {t(
            'ui.two_factor_desc',
            'Add an extra layer of security using an authenticator app (Google Authenticator, Authy, Microsoft Authenticator).',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingStatus ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('ui.loading', 'Loading...')}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-2fa">{t('ui.enable_two_factor', 'Enable Two-Factor Authentication')}</Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? t('ui.two_factor_on', 'Two-factor is currently ON for your account.')
                    : t('ui.two_factor_off', 'Two-factor is currently OFF.')}
                </p>
              </div>
              <Switch
                id="enable-2fa"
                checked={enabled || Boolean(setup)}
                disabled={busy || disabling}
                onCheckedChange={handleToggle}
              />
            </div>

            {/* Enrollment QR + confirm step */}
            {setup && !enabled && (
              <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
                <p className="text-sm font-semibold">
                  {t('ui.scan_qr', '1. Scan this QR code with your authenticator app')}
                </p>
                <div className="flex justify-center rounded-lg bg-white p-3 w-fit mx-auto">
                  <QRCodeSVG value={setup.otpauthUri} size={168} includeMargin />
                </div>
                <p className="text-xs text-muted-foreground break-all text-center">
                  {t('ui.or_enter_secret', 'Or enter this key manually:')}{' '}
                  <span className="font-mono font-semibold text-foreground">{setup.secret}</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="enable-code">{t('ui.enter_code_to_confirm', '2. Enter the 6-digit code to confirm')}</Label>
                  <Input
                    id="enable-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={enableCode}
                    onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-12 text-center text-xl font-bold tracking-[0.4em]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmEnable} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('ui.verify_enable', 'Verify & Enable')}
                  </Button>
                  <Button variant="outline" onClick={() => { setSetup(null); setEnableCode(''); }} disabled={busy}>
                    {t('ui.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}

            {/* Disable confirmation step */}
            {disabling && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <Alert>
                  <AlertDescription>{disableInfo}</AlertDescription>
                </Alert>
                <div className="space-y-1.5">
                  <Label htmlFor="disable-code">{t('ui.confirmation_code', 'Confirmation Code')}</Label>
                  <Input
                    id="disable-code"
                    maxLength={14}
                    placeholder="Authenticator or backup code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 14))}
                    className="h-12 text-center text-lg font-bold tracking-[0.2em]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleDisable} disabled={busy || disableCode.trim().length < 6}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('ui.confirm_disable', 'Confirm Disable')}
                  </Button>
                  <Button variant="outline" onClick={() => { setDisabling(false); setDisableCode(''); setDisableInfo(''); }} disabled={busy}>
                    {t('ui.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}

            {/* Backup codes (shown once) */}
            {backupCodes && (
              <div className="rounded-xl border border-primary/30 bg-primary-soft p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary-strong">
                  <KeyRound className="h-4 w-4" />
                  <p className="text-sm font-bold">{t('ui.backup_codes', 'Backup recovery codes')}</p>
                </div>
                <p className="text-xs text-primary-strong/80">
                  {t('ui.backup_codes_hint', 'Save these now — each code works once and they will not be shown again. Use one if you lose access to your authenticator.')}
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code) => (
                    <span key={code} className="rounded bg-card px-2 py-1 text-center tracking-wider">{code}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyBackupCodes}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> {t('ui.copy', 'Copy')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBackupCodes(null)}>
                    {t('ui.done', 'Done')}
                  </Button>
                </div>
              </div>
            )}

            {/* Manage backup codes when enabled */}
            {enabled && status?.hasTotp && !disabling && !backupCodes && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">
                  {t('ui.backup_codes_remaining', 'Backup codes remaining')}: <span className="font-bold text-foreground">{status.backupCodesRemaining}</span>
                </p>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate()} disabled={busy}>
                  {t('ui.regenerate_codes', 'Regenerate')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
