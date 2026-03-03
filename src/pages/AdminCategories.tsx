import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function AdminCategories() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

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

  const fetchCategories = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const { response, data } = await requestWithAuthRetry('/admin/categories');
      if (!response) {
        toast.error(data.error || 'Failed to load categories');
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
            ? 'Categories endpoint not found. Restart server and try again.'
            : data.error || 'Failed to load categories',
        );
        return;
      }
      setCategories(data.categories || []);
    } catch (_error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchCategories();
  }, [currentUser, accessToken]);

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry('/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!response) {
        toast.error(data.error || 'Failed to add category');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to add category');
        return;
      }
      setCategories(data.categories || []);
      setNewName('');
      toast.success('Category added');
    } catch (_error) {
      toast.error('Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (id: string, payload: any) => {
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response) {
        toast.error(data.error || 'Failed to update category');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to update category');
        return;
      }
      setCategories(data.categories || []);
      toast.success('Category updated');
    } catch (_error) {
      toast.error('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    setSaving(true);
    try {
      const { response, data } = await requestWithAuthRetry(`/admin/categories/${id}`, {
        method: 'DELETE',
      });
      if (!response) {
        toast.error(data.error || 'Failed to delete category');
        return;
      }
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete category');
        return;
      }
      setCategories(data.categories || []);
      toast.success('Category deleted');
    } catch (_error) {
      toast.error('Failed to delete category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/admin')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Admin
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Admin Categories</CardTitle>
          <CardDescription>Add, edit, delete, or disable listing categories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md h-10 px-3 text-sm"
              placeholder="Add category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button className="bg-green-600 hover:bg-green-700" onClick={addCategory} disabled={saving}>
              Add
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories found.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{category.name}</p>
                    <Badge variant={category.isActive ? 'default' : 'secondary'}>
                      {category.isActive ? 'active' : 'disabled'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        const updatedName = (prompt('Edit category name', category.name) || '').trim();
                        if (!updatedName || updatedName === category.name) return;
                        updateCategory(category.id, { name: updatedName });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => updateCategory(category.id, { isActive: !category.isActive })}
                    >
                      {category.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => deleteCategory(category.id)}>
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
