import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Phone, Building2, Briefcase, Star, FileText, MapPin, Languages, AlertCircle, Calendar } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useLanguage } from "@/hooks/useLanguage";

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
}

interface Company {
  name: string;
}

export default function SpecialistProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  useEffect(() => {
    checkAuth();
  }, []);

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
      const { count } = await supabase
        .from('order_specialists')
        .select('*', { count: 'exact', head: true })
        .eq('specialist_id', specId)
        .is('quoted_price', null)
        .is('rejected_at', null);

      setNewOrdersCount(count || 0);
    } catch (error) {
      console.error('Error fetching new orders count:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/specialist-auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <h1 className="text-2xl font-bold mb-1">الحساب والإعدادات</h1>
          <p className="text-sm opacity-90">معلومات حسابك الشخصي</p>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* User Info Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 h-24" />
          <div className="p-6 -mt-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-20 w-20 rounded-full bg-background border-4 border-background shadow-lg flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{profile?.full_name}</h2>
                {specialist && specialist.rating && (
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{specialist.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({specialist.reviews_count} تقييم)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {profile?.phone && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">رقم الهاتف</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                </div>
              )}

              {company && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">الشركة</p>
                    <p className="font-medium">{company.name}</p>
                  </div>
                </div>
              )}

              {specialist?.specialty && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">التخصص</p>
                    <p className="font-medium">{specialist.specialty}</p>
                  </div>
                </div>
              )}

              {specialist?.experience_years && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Star className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">سنوات الخبرة</p>
                    <p className="font-medium">{specialist.experience_years} سنوات</p>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Details */}
            <div className="mt-6 space-y-4">
              {specialist?.countries_worked_in && specialist.countries_worked_in.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    الدول التي عملت فيها
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {specialist.countries_worked_in.map((country, idx) => (
                      <Badge key={idx} variant="outline">{country}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {specialist?.languages_spoken && specialist.languages_spoken.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    اللغات المتحدث بها
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {specialist.languages_spoken.map((lang, idx) => (
                      <Badge key={idx} variant="outline">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {specialist?.id_card_expiry_date && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    تاريخ انتهاء البطاقة
                  </p>
                  <p className="font-medium">{new Date(specialist.id_card_expiry_date).toLocaleDateString('ar-SA')}</p>
                </div>
              )}

              {(specialist?.has_pet_allergy || specialist?.has_cleaning_allergy) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    الحساسية
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {specialist.has_pet_allergy && (
                      <Badge variant="secondary">حساسية من الحيوانات</Badge>
                    )}
                    {specialist.has_cleaning_allergy && (
                      <Badge variant="secondary">حساسية من مواد التنظيف</Badge>
                    )}
                  </div>
                </div>
              )}

              {specialist?.notes && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ملاحظات
                  </p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                    {specialist.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Photos Section */}
        {(specialist?.face_photo_url || specialist?.full_body_photo_url || specialist?.id_card_front_url || specialist?.id_card_back_url) && (
          <Card className="p-4">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              الصور والوثائق
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {specialist.face_photo_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">صورة الوجه</p>
                  <img 
                    src={specialist.face_photo_url} 
                    alt="Face" 
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                </div>
              )}
              {specialist.full_body_photo_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">صورة كاملة</p>
                  <img 
                    src={specialist.full_body_photo_url} 
                    alt="Full body" 
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                </div>
              )}
              {specialist.id_card_front_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">البطاقة الأمامية</p>
                  <img 
                    src={specialist.id_card_front_url} 
                    alt="ID front" 
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                </div>
              )}
              {specialist.id_card_back_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">البطاقة الخلفية</p>
                  <img 
                    src={specialist.id_card_back_url} 
                    alt="ID back" 
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="p-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            روابط مهمة
          </h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => toast({ title: "قريباً", description: "هذه الميزة قيد التطوير" })}
            >
              <FileText className="h-4 w-4 ml-2" />
              القوانين والشروط
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => toast({ title: "قريباً", description: "هذه الميزة قيد التطوير" })}
            >
              <Building2 className="h-4 w-4 ml-2" />
              المحفظة
            </Button>
          </div>
        </Card>

        {/* Logout Button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full h-14 text-base font-bold"
            >
              <LogOut className="h-5 w-5 ml-2" />
              تسجيل الخروج
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                هل تريد تسجيل الخروج من حسابك؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>
                تسجيل الخروج
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <BottomNavigation newOrdersCount={newOrdersCount} />
    </div>
  );
}
