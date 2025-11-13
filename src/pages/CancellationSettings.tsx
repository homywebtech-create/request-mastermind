import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Percent } from "lucide-react";
import { AppLoader } from "@/components/ui/app-loader";

interface SubService {
  id: string;
  name: string;
  name_en: string;
  service_id: string;
}

interface Service {
  id: string;
  name: string;
  name_en: string;
  sub_services: SubService[];
}

interface CancellationSetting {
  id: string;
  sub_service_id: string;
  cancellation_percentage: number;
}

export default function CancellationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch services with sub-services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          id,
          name,
          name_en,
          sub_services (
            id,
            name,
            name_en,
            service_id
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (servicesError) throw servicesError;

      // Fetch cancellation settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('cancellation_settings')
        .select('*');

      if (settingsError) throw settingsError;

      // Map settings to sub-service IDs
      const settingsMap: Record<string, number> = {};
      settingsData?.forEach((setting: CancellationSetting) => {
        settingsMap[setting.sub_service_id] = Number(setting.cancellation_percentage);
      });

      // Add default 50% for sub-services without settings
      servicesData?.forEach(service => {
        service.sub_services?.forEach(subService => {
          if (!settingsMap[subService.id]) {
            settingsMap[subService.id] = 50;
          }
        });
      });

      setServices(servicesData || []);
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "فشل في تحميل البيانات" 
          : "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePercentageChange = (subServiceId: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setSettings(prev => ({
        ...prev,
        [subServiceId]: numValue
      }));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Update or insert settings for each sub-service
      const updates = Object.entries(settings).map(([subServiceId, percentage]) => ({
        sub_service_id: subServiceId,
        cancellation_percentage: percentage
      }));

      const { error } = await supabase
        .from('cancellation_settings')
        .upsert(updates, { onConflict: 'sub_service_id' });

      if (error) throw error;

      toast({
        title: language === 'ar' ? "تم الحفظ" : "Saved",
        description: language === 'ar'
          ? "تم حفظ الإعدادات بنجاح"
          : "Settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar'
          ? "فشل في حفظ الإعدادات"
          : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <AppLoader message={language === 'ar' ? "جاري التحميل..." : "Loading..."} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">
              {language === 'ar' ? 'إعدادات الإلغاء' : 'Cancellation Settings'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ar'
                ? 'تحديد نسبة الخصم عند إلغاء الطلب لكل خدمة فرعية'
                : 'Set cancellation deduction percentage for each sub-service'}
            </p>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-6">
          {services.map(service => (
            <Card key={service.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                <CardTitle className="text-xl">
                  {language === 'ar' ? service.name : service.name_en}
                </CardTitle>
                <CardDescription>
                  {language === 'ar'
                    ? `${service.sub_services?.length || 0} خدمة فرعية`
                    : `${service.sub_services?.length || 0} sub-services`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {service.sub_services?.map(subService => (
                    <div
                      key={subService.id}
                      className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors"
                    >
                      <Label
                        htmlFor={`percentage-${subService.id}`}
                        className="text-sm font-semibold mb-2 block"
                      >
                        {language === 'ar' ? subService.name : subService.name_en}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`percentage-${subService.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={settings[subService.id] || 50}
                          onChange={(e) => handlePercentageChange(subService.id, e.target.value)}
                          className="pr-10"
                        />
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === 'ar'
                          ? 'النسبة المئوية المستقطعة عند الإلغاء'
                          : 'Percentage deducted on cancellation'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Save Button */}
        <div className="sticky bottom-4 mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="shadow-lg"
          >
            <Save className="ml-2 h-5 w-5" />
            {isSaving
              ? language === 'ar' ? 'جاري الحفظ...' : 'Saving...'
              : language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
