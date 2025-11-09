import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AppVersion } from '@/hooks/useAppUpdate';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import ApkInstaller from '@/lib/apkInstaller';
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
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);

  const handleUpdate = async () => {
    // Check internet connection first
    if (!navigator.onLine) {
      toast({
        title: t.updateDialog.noInternet || "No Internet Connection",
        description: t.updateDialog.noInternetDesc || "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    const openInBrowser = () => {
      console.log('[Update] Plugin unavailable. Opening APK URL in system browser:', version.apk_url);
      window.location.href = version.apk_url;
      toast({
        title: t.updateDialog.downloadStarted,
        description: t.updateDialog.downloadStartedDesc,
      });
    };

    try {
      // If native plugin is not available, fallback immediately to browser
      const hasApkInstaller = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ApkInstaller');
      if (!hasApkInstaller) {
        openInBrowser();
        return;
      }

      setDownloading(true);
      setDownloadProgress(0);

      console.log('[Update] Starting APK download:', version.apk_url);

      // Download APK file
      const fileName = `app-update-${version.version_code}.apk`;
      
      // Use Capacitor Filesystem to download
      const response = await fetch(version.apk_url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          // Write file to device storage
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          console.log('[Update] APK downloaded to:', result.uri);
          setDownloadProgress(100);

          toast({
            title: t.updateDialog.downloadComplete || 'Download Complete',
            description: t.updateDialog.installingNow || 'Installing update...',
          });

          // Normalize file path for Android (strip file://)
          let filePath = result.uri;
          if (filePath.startsWith('file://')) filePath = filePath.replace('file://', '');

          // Trigger installation via native plugin
          await ApkInstaller.installApk({ filePath });

          console.log('[Update] Installation triggered successfully');

        } catch (error: any) {
          console.error('[Update] Error during download/install:', error);
          const msg = String(error?.message || '');
          // Fallback if plugin not implemented
          if (msg.includes('not implemented') || msg.includes('CapacitorException') || msg.includes('ApkInstaller')) {
            openInBrowser();
            return;
          }
          toast({
            title: t.updateDialog.downloadError,
            description: error.message || 'Failed to install update',
            variant: 'destructive',
          });
        }
      };

      reader.onerror = () => {
        console.error('[Update] Error reading blob');
        toast({
          title: t.updateDialog.downloadError,
          description: 'Failed to process download',
          variant: 'destructive',
        });
      };

      reader.readAsDataURL(blob);

    } catch (error: any) {
      console.error('[Update] Error downloading APK:', error);
      toast({
        title: t.updateDialog.downloadError,
        description: error.message || 'Could not download update',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
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
  );
};