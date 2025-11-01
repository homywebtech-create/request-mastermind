import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AppVersion } from '@/hooks/useAppUpdate';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useToast } from '@/hooks/use-toast';
import ApkInstaller from '@/lib/apkInstaller';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from '@/i18n';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AppVersion;
}

export const UpdateDialog = ({ open, onOpenChange, version }: UpdateDialogProps) => {
  const [downloading, setDownloading] = useState(false);
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

    try {
      // Guard: only on native Android. In web preview this plugin is unavailable
      if (!Capacitor.isNativePlatform()) {
        toast({
          title: 'Opening download link',
          description: 'Install updates from the Android app. Opened the APK link in your browser.',
        });
        try { window.open(version.apk_url, '_blank'); } catch {}
        return;
      }

      setDownloading(true);

      toast({
        title: t.updateDialog.downloading,
        description: t.updateDialog.downloadingDesc,
      });

      console.log('[Update] Platform:', Capacitor.getPlatform());
      console.log('[Update] Downloading APK from:', version.apk_url);

      const fileName = `update-${version.version_name}.apk`;
      let filePath: string | null = null;

      // Prefer native downloadFile API to avoid huge base64 memory usage
      try {
        if (typeof (Filesystem as any).downloadFile === 'function') {
          const res = await (Filesystem as any).downloadFile({
            url: version.apk_url,
            path: fileName,
            directory: Directory.Cache,
          });
          const candidate = (res?.uri || res?.path || '').toString();
          filePath = candidate.startsWith('file://') ? candidate.replace('file://', '') : candidate;
          console.log('[Update] Downloaded to (cache):', filePath);
        }
      } catch (e) {
        console.warn('[Update] downloadFile failed, falling back to fetch->writeFile:', e);
      }

      // Fallback: fetch + writeFile (base64) to Cache if downloadFile not available/failed
      if (!filePath) {
        const response = await fetch(version.apk_url, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        console.log('[Update] Blob size:', blob.size);

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        const candidate = (savedFile?.uri || '').toString();
        filePath = candidate.startsWith('file://') ? candidate.replace('file://', '') : candidate;
        console.log('[Update] Saved (fallback) to cache at:', filePath);
      }

      if (!filePath) {
        throw new Error('Unable to save update file');
      }

      console.log('[Update] Attempting install from path:', filePath);

      // Verify plugin availability at runtime (avoids "plugin not added" errors)
      if (!Capacitor.isPluginAvailable('ApkInstaller')) {
        console.error('[Update] ApkInstaller plugin not available');
        toast({
          title: 'Installer not available',
          description: 'The installer is not available on this build. Opening the APK link in your browser...',
          variant: 'destructive',
        });
        try { window.open(version.apk_url, '_blank'); } catch {}
        return;
      }

      const result = await ApkInstaller.installApk({ filePath });
      console.log('[Update] ApkInstaller result:', result);

      toast({
        title: t.updateDialog.installStarted || 'Installation Started',
        description: t.updateDialog.installStartedDesc || 'Follow the Android prompts to complete the update.',
      });
    } catch (error: any) {
      console.error('[Update] Error during update flow:', error);
      const msg = error?.message || 'Unknown error';
      toast({
        title: t.updateDialog.downloadError,
        description: `${t.updateDialog.downloadErrorDesc}: ${msg}`,
        variant: 'destructive',
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