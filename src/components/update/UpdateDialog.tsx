import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AppVersion } from '@/hooks/useAppUpdate';
import { App } from '@capacitor/app';
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
    try {
      setDownloading(true);
      
      toast({
        title: t.updateDialog.downloading,
        description: t.updateDialog.downloadingDesc,
      });

      console.log('Downloading APK from:', version.apk_url);

      // Download the APK file
      const response = await fetch(version.apk_url, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.android.package-archive'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size);
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('Converted to base64, saving to filesystem...');

      // Save to device storage
      const fileName = `update-${version.version_name}.apk`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      console.log('File saved at:', savedFile.uri);

      // Trigger native Android installation dialog
      await ApkInstaller.installApk({ 
        filePath: savedFile.uri.replace('file://', '')
      });

      toast({
        title: t.updateDialog.installStarted || "Installation Started",
        description: t.updateDialog.installStartedDesc || "Please follow the installation prompts",
      });
      
    } catch (error) {
      console.error('Error downloading update:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t.updateDialog.downloadError,
        description: `${t.updateDialog.downloadErrorDesc}: ${errorMessage}`,
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