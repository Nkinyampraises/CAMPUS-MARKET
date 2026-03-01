import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

const fallbackPickupLocations = [
  { name: 'University of Yaounde I', lat: 3.848, lng: 11.502 },
  { name: 'University of Douala', lat: 4.053, lng: 9.704 },
  { name: 'Ngoa Ekelle', lat: 3.864, lng: 11.5 },
  { name: 'Bonamoussadi Roundabout', lat: 4.088, lng: 9.758 },
  { name: 'Bambili Campus', lat: 5.959, lng: 10.197 },
];

const pickupKeywords = ['university', 'campus', 'roundabout', 'ngoa ekelle', 'bonamoussadi', 'bambili'];

interface ListingItem {
  id: string;
  title: string;
  price: number;
  images: string[];
  sellerId: string;
}

interface PickupLocation {
  name: string;
  lat?: number | null;
  lng?: number | null;
  placeId?: string;
  address?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

const isAllowedPickupName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return pickupKeywords.some((keyword) => normalized.includes(keyword));
};

export function Checkout() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuth();

  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const [item, setItem] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickupOptions, setPickupOptions] = useState(fallbackPickupLocations);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'mtn-momo' | 'orange-money'>('mtn-momo');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || '');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupLocation, setPickupLocation] = useState<PickupLocation>({
    name: '',
    lat: null,
    lng: null,
    placeId: '',
    address: '',
  });
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (currentUser?.phone) {
      setPhoneNumber((prev) => prev || currentUser.phone);
    }
  }, [currentUser?.phone]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchPickupPoints = async () => {
      try {
        const response = await fetch(`${API_URL}/pickup-locations`);
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          setPickupOptions(data.locations);
        }
      } catch (_error) {
        // Fallback list stays.
      }
    };
    fetchPickupPoints();
  }, []);

  useEffect(() => {
    if (location.state?.item) {
      setItem(location.state.item);
      setLoading(false);
      return;
    }

    const fetchItemDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/listings/${itemId}`);
        if (response.ok) {
          const data = await response.json();
          setItem(data.listing);
        } else {
          toast.error('Failed to fetch item details.');
          navigate('/marketplace');
        }
      } catch (_error) {
        toast.error('An error occurred while fetching item details.');
        navigate('/marketplace');
      } finally {
        setLoading(false);
      }
    };

    if (itemId) {
      fetchItemDetails();
    } else {
      setLoading(false);
    }
  }, [itemId, navigate, location.state]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsError('Google Maps key is not configured. Please select from the campus list.');
      return;
    }

    let isMounted = true;

    const initializeAutocomplete = () => {
      if (!window.google?.maps?.places || !locationInputRef.current) {
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(locationInputRef.current, {
        componentRestrictions: { country: 'cm' },
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
        types: ['establishment'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const placeName = place?.name || place?.formatted_address || '';
        const lat = place?.geometry?.location?.lat?.() ?? null;
        const lng = place?.geometry?.location?.lng?.() ?? null;
        if (!placeName) return;

        if (!isAllowedPickupName(placeName)) {
          toast.error('Only campus/public meeting points are allowed.');
          return;
        }

        setPickupLocation({
          name: placeName,
          lat,
          lng,
          placeId: place?.place_id || '',
          address: place?.formatted_address || '',
        });
        setErrorText('');
      });

      if (isMounted) {
        setMapsReady(true);
        setMapsError('');
      }
    };

    if (window.google?.maps?.places) {
      initializeAutocomplete();
      return () => {
        isMounted = false;
      };
    }

    const scriptId = 'google-maps-places-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', initializeAutocomplete);
      return () => {
        isMounted = false;
        existing.removeEventListener('load', initializeAutocomplete);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.onload = initializeAutocomplete;
    script.onerror = () => {
      if (isMounted) setMapsError('Unable to load Google Maps. Please use the campus list.');
    };
    document.head.appendChild(script);

    return () => {
      isMounted = false;
      script.onload = null;
    };
  }, []);

  const handleFallbackPickupSelect = (value: string) => {
    const selected = pickupOptions.find((option) => option.name === value);
    if (!selected) return;
    setPickupLocation({
      name: selected.name,
      lat: selected.lat ?? null,
      lng: selected.lng ?? null,
      placeId: '',
      address: selected.name,
    });
    setErrorText('');
  };

  const validateFields = () => {
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
    if (!/^(\+?237)?6\d{8}$/.test(normalizedPhone)) {
      return 'Please enter a valid Cameroon phone number (e.g. 671234567).';
    }
    if (!pickupDate || !pickupTime) {
      return 'Please select pickup date and time.';
    }
    if (!pickupLocation.name || !isAllowedPickupName(pickupLocation.name)) {
      return 'Select a valid campus/roundabout meeting point.';
    }
    return '';
  };

  const handleReviewPayment = () => {
    const validationError = validateFields();
    if (validationError) {
      setErrorText(validationError);
      toast.error(validationError);
      return;
    }
    setErrorText('');

    navigate('/payment-review', {
      state: {
        context: 'order',
        title: item?.title || 'Marketplace purchase',
        amount: item?.price || 0,
        paymentMethod,
        fromName: currentUser?.name || 'Buyer',
        fromPhone: phoneNumber,
        payload: {
          itemId: item?.id,
          paymentMethod,
          phoneNumber,
          buyerName: currentUser?.name || '',
          buyerPhoneNumber: currentUser?.phone || phoneNumber,
          buyerProfilePicture: currentUser?.profilePicture || '',
          pickupDate,
          pickupTime,
          pickupLocation: pickupLocation.name,
          pickupAddress: pickupLocation.address || pickupLocation.name,
          pickupLatitude: pickupLocation.lat,
          pickupLongitude: pickupLocation.lng,
          pickupPlaceId: pickupLocation.placeId || '',
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Item not found</h1>
        <Button onClick={() => navigate('/marketplace')}>Back to Marketplace</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <h1 className="text-3xl font-bold mb-6">Complete Your Escrow Purchase</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <img src={item.images?.[0] || '/placeholder.svg'} alt={item.title} className="w-24 h-24 object-cover rounded-lg" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-sm text-muted-foreground">Escrow protected transaction</p>
                <p className="text-2xl font-bold mt-2">{(item.price || 0).toLocaleString()} XAF</p>
              </div>
            </div>
            <Alert className="mt-4">
              <AlertDescription>
                Payment will be reviewed on the next page before final confirmation.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment & Pickup Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <Label className="text-base">Select Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  className="mt-2 grid grid-cols-2 gap-4"
                  onValueChange={(value: 'mtn-momo' | 'orange-money') => setPaymentMethod(value)}
                >
                  <div>
                    <RadioGroupItem value="mtn-momo" id="mtn" className="peer sr-only" />
                    <Label htmlFor="mtn" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary">
                      MTN MoMo
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="orange-money" id="orange" className="peer sr-only" />
                    <Label htmlFor="orange" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary">
                      Orange Money
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number" className="text-base">
                  {paymentMethod === 'mtn-momo' ? 'MTN' : 'Orange'} Phone Number
                </Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="671234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pickup-date">Pickup Date</Label>
                  <Input id="pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickup-time">Pickup Time</Label>
                  <Input id="pickup-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickup-location">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Campus/Public Pickup Point (Cameroon only)
                  </span>
                </Label>
                <Input
                  id="pickup-location"
                  ref={locationInputRef}
                  placeholder="Search campus or roundabout in Cameroon"
                  disabled={!mapsReady}
                  onChange={(e) => setPickupLocation((prev) => ({ ...prev, name: e.target.value }))}
                  value={pickupLocation.name}
                />
                <p className="text-xs text-muted-foreground">Allowed: university campuses and roundabouts only.</p>
                {mapsError ? <p className="text-xs text-amber-700">{mapsError}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Select from approved locations</Label>
                <Select onValueChange={handleFallbackPickupSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose approved pickup point" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupOptions.map((option) => (
                      <SelectItem key={option.name} value={option.name}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {errorText ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorText}</AlertDescription>
                </Alert>
              ) : null}

              <Button onClick={handleReviewPayment} className="w-full bg-green-600 hover:bg-green-700">
                Review Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
