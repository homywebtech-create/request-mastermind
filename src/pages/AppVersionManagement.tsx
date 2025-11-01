import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Download, Trash2, Upload } from 'lucide-react';
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
  const queryClient = useQueryClient();
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
          title: "خطأ",
          description: "الرجاء اختيار ملف APK",
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
          title: "تم اكتشاف الإصدار",
          description: `الإصدار: ${version.name} (${version.code})`,
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
      const { data, error } = await supabase
        .from('app_versions')
        .insert([newVersion])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-versions'] });
      toast({
        title: "تم إضافة الإصدار",
        description: "تم إرسال إشعارات للمستخدمين تلقائياً",
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
        title: "خطأ",
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
        title: "تم الحذف",
        description: "تم حذف الإصدار بنجاح",
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
          title: "جاري رفع الملف...",
          description: "قد يستغرق بضع ثوانٍ",
        });
        finalApkUrl = await uploadApk(apkFile);
      }

      if (!finalApkUrl) {
        toast({
          title: "خطأ",
          description: "الرجاء رفع ملف APK أو إدخال رابط",
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
        title: "خطأ في رفع الملف",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إدارة إصدارات التطبيق</h1>
        <p className="text-muted-foreground mt-2">
          إضافة إصدار جديد يرسل إشعارات تلقائياً لجميع المستخدمين
        </p>
      </div>

      {/* Create Version Form */}
      <Card>
        <CardHeader>
          <CardTitle>إضافة إصدار جديد</CardTitle>
          <CardDescription>
            سيتم إرسال إشعار push لجميع المستخدمين تلقائياً
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCreating ? (
            <Button onClick={() => setIsCreating(true)}>
              <Upload className="w-4 h-4 ml-2" />
              إضافة إصدار جديد
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* APK File Upload */}
              <div className="space-y-2">
                <Label htmlFor="apkFile">ملف APK</Label>
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
                  سيتم اكتشاف رقم الإصدار تلقائياً من اسم الملف (مثال: app-v1.0.2.apk)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="versionCode">رقم الإصدار (Version Code)</Label>
                  <Input
                    id="versionCode"
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(e.target.value)}
                    placeholder="سيتم ملؤه تلقائياً"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    يتم ملؤه تلقائياً من اسم الملف
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="versionName">اسم الإصدار (Version Name)</Label>
                  <Input
                    id="versionName"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="سيتم ملؤه تلقائياً"
                    required
                  />
                </div>
              </div>

              {/* Advanced option: Manual URL (if no file uploaded) */}
              {!apkFile && (
                <div className="space-y-2">
                  <Label htmlFor="apkUrl">أو أدخل رابط APK يدوياً (اختياري)</Label>
                  <Input
                    id="apkUrl"
                    value={apkUrl}
                    onChange={(e) => setApkUrl(e.target.value)}
                    placeholder="https://example.com/app-v1.0.2.apk"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="changelog">ملاحظات التحديث (Changelog)</Label>
                <Textarea
                  id="changelog"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="- إصلاح أخطاء&#10;- تحسينات في الأداء&#10;- ميزات جديدة"
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
                  تحديث إلزامي (التطبيق لن يعمل بدون تحديث)
                </Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createVersion.isPending || uploading}>
                  {uploading ? 'جاري رفع الملف...' : createVersion.isPending ? 'جاري الإضافة...' : 'إضافة وإرسال الإشعارات'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Versions List */}
      <Card>
        <CardHeader>
          <CardTitle>الإصدارات السابقة</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>جاري التحميل...</p>
          ) : versions && versions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الإصدار</TableHead>
                  <TableHead>اسم الإصدار</TableHead>
                  <TableHead>إلزامي</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead>تاريخ الإضافة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-mono">{version.version_code}</TableCell>
                    <TableCell className="font-semibold">{version.version_name}</TableCell>
                    <TableCell>
                      {version.is_mandatory ? (
                        <Badge variant="destructive">إلزامي</Badge>
                      ) : (
                        <Badge variant="secondary">اختياري</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {version.changelog || '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(version.created_at).toLocaleDateString('ar-SA')}
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
                            if (confirm('هل تريد حذف هذا الإصدار؟')) {
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
              لا توجد إصدارات حالياً
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppVersionManagement;