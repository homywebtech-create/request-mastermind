import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MapLocationPickerProps {
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
    currentLocation: 'موقعي الحالي',
    useInteractiveMap: 'أو استخدم الخريطة التفاعلية (يتطلب Mapbox Token)',
    enterToken: 'يرجى إدخال Mapbox Token',
    getToken: 'احصل على token مجاني من https://mapbox.com',
    locationSelected: 'الموقع المحدد:',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    dragMarker: 'يمكنك سحب العلامة لتعديل الموقع',
    locationSet: 'تم تحديد الموقع',
    defaultLocationUsed: 'تم استخدام الموقع الافتراضي (الدوحة، قطر)',
    currentLocationUsed: 'تم تحديد موقعك الحالي بنجاح',
    error: 'خطأ',
    geoError: 'متصفحك لا يدعم خاصية تحديد الموقع',
    geoPermissionError: 'لم نتمكن من الوصول لموقعك. تأكد من منح الإذن للمتصفح.',
  },
  en: {
    testingMode: '🧪 Testing Mode - Use Default Location',
    testingDesc: 'For testing only: You can use the default location (Doha). After testing, an interactive map can be added.',
    selectLocation: 'Select Service Location',
    defaultLocation: 'Default Location (Doha)',
    currentLocation: 'My Current Location',
    useInteractiveMap: 'Or use interactive map (requires Mapbox Token)',
    enterToken: 'Please enter Mapbox Token',
    getToken: 'Get free token from https://mapbox.com',
    locationSelected: 'Selected Location:',
    latitude: 'Latitude',
    longitude: 'Longitude',
    dragMarker: 'You can drag the marker to adjust location',
    locationSet: 'Location Set',
    defaultLocationUsed: 'Default location set (Doha, Qatar)',
    currentLocationUsed: 'Your current location has been set successfully',
    error: 'Error',
    geoError: 'Your browser does not support geolocation',
    geoPermissionError: 'Could not access your location. Make sure to grant permission to the browser.',
  }
};

export function MapLocationPicker({ onLocationSelect, initialLat = 25.286106, initialLng = 51.534817, language = 'ar' }: MapLocationPickerProps) {
  const t = translations[language];
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showMap, setShowMap] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current || map.current || !showMap || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add click handler
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      
      // Remove existing marker
      if (marker.current) {
        marker.current.remove();
      }

      // Add new marker
      marker.current = new mapboxgl.Marker({ color: '#3b82f6', draggable: true })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      // Update on drag
      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
        onLocationSelect(lngLat.lat, lngLat.lng);
      });

      setSelectedLocation({ lat, lng });
      onLocationSelect(lat, lng);
    });

    // Add initial marker if coordinates provided
    if (initialLat && initialLng) {
      marker.current = new mapboxgl.Marker({ color: '#3b82f6', draggable: true })
        .setLngLat([initialLng, initialLat])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
        onLocationSelect(lngLat.lat, lngLat.lng);
      });
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, showMap]);

  const handleUseDefaultLocation = () => {
    // Default location: Doha, Qatar
    const defaultLat = 25.286106;
    const defaultLng = 51.534817;
    
    setSelectedLocation({ lat: defaultLat, lng: defaultLng });
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
        
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
          });

          // Remove existing marker
          if (marker.current) {
            marker.current.remove();
          }

          // Add new marker
          marker.current = new mapboxgl.Marker({ color: '#3b82f6', draggable: true })
            .setLngLat([longitude, latitude])
            .addTo(map.current);

          marker.current.on('dragend', () => {
            const lngLat = marker.current!.getLngLat();
            setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
            onLocationSelect(lngLat.lat, lngLat.lng);
          });
        }

        setSelectedLocation({ lat: latitude, lng: longitude });
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

  return (
    <div className="space-y-4">
      {/* Testing Mode Notice */}
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
          {showMap && mapboxToken && (
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
          )}
        </div>
      </div>

      {/* Optional: Show map with token */}
      {!showMap && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="text-sm text-primary hover:underline"
          >
            {t.useInteractiveMap}
          </button>
        </div>
      )}

      {/* Mapbox Token Input */}
      {showMap && !mapboxToken && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            {t.enterToken}
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            {t.getToken}
          </p>
          <input
            type="text"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            placeholder="pk.eyJ1Ijoi..."
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
            dir="ltr"
          />
        </div>
      )}

      {/* Map Container */}
      {showMap && mapboxToken && (
        <div 
          ref={mapContainer} 
          className="h-[400px] w-full rounded-lg border-2 border-border shadow-sm"
        />
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">{t.locationSelected}</p>
          <p>📍 {t.latitude}: {selectedLocation.lat.toFixed(6)}</p>
          <p>📍 {t.longitude}: {selectedLocation.lng.toFixed(6)}</p>
          {showMap && mapboxToken && (
            <p className="text-xs mt-2 text-primary">{t.dragMarker}</p>
          )}
        </div>
      )}
    </div>
  );
}
