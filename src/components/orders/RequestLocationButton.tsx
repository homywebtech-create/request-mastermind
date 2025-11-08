import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { requestCustomerLocation } from "@/lib/whatsappLocationHelper";

interface RequestLocationButtonProps {
  customerPhone: string;
  orderNumber: string;
  onLocationRequested?: () => void;
}

export const RequestLocationButton = ({
  customerPhone,
  orderNumber,
  onLocationRequested,
}: RequestLocationButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestLocation = async () => {
    try {
      setIsLoading(true);
      
      await requestCustomerLocation(customerPhone, orderNumber);
      
      toast({
        title: "تم إرسال طلب الموقع",
        description: "تم إرسال رسالة للعميل لمشاركة موقعه عبر WhatsApp",
      });

      onLocationRequested?.();
    } catch (error) {
      console.error("Error requesting location:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال طلب الموقع",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRequestLocation}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          جاري الإرسال...
        </>
      ) : (
        <>
          <MapPin className="h-4 w-4 mr-2" />
          طلب الموقع عبر WhatsApp
        </>
      )}
    </Button>
  );
};
