import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from '@/i18n';
import { Download, Trash2, Upload, ArrowLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AppVersion {
  id: string;
  version_code: number;
  version_name: string;
  apk_url: string;
  changelog: string | null;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

const AppVersionManagement = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkUrl, setApkUrl] = useState('');
  const [changelog, setChangelog] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);

  // Auto-extract version from filename (e.g., app-v1.0.2.apk)
  const extractVersionFromFilename = (filename: string) => {
    const match = filename.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const [, major, minor, patch] = match;
      return {
        name: `${major}.${minor}.${patch}`,
        code: parseInt(major) * 10000 + parseInt(minor) * 100 + parseInt(patch)
      };
    }
    return null;
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.apk')) {
        toast({
          title: t.common.error,
          description: t.appVersions.invalidFile,
          variant: "destructive"
        });
        return;
      }

      setApkFile(file);
      
      // Try to auto-extract version from filename
      const version = extractVersionFromFilename(file.name);
      if (version) {
        setVersionName(version.name);
        setVersionCode(version.code.toString());
        toast({
          title: t.appVersions.versionDetected,
          description: t.appVersions.versionInfo
            .replace('{version}', version.name)
            .replace('{code}', version.code.toString()),
        });
      }
    }
  };

  // Upload APK to storage
  const uploadApk = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('apk-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('apk-files')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Fetch versions
  const { data: versions, isLoading } = useQuery({
    queryKey: ['app-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('version_code', { ascending: false });
      
      if (error) throw error;
      return data as AppVersion[];
    },
  });

  // Create version mutation
  const createVersion = useMutation({
    mutationFn: async (newVersion: {
      version_code: number;
      version_name: string;
      apk_url: string;
      changelog: string;
      is_mandatory: boolean;
    }) => {
      // Check for duplicate version_code first
      const { data: existing } = await supabase
        .from('app_versions')
        .select('version_code, version_name')
        .eq('version_code', newVersion.version_code)
        .maybeSingle();

      if (existing) {
        throw new Error(t.appVersions.duplicateVersionHelp.replace('{version}', existing.version_name));
      }

      const { data, error } = await supabase
        .from('app_versions')
        .insert([newVersion])
        .select()
        .single();
      
      if (error) throw error;

      // Send push notifications to all users
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-app-update', {
          body: { versionId: data.id }
        });

        if (notifyError) {
          console.error('Error sending notifications:', notifyError);
        }
      } catch (error) {
        console.error('Error invoking notification function:', error);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-versions'] });
      toast({
        title: t.appVersions.versionAdded,
        description: t.appVersions.notificationsSentAuto,
      });
      // Reset form
      setVersionCode('');
      setVersionName('');
      setApkUrl('');
      setApkFile(null);
      setChangelog('');
      setIsMandatory(true);
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete version mutation
  const deleteVersion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('app_versions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-versions'] });
      toast({
        title: t.appVersions.versionDeleted,
        description: t.appVersions.versionDeletedSuccess,
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setUploading(true);
      
      let finalApkUrl = apkUrl;
      
      // Upload APK if file is selected
      if (apkFile) {
        toast({
          title: t.appVersions.uploadingFile,
          description: t.appVersions.uploadingFileHelp,
        });
        finalApkUrl = await uploadApk(apkFile);
      }

      if (!finalApkUrl) {
        toast({
          title: t.common.error,
          description: t.appVersions.apkUrlOrFileRequired,
          variant: "destructive"
        });
        return;
      }

      createVersion.mutate({
        version_code: parseInt(versionCode),
        version_name: versionName,
        apk_url: finalApkUrl,
        changelog,
        is_mandatory: isMandatory,
      });
    } catch (error: any) {
      toast({
        title: t.appVersions.uploadError,
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t.appVersions.title}</h1>
          <p className="text-muted-foreground mt-2">
            {t.appVersions.subtitle}
          </p>
        </div>
      </div>

      {/* Create Version Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t.appVersions.addNewVersion}</CardTitle>
          <CardDescription>
            {t.appVersions.notificationsSent}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCreating ? (
            <Button onClick={() => setIsCreating(true)}>
              <Upload className="w-4 h-4 ml-2" />
              {t.appVersions.addVersionButton}
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* APK File Upload */}
              <div className="space-y-2">
                <Label htmlFor="apkFile">{t.appVersions.apkFile}</Label>
                <div className="flex gap-2">
                  <Input
                    id="apkFile"
                    type="file"
                    accept=".apk"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {apkFile && (
                    <Badge variant="secondary" className="self-center">
                      {(apkFile.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.appVersions.apkFileHelp}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="versionCode">{t.appVersions.versionCode}</Label>
                  <Input
                    id="versionCode"
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(e.target.value)}
                    placeholder={t.appVersions.autoFilled}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.appVersions.autoFilledHelp}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="versionName">{t.appVersions.versionName}</Label>
                  <Input
                    id="versionName"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder={t.appVersions.autoFilled}
                    required
                  />
                </div>
              </div>

              {/* Advanced option: Manual URL (if no file uploaded) */}
              {!apkFile && (
                <div className="space-y-2">
                  <Label htmlFor="apkUrl">{t.appVersions.manualUrl}</Label>
                  <Input
                    id="apkUrl"
                    value={apkUrl}
                    onChange={(e) => setApkUrl(e.target.value)}
                    placeholder="https://example.com/app-v1.0.2.apk"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="changelog">{t.appVersions.changelogLabel}</Label>
                <Textarea
                  id="changelog"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder={t.appVersions.changelogPlaceholder}
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="mandatory"
                  checked={isMandatory}
                  onCheckedChange={setIsMandatory}
                />
                <Label htmlFor="mandatory" className="cursor-pointer">
                  {t.appVersions.mandatoryUpdate}
                </Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createVersion.isPending || uploading}>
                  {uploading ? t.appVersions.uploading : createVersion.isPending ? t.appVersions.adding : t.appVersions.addAndNotify}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Versions List */}
      <Card>
        <CardHeader>
          <CardTitle>{t.appVersions.previousVersions}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t.common.loading}</p>
          ) : versions && versions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.appVersions.versionNumber}</TableHead>
                  <TableHead>{t.appVersions.versionNameLabel}</TableHead>
                  <TableHead>{t.appVersions.mandatory}</TableHead>
                  <TableHead>{t.appVersions.changelogNotes}</TableHead>
                  <TableHead>{t.appVersions.dateAdded}</TableHead>
                  <TableHead>{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-mono">{version.version_code}</TableCell>
                    <TableCell className="font-semibold">{version.version_name}</TableCell>
                    <TableCell>
                      {version.is_mandatory ? (
                        <Badge variant="destructive">{t.appVersions.mandatory}</Badge>
                      ) : (
                        <Badge variant="secondary">{t.appVersions.optional}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {version.changelog || '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(version.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(version.apk_url, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(t.appVersions.deleteConfirm)) {
                              deleteVersion.mutate(version.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t.appVersions.noVersions}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppVersionManagement;