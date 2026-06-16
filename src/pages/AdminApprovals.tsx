import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';
import { useLanguage } from '@/contexts/LanguageContext';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  studentId?: string;
  userType?: 'buyer' | 'seller';
  createdAt: string;
}

export function AdminApprovals() {
  const { currentUser, accessToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [universities, setUniversities] = useState<NamedCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchPendingUsers();
    fetchUniversities();
  }, [isAdmin, navigate, accessToken]);

  const fetchPendingUsers = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/pending-users`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingUsers(data.users);
      } else {
        toast.error('Failed to fetch pending users');
      }
    } catch (error) {
      console.error('Fetch pending users error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchUniversities = async () => {
    try {
      const rows = await fetchPublicCatalog('universities');
      setUniversities(rows);
    } catch {
      setUniversities([]);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setActionLoading(userId);
    
    try {
      const response = await fetch(`${API_URL}/admin/approve-user/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        toast.success('User approved successfully!');
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Approve user error:', error);
      toast.error('An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDenyUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deny this user? This action cannot be undone.')) {
      return;
    }

    setActionLoading(userId);
    
    try {
      const response = await fetch(`${API_URL}/admin/deny-user/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        toast.success('User denied and removed');
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to deny user');
      }
    } catch (error) {
      console.error('Deny user error:', error);
      toast.error('An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-background min-h-screen py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t('ui.account_approvals', 'Account Approvals')}</h1>
          <p className="text-muted-foreground">
            {t('ui.review_and_approve_or_deny_student_account_registr', 'Review and approve or deny student account registrations')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('ui.pending_approvals', 'Pending Approvals')}</CardTitle>
                <CardDescription>
                  {pendingUsers.length} account{pendingUsers.length !== 1 ? 's' : ''} waiting for approval
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('ui.loading_pending_approvals', 'Loading pending approvals...')}</p>
              </div>
            ) : pendingUsers.length > 0 ? (
              <div className="space-y-4">
                {pendingUsers.map((user) => {
                  const universityLabel = resolveNamedCatalogLabel(universities, user.university, user.university || '-');
                  
                  return (
                    <div key={user.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 md:flex-row md:items-start md:gap-4">
                      <div className="h-12 w-12 rounded-full bg-[#FEF3C7] dark:bg-[#FEF3C7]/15 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-6 w-6 text-[#D97706]" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg">{user.name}</h3>
                          <Badge variant="secondary" className="bg-[#FEF3C7] text-[#D97706] border-transparent">
                            {t('ui.pending', 'Pending')}
                          </Badge>
                          {user.userType && (
                            <Badge
                              variant="outline"
                              className={
                                user.userType === 'seller'
                                  ? 'bg-[#DCFCE7] text-[#16A34A] border-transparent'
                                  : 'bg-[#CCFBF1] text-[#0D9488] border-transparent'
                              }
                            >
                              {user.userType.charAt(0).toUpperCase() + user.userType.slice(1)}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="mb-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="break-all">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {user.phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {universityLabel}
                          </div>
                          {user.studentId && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{t('ui.student_id', 'Student ID:')}</span>
                              {user.studentId}
                            </div>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground break-words">
                          Registered: {new Date(user.createdAt).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-1">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleApproveUser(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="mr-1 h-4 w-4" />
                              {t('ui.approve', 'Approve')}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() => handleDenyUser(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-[#16A34A] mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('ui.all_caught_up', 'All Caught Up!')}</h3>
                <p className="text-muted-foreground">
                  {t('ui.no_pending_account_approvals_at_the_moment', 'No pending account approvals at the moment')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

