import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Autocomplete } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GoogleMapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
  language?: 'ar' | 'en';
}

const translations = {
  ar: {
    selectLocation: 'حدد موقع الخدمة على الخريطة',
    searchPlaceholder: 'ابحث عن عنوان أو مكان...',
    currentLocation: 'موقعي الحالي',
    locationSelected: 'تم تحديد الموقع',
    clickMap: 'انقر على الخريطة لتحديد الموقع',
    dragMarker: 'يمكنك سحب العلامة لضبط الموقع بدقة',
    loading: 'جاري تحميل الخريطة...',
    error: 'خطأ',
    geoError: 'متصفحك لا يدعم خاصية تحديد الموقع',
    geoPermissionError: 'لم نتمكن من الوصول لموقعك. تأكد من منح الإذن للمتصفح.',
    currentLocationUsed: 'تم تحديد موقعك الحالي بنجاح',
  },
  en: {
    selectLocation: 'Select Service Location on Map',
    searchPlaceholder: 'Search for address or place...',
    currentLocation: 'My Current Location',
    locationSelected: 'Location Selected',
    clickMap: 'Click on the map to select location',
    dragMarker: 'You can drag the marker to fine-tune the location',
    loading: 'Loading map...',
    error: 'Error',
    geoError: 'Your browser does not support geolocation',
    geoPermissionError: 'Could not access your location. Make sure to grant permission.',
    currentLocationUsed: 'Your current location has been set successfully',
  }
};

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: 25.286106,
  lng: 51.534817,
};

const libraries: ("places")[] = ["places"];

export function GoogleMapLocationPicker({ 
  onLocationSelect, 
  initialLat = 25.286106, 
  initialLng = 51.534817, 
  language = 'ar' 
}: GoogleMapLocationPickerProps) {
  const t = translations[language];
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<string>('');
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  
  // Fetch API key from edge function
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (error) {
          console.error('Error fetching Google Maps API key:', error);
        } else if (data?.apiKey) {
          // Extract just the API key if it's a full URL
          let key = data.apiKey;
          if (key.includes('key=')) {
            const match = key.match(/key=([^&]+)/);
            if (match) key = match[1];
          }
          setApiKey(key);
        }
      } catch (error) {
        console.error('Error fetching Google Maps API key:', error);
      } finally {
        setIsKeyLoading(false);
      }
    };
    fetchApiKey();
  }, []);
  
  if (isKeyLoading || !apiKey) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
      language={language}
      loadingElement={
        <div className="flex items-center justify-center h-[500px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">{t.loading}</p>
          </div>
        </div>
      }
    >
      <GoogleMapContent 
        onLocationSelect={onLocationSelect}
        initialLat={initialLat}
        initialLng={initialLng}
        language={language}
      />
    </LoadScript>
  );
}

function GoogleMapContent({ 
  onLocationSelect, 
  initialLat, 
  initialLng, 
  language 
}: GoogleMapLocationPickerProps) {
  const t = translations[language];
  const { toast } = useToast();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [markerPosition, setMarkerPosition] = useState({ lat: initialLat, lng: initialLng });
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(currentLocation);
          setMarkerPosition(currentLocation);
          onLocationSelect(currentLocation.lat, currentLocation.lng);
          
          // Reverse geocode to get address
          if (window.google) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: currentLocation }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                setSelectedAddress(results[0].formatted_address);
              }
            });
          }
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      onLocationSelect(lat, lng);

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setSelectedAddress(results[0].formatted_address);
          onLocationSelect(lat, lng, results[0].formatted_address);
        }
      });

      toast({
        title: t.locationSelected,
        description: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    }
  }, [onLocationSelect, toast, t]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      onLocationSelect(lat, lng);

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setSelectedAddress(results[0].formatted_address);
          onLocationSelect(lat, lng, results[0].formatted_address);
        }
      });
    }
  }, [onLocationSelect]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: t.error,
        description: t.geoError,
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentLocation = { lat: latitude, lng: longitude };
        
        setCenter(currentLocation);
        setMarkerPosition(currentLocation);
        onLocationSelect(latitude, longitude);

        if (map) {
          map.panTo(currentLocation);
          map.setZoom(16);
        }

        // Reverse geocode to get address
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: currentLocation }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            setSelectedAddress(results[0].formatted_address);
            onLocationSelect(latitude, longitude, results[0].formatted_address);
          }
        });

        toast({
          title: t.locationSelected,
          description: t.currentLocationUsed,
        });
      },
      () => {
        toast({
          title: t.error,
          description: t.geoPermissionError,
          variant: 'destructive',
        });
      }
    );
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const newCenter = { lat, lng };
        
        setCenter(newCenter);
        setMarkerPosition(newCenter);
        setSelectedAddress(place.formatted_address || '');
        onLocationSelect(lat, lng, place.formatted_address);

        if (map) {
          map.panTo(newCenter);
          map.setZoom(16);
        }

        toast({
          title: t.locationSelected,
          description: place.formatted_address,
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">{t.selectLocation}</span>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleCurrentLocation}
          className="flex items-center gap-2"
        >
          <Navigation className="h-4 w-4" />
          {t.currentLocation}
        </Button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
        <Autocomplete
          onLoad={(autocomplete) => {
            autocompleteRef.current = autocomplete;
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'qa' },
            fields: ['geometry', 'formatted_address', 'name'],
          }}
        >
          <Input
            type="text"
            placeholder={t.searchPlaceholder}
            className="pr-10 h-12 text-base"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
        </Autocomplete>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-border">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={14}
          onClick={handleMapClick}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'on' }],
              },
            ],
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={handleMarkerDragEnd}
            animation={google.maps.Animation.DROP}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 0C8.95 0 0 8.95 0 20C0 35 20 56 20 56C20 56 40 35 40 20C40 8.95 31.05 0 20 0Z" fill="#3b82f6"/>
                  <circle cx="20" cy="20" r="8" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 56),
              anchor: new google.maps.Point(20, 56),
            }}
          />
        </GoogleMap>
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1 flex-1">
            {selectedAddress ? (
              <>
                <p className="font-medium text-sm">{t.locationSelected}</p>
                <p className="text-sm text-muted-foreground break-words">{selectedAddress}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.clickMap}</p>
            )}
            <p className="text-xs text-primary font-mono">
              📍 {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic">{t.dragMarker}</p>
      </div>
    </div>
  );
}