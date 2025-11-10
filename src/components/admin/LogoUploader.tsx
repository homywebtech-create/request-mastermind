import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Camera } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

interface LogoUploaderProps {
  currentLogoUrl: string;
  onLogoUpdate: (newUrl: string) => void;
}

export function LogoUploader({ currentLogoUrl, onLogoUpdate }: LogoUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "الرجاء اختيار ملف صورة" : "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "حجم الملف يجب أن يكون أقل من 5 ميجابايت" : "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(uploadData.path);

      // Update settings in database
      const { error: updateError } = await supabase
        .from('settings')
        .upsert({
          key: 'company_logo_url',
          value: publicUrl
        }, {
          onConflict: 'key'
        });

      if (updateError) throw updateError;

      // Delete old logo if exists
      if (currentLogoUrl && currentLogoUrl.includes('logos/')) {
        const oldFileName = currentLogoUrl.split('/logos/')[1];
        if (oldFileName && oldFileName !== fileName) {
          await supabase.storage
            .from('logos')
            .remove([oldFileName]);
        }
      }

      onLogoUpdate(publicUrl);
      setIsOpen(false);

      toast({
        title: language === 'ar' ? "نجح!" : "Success!",
        description: language === 'ar' ? "تم تحديث الشعار بنجاح" : "Logo updated successfully",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل تحميل الشعار" : "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تغيير شعار الشركة' : 'Change Company Logo'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            {currentLogoUrl && (
              <img
                src={currentLogoUrl}
                alt="Current logo"
                className="h-32 w-32 rounded-full object-cover border-2 border-border"
              />
            )}
            <label
              htmlFor="logo-upload"
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                <Upload className="h-4 w-4" />
                <span>{uploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'اختر صورة' : 'Choose Image')}</span>
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="text-sm text-muted-foreground text-center">
              {language === 'ar' 
                ? 'اختر صورة بحجم أقل من 5 ميجابايت' 
                : 'Select an image less than 5MB'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
