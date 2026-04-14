import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

export function AdminUniversities() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [universities, setUniversities] = useState<any[]>([]);

  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
    if (!accessToken) {
      return { response: null as Response | null, data: { error: 'Unauthorized' } };
    }

    const makeRequest = async (token: string) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...(init || {}),
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    try {
      const firstAttempt = await makeRequest(accessToken);
      if (firstAttempt.response.status !== 401) {
        return firstAttempt;
      }

      const refreshedToken = await refreshAuthToken();
      if (!refreshedToken) {
        return firstAttempt;
      }

      return makeRequest(refreshedToken);
    } catch (error) {
      return {
        response: null as Response | null,
        data: { error: error instanceof Error ? error.message : 'Unable to reach server' },
      };
    }
  };

  const fetchUniversities = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/admin/universities');
      if (!response) {
        toast.error(data.error || 'Failed to load universities');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(
          response.status === 404
            ? 'Universities endpoint not found. Restart server and try again.'
            : data.error || 'Failed to load universities',
        );
        return;
      }
      setUniversities(data.universities || []);
    } catch (_error) {
      toast.error('Failed to load universities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchUniversities();
  }, [currentUser, accessToken]);

  const addUniversity = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('University name is required');
      return;
    }
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry('/admin/universities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!response) {
        toast.error(data.error || 'Failed to add university');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to add university');
        return;
      }
      setUniversities(data.universities || []);
      setNewName('');
      toast.success('University added');
    } catch (_error) {
      toast.error('Failed to add university');
    } finally {
      setSaving(false);
    }
  };

  const updateUniversity = async (id: string, payload: any) => {
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/universities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response) {
        toast.error(data.error || 'Failed to update university');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to update university');
        return;
      }
      setUniversities(data.universities || []);
      toast.success('University updated');
    } catch (_error) {
      toast.error('Failed to update university');
    } finally {
      setSaving(false);
    }
  };

  const deleteUniversity = async (id: string) => {
    if (!confirm('Delete this university?')) return;
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/universities/${id}`, {
        method: 'DELETE',
      });
      if (!response) {
        toast.error(data.error || 'Failed to delete university');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete university');
        return;
      }
      setUniversities(data.universities || []);
      toast.success('University deleted');
    } catch (_error) {
      toast.error('Failed to delete university');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-3 py-8 sm:px-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Universities</CardTitle>
          <CardDescription>Add, edit, delete, or disable universities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 border rounded-md h-10 px-3 text-sm"
              placeholder="Add university name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button className="w-full bg-green-600 hover:bg-green-700 sm:w-auto" onClick={addUniversity} disabled={saving}>
              Add
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading universities...</p>
          ) : universities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No universities found.</p>
          ) : (
            <div className="space-y-3">
              {universities.map((uni) => (
                <div key={uni.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{uni.name}</p>
                    <Badge variant={uni.isActive ? 'default' : 'secondary'}>
                      {uni.isActive ? 'active' : 'disabled'}
                    </Badge>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={saving}
                      onClick={() => {
                        const updatedName = (prompt('Edit university name', uni.name) || '').trim();
                        if (!updatedName || updatedName === uni.name) return;
                        updateUniversity(uni.id, { name: updatedName });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={saving}
                      onClick={() => updateUniversity(uni.id, { isActive: !uni.isActive })}
                    >
                      {uni.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={() => deleteUniversity(uni.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
