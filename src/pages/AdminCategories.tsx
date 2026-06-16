import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export function AdminCategories() {
  const navigate = useNavigate();
  const { currentUser, accessToken, refreshAuthToken, logout } = useAuth();
  const { t } = useLanguage();
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
    <div className="container mx-auto max-w-5xl px-3 py-8 sm:px-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('ui.admin_categories', 'Admin Categories')}</CardTitle>
          <CardDescription>{t('ui.add_edit_delete_or_disable_listing_categories', 'Add, edit, delete, or disable listing categories.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-md h-10 border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('ui.add_category_name', 'Add category name')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button className="w-full sm:w-auto" onClick={addCategory} disabled={saving}>
              {t('ui.add', 'Add')}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('ui.loading_categories', 'Loading categories...')}</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ui.no_categories_found', 'No categories found.')}</p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-colors hover:bg-accent md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{category.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        category.isActive ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {category.isActive ? t('ui.active', 'active') : t('ui.disabled', 'disabled')}
                    </span>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={saving}
                      onClick={() => {
                        const updatedName = (prompt('Edit category name', category.name) || '').trim();
                        if (!updatedName || updatedName === category.name) return;
                        updateCategory(category.id, { name: updatedName });
                      }}
                    >
                      {t('ui.edit', 'Edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={saving}
                      onClick={() => updateCategory(category.id, { isActive: !category.isActive })}
                    >
                      {category.isActive ? t('ui.disable', 'Disable') : t('ui.enable', 'Enable')}
                    </Button>
                    <Button size="sm" variant="destructive" className="w-full sm:w-auto" disabled={saving} onClick={() => deleteCategory(category.id)}>
                      {t('ui.delete', 'Delete')}
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

