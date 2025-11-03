import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

interface OnlineStatusToggleProps {
  specialistId: string;
}

export function OnlineStatusToggle({ specialistId }: OnlineStatusToggleProps) {
  const { language } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [offlineUntil, setOfflineUntil] = useState<Date | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [durationType, setDurationType] = useState<"minutes" | "hours" | "days">("hours");
  const [durationValue, setDurationValue] = useState("1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    
    // Check status every minute
    const interval = setInterval(() => {
      fetchStatus();
    }, 60000);

    return () => clearInterval(interval);
  }, [specialistId]);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select("is_online, offline_until")
        .eq("id", specialistId)
        .single();

      if (error) throw error;

      if (data) {
        setIsOnline(data.is_online);
        
        // Check if offline_until has expired
        if (data.offline_until) {
          const untilDate = new Date(data.offline_until);
          if (untilDate > new Date()) {
            setOfflineUntil(untilDate);
          } else {
            // Auto set back online if time expired
            await setOnlineStatus(true);
          }
        } else {
          setOfflineUntil(null);
        }
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  };

  const setOnlineStatus = async (online: boolean, until?: Date) => {
    setLoading(true);
    try {
      const updateData: any = {
        is_online: online,
      };

      if (!online && until) {
        updateData.offline_until = until.toISOString();
      } else {
        updateData.offline_until = null;
        updateData.offline_reason = null;
      }

      const { error } = await supabase
        .from("specialists")
        .update(updateData)
        .eq("id", specialistId);

      if (error) throw error;

      setIsOnline(online);
      setOfflineUntil(until || null);
      
      toast.success(
        online
          ? language === "ar"
            ? "تم تفعيل استقبال العروض"
            : "You are now online"
          : language === "ar"
          ? "تم إيقاف استقبال العروض مؤقتاً"
          : "You are now offline"
      );
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(
        language === "ar"
          ? "فشل تحديث الحالة"
          : "Failed to update status"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoOffline = () => {
    const duration = parseInt(durationValue);
    
    if (!duration || duration <= 0) {
      toast.error(
        language === "ar"
          ? "الرجاء إدخال مدة صحيحة"
          : "Please enter a valid duration"
      );
      return;
    }

    // Calculate max duration (3 days)
    const maxMinutes = 3 * 24 * 60; // 3 days in minutes
    let durationInMinutes = 0;

    switch (durationType) {
      case "minutes":
        durationInMinutes = duration;
        break;
      case "hours":
        durationInMinutes = duration * 60;
        break;
      case "days":
        durationInMinutes = duration * 24 * 60;
        break;
    }

    if (durationInMinutes > maxMinutes) {
      toast.error(
        language === "ar"
          ? "الحد الأقصى للمدة هو 3 أيام"
          : "Maximum duration is 3 days"
      );
      return;
    }

    const until = new Date();
    until.setMinutes(until.getMinutes() + durationInMinutes);

    setOnlineStatus(false, until);
    setShowDialog(false);
  };

  const handleToggle = () => {
    if (isOnline) {
      setShowDialog(true);
    } else {
      setOnlineStatus(true);
    }
  };

  const getTimeRemaining = () => {
    if (!offlineUntil) return "";

    const now = new Date();
    const diff = offlineUntil.getTime() - now.getTime();
    
    if (diff <= 0) return "";

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return language === "ar"
        ? `${days} ${days === 1 ? "يوم" : "أيام"}`
        : `${days} ${days === 1 ? "day" : "days"}`;
    }
    if (hours > 0) {
      return language === "ar"
        ? `${hours} ${hours === 1 ? "ساعة" : "ساعات"}`
        : `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    return language === "ar"
      ? `${minutes} ${minutes === 1 ? "دقيقة" : "دقائق"}`
      : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-card border rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-gray-400" />
            )}
            <span className="font-medium">
              {language === "ar" ? "حالة استقبال العروض" : "Order Reception Status"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isOnline ? "default" : "secondary"}
              className={isOnline ? "bg-green-600" : "bg-gray-400"}
            >
              {isOnline
                ? language === "ar"
                  ? "أونلاين"
                  : "Online"
                : language === "ar"
                ? "أوفلاين"
                : "Offline"}
            </Badge>
            {!isOnline && offlineUntil && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {language === "ar" ? "متبقي" : "Remaining"}: {getTimeRemaining()}
              </span>
            )}
          </div>
        </div>
        <Button
          variant={isOnline ? "destructive" : "default"}
          size="sm"
          onClick={handleToggle}
          disabled={loading}
        >
          {isOnline
            ? language === "ar"
              ? "قو أوفلاين"
              : "Go Offline"
            : language === "ar"
            ? "قو أونلاين"
            : "Go Online"}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar"
                ? "إيقاف استقبال العروض مؤقتاً"
                : "Temporarily Go Offline"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "اختر المدة التي تريد إيقاف استقبال العروض خلالها (الحد الأقصى 3 أيام)"
                : "Choose how long you want to stop receiving orders (maximum 3 days)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {language === "ar" ? "المدة" : "Duration"}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={durationType === "days" ? "3" : durationType === "hours" ? "72" : "4320"}
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {language === "ar" ? "الوحدة" : "Unit"}
                </Label>
                <Select
                  value={durationType}
                  onValueChange={(value: any) => {
                    setDurationType(value);
                    // Reset value when changing type
                    setDurationValue("1");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">
                      {language === "ar" ? "دقائق" : "Minutes"}
                    </SelectItem>
                    <SelectItem value="hours">
                      {language === "ar" ? "ساعات" : "Hours"}
                    </SelectItem>
                    <SelectItem value="days">
                      {language === "ar" ? "أيام" : "Days"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
              {language === "ar"
                ? "ملاحظة: لن تتلقى أي إشعارات بالعروض الجديدة حتى انتهاء المدة أو إعادة تفعيل الحالة يدوياً"
                : "Note: You won't receive any new order notifications until the duration expires or you manually go back online"}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleGoOffline} disabled={loading}>
              {language === "ar" ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}