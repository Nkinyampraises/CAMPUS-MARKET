import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BuyerDashboard } from './BuyerDashboard';
import { SellerDashboard } from './SellerDashboard';
import { Admin } from './Admin';

export function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/'); // Redirect to main dashboard/home if not logged in
      return;
    }

    // Subscription check for non-admin users
    if (currentUser.role !== 'admin') {
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
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null; // Render nothing while redirecting

  // Route based on role
  if (currentUser.role === 'admin') {
    return <Admin />;
  }

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
