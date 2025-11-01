import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AppVersion } from '@/hooks/useAppUpdate';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useToast } from '@/hooks/use-toast';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AppVersion;
}

export const UpdateDialog = ({ open, onOpenChange, version }: UpdateDialogProps) => {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    try {
      setDownloading(true);
      
      // Open APK URL in browser to download
      await Browser.open({ url: version.apk_url });
      
      toast({
        title: "تحميل التحديث",
        description: "سيتم تنزيل التحديث. اتبع التعليمات لتثبيت التطبيق.",
      });
    } catch (error) {
      console.error('Error downloading update:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل التحديث. حاول مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSkip = async () => {
    if (version.is_mandatory) {
      // Force close app for mandatory updates
      await App.exitApp();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={version.is_mandatory ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => version.is_mandatory && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            تحديث متوفر - {version.version_name}
          </DialogTitle>
          <DialogDescription className="text-right">
            {version.changelog || 'إصدار جديد متاح للتحميل'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {version.is_mandatory && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              هذا التحديث إلزامي. يجب تحديث التطبيق للمتابعة.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleUpdate}
              disabled={downloading}
              className="w-full"
            >
              <Download className="w-4 h-4 ml-2" />
              {downloading ? 'جاري التحميل...' : 'تحديث الآن'}
            </Button>

            {version.is_mandatory ? (
              <Button
                onClick={handleSkip}
                variant="destructive"
                className="w-full"
              >
                <X className="w-4 h-4 ml-2" />
                إغلاق التطبيق
              </Button>
            ) : (
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full"
              >
                تخطي
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};