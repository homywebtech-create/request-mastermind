import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleMapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  language?: 'ar' | 'en';
}

const translations = {
  ar: {
    testingMode: '🧪 وضع الاختبار - استخدم الموقع الافتراضي',
    testingDesc: 'للاختبار فقط: يمكنك استخدام الموقع الافتراضي (الدوحة). بعد الانتهاء من الاختبار، يمكن إضافة خريطة تفاعلية حقيقية.',
    selectLocation: 'حدد موقع الخدمة',
    defaultLocation: 'موقع افتراضي (الدوحة)',
    myLocation: 'موقعي الحالي',
    confirmLocation: 'تأكيد الموقع',
    backToMyLocation: 'العودة إلى موقعي',
    enterApiKey: 'يرجى إدخال Google Maps API Key',
    getApiKey: 'احصل على API key مجاني من https://console.cloud.google.com',
    locationSelected: 'الموقع المحدد:',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    area: 'المنطقة',
    moveMapHint: 'حرك الخريطة لتحديد الموقع المطلوب',
    locationSet: 'تم تحديد الموقع',
    defaultLocationUsed: 'تم استخدام الموقع الافتراضي (الدوحة، قطر)',
    currentLocationUsed: 'تم تحديد موقعك الحالي بنجاح',
    error: 'خطأ',
    geoError: 'متصفحك لا يدعم خاصية تحديد الموقع',
    geoPermissionError: 'لم نتمكن من الوصول لموقعك. تأكد من منح الإذن للمتصفح.',
    locationConfirmed: 'تم تأكيد الموقع بنجاح',
    useInteractiveMap: 'استخدم الخريطة التفاعلية',
  },
  en: {
    testingMode: '🧪 Testing Mode - Use Default Location',
    testingDesc: 'For testing only: You can use the default location (Doha). After testing, an interactive map can be added.',
    selectLocation: 'Select Service Location',
    defaultLocation: 'Default Location (Doha)',
    myLocation: 'My Current Location',
    confirmLocation: 'Confirm Location',
    backToMyLocation: 'Back to My Location',
    enterApiKey: 'Please enter Google Maps API Key',
    getApiKey: 'Get free API key from https://console.cloud.google.com',
    locationSelected: 'Selected Location:',
    latitude: 'Latitude',
    longitude: 'Longitude',
    area: 'Area',
    moveMapHint: 'Move the map to select the desired location',
    locationSet: 'Location Set',
    defaultLocationUsed: 'Default location set (Doha, Qatar)',
    currentLocationUsed: 'Your current location has been set successfully',
    error: 'Error',
    geoError: 'Your browser does not support geolocation',
    geoPermissionError: 'Could not access your location. Make sure to grant permission to the browser.',
    locationConfirmed: 'Location confirmed successfully',
    useInteractiveMap: 'Use Interactive Map',
  }
};

export function GoogleMapLocationPicker({ 
  onLocationSelect, 
  initialLat = 25.286106, 
  initialLng = 51.534817, 
  language = 'ar' 
}: GoogleMapLocationPickerProps) {
  const t = translations[language];
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number }>({ 
    lat: initialLat, 
    lng: initialLng 
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [areaName, setAreaName] = useState<string>('');
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [showMap, setShowMap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { toast } = useToast();

  // Request location permission on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setCurrentLocation({ lat: latitude, lng: longitude });
          onLocationSelect(latitude, longitude);
        },
        (error) => {
          console.log('Geolocation permission denied or error:', error);
          // Set default location if permission denied
          setCurrentLocation({ lat: initialLat, lng: initialLng });
          onLocationSelect(initialLat, initialLng);
        }
      );
    } else {
      setCurrentLocation({ lat: initialLat, lng: initialLng });
      onLocationSelect(initialLat, initialLng);
    }
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!showMap || !googleApiKey || mapLoaded) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places&language=${language}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setMapLoaded(true);
      geocoder.current = new (window as any).google.maps.Geocoder();
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [googleApiKey, showMap, language]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapLoaded) return;

    map.current = new (window as any).google.maps.Map(mapContainer.current, {
      center: currentLocation,
      zoom: 15,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
    });

    // Update location on map drag
    map.current.addListener('center_changed', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      if (center) {
        const lat = center.lat();
        const lng = center.lng();
        setCurrentLocation({ lat, lng });
        reverseGeocode(lat, lng);
      }
    });

    // Initial reverse geocode
    reverseGeocode(currentLocation.lat, currentLocation.lng);
  }, [mapLoaded]);

  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoder.current) return;

    geocoder.current.geocode(
      { location: { lat, lng } },
      (results, status) => {
        if (status === 'OK' && results && results[0]) {
          // Get the most relevant address component (neighborhood or locality)
          const addressComponents = results[0].address_components;
          let area = '';
          
          for (const component of addressComponents) {
            if (component.types.includes('neighborhood') || 
                component.types.includes('sublocality') ||
                component.types.includes('locality')) {
              area = component.long_name;
              break;
            }
          }
          
          setAreaName(area || results[0].formatted_address);
        }
      }
    );
  };

  const handleUseDefaultLocation = () => {
    const defaultLat = 25.286106;
    const defaultLng = 51.534817;
    
    setCurrentLocation({ lat: defaultLat, lng: defaultLng });
    
    if (map.current) {
      map.current.setCenter({ lat: defaultLat, lng: defaultLng });
      reverseGeocode(defaultLat, defaultLng);
    }

    toast({
      title: t.locationSet,
      description: t.defaultLocationUsed,
    });
  };

  const handleBackToMyLocation = () => {
    if (!userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            setCurrentLocation({ lat: latitude, lng: longitude });
            
            if (map.current) {
              map.current.setCenter({ lat: latitude, lng: longitude });
              reverseGeocode(latitude, longitude);
            }

            toast({
              title: t.locationSet,
              description: t.currentLocationUsed,
            });
          },
          (error) => {
            toast({
              title: t.error,
              description: t.geoPermissionError,
              variant: 'destructive',
            });
          }
        );
      }
      return;
    }

    setCurrentLocation(userLocation);
    
    if (map.current) {
      map.current.setCenter(userLocation);
      reverseGeocode(userLocation.lat, userLocation.lng);
    }
  };

  const handleConfirmLocation = () => {
    onLocationSelect(currentLocation.lat, currentLocation.lng);
    
    toast({
      title: t.locationSet,
      description: t.locationConfirmed,
    });
  };

  return (
    <div className="space-y-4">
      {/* Testing Mode Notice - Only show if map not activated */}
      {!showMap && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            {t.testingMode}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t.testingDesc}
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-medium">{t.selectLocation}</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleUseDefaultLocation}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {t.defaultLocation}
          </Button>
        </div>
      </div>

      {/* Show map activation button */}
      {!showMap && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="text-sm text-primary hover:underline font-medium"
          >
            {t.useInteractiveMap}
          </button>
        </div>
      )}

      {/* Google Maps API Key Input */}
      {showMap && !googleApiKey && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            {t.enterApiKey}
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            {t.getApiKey}
          </p>
          <input
            type="text"
            value={googleApiKey}
            onChange={(e) => setGoogleApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
            dir="ltr"
          />
        </div>
      )}

      {/* Map Container with fixed center marker */}
      {showMap && googleApiKey && mapLoaded && (
        <div className="relative">
          <div 
            ref={mapContainer} 
            className="h-[450px] w-full rounded-lg border-2 border-border shadow-lg"
          />
          
          {/* Fixed center marker */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <MapPin className="h-10 w-10 text-red-500 drop-shadow-lg" fill="currentColor" />
          </div>

          {/* Control buttons overlay */}
          <div className="absolute top-4 left-4 right-4 flex justify-between gap-2 z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleBackToMyLocation}
              className="flex items-center gap-2 shadow-lg"
            >
              <Navigation className="h-4 w-4" />
              {t.myLocation}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmLocation}
              className="flex items-center gap-2 shadow-lg"
            >
              <Check className="h-4 w-4" />
              {t.confirmLocation}
            </Button>
          </div>

          {/* Hint at bottom */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border">
              <p className="text-sm text-center text-muted-foreground">
                {t.moveMapHint}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Location Display */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-2">
        <p className="font-medium text-base mb-2">{t.locationSelected}</p>
        {areaName && showMap && mapLoaded && (
          <p className="text-foreground font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {t.area}: {areaName}
          </p>
        )}
        <p className="flex items-center gap-2">
          📍 {t.latitude}: <span className="font-mono">{currentLocation.lat.toFixed(6)}</span>
        </p>
        <p className="flex items-center gap-2">
          📍 {t.longitude}: <span className="font-mono">{currentLocation.lng.toFixed(6)}</span>
        </p>
      </div>
    </div>
  );
}
