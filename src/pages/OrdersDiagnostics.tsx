import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface InconsistentOrder {
  id: string;
  order_number: string;
  status: string;
  tracking_stage: string | null;
  waiting_started_at: string | null;
  waiting_ends_at: string | null;
  created_at: string;
}

interface IssueCategory {
  name: string;
  nameAr: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  descriptionAr: string;
}

export default function OrdersDiagnostics() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [issues, setIssues] = useState<IssueCategory[]>([]);
  const [inconsistentOrders, setInconsistentOrders] = useState<InconsistentOrder[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (role !== 'admin' && role !== 'admin_full' && role !== 'admin_manager') {
      navigate('/admin');
      return;
    }
    
    checkInconsistencies();
  }, [user, role]);
  
  const checkInconsistencies = async () => {
    setLoading(true);
    try {
      const issueCategories: IssueCategory[] = [];
      const allInconsistentOrders: InconsistentOrder[] = [];
      
      // 1. Cancelled with tracking_stage
      const { data: cancelled } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'cancelled')
        .not('tracking_stage', 'is', null);
      
      if (cancelled && cancelled.length > 0) {
        issueCategories.push({
          name: 'Cancelled with Tracking Stage',
          nameAr: 'طلبات ملغية مع مرحلة تتبع',
          count: cancelled.length,
          severity: 'high',
          description: 'Orders marked as cancelled but still have active tracking stage',
          descriptionAr: 'طلبات ملغية لكن لا تزال تحتوي على مرحلة تتبع نشطة'
        });
        allInconsistentOrders.push(...cancelled);
      }
      
      // 2. Working with waiting times
      const { data: workingWaiting } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_stage', 'working')
        .or('waiting_started_at.not.is.null,waiting_ends_at.not.is.null');
      
      if (workingWaiting && workingWaiting.length > 0) {
        issueCategories.push({
          name: 'Working with Waiting Times',
          nameAr: 'طلبات قيد العمل مع أوقات انتظار',
          count: workingWaiting.length,
          severity: 'high',
          description: 'Orders in working stage but still have waiting times set',
          descriptionAr: 'طلبات في مرحلة العمل لكن لا تزال تحتوي على أوقات انتظار'
        });
        allInconsistentOrders.push(...workingWaiting);
      }
      
      // 3. Payment received but not completed
      const { data: paymentNoComplete } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_stage', 'payment_received')
        .neq('status', 'completed');
      
      if (paymentNoComplete && paymentNoComplete.length > 0) {
        issueCategories.push({
          name: 'Payment Received but Not Completed',
          nameAr: 'استلام دفع بدون إكمال',
          count: paymentNoComplete.length,
          severity: 'medium',
          description: 'Orders with payment received but status not marked as completed',
          descriptionAr: 'طلبات تم استلام الدفع لكن الحالة ليست مكتملة'
        });
        allInconsistentOrders.push(...paymentNoComplete);
      }
      
      // 4. Completed without payment_received
      const { data: completeNoPayment } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .neq('tracking_stage', 'payment_received');
      
      if (completeNoPayment && completeNoPayment.length > 0) {
        issueCategories.push({
          name: 'Completed without Payment Received',
          nameAr: 'مكتملة بدون تسجيل الدفع',
          count: completeNoPayment.length,
          severity: 'medium',
          description: 'Orders marked as completed but tracking stage not set to payment_received',
          descriptionAr: 'طلبات مكتملة لكن مرحلة التتبع ليست استلام الدفع'
        });
        allInconsistentOrders.push(...completeNoPayment);
      }
      
      // 5. Pending with tracking_stage
      const { data: pendingTracking } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .not('tracking_stage', 'is', null);
      
      if (pendingTracking && pendingTracking.length > 0) {
        issueCategories.push({
          name: 'Pending with Tracking Stage',
          nameAr: 'طلبات معلقة مع مرحلة تتبع',
          count: pendingTracking.length,
          severity: 'medium',
          description: 'Pending orders that have tracking stages set',
          descriptionAr: 'طلبات معلقة تحتوي على مراحل تتبع'
        });
        allInconsistentOrders.push(...pendingTracking);
      }
      
      // 6. Waiting without times
      const { data: waitingNoTimes } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_stage', 'waiting')
        .or('waiting_started_at.is.null,waiting_ends_at.is.null');
      
      if (waitingNoTimes && waitingNoTimes.length > 0) {
        issueCategories.push({
          name: 'Waiting without Proper Times',
          nameAr: 'انتظار بدون أوقات صحيحة',
          count: waitingNoTimes.length,
          severity: 'low',
          description: 'Orders in waiting stage but missing start or end times',
          descriptionAr: 'طلبات في مرحلة الانتظار لكن تفتقد أوقات البداية أو النهاية'
        });
        allInconsistentOrders.push(...waitingNoTimes);
      }
      
      // 7. Stuck waiting orders
      const { data: stuckWaiting } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_stage', 'waiting')
        .not('waiting_ends_at', 'is', null)
        .lt('waiting_ends_at', new Date().toISOString());
      
      if (stuckWaiting && stuckWaiting.length > 0) {
        issueCategories.push({
          name: 'Stuck in Waiting',
          nameAr: 'عالق في الانتظار',
          count: stuckWaiting.length,
          severity: 'high',
          description: 'Orders stuck in waiting stage past the deadline',
          descriptionAr: 'طلبات عالقة في مرحلة الانتظار بعد انتهاء الموعد'
        });
        allInconsistentOrders.push(...stuckWaiting);
      }
      
      setIssues(issueCategories);
      setInconsistentOrders(allInconsistentOrders);
      setLastCheck(new Date());
      
    } catch (error: any) {
      console.error('Error checking inconsistencies:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleFixAll = async () => {
    setFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-inconsistent-orders');
      
      if (error) throw error;
      
      toast({
        title: language === 'ar' ? 'تم الإصلاح بنجاح' : 'Fixed Successfully',
        description: language === 'ar' 
          ? `تم إصلاح ${data.totalFixed} طلب`
          : `Fixed ${data.totalFixed} orders`
      });
      
      // Refresh the check
      checkInconsistencies();
      
    } catch (error: any) {
      console.error('Error fixing inconsistencies:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setFixing(false);
    }
  };
  
  const getSeverityBadge = (severity: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-500',
      medium: 'bg-orange-500',
      low: 'bg-yellow-500'
    };
    
    const labels = {
      high: language === 'ar' ? 'عالي' : 'High',
      medium: language === 'ar' ? 'متوسط' : 'Medium',
      low: language === 'ar' ? 'منخفض' : 'Low'
    };
    
    return (
      <Badge className={colors[severity]}>
        {labels[severity]}
      </Badge>
    );
  };
  
  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'العودة' : 'Back'}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ar' ? 'تشخيص الطلبات' : 'Orders Diagnostics'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'اكتشف وأصلح الحالات المتناقضة في الطلبات'
                : 'Detect and fix inconsistent order states'
              }
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={checkInconsistencies}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {language === 'ar' ? 'إعادة الفحص' : 'Recheck'}
          </Button>
          
          {totalIssues > 0 && (
            <Button
              onClick={handleFixAll}
              disabled={fixing}
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {language === 'ar' ? 'إصلاح الكل' : 'Fix All'}
            </Button>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'إجمالي المشاكل' : 'Total Issues'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalIssues}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'طلبات متناقضة' : 'Inconsistent orders'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'فئات المشاكل' : 'Issue Categories'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{issues.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'أنواع مختلفة' : 'Different types'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'آخر فحص' : 'Last Check'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {lastCheck ? lastCheck.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastCheck ? lastCheck.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Issues Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : totalIssues === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {language === 'ar' ? 'كل شيء على ما يرام!' : 'All Good!'}
            </h3>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'لا توجد طلبات متناقضة في النظام'
                : 'No inconsistent orders found in the system'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'ar' ? 'المشاكل المكتشفة' : 'Detected Issues'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' 
                ? 'قائمة بجميع الحالات المتناقضة التي تم اكتشافها'
                : 'List of all detected inconsistent states'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الأولوية' : 'Severity'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الفئة' : 'Category'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'العدد' : 'Count'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, index) => (
                  <TableRow key={index}>
                    <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                    <TableCell className="font-medium">
                      {language === 'ar' ? issue.nameAr : issue.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {language === 'ar' ? issue.descriptionAr : issue.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{issue.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
