import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { translations } from '@/i18n';

interface ContractTemplate {
  id: string;
  title: string;
  content_ar: string;
  content_en: string;
  terms_ar: string[];
  terms_en: string[];
  is_active: boolean;
}

export default function ContractManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  
  const t = translations[language].contracts;
  const tCommon = translations[language].common;

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setTemplate(data);
      }
    } catch (error: any) {
      console.error('Error fetching template:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('contract_templates')
        .update({
          title: template.title,
          content_ar: template.content_ar,
          content_en: template.content_en,
          terms_ar: template.terms_ar,
          terms_en: template.terms_en,
          is_active: template.is_active,
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: tCommon.success,
        description: t.changesSaved,
      });
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

  const addTerm = (lang: 'ar' | 'en') => {
    if (!template) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    setTemplate({
      ...template,
      [key]: [...template[key], ''],
    });
  };

  const removeTerm = (lang: 'ar' | 'en', index: number) => {
    if (!template) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    const newTerms = [...template[key]];
    newTerms.splice(index, 1);
    setTemplate({
      ...template,
      [key]: newTerms,
    });
  };

  const updateTerm = (lang: 'ar' | 'en', index: number, value: string) => {
    if (!template) return;
    
    const key = lang === 'ar' ? 'terms_ar' : 'terms_en';
    const newTerms = [...template[key]];
    newTerms[index] = value;
    setTemplate({
      ...template,
      [key]: newTerms,
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">جاري التحميل...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">لم يتم العثور على قالب</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {t.title}
              </h1>
              <p className="text-muted-foreground mt-1">{t.subtitle}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <Card className="shadow-xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t.contractTitle}</span>
              <div className="flex items-center gap-2">
                <Label htmlFor="is-active">{t.isActive}</Label>
                <Switch
                  id="is-active"
                  checked={template.is_active}
                  onCheckedChange={(checked) =>
                    setTemplate({ ...template, is_active: checked })
                  }
                />
              </div>
            </CardTitle>
            <CardDescription>{t.templateInfo}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t.contractTitle}</Label>
              <Input
                id="title"
                value={template.title}
                onChange={(e) =>
                  setTemplate({ ...template, title: e.target.value })
                }
                placeholder={t.contractTitle}
              />
            </div>

            {/* Arabic Content */}
            <div className="space-y-2">
              <Label htmlFor="content-ar">{t.arabicContent}</Label>
              <Textarea
                id="content-ar"
                value={template.content_ar}
                onChange={(e) =>
                  setTemplate({ ...template, content_ar: e.target.value })
                }
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
                value={template.content_en}
                onChange={(e) =>
                  setTemplate({ ...template, content_en: e.target.value })
                }
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
                {template.terms_ar.map((term, index) => (
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
                {template.terms_en.map((term, index) => (
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
                disabled={saving}
                size="lg"
                className="min-w-[200px]"
              >
                <Save className="h-5 w-5 me-2" />
                {saving ? tCommon.saving : t.saveChanges}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}