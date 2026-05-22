import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { RefreshCw, X, MessageSquare, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

type ReportStatus = 'open' | 'reviewed' | 'resolved' | 'rejected';

export function AdminInbox() {
  const navigate = useNavigate();
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [actioningReportId, setActioningReportId] = useState('');
  const [reports, setReports]                 = useState<any[]>([]);
  const [conversations, setConversations]     = useState<any[]>([]);
  const [activeTab, setActiveTab]             = useState<'reports' | 'conversations'>('conversations');
  const [query, setQuery]                     = useState('');
  const [categoryFilter, setCategoryFilter]   = useState<'all' | 'support' | 'report'>('all');
  const [statusFilter, setStatusFilter]       = useState<'all' | ReportStatus>('all');

  // Conversation viewer state
  const [viewingConv, setViewingConv]         = useState<any | null>(null);
  const [convMessages, setConvMessages]       = useState<any[]>([]);
  const [loadingConv, setLoadingConv]         = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchReports = async (silent = false) => {
    if (!accessToken) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res  = await fetch(`${API_URL}/admin/reports`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || 'Failed to load inbox'); return; }
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch { toast.error('Failed to load inbox'); }
    finally   { setRefreshing(false); setLoading(false); }
  };

  const fetchConversations = async () => {
    if (!accessToken) return;
    try {
      const res  = await fetch(`${API_URL}/admin/all-conversations`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch { /* ignore */ }
  };

  const openConversation = async (conv: any) => {
    setViewingConv(conv);
    setConvMessages([]);
    setLoadingConv(true);
    try {
      const res  = await fetch(
        `${API_URL}/admin/conversation?user1=${conv.user1.id}&user2=${conv.user2.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await res.json().catch(() => ({}));
      setConvMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch { toast.error('Could not load conversation'); }
    finally   { setLoadingConv(false); }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') { navigate('/'); return; }
    fetchReports();
    fetchConversations();
  }, [currentUser, accessToken]);

  // ── Report filtering ───────────────────────────────────────────────────────

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const isSupport = r?.category === 'support' || r?.category === 'support_seller';
      const matchesCategory =
        categoryFilter === 'all' ? true
        : categoryFilter === 'support' ? isSupport
        : !isSupport;
      const matchesStatus = statusFilter === 'all' || r?.status === statusFilter;
      const matchesQuery  = !q || JSON.stringify(r).toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [reports, query, categoryFilter, statusFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const updateReportStatus = async (reportId: string, status: ReportStatus) => {
    if (!accessToken) return;
    setActioningReportId(reportId);
    try {
      const res  = await fetch(`${API_URL}/admin/reports/${reportId}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || 'Failed to update'); return; }
      toast.success('Status updated');
      fetchReports(true);
    } catch { toast.error('Failed to update'); }
    finally   { setActioningReportId(''); }
  };

  // ── Conversation viewer ────────────────────────────────────────────────────

  if (viewingConv) {
    return (
      <div className="container mx-auto max-w-4xl px-3 py-8 sm:px-4 space-y-4">
        <button
          type="button"
          onClick={() => setViewingConv(null)}
          className="flex items-center gap-2 text-sm font-medium text-[#05B43D] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to all conversations
        </button>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-[#05B43D]" />
                  Conversation between{' '}
                  <span className="text-[#05B43D]">{viewingConv.user1?.name}</span>
                  {' '}↔{' '}
                  <span className="text-blue-600">{viewingConv.user2?.name}</span>
                </CardTitle>
                <CardDescription>
                  {viewingConv.messageCount} messages · Last active:{' '}
                  {viewingConv.latestAt ? new Date(viewingConv.latestAt).toLocaleString() : 'Unknown'}
                </CardDescription>
              </div>
              <button type="button" title="Close conversation" onClick={() => setViewingConv(null)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingConv ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading messages…</div>
            ) : convMessages.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No messages found.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {convMessages.map((msg) => {
                  const isUser1 = msg.senderId === viewingConv.user1?.id;
                  const senderName = isUser1 ? viewingConv.user1?.name : viewingConv.user2?.name;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isUser1 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        isUser1
                          ? 'bg-[#F3F5F4] text-[#111111] rounded-tl-sm'
                          : 'bg-[#05B43D] text-white rounded-tr-sm'
                      }`}>
                        <p className={`mb-1 text-[10px] font-bold ${isUser1 ? 'text-[#8A8A8A]' : 'text-white/70'}`}>
                          {senderName}
                        </p>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`mt-1 text-[10px] ${isUser1 ? 'text-[#8A8A8A]' : 'text-white/60'}`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          {' · '}
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : ''}
                        </p>
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

  // ── Main inbox ─────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-3 py-8 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'conversations' ? 'default' : 'outline'}
            className={activeTab === 'conversations' ? 'bg-[#05B43D] hover:bg-[#018F2D]' : ''}
            onClick={() => { setActiveTab('conversations'); fetchConversations(); }}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            All Conversations ({conversations.length})
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'default' : 'outline'}
            className={activeTab === 'reports' ? 'bg-[#05B43D] hover:bg-[#018F2D]' : ''}
            onClick={() => setActiveTab('reports')}
          >
            Reports & Support ({reports.length})
          </Button>
        </div>
        <Button variant="outline" onClick={() => { fetchReports(true); fetchConversations(); }} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {t('ui.refresh', 'Refresh')}
        </Button>
      </div>

      {/* ── All buyer-seller conversations ── */}
      {activeTab === 'conversations' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#05B43D]" />
              All Buyer–Seller Conversations
            </CardTitle>
            <CardDescription>
              Every private conversation happening between users on the platform. Click a conversation to read all messages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">No conversations yet on the platform.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.key}
                    className="flex items-center justify-between rounded-xl border border-border p-4 hover:bg-[#F3F5F4] transition-colors cursor-pointer"
                    onClick={() => openConversation(conv)}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <Badge variant="outline" className="border-[#05B43D] text-[#05B43D] text-[10px]">
                          {conv.user1?.userType || 'user'}
                        </Badge>
                        <span>{conv.user1?.name}</span>
                        <span className="text-muted-foreground">↔</span>
                        <Badge variant="outline" className="border-blue-400 text-blue-600 text-[10px]">
                          {conv.user2?.userType || 'user'}
                        </Badge>
                        <span>{conv.user2?.name}</span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{conv.latestMessage || 'No preview'}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} ·{' '}
                        {conv.latestAt ? new Date(conv.latestAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="ml-4 shrink-0 border-[#05B43D] text-[#05B43D] hover:bg-[#e8f9ee]">
                      Read
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Reports & Support ── */}
      {activeTab === 'reports' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('ui.admin_inbox', 'Admin Inbox')}</CardTitle>
            <CardDescription>{t('ui.all_contact_support_and_report_problem_submissions', 'All contact support and report problem submissions.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="border rounded-md h-10 px-3 text-sm md:col-span-2"
                placeholder="Search by category, description, user..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select title="Filter by category" className="border rounded-md h-10 px-3 text-sm"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}>
                <option value="all">All Types</option>
                <option value="support">Support</option>
                <option value="report">Reports</option>
              </select>
              <select title="Filter by status" className="border rounded-md h-10 px-3 text-sm"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading inbox…</p>
            ) : filteredReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions found.</p>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={report.status === 'open' ? 'destructive' : 'secondary'} className="text-xs">
                          {report.status || 'open'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{report.category}</Badge>
                        <span className="text-sm font-medium">{report.submittedByName || 'Anonymous'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {report.createdAt ? new Date(report.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-sm">{report.description || report.message || 'No description.'}</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['reviewed', 'resolved', 'rejected'] as ReportStatus[]).map((s) => (
                        <Button key={s} size="sm" variant="outline"
                          disabled={report.status === s || actioningReportId === report.id}
                          onClick={() => updateReportStatus(report.id, s)}
                        >
                          Mark {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
