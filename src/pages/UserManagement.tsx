import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Tag, Table, Button, message, Popconfirm, Avatar, Space } from 'antd';
import { getUniversityName } from '@/data/mockData';

import { API_URL } from '@/lib/api';

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser, accessToken]);

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

  const columns = [
    {
      title: 'Photo',
      key: 'profilePicture',
      width: 80,
      render: (_: any, record: User) => (
        <Avatar src={record.profilePicture} alt={record.name}>
          {record.name?.charAt(0)?.toUpperCase()}
        </Avatar>
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'University',
      dataIndex: 'university',
      key: 'university',
      render: (university: string) => getUniversityName(university),
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
      render: (isApproved: boolean, record: User) => (
        <Tag color={record.isBanned ? 'volcano' : (isApproved ? 'green' : 'gold')}>
          {record.isBanned ? 'Banned' : (isApproved ? 'Approved' : 'Pending')}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button onClick={() => handleToggleBan(record.id)}>
            {record.isBanned ? 'Unban' : 'Ban'}
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (currentUser?.role !== 'admin') {
    return <div>You are not authorized to view this page.</div>;
  }

  return (
    <div>
      <h2>User Management</h2>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
