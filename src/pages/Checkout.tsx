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
import { ArrowLeft, CalendarClock, CreditCard, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { MeetupMap } from '@/components/MeetupMap';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';
import { useLanguage } from '@/contexts/LanguageContext';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

const fallbackPickupLocations = [
  { name: 'University of Yaounde I', lat: 3.848, lng: 11.502 },
  { name: 'University of Yaounde II (Soa)', lat: 4.0, lng: 11.59 },
  { name: 'ICT University, Yaounde', lat: 3.87, lng: 11.5 },
  { name: 'Catholic University of Central Africa (UCAC)', lat: 3.88, lng: 11.53 },
  { name: 'National Advanced School of Engineering Yaounde', lat: 3.86, lng: 11.5 },
  { name: 'IRIC Yaounde', lat: 3.87, lng: 11.52 },
  { name: 'University of Douala', lat: 4.053, lng: 9.704 },
  { name: 'Ngoa Ekelle', lat: 3.864, lng: 11.5 },
  { name: 'Poste Centrale Yaounde Roundabout', lat: 3.87, lng: 11.52 },
  { name: 'Elig-Essono Roundabout', lat: 3.89, lng: 11.51 },
  { name: 'Bonamoussadi Roundabout', lat: 4.088, lng: 9.758 },
  { name: 'Bambili Campus', lat: 5.959, lng: 10.197 },
];

const pickupKeywords = [
  'university',
  'campus',
  'roundabout',
  'ngoa ekelle',
  'bonamoussadi',
  'bambili',
  'yaounde',
  'soa',
  'ict',
  'ucac',
  'iric',
  'poste centrale',
  'elig essono',
];

interface ListingItem {
  id: string;
  title: string;
  price: number;
  images: string[];
  sellerId: string;
  category?: string;
  condition?: string;
  type?: 'sell' | 'rent';
  rentalPeriod?: 'daily' | 'weekly' | 'monthly';
  location?: string;
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
  const { t } = useLanguage();

  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const [item, setItem] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickupOptions, setPickupOptions] = useState(fallbackPickupLocations);
  const [categories, setCategories] = useState<NamedCatalogOption[]>([]);
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
    let mounted = true;

    const fetchCategories = async () => {
      try {
        const rows = await fetchPublicCatalog('categories');
        if (!mounted) return;
        setCategories(rows);
      } catch {
        if (!mounted) return;
        setCategories([]);
      }
    };

    fetchCategories();
    return () => {
      mounted = false;
    };
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
        // Carry the exact fee shown on this checkout screen so the payment review
        // (and the amount actually charged) matches — 2% with a 3 FCFA minimum.
        feeOverride: Math.max(3, Math.round((Number(item?.price) || 0) * 0.02)),
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
          itemImage: item?.images?.[0] || '',
          sellerName: (item as any)?.seller?.name || 'Seller',
          buyerStudentId: currentUser?.studentId || '',
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
        <h1 className="text-2xl font-bold mb-4">{t('ui.item_not_found', 'Item not found')}</h1>
        <Button onClick={() => navigate('/marketplace')}>{t('ui.back_to_marketplace', 'Back to Marketplace')}</Button>
      </div>
    );
  }

  // Round to a whole franc — XAF/FCFA has no fractional unit, and rounding here
  // guarantees no stray sub-franc gets dropped from the displayed amount.
  const subtotal = Math.max(0, Math.round(Number(item.price || 0)));
  // Platform fee: 2% of the item price, with a small 3 FCFA minimum so tiny
  // amounts still cover processing (e.g. 50 → 3, 500 → 10, 1000 → 20).
  const platformFee = Math.max(3, Math.round(subtotal * 0.02));
  const checkoutTotal = subtotal + platformFee;
  const categoryLabel = resolveNamedCatalogLabel(categories, item.category, 'Marketplace Item');
  const conditionLabel = String(item.condition || 'Good')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (value) => value.toUpperCase());
  const paymentPhoneLabel = paymentMethod === 'mtn-momo' ? 'MTN' : 'Orange';

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="w-full px-4 lg:px-8 xl:px-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('ui.back', 'Back')}
        </Button>

        <div className="mb-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('ui.secure', 'Secure')} <span className="text-primary">{t('ui.checkout', 'Checkout')}</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('ui.complete_your_purchase_from_the_university_of_buea', 'Complete your purchase from the University of Buea Marketplace.')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <Card className="h-fit rounded-2xl border border-border bg-card shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold text-foreground">{t("checkout.orderSummary", "Order Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-border bg-secondary p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={item.images?.[0] || 'https://placehold.co/200x200?text=Item'}
                    alt={item.title}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{categoryLabel}</p>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t('ui.condition', 'Condition')}: {conditionLabel}</p>
                    <div className="mt-1 flex items-center">
                      <p className="text-lg font-bold text-primary">{subtotal.toLocaleString()} XAF</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t('ui.subtotal', 'Subtotal')}</span>
                  <span>{subtotal.toLocaleString()} XAF</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("checkout.platformFee", "Platform Fee")}</span>
                  <span>{platformFee.toLocaleString()} XAF</span>
                </div>

                <div className="mt-2 border-t border-border pt-2">
                  <div className="flex items-center justify-between text-xl font-bold text-primary">
                    <span>{t('ui.total', 'Total')}</span>
                    <span>{checkoutTotal.toLocaleString()} XAF</span>
                  </div>
                </div>
              </div>

              <Alert className="rounded-xl border-border bg-primary-soft text-primary-strong">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  {t('ui.payments_are_held_in_escrow_until_pickup_is_confir', 'Payments are held in escrow until pickup is confirmed.')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </span>
                  {t('ui.payment_method', 'Payment Method')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <RadioGroup
                  value={paymentMethod}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  onValueChange={(value: 'mtn-momo' | 'orange-money') => setPaymentMethod(value)}
                >
                  <div>
                    <RadioGroupItem value="mtn-momo" id="mtn" className="peer sr-only" />
                    <Label
                      htmlFor="mtn"
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary-soft"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#fdd816] text-[10px] font-black text-[#0d3b31]">
                          MTN
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{t("checkout.mtnMomo", "MTN Mobile Money")}</span>
                          <span className="block text-xs text-muted-foreground">{t("checkout.instantProcessing", "Instant processing")}</span>
                        </span>
                      </div>
                      <span className="h-4 w-4 rounded-full border border-border peer-data-[state=checked]:border-[5px] peer-data-[state=checked]:border-primary" />
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="orange-money" id="orange" className="peer sr-only" />
                    <Label
                      htmlFor="orange"
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary-soft"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#ff7b00] text-[10px] font-black text-white">
                          ORG
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{t("checkout.orangeMoney", "Orange Money")}</span>
                          <span className="block text-xs text-muted-foreground">{t("checkout.instantProcessing", "Instant processing")}</span>
                        </span>
                      </div>
                      <span className="h-4 w-4 rounded-full border border-border peer-data-[state=checked]:border-[5px] peer-data-[state=checked]:border-primary" />
                    </Label>
                  </div>
                </RadioGroup>

                <div className="space-y-2">
                  <Label htmlFor="phone-number" className="text-sm text-foreground">
                    {t('checkout.phoneAccount', 'Phone Number')} ({paymentPhoneLabel} {t('ui.account', 'Account')})
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="+237 6XX XXX XXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent">
                    <CalendarClock className="h-4 w-4 text-accent-foreground" />
                  </span>
                  {t('ui.pickup_details', 'Pickup Details')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pickup-date" className="text-sm text-foreground">{t("checkout.preferredDate", "Preferred Date")}</Label>
                    <Input
                      id="pickup-date"
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickup-time" className="text-sm text-foreground">{t("checkout.preferredTime", "Preferred Time")}</Label>
                    <Input
                      id="pickup-time"
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickup-location" className="text-sm text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {t('ui.meeting_location', 'Meeting Location')}
                    </span>
                  </Label>
                  <Input
                    id="pickup-location"
                    ref={locationInputRef}
                    placeholder="University Main Library Entrance"
                    disabled={!mapsReady}
                    onChange={(e) => setPickupLocation((prev) => ({ ...prev, name: e.target.value }))}
                    value={pickupLocation.name}
                  />
                  <p className="text-xs text-muted-foreground">{t('ui.allowed_university_campuses_and_roundabouts_only', 'Allowed: university campuses and roundabouts only.')}</p>
                  {mapsError ? <p className="text-xs text-[#D97706]">{mapsError}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-foreground">{t('ui.select_from_approved_locations', 'Select from approved locations')}</Label>
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

                <div className="overflow-hidden rounded-xl border border-border bg-secondary">
                  {pickupLocation.name ? (
                    <MeetupMap
                      locationName={pickupLocation.name}
                      address={pickupLocation.address}
                      latitude={pickupLocation.lat}
                      longitude={pickupLocation.lng}
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                      {t('ui.select_a_pickup_point_to_preview_the_map', 'Select a pickup point to preview the map.')}
                    </div>
                  )}
                </div>

                {errorText ? (
                  <Alert variant="destructive">
                    <AlertDescription>{errorText}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  onClick={handleReviewPayment}
                  size="lg"
                  className="h-12 w-full text-base"
                >
                  {t('ui.review_payment', 'Review Payment')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
