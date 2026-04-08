import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

interface AdminSettingsData {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  platformCommissionPercent: number;
  payoutFeePercent: number;
  minimumPayoutAmount: number;
  autoPayoutToMobileMoney: boolean;
}

const defaultSettings: AdminSettingsData = {
  platformName: 'UNITRADE',
  supportEmail: 'support@UNITRADE.cm',
  maintenanceMode: false,
  allowNewRegistrations: true,
  platformCommissionPercent: 5,
  payoutFeePercent: 5,
  minimumPayoutAmount: 1000,
  autoPayoutToMobileMoney: false,
};

export function AdminSettings() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<AdminSettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to load settings');
        return;
      }
      setSettings({ ...defaultSettings, ...(data.settings || {}) });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to save settings');
        return;
      }
      setSettings({ ...defaultSettings, ...(data.settings || {}) });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Settings</CardTitle>
        <CardDescription>Configure global platform behavior and payout rules.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input
              id="platform-name"
              value={settings.platformName}
              onChange={(e) => setSettings((prev) => ({ ...prev, platformName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">Support Email</Label>
            <Input
              id="support-email"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings((prev) => ({ ...prev, supportEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-fee">Platform Commission Percent</Label>
            <Input
              id="payout-fee"
              type="number"
              min={0}
              step={0.1}
              value={settings.platformCommissionPercent}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  platformCommissionPercent: Number(e.target.value) || 0,
                  payoutFeePercent: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-minimum">Minimum Payout Amount</Label>
            <Input
              id="payout-minimum"
              type="number"
              min={0}
              value={settings.minimumPayoutAmount}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, minimumPayoutAmount: Number(e.target.value) || 0 }))
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 border rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Disable normal operations during maintenance.</p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              className="self-end sm:self-auto"
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, maintenanceMode: checked }))}
            />
          </div>
          <div className="flex flex-col gap-3 border rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Allow New Registrations</p>
              <p className="text-xs text-muted-foreground">Enable or disable new user signups.</p>
            </div>
            <Switch
              checked={settings.allowNewRegistrations}
              className="self-end sm:self-auto"
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, allowNewRegistrations: checked }))
              }
            />
          </div>
          <div className="flex flex-col gap-3 border rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Auto Payout to MTN on Release</p>
              <p className="text-xs text-muted-foreground">When enabled, released MTN escrow payments are auto-sent to seller mobile money.</p>
            </div>
            <Switch
              checked={settings.autoPayoutToMobileMoney}
              className="self-end sm:self-auto"
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, autoPayoutToMobileMoney: checked }))
              }
            />
          </div>
        </div>

        <Button className="w-full bg-green-600 hover:bg-green-700 sm:w-auto" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

