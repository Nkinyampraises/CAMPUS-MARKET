import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { ConfirmEmail } from '@/pages/ConfirmEmail';
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
import { AdminSectionLayout } from '@/components/AdminSectionLayout';
import { BuyerSectionLayout } from '@/components/BuyerSectionLayout';
import { SellerSectionLayout } from '@/components/SellerSectionLayout';

function AppLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
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
          <Route
            path="/admin"
            element={(
              <AdminSectionLayout>
                <Admin />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/profile"
            element={(
              <AdminSectionLayout>
                <Profile />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin-approvals"
            element={(
              <AdminSectionLayout>
                <AdminApprovals />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/user-management"
            element={(
              <AdminSectionLayout>
                <UserManagement />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/user-details"
            element={(
              <AdminSectionLayout>
                <AdminUserDetails />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/user-details/:id"
            element={(
              <AdminSectionLayout>
                <AdminUserDetails />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/inbox"
            element={(
              <AdminSectionLayout>
                <AdminInbox />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/reviews"
            element={(
              <AdminSectionLayout>
                <AdminReviews />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/universities"
            element={(
              <AdminSectionLayout>
                <AdminUniversities />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/categories"
            element={(
              <AdminSectionLayout>
                <AdminCategories />
              </AdminSectionLayout>
            )}
          />
          <Route
            path="/admin/analytics"
            element={(
              <AdminSectionLayout>
                <AdminAnalytics />
              </AdminSectionLayout>
            )}
          />
          <Route path="/review" element={<Review />} />
          <Route path="/buyer/review" element={<Review />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route
            path="/buyer/dashboard"
            element={(
              <BuyerSectionLayout>
                <Dashboard />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/profile"
            element={(
              <BuyerSectionLayout>
                <Profile />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/orders"
            element={(
              <BuyerSectionLayout>
                <BuyerOrders />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/rentals"
            element={(
              <BuyerSectionLayout>
                <BuyerRentals />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/rental-details/:id"
            element={(
              <BuyerSectionLayout>
                <RentalDetails />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/payments"
            element={(
              <BuyerSectionLayout>
                <BuyerPayments />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/receipt/:id"
            element={(
              <BuyerSectionLayout>
                <BuyerReceipt />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/settings"
            element={(
              <BuyerSectionLayout>
                <Settings />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/notifications"
            element={(
              <BuyerSectionLayout>
                <Notifications />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/help"
            element={(
              <BuyerSectionLayout>
                <HelpSupport />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/report"
            element={(
              <BuyerSectionLayout>
                <BuyerReport />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/disputes"
            element={(
              <BuyerSectionLayout>
                <BuyerDisputes />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/buyer/recently-viewed"
            element={(
              <BuyerSectionLayout>
                <RecentlyViewed />
              </BuyerSectionLayout>
            )}
          />
          <Route
            path="/seller/dashboard"
            element={(
              <SellerSectionLayout>
                <Dashboard />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/profile"
            element={(
              <SellerSectionLayout>
                <Profile />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/manage-listings"
            element={(
              <SellerSectionLayout>
                <SellerManageListings />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/edit-listing/:id"
            element={(
              <SellerSectionLayout>
                <SellerEditListing />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/orders"
            element={(
              <SellerSectionLayout>
                <SellerOrders />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/order-details/:id"
            element={(
              <SellerSectionLayout>
                <SellerOrderDetails />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/rentals"
            element={(
              <SellerSectionLayout>
                <SellerRentals />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/settings"
            element={(
              <SellerSectionLayout>
                <SellerSettings />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/notifications"
            element={(
              <SellerSectionLayout>
                <SellerNotifications />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/help"
            element={(
              <SellerSectionLayout>
                <SellerHelp />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/reports"
            element={(
              <SellerSectionLayout>
                <SellerReports />
              </SellerSectionLayout>
            )}
          />
          <Route
            path="/seller/disputes"
            element={(
              <SellerSectionLayout>
                <SellerDisputes />
              </SellerSectionLayout>
            )}
          />
        </Routes>
      </main>
      {!isLoginPage && <Footer />}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LanguageProvider>
          <Router>
            <AppLayout />
          </Router>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
