import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AppVersion } from '@/hooks/useAppUpdate';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from '@/i18n';
import { Progress } from '@/components/ui/progress';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AppVersion;
}

export const UpdateDialog = ({ open, onOpenChange, version }: UpdateDialogProps) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showUninstallPopup, setShowUninstallPopup] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);

  const handleUpdate = () => {
    // Check internet connection first
    if (!navigator.onLine) {
      toast({
        title: t.updateDialog.noInternet || "No Internet Connection",
        description: t.updateDialog.noInternetDesc || "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    // Show uninstall popup
    setShowUninstallPopup(true);
  };

  const handleProceedToDownload = () => {
    setShowUninstallPopup(false);
    
    // Open APK download in system browser using standard window.open
    const apkUrl = version.apk_url;
    console.log('[Update] Opening APK URL in default browser:', apkUrl);
    
    // For native apps, use window.open which opens in default browser
    if (Capacitor.isNativePlatform()) {
      window.open(apkUrl, '_system');
    } else {
      window.open(apkUrl, '_blank');
    }
    
    toast({
      title: t.updateDialog.downloadStarted,
      description: t.updateDialog.downloadStartedDesc,
    });
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
    <>
      <Dialog open={open} onOpenChange={version.is_mandatory ? () => {} : onOpenChange}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => version.is_mandatory && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t.updateDialog.updateAvailable.replace('{version}', version.version_name)}
            </DialogTitle>
            <DialogDescription className="text-right">
              {version.changelog || t.updateDialog.newVersionAvailable}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {version.is_mandatory && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                {t.updateDialog.mandatoryUpdate}
              </div>
            )}

            {downloading && downloadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={downloadProgress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {downloadProgress < 100 ? t.updateDialog.downloading : t.updateDialog.installing}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleUpdate}
                disabled={downloading}
                className="w-full"
              >
                <Download className="w-4 h-4 ml-2" />
                {downloading ? t.updateDialog.downloading : t.updateDialog.updateNow}
              </Button>

              {version.is_mandatory ? (
                <Button
                  onClick={handleSkip}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="w-4 h-4 ml-2" />
                  {t.updateDialog.closeApp}
                </Button>
              ) : (
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="w-full"
                >
                  {t.updateDialog.skip}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUninstallPopup} onOpenChange={setShowUninstallPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall First</AlertDialogTitle>
            <AlertDialogDescription>
              Please uninstall the app first for a better experience, then install the downloaded update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleProceedToDownload}>
              Continue to Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};