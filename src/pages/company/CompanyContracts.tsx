import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Save, Upload, X, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from '@/i18n';

interface ContractTemplate {
  id: string;
  company_id: string;
  title: string;
  content_ar: string;
  content_en: string;
  terms_ar: string[];
  terms_en: string[];
  is_active: boolean;
  company_logo_url?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
  logo_url?: string;
}

export default function CompanyContracts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const translations = useTranslation(language);
  const t = translations.contracts;
  const tCommon = translations.common;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/company-auth');
        return;
      }

      // Get company info
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'لم يتم العثور على شركة مرتبطة بهذا الحساب' : 'No company found',
          variant: 'destructive',
        });
        navigate('/company-auth');
        return;
      }

      // Get company details
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('id', profile.company_id)
        .single();

      if (companyData) {
        setCompany(companyData);
        fetchTemplates(companyData.id);
      }
    } catch (error: any) {
      console.error('Error checking auth:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchTemplates = async (companyId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTemplates((data || []) as ContractTemplate[]);
      
      // Select first template if exists
      if (data && data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0] as ContractTemplate);
      }
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewContract = () => {
    if (!company) return;
    
    const newTemplate: ContractTemplate = {
      id: '',
      company_id: company.id,
      title: language === 'ar' ? 'عقد جديد' : 'New Contract',
      content_ar: '',
      content_en: '',
      terms_ar: [''],
      terms_en: [''],
      is_active: false,
      company_logo_url: company.logo_url,
      approval_status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    setSelectedTemplate(newTemplate);
    setIsCreating(true);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTemplate) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: tCommon.error,
        description: language === 'ar' ? 'حجم الملف يجب أن لا يتجاوز 2 ميجا' : 'File size must not exceed 2MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `contract-logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setSelectedTemplate({ ...selectedTemplate, company_logo_url: publicUrl });

      toast({
        title: tCommon.success,
        description: language === 'ar' ? 'تم رفع الشعار بنجاح' : 'Logo uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    if (!selectedTemplate) return;
    setSelectedTemplate({ ...selectedTemplate, company_logo_url: undefined });
  };

  const handleSave = async () => {
    if (!selectedTemplate || !company) return;

    // Validate
    if (!selectedTemplate.title || !selectedTemplate.content_ar || !selectedTemplate.content_en) {
      toast({
        title: tCommon.error,
        description: language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      
      if (isCreating || !selectedTemplate.id) {
        // Create new
        const { data, error } = await supabase
          .from('contract_templates')
          .insert({
            company_id: company.id,
            title: selectedTemplate.title,
            content_ar: selectedTemplate.content_ar,
            content_en: selectedTemplate.content_en,
            terms_ar: selectedTemplate.terms_ar.filter(t => t.trim()),
            terms_en: selectedTemplate.terms_en.filter(t => t.trim()),
            is_active: selectedTemplate.is_active,
            company_logo_url: selectedTemplate.company_logo_url,
            approval_status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        
        setSelectedTemplate(data as ContractTemplate);
        setIsCreating(false);
        fetchTemplates(company.id);
        
        toast({
          title: tCommon.success,
          description: language === 'ar' ? 'تم إنشاء العقد بنجاح. في انتظار موافقة الإدارة.' : 'Contract created. Awaiting admin approval.',
        });
      } else {
        // Update existing
        const { error } = await supabase
          .from('contract_templates')
          .update({
            title: selectedTemplate.title,
            content_ar: selectedTemplate.content_ar,
            content_en: selectedTemplate.content_en,
            terms_ar: selectedTemplate.terms_ar.filter(t => t.trim()),
            terms_en: selectedTemplate.terms_en.filter(t => t.trim()),
            is_active: selectedTemplate.is_active,
            company_logo_url: selectedTemplate.company_logo_url,
            // Reset approval when edited
            approval_status: 'pending',
            approved_at: null,
            approved_by: null,
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;

        fetchTemplates(company.id);
        
        toast({
          title: tCommon.success,
          description: language === 'ar' ? 'تم تحديث العقد. في انتظار موافقة الإدارة.' : 'Contract updated. Awaiting admin approval.',
        });
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا العقد؟' : 'Are you sure you want to delete this contract?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', contractId);

      if (error) throw error;

      toast({
        title: tCommon.success,
        description: language === 'ar' ? 'تم حذف العقد' : 'Contract deleted',
      });

      if (company) {
        fetchTemplates(company.id);
      }
      setSelectedTemplate(null);
    } catch (error: any) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addTerm = (lang: 'ar' | 'en') => {
    if (!selectedTemplate) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    setSelectedTemplate({
      ...selectedTemplate,
      [key]: [...selectedTemplate[key], ''],
    });
  };

  const removeTerm = (lang: 'ar' | 'en', index: number) => {
    if (!selectedTemplate) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    const newTerms = [...selectedTemplate[key]];
    newTerms.splice(index, 1);
    setSelectedTemplate({
      ...selectedTemplate,
      [key]: newTerms,
    });
  };

  const updateTerm = (lang: 'ar' | 'en', index: number, value: string) => {
    if (!selectedTemplate) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    const newTerms = [...selectedTemplate[key]];
    newTerms[index] = value;
    setSelectedTemplate({
      ...selectedTemplate,
      [key]: newTerms,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 me-1" />{language === 'ar' ? 'معتمد' : 'Approved'}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 me-1" />{language === 'ar' ? 'مرفوض' : 'Rejected'}</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 me-1" />{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/company-portal')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {language === 'ar' ? 'إدارة العقود' : 'Contract Management'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {language === 'ar' ? 'قم بإنشاء وتعديل عقود شركتك' : 'Create and edit your company contracts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button onClick={createNewContract}>
              <Plus className="h-4 w-4 me-2" />
              {language === 'ar' ? 'عقد جديد' : 'New Contract'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Contracts List Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'العقود' : 'Contracts'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {language === 'ar' ? 'لا توجد عقود' : 'No contracts'}
                </p>
              ) : (
                templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate?.id === template.id ? 'default' : 'ghost'}
                    className="w-full justify-start h-auto py-3"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setIsCreating(false);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1 w-full">
                      <div className="flex items-center gap-2 w-full">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{template.title}</span>
                      </div>
                      {getStatusBadge(template.approval_status)}
                    </div>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Contract Editor */}
          <div className="lg:col-span-3">
            {selectedTemplate ? (
              <Card className="shadow-xl border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>{selectedTemplate.title}</CardTitle>
                      {getStatusBadge(selectedTemplate.approval_status)}
                    </div>
                    {selectedTemplate.id && selectedTemplate.approval_status === 'pending' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(selectedTemplate.id)}
                      >
                        <Trash2 className="h-4 w-4 me-2" />
                        {language === 'ar' ? 'حذف' : 'Delete'}
                      </Button>
                    )}
                  </div>
                  {selectedTemplate.approval_status === 'rejected' && selectedTemplate.rejection_reason && (
                    <div className="mt-2 p-3 bg-destructive/10 rounded-lg">
                      <p className="text-sm text-destructive">
                        <strong>{language === 'ar' ? 'سبب الرفض:' : 'Rejection reason:'}</strong> {selectedTemplate.rejection_reason}
                      </p>
                    </div>
                  )}
                  {selectedTemplate.approval_status === 'approved' && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        {language === 'ar' ? '✓ هذا العقد معتمد ويظهر للعملاء في صفحة الحجز' : '✓ This contract is approved and visible to customers'}
                      </p>
                    </div>
                  )}
                  <CardDescription>
                    {selectedTemplate.approval_status === 'pending'
                      ? (language === 'ar' ? 'في انتظار موافقة الإدارة' : 'Awaiting admin approval')
                      : (language === 'ar' ? 'تم التعديل في ' : 'Last modified ') + new Date(selectedTemplate.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Logo */}
                  <div className="space-y-3">
                    <Label>{language === 'ar' ? 'شعار الشركة' : 'Company Logo'}</Label>
                    {selectedTemplate.company_logo_url ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={selectedTemplate.company_logo_url}
                          alt="Company Logo"
                          className="h-20 w-20 object-contain border rounded-lg p-2"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-4 w-4 me-2" />
                          {language === 'ar' ? 'إزالة الشعار' : 'Remove Logo'}
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <Label
                            htmlFor="logo-upload"
                            className="cursor-pointer text-sm text-primary hover:underline"
                          >
                            {uploading
                              ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...')
                              : (language === 'ar' ? 'اضغط لرفع الشعار' : 'Click to upload logo')}
                          </Label>
                          <Input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={uploading}
                            className="hidden"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">{language === 'ar' ? 'عنوان العقد' : 'Contract Title'}</Label>
                    <Input
                      id="title"
                      value={selectedTemplate.title}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, title: e.target.value })}
                      placeholder={language === 'ar' ? 'عنوان العقد' : 'Contract Title'}
                    />
                  </div>

                  {/* Arabic Content */}
                  <div className="space-y-2">
                    <Label htmlFor="content-ar">{t.arabicContent}</Label>
                    <Textarea
                      id="content-ar"
                      value={selectedTemplate.content_ar}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, content_ar: e.target.value })}
                      placeholder={t.arabicContent}
                      rows={3}
                      dir="rtl"
                    />
                  </div>

                  {/* English Content */}
                  <div className="space-y-2">
                    <Label htmlFor="content-en">{t.englishContent}</Label>
                    <Textarea
                      id="content-en"
                      value={selectedTemplate.content_en}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, content_en: e.target.value })}
                      placeholder={t.englishContent}
                      rows={3}
                    />
                  </div>

                  {/* Arabic Terms */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t.arabicTerms}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTerm('ar')}
                      >
                        <Plus className="h-4 w-4 me-2" />
                        {t.addTerm}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {selectedTemplate.terms_ar.map((term, index) => (
                        <div key={index} className="flex gap-2">
                          <Textarea
                            value={term}
                            onChange={(e) => updateTerm('ar', index, e.target.value)}
                            placeholder={`${tCommon.term} ${index + 1}`}
                            rows={2}
                            dir="rtl"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTerm('ar', index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* English Terms */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t.englishTerms}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTerm('en')}
                      >
                        <Plus className="h-4 w-4 me-2" />
                        {t.addTerm}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {selectedTemplate.terms_en.map((term, index) => (
                        <div key={index} className="flex gap-2">
                          <Textarea
                            value={term}
                            onChange={(e) => updateTerm('en', index, e.target.value)}
                            placeholder={`Term ${index + 1}`}
                            rows={2}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTerm('en', index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-6 border-t">
                    <Button
                      onClick={handleSave}
                      disabled={saving || selectedTemplate.approval_status === 'approved'}
                      size="lg"
                      className="min-w-[200px]"
                    >
                      <Save className="h-5 w-5 me-2" />
                      {saving ? tCommon.saving : (language === 'ar' ? 'حفظ ورفع للمراجعة' : 'Save & Submit for Review')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {language === 'ar' ? 'اختر عقداً من القائمة أو أنشئ عقداً جديداً' : 'Select a contract or create a new one'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}