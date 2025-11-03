import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  User,
  Smartphone
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SpecialistTokenStatus {
  specialist_id: string;
  specialist_name: string;
  phone: string;
  has_token: boolean;
  token_count: number;
  last_token_update: string | null;
  platform: string | null;
}

export default function NotificationDiagnostics() {
  const [specialists, setSpecialists] = useState<SpecialistTokenStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    try {
      // Get all specialists with their token status
      const { data: specialistsData, error: specError } = await supabase
        .from('specialists')
        .select('id, name, phone')
        .eq('is_active', true)
        .order('name');

      if (specError) throw specError;

      // Get all device tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('device_tokens')
        .select('specialist_id, platform, last_used_at, created_at');

      if (tokensError) throw tokensError;

      // Combine data
      const diagnostics = (specialistsData || []).map(spec => {
        const tokens = (tokensData || []).filter(t => t.specialist_id === spec.id);
        const latestToken = tokens.sort((a, b) => 
          new Date(b.last_used_at || b.created_at).getTime() - 
          new Date(a.last_used_at || a.created_at).getTime()
        )[0];

        return {
          specialist_id: spec.id,
          specialist_name: spec.name,
          phone: spec.phone,
          has_token: tokens.length > 0,
          token_count: tokens.length,
          last_token_update: latestToken?.last_used_at || latestToken?.created_at || null,
          platform: latestToken?.platform || null
        };
      });

      setSpecialists(diagnostics);
    } catch (error) {
      console.error('Error fetching diagnostics:', error);
      toast({
        title: 'خطأ / Error',
        description: 'Failed to load diagnostics',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const stats = {
    total: specialists.length,
    withTokens: specialists.filter(s => s.has_token).length,
    withoutTokens: specialists.filter(s => !s.has_token).length,
    coverage: specialists.length > 0 
      ? Math.round((specialists.filter(s => s.has_token).length / specialists.length) * 100)
      : 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تشخيص الإشعارات</h1>
          <p className="text-muted-foreground">حالة تسجيل المحترفين في نظام الإشعارات</p>
        </div>
        <Button onClick={fetchDiagnostics} disabled={isLoading}>
          <RefreshCw className={`ml-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المحترفين</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <User className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6 bg-green-50 dark:bg-green-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">مسجلين</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.withTokens}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </Card>

        <Card className="p-6 bg-red-50 dark:bg-red-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">غير مسجلين</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.withoutTokens}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">نسبة التغطية</p>
              <p className="text-3xl font-bold">{stats.coverage}%</p>
            </div>
            <Bell className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Alert if coverage is low */}
      {stats.coverage < 80 && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                تحذير: تغطية منخفضة للإشعارات
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                {stats.withoutTokens} محترف لا يستقبلون الإشعارات. يرجى مطالبتهم بـ:
              </p>
              <ul className="text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1 mr-4">
                <li>• تسجيل الدخول مرة أخرى في التطبيق</li>
                <li>• السماح بأذونات الإشعارات عند الطلب</li>
                <li>• التأكد من عدم حظر الإشعارات في إعدادات الهاتف</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Specialists Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">تفاصيل المحترفين</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">رقم الهاتف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">المنصة</TableHead>
                  <TableHead className="text-right">عدد الأجهزة</TableHead>
                  <TableHead className="text-right">آخر تحديث</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialists.map((spec) => (
                  <TableRow key={spec.specialist_id}>
                    <TableCell className="font-medium">{spec.specialist_name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{spec.phone}</TableCell>
                    <TableCell>
                      {spec.has_token ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <CheckCircle className="ml-1 h-3 w-3" />
                          مسجل
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="ml-1 h-3 w-3" />
                          غير مسجل
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {spec.platform ? (
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-4 w-4" />
                          {spec.platform}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {spec.token_count > 0 ? (
                        <Badge variant="outline">{spec.token_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {spec.last_token_update ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(spec.last_token_update).toLocaleDateString('ar-SA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
