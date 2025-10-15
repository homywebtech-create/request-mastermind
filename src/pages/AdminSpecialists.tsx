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
import { LogOut, Building2, Users, AlertCircle, Clock, Ban } from "lucide-react";
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
            .select('*')
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
    if (!specialist.is_active) {
      if (specialist.suspension_type === 'permanent') {
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            {language === 'ar' ? 'إيقاف دائم' : 'Permanent Suspension'}
          </Badge>
        );
      } else if (specialist.suspension_type === 'temporary') {
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {language === 'ar' ? 'إيقاف مؤقت' : 'Temporary Suspension'}
          </Badge>
        );
      } else {
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {language === 'ar' ? 'غير نشط' : 'Inactive'}
          </Badge>
        );
      }
    }
    return null;
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
