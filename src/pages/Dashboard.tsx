import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BuyerDashboard } from './BuyerDashboard';
import { SellerDashboard } from './SellerDashboard';

export function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!currentUser) {
      navigate('/'); // Redirect to main dashboard/home if not logged in
      return;
    }

    if (currentUser.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }

    if (currentUser.userType === 'seller' && location.pathname === '/dashboard') {
      navigate('/seller/dashboard', { replace: true });
      return;
    }

    // Subscription check for non-admin users
    const createdAt = currentUser.createdAt ? new Date(currentUser.createdAt) : new Date();
    const now = new Date();
    const trialDays = 14;
    // Cloned to avoid mutating the original date object from context
    const trialEndDate = new Date(createdAt.getTime());
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    const isTrialExpired = now > trialEndDate;
    const hasActiveSubscription = currentUser.subscriptionStatus === 'active' &&
                                  currentUser.subscriptionEndDate &&
                                  new Date(currentUser.subscriptionEndDate) > now;

    if (isTrialExpired && !hasActiveSubscription) {
      navigate('/subscription');
    }
  }, [currentUser, navigate, location.pathname]);

  if (!currentUser) return null; // Render nothing while redirecting

  if (currentUser.role === 'admin') return null;

  // Route based on user type for students
  if (currentUser.userType === 'buyer') {
    return <BuyerDashboard />;
  }

  if (currentUser.userType === 'seller') {
    return <SellerDashboard />;
  }

  // Default to buyer for legacy accounts without userType
  return <BuyerDashboard />;
}
