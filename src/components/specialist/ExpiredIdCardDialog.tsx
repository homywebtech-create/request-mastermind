import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Camera, Calendar, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExpiredIdCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialistId: string;
  specialistName: string;
  currentExpiryDate?: string;
  onSuccess: () => void;
}

export function ExpiredIdCardDialog({
  open,
  onOpenChange,
  specialistId,
  specialistName,
  currentExpiryDate,
  onSuccess,
}: ExpiredIdCardDialogProps) {
  const [idCardFrontFile, setIdCardFrontFile] = useState<File | null>(null);
  const [idCardBackFile, setIdCardBackFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const handleFrontFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdCardFrontFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFrontPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdCardBackFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}_${Date.now()}.${fileExt}`;
    const filePath = `${specialistId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('specialist-documents')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('specialist-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!expiryDate) {
      toast({
        title: "خطأ / Error",
        description: "يرجى إدخال تاريخ انتهاء البطاقة / Please enter ID card expiry date",
        variant: "destructive",
      });
      return;
    }

    if (!idCardFrontFile || !idCardBackFile) {
      toast({
        title: "خطأ / Error",
        description: "يرجى رفع صور البطاقة الأمامية والخلفية / Please upload both front and back ID card photos",
        variant: "destructive",
      });
      return;
    }

    // التحقق من أن التاريخ في المستقبل
    const selectedDate = new Date(expiryDate);
    if (selectedDate <= new Date()) {
      toast({
        title: "خطأ / Error",
        description: "تاريخ الانتهاء يجب أن يكون في المستقبل / Expiry date must be in the future",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // رفع صور البطاقة
      const frontUrl = await uploadFile(idCardFrontFile, 'id_card_front');
      const backUrl = await uploadFile(idCardBackFile, 'id_card_back');

      // تحديث بيانات المحترف
      const { error: updateError } = await supabase
        .from('specialists')
        .update({
          id_card_front_url: frontUrl,
          id_card_back_url: backUrl,
          id_card_expiry_date: expiryDate,
          // سيتم إعادة التفعيل تلقائياً بواسطة الـ trigger
        })
        .eq('id', specialistId);

      if (updateError) throw updateError;

      toast({
        title: "تم التحديث بنجاح / Updated Successfully",
        description: "تم تحديث بطاقتك الشخصية وإعادة تفعيل حسابك / Your ID card has been updated and your account reactivated",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating ID card:', error);
      toast({
        title: "خطأ / Error",
        description: error.message || "فشل تحديث البطاقة / Failed to update ID card",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            <span>تجديد البطاقة الشخصية / Renew ID Card</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            مرحباً {specialistName}، بطاقتك الشخصية منتهية الصلاحية. يرجى تحديثها لإعادة تفعيل حسابك.
            <br />
            Hello {specialistName}, your ID card has expired. Please update it to reactivate your account.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-orange-50 border-orange-200">
          <AlertDescription className="text-sm">
            {currentExpiryDate && (
              <>
                <strong>تاريخ الانتهاء الحالي / Current Expiry:</strong> {new Date(currentExpiryDate).toLocaleDateString('ar-SA')}
                <br />
              </>
            )}
            <strong>ملاحظة:</strong> سيتم إعادة تفعيل حسابك تلقائياً بعد تحديث البطاقة.
            <br />
            <strong>Note:</strong> Your account will be automatically reactivated after updating your card.
          </AlertDescription>
        </Alert>

        <div className="space-y-6 mt-4">
          {/* تاريخ انتهاء البطاقة الجديد */}
          <div className="space-y-2">
            <Label htmlFor="expiryDate" className="text-base font-semibold">
              تاريخ انتهاء البطاقة الجديد / New Expiry Date *
            </Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-base"
            />
          </div>

          {/* البطاقة الأمامية */}
          <div className="space-y-2">
            <Label htmlFor="idCardFront" className="text-base font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" />
              صورة البطاقة الأمامية / Front ID Card Photo *
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
              <Input
                id="idCardFront"
                type="file"
                accept="image/*"
                onChange={handleFrontFileChange}
                className="hidden"
              />
              <label htmlFor="idCardFront" className="cursor-pointer">
                {frontPreview ? (
                  <img src={frontPreview} alt="Front Preview" className="max-h-48 mx-auto rounded" />
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500">اضغط لاختيار صورة / Click to select image</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* البطاقة الخلفية */}
          <div className="space-y-2">
            <Label htmlFor="idCardBack" className="text-base font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" />
              صورة البطاقة الخلفية / Back ID Card Photo *
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
              <Input
                id="idCardBack"
                type="file"
                accept="image/*"
                onChange={handleBackFileChange}
                className="hidden"
              />
              <label htmlFor="idCardBack" className="cursor-pointer">
                {backPreview ? (
                  <img src={backPreview} alt="Back Preview" className="max-h-48 mx-auto rounded" />
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500">اضغط لاختيار صورة / Click to select image</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isUploading}
              className="flex-1"
              size="lg"
            >
              {isUploading ? "جاري التحديث... / Updating..." : "تحديث وإعادة التفعيل / Update & Reactivate"}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              disabled={isUploading}
              size="lg"
            >
              إلغاء / Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}