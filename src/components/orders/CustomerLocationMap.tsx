import { useEffect, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomerLocationMapProps {
  latitude: number;
  longitude: number;
  address?: string | null;
  name?: string | null;
}

export const CustomerLocationMap = ({
  latitude,
  longitude,
  address,
  name,
}: CustomerLocationMapProps) => {
  const [mapUrl, setMapUrl] = useState<string>("");

  useEffect(() => {
    // استخدام Google Maps Static API لعرض الخريطة
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=600x300&markers=color:red%7C${latitude},${longitude}&key=YOUR_GOOGLE_MAPS_API_KEY`;
    setMapUrl(url);
  }, [latitude, longitude]);

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          موقع العميل
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* معلومات الموقع */}
        <div className="space-y-2">
          {name && (
            <div className="text-sm">
              <span className="font-semibold">الاسم:</span> {name}
            </div>
          )}
          {address && (
            <div className="text-sm">
              <span className="font-semibold">العنوان:</span> {address}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">الإحداثيات:</span> {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>

        {/* الخريطة */}
        <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
          <iframe
            src={`https://www.google.com/maps?q=${latitude},${longitude}&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* زر فتح في خرائط جوجل */}
        <Button
          onClick={openInGoogleMaps}
          variant="outline"
          className="w-full"
        >
          <Navigation className="h-4 w-4 mr-2" />
          فتح في خرائط جوجل
        </Button>

        <Alert>
          <AlertDescription className="text-sm">
            💡 يمكنك استخدام هذا الموقع للتوجيه والوصول إلى العميل
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
