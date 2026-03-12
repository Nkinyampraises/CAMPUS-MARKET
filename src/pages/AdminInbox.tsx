import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

type ReportStatus = 'open' | 'reviewed' | 'resolved' | 'rejected';

export function AdminInbox() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningReportId, setActioningReportId] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'support' | 'report'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');

  const fetchReports = async (silent = false) => {
    if (!accessToken) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/admin/reports`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Failed to load inbox');
        return;
      }
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (_error) {
      toast.error('Failed to load inbox');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchReports();
  }, [currentUser, accessToken]);

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      const isSupport = report?.category === 'support' || report?.category === 'support_seller';
      const matchesCategory =
        categoryFilter === 'all'
          ? true
          : categoryFilter === 'support'
            ? isSupport
            : !isSupport;
      const matchesStatus = statusFilter === 'all' || report?.status === statusFilter;
      const haystack = [
        report?.category,
        report?.description,
        report?.reporterName,
        report?.targetUserName,
        report?.id,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      const matchesQuery = !q || haystack.includes(q);
      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [reports, query, categoryFilter, statusFilter]);

  const updateReportStatus = async (reportId: string, status: ReportStatus) => {
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
      setReports((prev) =>
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
        <Button variant="outline" onClick={() => fetchReports(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Inbox</CardTitle>
          <CardDescription>All contact support and report problem submissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="border rounded-md h-10 px-3 text-sm md:col-span-2"
              placeholder="Search by category, description, user..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="border rounded-md h-10 px-3 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'support' | 'report')}
            >
              <option value="all">All Types</option>
              <option value="support">Support</option>
              <option value="report">Reports</option>
            </select>
            <select
              className="border rounded-md h-10 px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ReportStatus)}
            >
              <option value="all">All Statuses</option>
              <option value="open">open</option>
              <option value="reviewed">reviewed</option>
              <option value="resolved">resolved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading inbox...</p>
          ) : filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions found.</p>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const isSupport = report?.category === 'support' || report?.category === 'support_seller';
                return (
                  <div key={report.id} className="border rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{isSupport ? 'support' : 'report'}</Badge>
                        <Badge variant="secondary">{report.category || '-'}</Badge>
                        <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>
                          {report.status || 'open'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {report.createdAt ? new Date(report.createdAt).toLocaleString() : '-'}
                      </span>
                    </div>
                    <p className="text-sm mb-2">{report.description || '-'}</p>
                    <p className="text-xs text-muted-foreground">
                      From: {report.reporterName || report.reporterId || '-'}
                      {report.targetUserName ? ` | Target: ${report.targetUserName}` : ''}
                    </p>
                    {report.adminNote ? (
                      <p className="text-xs text-muted-foreground mt-1">Admin note: {report.adminNote}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningReportId === report.id}
                        onClick={() => updateReportStatus(report.id, 'reviewed')}
                      >
                        Mark Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningReportId === report.id}
                        onClick={() => updateReportStatus(report.id, 'resolved')}
                      >
                        Mark Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningReportId === report.id}
                        onClick={() => updateReportStatus(report.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

