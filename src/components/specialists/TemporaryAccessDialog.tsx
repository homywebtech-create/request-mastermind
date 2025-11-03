import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TemporaryAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialist: {
    id: string;
    name: string;
    phone: string;
    id_card_expiry_date?: string;
  };
  onSuccess: () => void;
}

export function TemporaryAccessDialog({
  open,
  onOpenChange,
  specialist,
  onSuccess,
}: TemporaryAccessDialogProps) {
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("سماح مؤقت لإكمال الحجوزات القائمة");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!endDate) {
      toast({
        title: "خطأ / Error",
        description: "يرجى تحديد تاريخ انتهاء السماح المؤقت / Please select temporary access end date",
        variant: "destructive",
      });
      return;
    }

    // التحقق من أن التاريخ في المستقبل
    const selectedDate = new Date(endDate);
    if (selectedDate <= new Date()) {
      toast({
        title: "خطأ / Error",
        description: "التاريخ يجب أن يكون في المستقبل / Date must be in the future",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // تحديث حالة المحترف لإعطاء سماح مؤقت
      const { error: updateError } = await supabase
        .from('specialists')
        .update({
          is_active: true,
          suspension_type: 'temporary',
          suspension_reason: reason,
          suspension_end_date: endDate,
        })
        .eq('id', specialist.id);

      if (updateError) throw updateError;

      toast({
        title: "تم بنجاح / Success",
        description: `تم منح سماح مؤقت للمحترف ${specialist.name} حتى ${new Date(endDate).toLocaleDateString('ar-SA')}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error granting temporary access:', error);
      toast({
        title: "خطأ / Error",
        description: error.message || "فشل منح السماح المؤقت / Failed to grant temporary access",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // حساب تاريخ افتراضي (أسبوع من الآن)
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 7);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <span>سماح مؤقت / Temporary Access</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            منح سماح مؤقت للمحترف لإكمال الحجوزات القائمة رغم انتهاء البطاقة
            <br />
            Grant temporary access to complete existing bookings despite expired ID
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong>المحترف:</strong> {specialist.name} ({specialist.phone})
            <br />
            {specialist.id_card_expiry_date && (
              <>
                <strong>تاريخ انتهاء البطاقة:</strong> {new Date(specialist.id_card_expiry_date).toLocaleDateString('ar-SA')}
                <br />
              </>
            )}
            <strong>ملاحظة:</strong> سيتم إيقاف الحساب تلقائياً بعد انتهاء فترة السماح
          </AlertDescription>
        </Alert>

        <div className="space-y-4 mt-4">
          {/* تاريخ انتهاء السماح المؤقت */}
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-base font-semibold">
              تاريخ انتهاء السماح المؤقت / Temporary Access End Date *
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              placeholder={defaultEndDate.toISOString().split('T')[0]}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              اقتراح: {defaultEndDate.toLocaleDateString('ar-SA')} (أسبوع من الآن)
            </p>
          </div>

          {/* سبب السماح المؤقت */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-semibold">
              سبب السماح المؤقت / Reason for Temporary Access
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: لإكمال الحجوزات القائمة حتى تجديد البطاقة"
              rows={3}
              className="text-base"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-6">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1"
            size="lg"
          >
            {isLoading ? "جاري المنح... / Granting..." : "منح السماح المؤقت / Grant Access"}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={isLoading}
            size="lg"
          >
            إلغاء / Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}