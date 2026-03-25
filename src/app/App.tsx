import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
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
import { AdminUserDetails } from '@/pages/AdminUserDetails';
import { AdminInbox } from '@/pages/AdminInbox';
import { AdminReviews } from '@/pages/AdminReviews';
import { AdminUniversities } from '@/pages/AdminUniversities';
import { AdminCategories } from '@/pages/AdminCategories';
import { AdminAnalytics } from '@/pages/AdminAnalytics';
import { Review } from '@/pages/Review';
import { Favorites } from '@/pages/Favorites';
import { Subscription } from '@/pages/Subscription';
import { BuyerOrders } from '@/pages/BuyerOrders';
import { BuyerRentals } from '@/pages/BuyerRentals';
import { BuyerPayments } from '@/pages/BuyerPayments';
import { BuyerReceipt } from '@/pages/BuyerReceipt';
import { Notifications } from '@/pages/Notifications';
import { Settings } from '@/pages/Settings';
import { RentalDetails } from '@/pages/RentalDetails';
import { HelpSupport } from '@/pages/HelpSupport';
import { BuyerReport } from '@/pages/BuyerReport';
import { BuyerDisputes } from '@/pages/BuyerDisputes';
import { RecentlyViewed } from '@/pages/RecentlyViewed';
import { SellerManageListings } from '@/pages/SellerManageListings';
import { SellerEditListing } from '@/pages/SellerEditListing';
import { SellerOrders } from '@/pages/SellerOrders';
import { SellerOrderDetails } from '@/pages/SellerOrderDetails';
import { SellerRentals } from '@/pages/SellerRentals';
import { SellerSettings } from '@/pages/SellerSettings';
import { SellerNotifications } from '@/pages/SellerNotifications';
import { SellerHelp } from '@/pages/SellerHelp';
import { SellerReports } from '@/pages/SellerReports';
import { SellerDisputes } from '@/pages/SellerDisputes';
import { Toaster } from '@/app/components/ui/sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LanguageProvider>
          <Router>
            <div className="min-h-screen flex flex-col bg-background text-foreground">
              <Header />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
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
                  <Route path="/admin/user-details" element={<AdminUserDetails />} />
                  <Route path="/admin/user-details/:id" element={<AdminUserDetails />} />
                  <Route path="/admin/inbox" element={<AdminInbox />} />
                  <Route path="/admin/reviews" element={<AdminReviews />} />
                  <Route path="/admin/universities" element={<AdminUniversities />} />
                  <Route path="/admin/categories" element={<AdminCategories />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/review" element={<Review />} />
                  <Route path="/buyer/review" element={<Review />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/buyer/orders" element={<BuyerOrders />} />
                  <Route path="/buyer/rentals" element={<BuyerRentals />} />
                  <Route path="/buyer/rental-details/:id" element={<RentalDetails />} />
                  <Route path="/buyer/payments" element={<BuyerPayments />} />
                  <Route path="/buyer/receipt/:id" element={<BuyerReceipt />} />
                  <Route path="/buyer/settings" element={<Settings />} />
                  <Route path="/buyer/notifications" element={<Notifications />} />
                  <Route path="/buyer/help" element={<HelpSupport />} />
                  <Route path="/buyer/report" element={<BuyerReport />} />
                  <Route path="/buyer/disputes" element={<BuyerDisputes />} />
                  <Route path="/buyer/recently-viewed" element={<RecentlyViewed />} />
                  <Route path="/seller/manage-listings" element={<SellerManageListings />} />
                  <Route path="/seller/edit-listing/:id" element={<SellerEditListing />} />
                  <Route path="/seller/orders" element={<SellerOrders />} />
                  <Route path="/seller/order-details/:id" element={<SellerOrderDetails />} />
                  <Route path="/seller/rentals" element={<SellerRentals />} />
                  <Route path="/seller/settings" element={<SellerSettings />} />
                  <Route path="/seller/notifications" element={<SellerNotifications />} />
                  <Route path="/seller/help" element={<SellerHelp />} />
                  <Route path="/seller/reports" element={<SellerReports />} />
                  <Route path="/seller/disputes" element={<SellerDisputes />} />
                </Routes>
              </main>
              <Footer />
              <Toaster />
            </div>
          </Router>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
