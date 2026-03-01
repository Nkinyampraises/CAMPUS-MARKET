import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Marketplace } from '@/pages/Marketplace';
import { ItemDetails } from '@/pages/ItemDetails';
import { Dashboard } from '@/pages/Dashboard';
import { AddListing } from '@/pages/AddListing';
import { Messages } from '@/pages/Messages';
import { Profile } from '@/pages/Profile';
import { Checkout } from '@/pages/Checkout';
import { PaymentReview } from '@/pages/PaymentReview';
import { OrderDetails } from '@/pages/OrderDetails';
import { Admin } from '@/pages/Admin';
import { AdminApprovals } from '@/pages/AdminApprovals';
import { UserManagement } from '@/pages/UserManagement';
import { Review } from '@/pages/Review';
import { Favorites } from '@/pages/Favorites';
import { Subscription } from '@/pages/Subscription';
import { Toaster } from '@/app/components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/item/:id" element={<ItemDetails />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/add-listing" element={<AddListing />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/checkout/:itemId" element={<Checkout />} />
              <Route path="/payment-review" element={<PaymentReview />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin-approvals" element={<AdminApprovals />} />
              <Route path="/admin/user-management" element={<UserManagement />} />
              <Route path="/review" element={<Review />} />
              <Route path="/favorites" element={<Favorites />} />
            </Routes>
          </main>
          <Footer />
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}
