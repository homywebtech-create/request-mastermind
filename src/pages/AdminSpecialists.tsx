import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LogOut, Building2, Users, AlertCircle, Clock, Ban, XCircle, CheckCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

interface Specialist {
  id: string;
  name: string;
  phone: string;
  nationality: string | null;
  image_url: string | null;
  suspension_type: string | null;
  suspension_reason: string | null;
  suspension_end_date: string | null;
  id_card_expiry_date: string | null;
  is_active: boolean;
}

interface Company {
  id: string;
  name: string;
  name_en: string | null;
  phone: string | null;
  email: string | null;
  suspended_specialists: Specialist[];
  total_specialists: number;
}

export default function AdminSpecialists() {
  const { language } = useLanguage();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompaniesWithSuspendedSpecialists();
  }, []);

  const fetchCompaniesWithSuspendedSpecialists = async () => {
    setLoading(true);
    try {
      // Fetch all companies with their specialists
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          name_en,
          phone,
          email
        `)
        .eq('is_active', true)
        .order('name');

      if (companiesError) throw companiesError;

      // For each company, fetch total specialists count and suspended specialists
      const companiesWithSpecialists = await Promise.all(
        (companiesData || []).map(async (company) => {
          // Get total specialists count
          const { count: totalCount } = await supabase
            .from('specialists')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);

          // Get suspended specialists
          const { data: suspendedData, error: suspendedError } = await supabase
            .from('specialists')
            .select('id, name, phone, nationality, image_url, suspension_type, suspension_reason, suspension_end_date, id_card_expiry_date, is_active')
            .eq('company_id', company.id)
            .or('is_active.eq.false,suspension_type.not.is.null')
            .order('name');

          if (suspendedError) throw suspendedError;

          return {
            ...company,
            total_specialists: totalCount || 0,
            suspended_specialists: suspendedData || [],
          };
        })
      );

      // Filter companies that have suspended specialists
      const companiesWithSuspended = companiesWithSpecialists.filter(
        (c) => c.suspended_specialists.length > 0
      );

      setCompanies(companiesWithSuspended);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSuspensionBadge = (specialist: Specialist) => {
    if (!specialist.suspension_type && specialist.is_active) return null;
    
    // إيقاف دائم - أحمر غامق مع أيقونة
    if (specialist.suspension_type === 'permanent') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 bg-red-600 hover:bg-red-700">
          <Ban className="h-3 w-3" />
          {language === 'ar' ? '🚫 موقوف نهائياً' : '🚫 Permanent'}
        </Badge>
      );
    }
    
    // إيقاف مؤقت - أزرق فاتح
    if (specialist.suspension_type === 'temporary') {
      const endDate = specialist.suspension_end_date ? new Date(specialist.suspension_end_date) : null;
      const isExpired = endDate && endDate < new Date();
      
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <Clock className="h-3 w-3" />
          {isExpired 
            ? (language === 'ar' ? 'منتهي / Expired' : 'Expired')
            : (language === 'ar' 
                ? `موقف / حتى ${endDate?.toLocaleDateString('ar-EG')}` 
                : `Until ${endDate?.toLocaleDateString('en-US')}`
              )
          }
        </Badge>
      );
    }
    
    // غير نشط بدون إيقاف محدد
    if (!specialist.is_active) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {language === 'ar' ? 'غير نشط' : 'Inactive'}
        </Badge>
      );
    }
    
    return null;
  };

  // دالة للتحقق من البطاقة المنتهية
  const getIdCardStatusBadge = (specialist: Specialist) => {
    if (!specialist.id_card_expiry_date) return (
      <span className="text-xs text-muted-foreground">-</span>
    );
    
    const expiryDate = new Date(specialist.id_card_expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // منتهية - أحمر مع تأثير نبض
    if (daysUntilExpiry < 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 animate-pulse bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300">
          <AlertCircle className="h-3 w-3" />
          {language === 'ar' ? '⚠️ بطاقة منتهية' : '⚠️ ID Expired'}
        </Badge>
      );
    }
    
    // ستنتهي خلال 30 يوم - برتقالي/أصفر
    if (daysUntilExpiry <= 30) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300">
          <Clock className="h-3 w-3" />
          {language === 'ar' 
            ? `⏰ ستنتهي خلال ${daysUntilExpiry} يوم` 
            : `⏰ Expires in ${daysUntilExpiry} days`
          }
        </Badge>
      );
    }
    
    // صالحة - أخضر فاتح
    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="h-3 w-3" />
        {language === 'ar' ? '✓ صالحة' : '✓ Valid'}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {language === 'ar' ? 'المحترفين المعلقين' : 'Suspended Specialists'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {language === 'ar' 
                  ? 'الشركات التي لديها محترفين معلقين أو موقوفين'
                  : 'Companies with suspended or inactive specialists'
                }
              </p>
            </div>

            <div className="flex gap-2">
              <LanguageSwitcher />
              
              <Button
                variant="outline"
                onClick={() => navigate('/admin')}
              >
                {language === 'ar' ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleSignOut}
                title={language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  {language === 'ar'
                    ? 'لا توجد شركات لديها محترفين معلقين'
                    : 'No companies with suspended specialists'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {language === 'ar' 
                    ? `الشركات (${companies.length})`
                    : `Companies (${companies.length})`
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {companies.map((company) => (
                    <AccordionItem key={company.id} value={company.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div className="text-left">
                              <div className="font-semibold">
                                {language === 'ar' ? company.name : (company.name_en || company.name)}
                              </div>
                              {company.phone && (
                                <div className="text-sm text-muted-foreground">
                                  {company.phone}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {language === 'ar' 
                                ? `${company.suspended_specialists.length} معلق`
                                : `${company.suspended_specialists.length} suspended`
                              }
                            </Badge>
                            <Badge variant="outline">
                              {language === 'ar'
                                ? `${company.total_specialists} إجمالي`
                                : `${company.total_specialists} total`
                              }
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                                <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                                <TableHead>{language === 'ar' ? 'الجنسية' : 'Nationality'}</TableHead>
                                <TableHead>{language === 'ar' ? 'حالة البطاقة' : 'ID Card Status'}</TableHead>
                                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead>{language === 'ar' ? 'نوع التعليق' : 'Suspension Type'}</TableHead>
                                <TableHead>{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                                <TableHead>{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {company.suspended_specialists.map((specialist) => (
                                <TableRow key={specialist.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {specialist.image_url && (
                                        <img
                                          src={specialist.image_url}
                                          alt={specialist.name}
                                          className="h-8 w-8 rounded-full object-cover"
                                        />
                                      )}
                                      <span className="font-medium">{specialist.name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {specialist.phone}
                                  </TableCell>
                                  <TableCell>
                                    {specialist.nationality || '-'}
                                  </TableCell>
                                  <TableCell>
                                    {getIdCardStatusBadge(specialist)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={specialist.is_active ? "default" : "destructive"}>
                                      {specialist.is_active 
                                        ? (language === 'ar' ? 'نشط' : 'Active')
                                        : (language === 'ar' ? 'معلق' : 'Suspended')
                                      }
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {getSuspensionBadge(specialist)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="max-w-xs truncate" title={specialist.suspension_reason || '-'}>
                                      {specialist.suspension_reason || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {specialist.suspension_type === 'temporary' 
                                      ? formatDate(specialist.suspension_end_date)
                                      : specialist.suspension_type === 'permanent'
                                      ? (language === 'ar' ? 'دائم' : 'Permanent')
                                      : '-'
                                    }
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
