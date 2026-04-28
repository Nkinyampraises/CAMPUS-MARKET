import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tag, Table, Button, message, Popconfirm, Avatar, Space } from 'antd';
import { Search, ChevronDown, Filter } from 'lucide-react';

import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  isApproved: boolean;
  isBanned: boolean;
  role: string;
  userType?: 'buyer' | 'seller';
  profilePicture?: string;
}

export function UserManagement() {
  const { currentUser, accessToken } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [universities, setUniversities] = useState<NamedCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [universityInput, setUniversityInput] = useState('all');
  const [statusInput, setStatusInput] = useState<'all' | 'approved' | 'pending' | 'banned'>('all');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedUniversity, setAppliedUniversity] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState<'all' | 'approved' | 'pending' | 'banned'>('all');
  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users);
      } else {
        message.error(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      message.error('An error occurred while fetching users');
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

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) {
      navigate('/');
      return;
    }
    if (accessToken) {
      fetchUniversities();
      fetchUsers();
    }
  }, [currentUser, accessToken, isAdmin, navigate]);

  const handleToggleBan = async (userId: string) => {
    try {

      const response = await fetch(`${API_URL}/admin/users/${userId}/toggle-ban`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        message.success('User status updated');
        fetchUsers(); // Refresh the user list
      } else {
        message.error(data.error || 'Failed to update user status');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        message.success('User deleted');
        fetchUsers(); // Refresh the user list
      } else {
        message.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const getStatus = (user: User) => {
    if (user.isBanned) return 'banned';
    return user.isApproved ? 'approved' : 'pending';
  };

  const activeUsersCount = useMemo(
    () => users.filter((user) => user.isApproved && !user.isBanned).length,
    [users],
  );

  const universityOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      if (!user.university) continue;
      map.set(
        user.university,
        resolveNamedCatalogLabel(universities, user.university, user.university),
      );
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [universities, users]);

  const filteredUsers = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = !q || [user.name, user.email, user.id].some((field) => String(field || '').toLowerCase().includes(q));
      const matchesUniversity = appliedUniversity === 'all' || user.university === appliedUniversity;
      const matchesStatus = appliedStatus === 'all' || getStatus(user) === appliedStatus;
      return matchesSearch && matchesUniversity && matchesStatus;
    });
  }, [appliedSearch, appliedStatus, appliedUniversity, users]);

  const applyFilters = () => {
    setAppliedSearch(searchInput);
    setAppliedUniversity(universityInput);
    setAppliedStatus(statusInput);
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: User) => {
        const firstLetter = record.name?.charAt(0)?.toUpperCase() || 'U';
        return (
          <div className="flex items-start gap-3">
            <Avatar src={record.profilePicture} alt={record.name}>
              {firstLetter}
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-[#0f1111]">{record.name || '-'}</p>
              <p className="break-all text-xs text-muted-foreground">{record.email || '-'}</p>
              <p className="text-xs text-muted-foreground">ID: {record.id}</p>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Contact',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => <span className="text-sm">{phone || '-'}</span>,
    },
    {
      title: 'University',
      dataIndex: 'university',
      key: 'university',
      render: (university: string) => (
        <span className="text-sm">{resolveNamedCatalogLabel(universities, university, university || '-')}</span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'userType',
      key: 'userType',
      render: (userType: User['userType']) => (
        <Tag color={userType === 'seller' ? 'blue' : 'geekblue'}>
          {(userType || 'buyer').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isApproved',
      key: 'status',
      render: (_isApproved: boolean, record: User) => (
        <Tag color={record.isBanned ? 'volcano' : (record.isApproved ? 'green' : 'gold')}>
          {record.isBanned ? 'Banned' : (record.isApproved ? 'Approved' : 'Pending')}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size={6}>
          <Button size="small" onClick={() => handleToggleBan(record.id)}>
            {record.isBanned ? 'Unban' : 'Ban'}
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!currentUser || !isAdmin) {
    return null;
  }

  return (
    <div className="space-y-5 p-3 sm:p-4">
      <section className="rounded-2xl border border-[#d7dede] bg-[#f7f9f9] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold leading-tight text-[#00524a]">User Registry</h2>
            <p className="mt-1 text-[1rem] text-[#30424f]">
              Manage institutional accounts and marketplace permissions across all campuses.
            </p>
          </div>

          <div className="self-start rounded-xl bg-[#edf2ef] px-4 py-2">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.12em] text-[#5a6c78]">Total Active</p>
            <p className="text-3xl font-bold text-[#004f47]">{activeUsersCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_170px_150px_165px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8c98]" />
            <input
              className="h-11 w-full rounded-xl border border-[#d8dede] bg-white pl-10 pr-3 text-sm text-[#0f1111] outline-none transition focus:border-[#00524a] focus:ring-2 focus:ring-[#00524a]/15"
              placeholder="Search by name, email or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              value={universityInput}
              onChange={(e) => setUniversityInput(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#d8dede] bg-white px-3 pr-9 text-sm text-[#0f1111] outline-none transition focus:border-[#00524a] focus:ring-2 focus:ring-[#00524a]/15"
            >
              <option value="all">All Universities</option>
              {universityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72828e]" />
          </div>

          <div className="relative">
            <select
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value as 'all' | 'approved' | 'pending' | 'banned')}
              className="h-11 w-full appearance-none rounded-xl border border-[#d8dede] bg-white px-3 pr-9 text-sm text-[#0f1111] outline-none transition focus:border-[#00524a] focus:ring-2 focus:ring-[#00524a]/15"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="banned">Banned</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72828e]" />
          </div>

          <button
            type="button"
            onClick={applyFilters}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#013f3a] bg-[#1FAF9A] px-4 text-sm font-semibold text-white transition hover:bg-[#27b9a6]"
          >
            <Filter className="h-3.5 w-3.5" />
            Apply Filters
          </button>
        </div>
      </section>

      <div className="rounded-2xl border border-[#d7dede] bg-white p-2 sm:p-3">
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          size="middle"
        />
      </div>
    </div>
  );
}
