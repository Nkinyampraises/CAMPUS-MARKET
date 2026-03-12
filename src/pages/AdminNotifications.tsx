import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Bell, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  target: 'all' | 'buyers' | 'sellers';
  createdAt: string;
}

interface SupportReport {
  id: string;
  category: string;
  description: string;
  reporterId: string;
  reporterName?: string;
  status: 'open' | 'reviewed' | 'resolved' | 'rejected';
  adminNote?: string;
  createdAt: string;
}

export function AdminNotifications() {
  const { accessToken } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [supportReports, setSupportReports] = useState<SupportReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioningReportId, setActioningReportId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [target, setTarget] = useState<'all' | 'buyers' | 'sellers'>('all');

  const fetchBroadcasts = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/admin/broadcasts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to load broadcasts');
        return;
      }
      setBroadcasts(data.broadcasts || []);
    } catch (error) {
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportReports = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/admin/reports`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to load reports');
        return;
      }
      const reports = Array.isArray(data.reports) ? data.reports : [];
      setSupportReports(reports);
    } catch (_error) {
      toast.error('Failed to load reports');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    fetchSupportReports();
  }, [accessToken]);

  const updateSupportReportStatus = async (
    reportId: string,
    status: 'reviewed' | 'resolved' | 'rejected',
  ) => {
    if (!accessToken) return;
    setActioningReportId(reportId);
    try {
      const adminNote = (prompt('Optional admin note') || '').trim();
      const response = await fetch(`${API_URL}/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status,
          adminNote,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to update report');
        return;
      }
      setSupportReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, status, adminNote: adminNote || report.adminNote || '' }
            : report,
        ),
      );
      toast.success(`Report marked as ${status}`);
    } catch (_error) {
      toast.error('Failed to update report');
    } finally {
      setActioningReportId('');
    }
  };

  const handleSend = async () => {
    if (!accessToken) return;
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/admin/broadcasts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          target,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to send broadcast');
        return;
      }

      setBroadcasts((prev) => [data.broadcast, ...prev]);
      setTitle('');
      setMessage('');
      setPriority('normal');
      setTarget('all');
      toast.success('Broadcast sent successfully');
    } catch (error) {
      toast.error('Failed to send broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Send Broadcast</CardTitle>
          <CardDescription>Send announcements to buyers, sellers, or all users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input
              id="broadcast-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Platform maintenance notice"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement..."
              className="min-h-28"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: 'normal' | 'high' | 'urgent') => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target</Label>
              <Select value={target} onValueChange={(v: 'all' | 'buyers' | 'sellers') => setTarget(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="buyers">Buyers only</SelectItem>
                  <SelectItem value="sellers">Sellers only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleSend}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Broadcast
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reports Inbox</CardTitle>
          <CardDescription>All buyer/seller reports and support requests received by admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportLoading ? (
            <div className="text-sm text-muted-foreground">Loading reports...</div>
          ) : supportReports.length === 0 ? (
            <div className="text-sm text-muted-foreground">No reports yet.</div>
          ) : (
            supportReports.map((report) => (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{report.category}</Badge>
                    <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">{report.description}</p>
                <p className="text-xs text-muted-foreground mb-2">From: {report.reporterName || report.reporterId}</p>
                {report.adminNote ? (
                  <p className="text-xs text-muted-foreground mb-2">Admin note: {report.adminNote}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actioningReportId === report.id}
                    onClick={() => updateSupportReportStatus(report.id, 'reviewed')}
                  >
                    Mark Reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actioningReportId === report.id}
                    onClick={() => updateSupportReportStatus(report.id, 'resolved')}
                  >
                    Mark Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actioningReportId === report.id}
                    onClick={() => updateSupportReportStatus(report.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
          <CardDescription>Latest announcements sent from admin dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading broadcasts...</div>
          ) : broadcasts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No broadcasts yet.</div>
          ) : (
            broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{broadcast.title}</div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{broadcast.target}</Badge>
                    <Badge
                      variant={broadcast.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className={broadcast.priority === 'high' ? 'bg-orange-100 text-orange-700' : ''}
                    >
                      {broadcast.priority}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{broadcast.message}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {new Date(broadcast.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
