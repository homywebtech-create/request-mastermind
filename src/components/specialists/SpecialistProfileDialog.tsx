import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Star, Award, Calendar, Phone, MapPin, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SpecialistProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialist: {
    id: string;
    name: string;
    phone: string;
    nationality?: string;
    image_url?: string;
    experience_years?: number;
    rating?: number;
    reviews_count?: number;
    notes?: string;
    specialty?: string;
  };
  language?: 'ar' | 'en';
}

interface Specialty {
  name: string;
  name_en?: string;
}

export function SpecialistProfileDialog({
  open,
  onOpenChange,
  specialist,
  language = 'ar'
}: SpecialistProfileDialogProps) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && specialist.id) {
      fetchSpecialties();
    }
  }, [open, specialist.id]);

  const fetchSpecialties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specialist_specialties')
        .select(`
          sub_service_id,
          sub_services (
            name,
            name_en
          )
        `)
        .eq('specialist_id', specialist.id);

      if (error) throw error;

      const specialtiesData = data?.map((item: any) => ({
        name: item.sub_services?.name || '',
        name_en: item.sub_services?.name_en || ''
      })) || [];

      setSpecialties(specialtiesData);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    } finally {
      setLoading(false);
    }
  };

  const t = {
    ar: {
      profile: 'السيرة الذاتية',
      personalInfo: 'المعلومات الشخصية',
      name: 'الاسم',
      phone: 'رقم الهاتف',
      nationality: 'الجنسية',
      experience: 'سنوات الخبرة',
      years: 'سنوات',
      year: 'سنة',
      specialties: 'التخصصات',
      rating: 'التقييم',
      reviews: 'تقييمات',
      notes: 'ملاحظات',
      noSpecialties: 'لا توجد تخصصات',
      noNotes: 'لا توجد ملاحظات'
    },
    en: {
      profile: 'CV',
      personalInfo: 'Personal Information',
      name: 'Name',
      phone: 'Phone',
      nationality: 'Nationality',
      experience: 'Years of Experience',
      years: 'years',
      year: 'year',
      specialties: 'Specialties',
      rating: 'Rating',
      reviews: 'reviews',
      notes: 'Notes',
      noSpecialties: 'No specialties',
      noNotes: 'No notes'
    }
  };

  const translations = t[language];

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        );
      } else {
        stars.push(
          <Star key={i} className="h-4 w-4 text-gray-300" />
        );
      }
    }
    return stars;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {translations.profile}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Profile Header with Image */}
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {specialist.image_url ? (
              <img
                src={specialist.image_url}
                alt={specialist.name}
                className="w-32 h-32 rounded-xl object-cover border-4 border-primary/20 shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border-4 border-border">
                <Users className="h-16 w-16 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 text-center md:text-start">
              <h3 className="text-2xl font-bold mb-2">{specialist.name}</h3>
              
              {/* Rating */}
              {specialist.rating !== undefined && (
                <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                  <div className="flex items-center">
                    {renderStars(specialist.rating)}
                  </div>
                  <span className="text-lg font-semibold">
                    {specialist.rating?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({specialist.reviews_count || 0} {translations.reviews})
                  </span>
                </div>
              )}

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {specialist.nationality && (
                  <Badge variant="secondary" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {specialist.nationality}
                  </Badge>
                )}
                {specialist.experience_years && (
                  <Badge variant="secondary" className="gap-1">
                    <Award className="h-3 w-3" />
                    {specialist.experience_years} {specialist.experience_years > 1 ? translations.years : translations.year}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {translations.personalInfo}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{translations.name}</p>
                <p className="font-medium">{specialist.name}</p>
              </div>

              {specialist.nationality && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{translations.nationality}</p>
                  <p className="font-medium">{specialist.nationality}</p>
                </div>
              )}

              {specialist.experience_years && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{translations.experience}</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {specialist.experience_years} {specialist.experience_years > 1 ? translations.years : translations.year}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Specialties */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5" />
              {translations.specialties}
            </h4>

            {loading ? (
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : specialties.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {specialties.map((specialty, index) => (
                  <Badge key={index} variant="outline" className="text-sm px-3 py-1">
                    {language === 'ar' ? specialty.name : (specialty.name_en || specialty.name)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{translations.noSpecialties}</p>
            )}
          </div>

          {/* Notes */}
          {specialist.notes && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {translations.notes}
                </h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg whitespace-pre-wrap">
                  {specialist.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
