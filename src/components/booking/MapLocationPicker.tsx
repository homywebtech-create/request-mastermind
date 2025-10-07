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
}

export function MapLocationPicker({ onLocationSelect, initialLat = 25.286106, initialLng = 51.534817 }: MapLocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Use placeholder token - admin should add real token via input or Supabase secret
    const token = mapboxToken || 'YOUR_MAPBOX_TOKEN_HERE';
    
    if (!token || token === 'YOUR_MAPBOX_TOKEN_HERE') {
      toast({
        title: 'تنبيه',
        description: 'يرجى إضافة Mapbox Token أولاً',
        variant: 'destructive',
      });
      return;
    }

    mapboxgl.accessToken = token;

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
  }, [mapboxToken]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'خطأ',
        description: 'متصفحك لا يدعم خاصية تحديد الموقع',
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
          title: 'تم تحديد الموقع',
          description: 'تم تحديد موقعك الحالي بنجاح',
        });
      },
      (error) => {
        toast({
          title: 'خطأ',
          description: 'لم نتمكن من الوصول لموقعك. تأكد من منح الإذن للمتصفح.',
          variant: 'destructive',
        });
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Mapbox Token Input (temporary until added to Supabase secrets) */}
      {!mapboxToken && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            يرجى إدخال Mapbox Token
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            احصل على token مجاني من https://mapbox.com
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-medium">حدد موقع الخدمة</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          className="flex items-center gap-2"
          disabled={!mapboxToken}
        >
          <Navigation className="h-4 w-4" />
          موقعي الحالي
        </Button>
      </div>

      <div 
        ref={mapContainer} 
        className="h-[400px] w-full rounded-lg border-2 border-border shadow-sm"
      />

      {selectedLocation && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">الموقع المحدد:</p>
          <p>خط العرض: {selectedLocation.lat.toFixed(6)}</p>
          <p>خط الطول: {selectedLocation.lng.toFixed(6)}</p>
          <p className="text-xs mt-2 text-primary">يمكنك سحب العلامة لتعديل الموقع</p>
        </div>
      )}
    </div>
  );
}
