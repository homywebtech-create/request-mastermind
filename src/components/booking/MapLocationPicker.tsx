import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Autocomplete } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  language?: 'ar' | 'en';
}

const translations = {
  ar: {
    selectLocation: 'حدد موقع الخدمة',
    searchLocation: 'ابحث عن عنوان أو موقع',
    searchPlaceholder: 'اكتب اسم المنطقة أو الشارع...',
    defaultLocation: 'استخدم موقع الدوحة',
    currentLocation: 'استخدم موقعي الحالي',
    locationSelected: 'تم تحديد الموقع:',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    clickMap: 'انقر على الخريطة لتحديد الموقع أو اسحب العلامة',
    locationSet: 'تم تحديد الموقع',
    defaultLocationUsed: 'تم استخدام الموقع الافتراضي (الدوحة، قطر)',
    currentLocationUsed: 'تم تحديد موقعك الحالي بنجاح',
    error: 'خطأ',
    geoError: 'متصفحك لا يدعم خاصية تحديد الموقع',
    geoPermissionError: 'لم نتمكن من الوصول لموقعك. تأكد من منح الإذن للمتصفح.',
    loadingMap: 'جاري تحميل الخريطة...',
    mapLoadError: 'حدث خطأ في تحميل الخريطة',
  },
  en: {
    selectLocation: 'Select Service Location',
    searchLocation: 'Search for an address or location',
    searchPlaceholder: 'Type area name or street...',
    defaultLocation: 'Use Doha Location',
    currentLocation: 'Use My Current Location',
    locationSelected: 'Selected Location:',
    latitude: 'Latitude',
    longitude: 'Longitude',
    clickMap: 'Click on the map to select location or drag the marker',
    locationSet: 'Location Set',
    defaultLocationUsed: 'Default location set (Doha, Qatar)',
    currentLocationUsed: 'Your current location has been set successfully',
    error: 'Error',
    geoError: 'Your browser does not support geolocation',
    geoPermissionError: 'Could not access your location. Make sure to grant permission to the browser.',
    loadingMap: 'Loading map...',
    mapLoadError: 'Error loading map',
  }
};

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '450px',
  borderRadius: '0.75rem',
};

export function MapLocationPicker({ 
  onLocationSelect, 
  initialLat = 25.286106, 
  initialLng = 51.534817, 
  language = 'ar' 
}: MapLocationPickerProps) {
  const t = translations[language];
  const { toast } = useToast();
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng
  });
  const [autocomplete, setAutocomplete] = useState<any>(null);
  const [searchValue, setSearchValue] = useState('');

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        
        if (error) throw error;
        
        if (data?.apiKey) {
          setGoogleMapsApiKey(data.apiKey);
          setLoading(false);
        } else {
          throw new Error('No API key received');
        }
      } catch (error) {
        console.error('Error fetching Google Maps API key:', error);
        toast({
          title: t.error,
          description: t.mapLoadError,
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  const handleMapClick = useCallback((e: any) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedLocation({ lat, lng });
      onLocationSelect(lat, lng);
      
      toast({
        title: t.locationSet,
        description: `${t.latitude}: ${lat.toFixed(6)}, ${t.longitude}: ${lng.toFixed(6)}`,
      });
    }
  }, [onLocationSelect, t]);

  const handleMarkerDragEnd = useCallback((e: any) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedLocation({ lat, lng });
      onLocationSelect(lat, lng);
    }
  }, [onLocationSelect]);

  const handleUseDefaultLocation = () => {
    const defaultLat = 25.286106;
    const defaultLng = 51.534817;
    
    setSelectedLocation({ lat: defaultLat, lng: defaultLng });
    setMapCenter({ lat: defaultLat, lng: defaultLng });
    onLocationSelect(defaultLat, defaultLng);

    toast({
      title: t.locationSet,
      description: t.defaultLocationUsed,
    });
  };

  const handleUseCurrentLocation = () => {
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
        
        setSelectedLocation({ lat: latitude, lng: longitude });
        setMapCenter({ lat: latitude, lng: longitude });
        onLocationSelect(latitude, longitude);

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
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        setSelectedLocation({ lat, lng });
        setMapCenter({ lat, lng });
        onLocationSelect(lat, lng);
        setSearchValue(place.formatted_address || '');
        
        toast({
          title: t.locationSet,
          description: place.formatted_address || '',
        });
      }
    }
  };

  const onAutocompleteLoad = (autocompleteInstance: any) => {
    setAutocomplete(autocompleteInstance);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[450px] bg-muted/30 rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t.loadingMap}</p>
        </div>
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-[450px] bg-destructive/10 rounded-lg border-2 border-destructive/20">
        <div className="text-center px-4">
          <p className="text-destructive font-medium">{t.mapLoadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with title and action buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">{t.selectLocation}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseDefaultLocation}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {t.defaultLocation}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            className="flex items-center gap-2"
          >
            <Navigation className="h-4 w-4" />
            {t.currentLocation}
          </Button>
        </div>
      </div>

      {/* Search box */}
      <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
        <div className="relative">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </Autocomplete>
        </div>

        {/* Google Map */}
        <div className="border-4 border-border rounded-xl overflow-hidden shadow-lg">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={13}
            onClick={handleMapClick}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
            }}
          >
            <Marker
              position={selectedLocation}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
            />
          </GoogleMap>
        </div>
      </LoadScript>

      {/* Location info and helper text */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
        <p className="text-sm text-muted-foreground">{t.clickMap}</p>
        <div className="flex items-start gap-2 pt-2 border-t border-primary/10">
          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-sm">{t.locationSelected}</p>
            <div className="flex flex-col sm:flex-row sm:gap-4 text-xs text-muted-foreground">
              <span>📍 {t.latitude}: <span className="font-mono">{selectedLocation.lat.toFixed(6)}</span></span>
              <span>📍 {t.longitude}: <span className="font-mono">{selectedLocation.lng.toFixed(6)}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}