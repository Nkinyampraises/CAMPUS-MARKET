import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Check, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const plans = {
  seller: {
    monthly: { price: 1000, name: 'Monthly' },
    yearly: { price: 12000, name: 'Yearly' },
  },
  buyer: {
    monthly: { price: 500, name: 'Monthly' },
    yearly: { price: 6000, name: 'Yearly' },
  },
};

export function Subscription() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const userType = currentUser?.userType === 'seller' ? 'seller' : 'buyer';
  const userPlans = plans[userType];

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'mtn-momo' | 'orange-money'>('mtn-momo');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || '');

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const planDetails = useMemo(() => userPlans[selectedPlan], [userPlans, selectedPlan]);
  const feeOverride =
    userType === 'buyer' && selectedPlan === 'monthly'
      ? 0
      : undefined;
  const handleContinue = () => {
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
    if (!/^(\+?237)?6\d{8}$/.test(normalizedPhone)) {
      toast.error('Enter a valid Cameroon phone number');
      return;
    }

    navigate('/payment-review', {
      state: {
        context: 'subscription',
        title: `${planDetails.name} Subscription (${currentUser.userType})`,
        amount: planDetails.price,
        paymentMethod,
        fromName: currentUser.name || 'User',
        fromPhone: phoneNumber,
        feeOverride,
        payload: {
          plan: selectedPlan,
          paymentMethod,
          phoneNumber,
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl">Choose Your Subscription Plan</CardTitle>
          <CardDescription>
            Your trial has ended. Continue with secure mobile money payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">1. Select Plan ({currentUser.userType})</h3>
              <RadioGroup value={selectedPlan} onValueChange={(v: 'monthly' | 'yearly') => setSelectedPlan(v)}>
                <div
                  className={`cursor-pointer rounded-lg border p-3 sm:p-4 ${selectedPlan === 'monthly' ? 'border-green-600 ring-2 ring-green-600' : ''}`}
                  onClick={() => setSelectedPlan('monthly')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="font-medium text-base sm:text-lg">{userPlans.monthly.name}</Label>
                    </div>
                    <p className="text-xl font-bold sm:text-2xl">{userPlans.monthly.price} XAF</p>
                  </div>
                </div>
                <div
                  className={`cursor-pointer rounded-lg border p-3 sm:p-4 ${selectedPlan === 'yearly' ? 'border-green-600 ring-2 ring-green-600' : ''}`}
                  onClick={() => setSelectedPlan('yearly')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="yearly" id="yearly" />
                      <Label htmlFor="yearly" className="font-medium text-base sm:text-lg">{userPlans.yearly.name}</Label>
                    </div>
                    <p className="text-xl font-bold sm:text-2xl">{userPlans.yearly.price} XAF</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold">2. Mobile Money Payment</h3>
              <div className="space-y-3">
                <Label>Choose Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v: 'mtn-momo' | 'orange-money') => setPaymentMethod(v)}>
                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value="mtn-momo" id="mtn-method" />
                    <Label htmlFor="mtn-method" className="cursor-pointer">MTN MoMo</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value="orange-money" id="orange-method" />
                    <Label htmlFor="orange-method" className="cursor-pointer">Orange Money</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-phone">Phone Number</Label>
                <Input
                  id="subscription-phone"
                  type="tel"
                  placeholder="671234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <Alert>
                <AlertDescription>
                  Click continue to open payment review with sender, receiver, and transaction fee details.
                </AlertDescription>
              </Alert>

              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <p className="font-semibold mb-2">Order Summary</p>
                  <div className="flex justify-between text-sm">
                    <p>{planDetails.name} Plan</p>
                    <p>{planDetails.price.toLocaleString()} XAF</p>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg" onClick={handleContinue}>
                <Check className="mr-2 h-4 w-4" />
                <Smartphone className="mr-2 h-4 w-4" />
                Continue to Payment Review
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
