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

      // Save to external storage (Downloads) for better compatibility
      const fileName = `update-${version.version_name}.apk`;
      
      // Try to save to external storage first (more reliable for APK installation)
      let savedFile;
      try {
        savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.External,
        });
        console.log('File saved to external storage:', savedFile.uri);
      } catch (extError) {
        console.warn('Failed to save to external storage, trying cache:', extError);
        // Fallback to cache if external fails
        savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        console.log('File saved to cache:', savedFile.uri);
      }
      
      // Get the actual file path (remove file:// prefix)
      let filePath = savedFile.uri;
      
      if (filePath.startsWith('file://')) {
        filePath = filePath.replace('file://', '');
      }
      
      console.log('Attempting to install APK from path:', filePath);

      // Trigger installation
      try {
        const result = await ApkInstaller.installApk({ 
          filePath: filePath
        });
        
        console.log('ApkInstaller result:', result);

        toast({
          title: t.updateDialog.installStarted || "Installation Started",
          description: t.updateDialog.installStartedDesc || "Please follow the installation prompts",
        });
      } catch (pluginError: any) {
        console.error('ApkInstaller plugin error:', pluginError);
        console.error('Error details:', JSON.stringify(pluginError));
        
        toast({
          title: "Installation Error",
          description: pluginError?.message || "Failed to start installation. Please check app permissions and install from file manager.",
          variant: "destructive"
        });
      }
      
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