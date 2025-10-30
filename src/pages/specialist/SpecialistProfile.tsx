import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Phone, Building2, Briefcase, Star, FileText, MapPin, Languages, AlertCircle, Calendar, TestTube, Globe, CheckCircle, XCircle, Clock, DollarSign, Package, BarChart3, Image as ImageIcon } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import BusyGuard from "@/components/specialist/BusyGuard";
import LanguageSelector from "@/components/specialist/LanguageSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/hooks/useLanguage";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";

interface Profile {
  full_name: string;
  phone: string | null;
  company_id: string | null;
}

interface Specialist {
  id: string;
  name: string;
  phone: string;
  specialty: string | null;
  experience_years: number | null;
  rating: number | null;
  reviews_count: number | null;
  face_photo_url: string | null;
  full_body_photo_url: string | null;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
  id_card_expiry_date: string | null;
  countries_worked_in: string[] | null;
  languages_spoken: string[] | null;
  has_pet_allergy: boolean | null;
  has_cleaning_allergy: boolean | null;
  notes: string | null;
  preferred_language: string;
}

interface Company {
  name: string;
}

interface Stats {
  totalOrders: number;
  acceptedOrders: number;
  rejectedOrders: number;
  quotedOrders: number;
  skippedOrders: number;
  newOrders: number;
}

export default function SpecialistProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    acceptedOrders: 0,
    rejectedOrders: 0,
    quotedOrders: 0,
    skippedOrders: 0,
    newOrders: 0
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const t = isAr ? ar.specialist : en.specialist;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!specialist?.id) return;

    fetchStats(specialist.id);

    const channel = supabase
      .channel('specialist-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialist.id}`
        },
        () => {
          fetchStats(specialist.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialist?.id]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone, company_id')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        
        if (profileData.phone) {
          const { data: specialistData } = await supabase
            .from('specialists')
            .select('*')
            .eq('phone', profileData.phone)
            .single();

          if (specialistData) {
            setSpecialist(specialistData);
            fetchNewOrdersCount(specialistData.id);
          }
        }

        if (profileData.company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', profileData.company_id)
            .single();

          if (companyData) {
            setCompany(companyData);
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewOrdersCount = async (specId: string) => {
    try {
      const now = new Date().toISOString();
      
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          id,
          order_id,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specId)
        .is('quoted_price', null)
        .is('rejected_at', null);

      if (!orderSpecialists) {
        setNewOrdersCount(0);
        return;
      }

      const validOrders = orderSpecialists.filter((os: any) => {
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true;
        return new Date(expiresAt) > new Date(now);
      });

      setNewOrdersCount(validOrders.length);
    } catch (error) {
      console.error('Error fetching new orders count:', error);
      setNewOrdersCount(0);
    }
  };

  const fetchStats = async (specId: string) => {
    try {
      const now = new Date().toISOString();

      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          *,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specId);

      if (!orderSpecialists) {
        return;
      }

      const newOrders = orderSpecialists.filter((os: any) => {
        if (os.quoted_price || os.rejected_at) return false;
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true;
        return new Date(expiresAt) > new Date(now);
      }).length;

      const quotedOrders = orderSpecialists.filter(os => 
        os.quoted_price && os.is_accepted === null
      ).length;

      const acceptedOrders = orderSpecialists.filter(os => 
        os.is_accepted === true
      ).length;

      const rejectedOrders = orderSpecialists.filter(os => 
        os.is_accepted === false && 
        os.quoted_price &&
        os.rejection_reason !== 'Skipped by specialist'
      ).length;

      const skippedOrders = orderSpecialists.filter(os => 
        os.is_accepted === false && 
        os.rejection_reason === 'Skipped by specialist'
      ).length;

      setStats({
        totalOrders: orderSpecialists.length,
        newOrders,
        quotedOrders,
        acceptedOrders,
        rejectedOrders,
        skippedOrders
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/specialist-auth');
  };

  const handleLanguageChange = async (newLanguage: string) => {
    if (!specialist) return;
    
    try {
      const { error } = await supabase
        .from('specialists')
        .update({ preferred_language: newLanguage })
        .eq('id', specialist.id);

      if (error) throw error;

      setSpecialist({ ...specialist, preferred_language: newLanguage });
      toast({
        title: t.quoteSubmitted,
        description: isAr ? "تم تحديث لغتك المفضلة بنجاح" : "Your preferred language has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: t.error,
        description: isAr ? "فشل تحديث اللغة" : "Failed to update language",
        variant: "destructive",
      });
    }
  };

  const languageOptions = [
    { value: 'ar', label: 'العربية (Arabic)' },
    { value: 'en', label: 'English' },
    { value: 'tl', label: 'Tagalog (Filipino)' },
    { value: 'hi', label: 'हिन्दी (Hindi)' },
    { value: 'si', label: 'සිංහල (Sinhala)' },
    { value: 'bn', label: 'বাংলা (Bengali)' },
    { value: 'sw', label: 'Kiswahili (Swahili)' },
    { value: 'am', label: 'አማርኛ (Amharic)' },
    { value: 'ti', label: 'ትግርኛ (Tigrinya)' },
    { value: 'fa', label: 'فارسی (Farsi)' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <BusyGuard specialistId={specialist?.id || ''} allowWhenBusy={false}>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{isAr ? "الإعدادات" : "Settings"}</h1>
              <p className="text-sm opacity-90">{t.accountInfo}</p>
            </div>
            {specialist && (
              <LanguageSelector 
                specialistId={specialist.id} 
                currentLanguage={specialist.preferred_language}
                onLanguageChange={(lang) => setSpecialist({ ...specialist, preferred_language: lang })}
              />
            )}
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="max-w-screen-lg mx-auto p-4">
        <Accordion type="single" collapsible className="space-y-4">
          {/* Statistics Section */}
          <AccordionItem value="statistics" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{isAr ? "الإحصائيات" : "Statistics"}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-3 pt-2">
                {[
                  {
                    title: t.newOffers,
                    value: stats.newOrders,
                    icon: Package,
                    bgColor: "bg-blue-50 dark:bg-blue-950/30",
                    textColor: "text-blue-600 dark:text-blue-400"
                  },
                  {
                    title: t.submittedOffers,
                    value: stats.quotedOrders,
                    icon: DollarSign,
                    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
                    textColor: "text-yellow-600 dark:text-yellow-400"
                  },
                  {
                    title: t.acceptedOrders,
                    value: stats.acceptedOrders,
                    icon: CheckCircle,
                    bgColor: "bg-green-50 dark:bg-green-950/30",
                    textColor: "text-green-600 dark:text-green-400"
                  },
                  {
                    title: t.rejectedOffers,
                    value: stats.rejectedOrders,
                    icon: XCircle,
                    bgColor: "bg-red-50 dark:bg-red-950/30",
                    textColor: "text-red-600 dark:text-red-400"
                  },
                  {
                    title: t.skippedOffers,
                    value: stats.skippedOrders,
                    icon: Clock,
                    bgColor: "bg-gray-50 dark:bg-gray-950/30",
                    textColor: "text-gray-600 dark:text-gray-400"
                  }
                ].map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${stat.bgColor}`}>
                          <Icon className={`h-5 w-5 ${stat.textColor}`} />
                        </div>
                        <span className="text-sm font-medium">{stat.title}</span>
                      </div>
                      <span className="text-xl font-bold">{stat.value}</span>
                    </div>
                  );
                })}
                
                {/* Total Summary */}
                <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{t.totalOrders}</p>
                    <p className="text-3xl font-bold text-primary">{stats.totalOrders}</p>
                    <p className="text-xs text-muted-foreground">{t.sinceStart}</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Personal Info Section */}
          <AccordionItem value="personal-info" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{isAr ? "المعلومات الشخصية" : "Personal Info"}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-4 pt-2">
                {/* Name and Rating */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{t.fullName}</p>
                    <p className="text-xl font-bold">{profile?.full_name}</p>
                    {specialist && specialist.rating && (
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{specialist.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({specialist.reviews_count} {t.reviews})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact & Work Info */}
                <div className="grid grid-cols-2 gap-3">
                  {profile?.phone && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <Phone className="h-5 w-5 text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">{t.phoneNumber}</p>
                      <p className="font-medium text-sm">{profile.phone}</p>
                    </div>
                  )}

                  {company && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <Building2 className="h-5 w-5 text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">{t.company}</p>
                      <p className="font-medium text-sm">{company.name}</p>
                    </div>
                  )}

                  {specialist?.specialty && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <Briefcase className="h-5 w-5 text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">{t.specialty}</p>
                      <p className="font-medium text-sm">{specialist.specialty}</p>
                    </div>
                  )}

                  {specialist?.experience_years && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <Calendar className="h-5 w-5 text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">{t.experience}</p>
                      <p className="font-medium text-sm">{specialist.experience_years} {t.years}</p>
                    </div>
                  )}
                </div>

                {/* Additional Details */}
                <div className="space-y-3">
                  {specialist?.countries_worked_in && specialist.countries_worked_in.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4" />
                        {t.countriesWorkedIn}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {specialist.countries_worked_in.map((country, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{country}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {specialist?.languages_spoken && specialist.languages_spoken.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                        <Languages className="h-4 w-4" />
                        {t.languagesSpoken}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {specialist.languages_spoken.map((lang, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {specialist?.id_card_expiry_date && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4" />
                        {t.idCardExpiry}
                      </p>
                      <p className="text-sm font-medium">{new Date(specialist.id_card_expiry_date).toLocaleDateString()}</p>
                    </div>
                  )}

                  {(specialist?.has_pet_allergy || specialist?.has_cleaning_allergy) && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        {t.allergies}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {specialist.has_pet_allergy && (
                          <Badge variant="secondary" className="text-xs">{isAr ? "حساسية حيوانات" : "Pet Allergy"}</Badge>
                        )}
                        {specialist.has_cleaning_allergy && (
                          <Badge variant="secondary" className="text-xs">{isAr ? "حساسية مواد تنظيف" : "Cleaning Products Allergy"}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {specialist?.notes && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        {t.notes}
                      </p>
                      <p className="text-sm">{specialist.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Photos & Documents Section */}
          <AccordionItem value="photos-docs" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{isAr ? "الصور والمستندات" : "Photos & Documents"}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm font-medium mb-2">{t.facePhoto}</p>
                  {specialist?.face_photo_url ? (
                    <img 
                      src={specialist.face_photo_url} 
                      alt={t.facePhoto}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                      {isAr ? "لا توجد صورة" : "No photo"}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">{t.fullBodyPhoto}</p>
                  {specialist?.full_body_photo_url ? (
                    <img 
                      src={specialist.full_body_photo_url} 
                      alt={t.fullBodyPhoto}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                      {isAr ? "لا توجد صورة" : "No photo"}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">{t.frontIdCard}</p>
                  {specialist?.id_card_front_url ? (
                    <img 
                      src={specialist.id_card_front_url} 
                      alt={t.frontIdCard}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                      {isAr ? "لا توجد صورة" : "No photo"}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">{t.backIdCard}</p>
                  {specialist?.id_card_back_url ? (
                    <img 
                      src={specialist.id_card_back_url} 
                      alt={t.backIdCard}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                      {isAr ? "لا توجد صورة" : "No photo"}
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>


          {/* App Version Section */}
          <AccordionItem value="version" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{isAr ? "معلومات الإصدار" : "Version Info"}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{isAr ? "رقم الإصدار" : "Version"}</span>
                      <span className="font-bold text-primary">1.0.0</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{isAr ? "تاريخ التحديث" : "Update Date"}</span>
                      <span className="font-medium">2025-01-30</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{isAr ? "وقت التحديث" : "Update Time"}</span>
                      <span className="font-medium">09:45:00</span>
                    </div>
                  </div>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  {isAr ? "تأكد دائماً من أن لديك أحدث إصدار من التطبيق" : "Always ensure you have the latest version of the app"}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>


          {/* Quick Actions Section */}
          <AccordionItem value="actions" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{isAr ? "روابط سريعة" : "Quick Links"}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/terms')}
                >
                  <FileText className="h-5 w-5" />
                  {isAr ? "الشروط والأحكام" : "Terms & Conditions"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/specialist-portfolio')}
                >
                  <Star className="h-5 w-5" />
                  {isAr ? "معرض الأعمال" : "Portfolio"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/notification-test')}
                >
                  <TestTube className="h-5 w-5" />
                  {isAr ? "اختبار الإشعارات" : "Test Notifications"}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Logout Button */}
        <div className="mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full gap-2"
                size="lg"
              >
                <LogOut className="h-5 w-5" />
                {t.logout}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{isAr ? "تسجيل الخروج" : "Logout"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {isAr ? "هل أنت متأكد من تسجيل الخروج؟" : "Are you sure you want to logout?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>
                  {isAr ? "تسجيل الخروج" : "Logout"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <BottomNavigation newOrdersCount={newOrdersCount} specialistId={specialist?.id} />
      </div>
    </BusyGuard>
  );
}
