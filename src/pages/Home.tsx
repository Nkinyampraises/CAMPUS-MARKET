import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { 
  ShoppingBag, 
  Recycle, 
  DollarSign, 
  Shield, 
  Truck, 
  Users,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { categories } from '@/data/mockData';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-background text-foreground">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-20 px-4 dark:from-emerald-950/50 dark:to-slate-950">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Student Marketplace<br />
            <span className="text-green-600">for Cameroon Universities</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Buy, sell, and rent household items from fellow students. Affordable, sustainable, and trusted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => navigate('/marketplace')}
            >
              Browse Marketplace
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/register')}
            >
              Sign Up Now
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-12">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">7+</p>
              <p className="text-sm text-muted-foreground">Universities</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">500+</p>
              <p className="text-sm text-muted-foreground">Active Students</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">1000+</p>
              <p className="text-sm text-muted-foreground">Items Listed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problems We Solve */}
      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why CampusMarket?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <DollarSign className="h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Save Money</h3>
                <p className="text-muted-foreground">
                  Get quality household items at student-friendly prices. No more overpaying for basic necessities.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Shield className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Safe & Trusted</h3>
                <p className="text-muted-foreground">
                  Verified student accounts, secure payments via MTN MoMo & Orange Money, and user ratings for peace of mind.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Recycle className="h-12 w-12 text-emerald-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Eco-Friendly</h3>
                <p className="text-muted-foreground">
                  Reduce waste by reusing perfectly good items. Help create a sustainable student community in Cameroon.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 bg-muted/40">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Popular Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Card 
                key={category.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate('/marketplace')}
              >
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-sm font-medium">{category.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">1. Sign Up</h3>
              <p className="text-sm text-muted-foreground">
                Register with your university email and verify your student status
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">2. Browse Items</h3>
              <p className="text-sm text-muted-foreground">
                Search for items you need or list items you want to sell or rent
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">3. Secure Payment</h3>
              <p className="text-sm text-muted-foreground">
                Pay safely using MTN MoMo or Orange Money mobile payments
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="font-semibold mb-2">4. Arrange Pickup</h3>
              <p className="text-sm text-muted-foreground">
                Coordinate with the seller for pickup or delivery on campus
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-green-50 dark:bg-emerald-950/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">Student Verification</p>
                <p className="text-sm text-muted-foreground">Verified student accounts only</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">Mobile Money Payments</p>
                <p className="text-sm text-muted-foreground">MTN MoMo & Orange Money</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">Secure Messaging</p>
                <p className="text-sm text-muted-foreground">Chat directly with sellers</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">User Ratings & Reviews</p>
                <p className="text-sm text-muted-foreground">Build trust with feedback</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">Sell or Rent Options</p>
                <p className="text-sm text-muted-foreground">Flexible listing types</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium">Transaction History</p>
                <p className="text-sm text-muted-foreground">Track all your deals</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-green-600 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join hundreds of students across Cameroon saving money and reducing waste
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate('/register')}
          >
            Create Your Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
