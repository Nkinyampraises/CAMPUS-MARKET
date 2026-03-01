import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Heart, Package } from 'lucide-react';
import { formatCurrency, getCategoryById } from '@/data/mockData';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function Favorites() {
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const navigate = useNavigate();
  const [favoriteItems, setFavoriteItems] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchFavorites = async () => {
      try {
        const response = await fetch(`${API_URL}/favorites`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (response.ok) {
          setFavoriteItems(data.favorites);
        }
      } catch (error) {
        toast.error('Failed to fetch favorites');
      }
    };

    fetchFavorites();
  }, [isAuthenticated, accessToken, navigate]);

  const handleRemoveFavorite = async (itemId: string) => {
    try {
      await fetch(`${API_URL}/favorites/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setFavoriteItems(prev => prev.filter(item => item.id !== itemId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-red-500" />
              Saved Items ({favoriteItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {favoriteItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No saved items</h3>
                <p className="text-muted-foreground mb-4">
                  Start browsing and save items you're interested in
                </p>
                <Button onClick={() => navigate('/marketplace')}>
                  Browse Marketplace
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteItems.map((item) => {
                  const category = getCategoryById(item.category);
                  return (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative aspect-video bg-gray-100 overflow-hidden">
                        <img
                          src={item.images[0]}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleRemoveFavorite(item.id)}
                          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors"
                        >
                          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                        </button>
                        <Badge
                          className={`absolute bottom-2 left-2 ${
                            item.status === 'available'
                              ? 'bg-green-600'
                              : item.status === 'sold'
                              ? 'bg-gray-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{category?.name}</p>
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(item.price)}
                          </span>
                          <Badge variant="outline">{item.type}</Badge>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => navigate(`/item/${item.id}`)}
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

