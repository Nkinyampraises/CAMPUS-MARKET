import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Input } from '@/app/components/ui/input';
import { 
  Users, 
  Package, 
  DollarSign, 
  TrendingUp,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Search,
  MessageSquare,
  Settings,
  Bell,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminSettings } from './AdminSettings';
import { AdminNotifications } from './AdminNotifications';
import { AdminPayouts } from './AdminPayouts';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function Admin() {
  const { currentUser, accessToken } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allMessages, setAllMessages] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;
      try {
        const results = await Promise.allSettled([
          fetch(`${API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(`${API_URL}/listings`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(`${API_URL}/admin/transactions`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(`${API_URL}/admin/messages`, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        ]);

        if (results[0].status === 'fulfilled' && results[0].value.ok) {
          const usersData = await results[0].value.json();
          setUsers(usersData.users);
        }
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
          const listingsData = await results[1].value.json();
          setListings(listingsData.listings);
        }
        if (results[2].status === 'fulfilled' && results[2].value.ok) {
          const transactionsData = await results[2].value.json();
          setTransactions(transactionsData.transactions);
        }
        if (results[3].status === 'fulfilled' && results[3].value.ok) {
          const messagesData = await results[3].value.json();
          setAllMessages(messagesData.messages || []);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
        toast.error('Failed to fetch dashboard data');
      }
    };

    if (currentUser?.role === 'admin') {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser, accessToken]);

  // Check if user is admin
  if (!currentUser || currentUser.role !== 'admin') {
    navigate('/');
    return null;
  }

  // Calculate stats
  const totalUsers = users.length;
  const totalListings = listings.length;
  const activeListings = listings.filter(i => i.status === 'available').length;
  const totalTransactions = transactions.length;
  const totalMessages = allMessages.length;
  const totalRevenue = transactions
    .reduce((sum, t) => sum + (t.platformFee || 0), 0);

  // Memoize conversations for the admin messages tab
    const conversations = useMemo(() => {
        const conversationMap = new Map();
        allMessages.forEach(msg => {
            const participants = [msg.senderId, msg.receiverId].sort().join('::');
            if (!conversationMap.has(participants)) {
                conversationMap.set(participants, []);
            }
            conversationMap.get(participants).push(msg);
        });
        return Array.from(conversationMap.entries()).map(([key, messages]) => ({
            id: key, // Unique ID for the conversation
            messages: messages
        }));
    }, [allMessages]);
  // Filter users based on search
  const filteredUsers = users
    .filter(u => u && u.name && u.email) // Filter out invalid users
    .filter(u => 
      searchQuery === '' || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleApproveUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/approve-user/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        toast.success('User approved');
        setUsers(prevUsers => prevUsers.map(u => 
          u.id === userId ? { ...u, isVerified: true, isApproved: true } : u
        ));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to approve user');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/toggle-ban`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        toast.success('User ban status toggled');
        setUsers(prevUsers => prevUsers.map(u => 
          u.id === userId ? data.user : u
        ));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to toggle ban status');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleDeleteListing = async (itemId: string) => {
    try {
      const response = await fetch(`${API_URL}/listings/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        toast.success('Listing removed');
        // Re-fetch listings or update state
      } else {
        toast.error('Failed to remove listing');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Check if user is admin */}
          {currentUser?.role !== 'admin' ? (
            <div>
              <p>You are not authorized to view this page.</p>
            </div>

          ) : (
            <>



        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, listings, and monitor platform activity
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Open advanced admin modules.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Button variant="outline" onClick={() => navigate('/admin/inbox')}>Inbox</Button>
              <Button variant="outline" onClick={() => navigate('/admin/reviews')}>Reviews</Button>
              <Button variant="outline" onClick={() => navigate('/admin/universities')}>Universities</Button>
              <Button variant="outline" onClick={() => navigate('/admin/categories')}>Categories</Button>
              <Button variant="outline" onClick={() => navigate('/admin/analytics')}>Analytics</Button>
              <Button variant="outline" onClick={() => navigate('/admin/user-management')}>User Management</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Registered students
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalListings}</div>
              <p className="text-xs text-muted-foreground">
                {activeListings} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMessages}</div>
              <p className="text-xs text-muted-foreground">Platform wide</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total transaction volume
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="notifications">Broadcasts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage student accounts and verifications</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => navigate('/admin/user-management')}>User Management</Button>
                    <Button onClick={() => navigate('/admin-approvals')}>Pending Approvals</Button>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">

                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{user.name}</p>
                          {user.isVerified && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.phone} • Student ID: {user.studentId || 'N/A'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/user-details/${user.id}`)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                        {!user.isVerified && (
                          <Button
                            size="sm"
                            disabled={!accessToken}
                            variant="outline"
                            onClick={() => handleApproveUser(user.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verify
                          </Button>
                        )}
                        <Button
                          size="sm"
                           disabled={!accessToken}
                          variant="outline"
                          onClick={() => handleSuspendUser(user.id)}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          {user.isBanned ? 'Unban' : 'Suspend'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>


              </CardContent>
            </Card>
          </TabsContent>

          {/* Listings Tab */}
          <TabsContent value="listings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Listing Management</CardTitle>
                <CardDescription>Review and moderate marketplace listings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {listings.slice(0, 10).map((item) => {
                    const seller = users.find(u => u.id === item.sellerId);

                    return (
                      <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="w-24 h-24 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium line-clamp-1">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.category} • {item.location}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={item.status === 'available' ? 'default' : 'secondary'}>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Seller: {seller?.name} • Views: {item.views}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-green-600">{formatCurrency(item.price)}</p>
                            <Badge variant="outline" className="text-xs">
                              {item.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/item/${item.id}`)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteListing(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Monitor all platform transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.map((txn) => {
                    const item = listings.find(i => i.id === txn.itemId);
                    const buyer = users.find(u => u.id === txn.buyerId);
                    const seller = users.find(u => u.id === txn.sellerId);

                    return (
                      <div key={txn.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{item?.title}</p>
                            <Badge
                              variant={txn.status === 'delivered_released' ? 'default' : 'secondary'}
                            >
                              {txn.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Buyer: {buyer?.name} → Seller: {seller?.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(txn.timestamp || txn.createdAt).toLocaleString()} • {txn.transactionRef || txn.orderId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Method: {txn.paymentMethod === 'mtn-momo' ? 'MTN MoMo' : (txn.paymentMethod === 'orange-money' ? 'Orange Money' : 'N/A')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {formatCurrency(txn.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Messages</CardTitle>
                <CardDescription>Monitor communication between users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversations.map((conversation: any) => {
                    const [user1Id, user2Id] = conversation.id.split('::');
                    const user1 = users.find((u: any) => u.id === user1Id);
                    const user2 = users.find((u: any) => u.id === user2Id);
                    const user1Name = user1?.name || 'Unknown User';
                    const user2Name = user2?.name || 'Unknown User';
                    const lastMsg = conversation.messages[conversation.messages.length - 1];

                    return (
                      <div 
                        key={conversation.id} 
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => navigate('/messages')}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-blue-600">{user1Name}</span>
                            <span className="text-muted-foreground text-xs">and</span>
                            <span className="font-bold text-blue-600">{user2Name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(lastMsg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {lastMsg.messageType === 'image' ? '📷 [Image]' :
                           lastMsg.messageType === 'voice' ? '🎤 [Voice Message]' : 
                           lastMsg.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {conversation.messages.length} messages
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {conversations.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No conversations found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* New Admin Tabs */}
          <TabsContent value="payouts">
            <AdminPayouts />
          </TabsContent>

          <TabsContent value="notifications">
            <AdminNotifications />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>

        </Tabs>
            </>
          )}
      </div>
    </div>
  );
}

