import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MapLocationPicker } from '@/components/booking/MapLocationPicker';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Calendar, Users, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Specialist {
  id: string;
  name: string;
  phone: string;
  image_url: string | null;
  nationality: string | null;
  quoted_price: string;
  quoted_at: string;
}

export default function CompanyBooking() {
  const { orderId, companyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [company, setCompany] = useState<Company | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  
  // Form data
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [buildingInfo, setBuildingInfo] = useState('');
  const [bookingType, setBookingType] = useState('');
  const [bookingDateType, setBookingDateType] = useState('');
  const [customDate, setCustomDate] = useState('');

  const totalSteps = 4;

  useEffect(() => {
    fetchData();
  }, [orderId, companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch specialists with their quotes for this order
      const { data: specialistsData, error: specialistsError } = await supabase
        .from('order_specialists')
        .select(`
          quoted_price,
          quoted_at,
          specialists (
            id,
            name,
            phone,
            image_url,
            nationality
          )
        `)
        .eq('order_id', orderId)
        .not('quoted_price', 'is', null)
        .eq('is_accepted', null);

      if (specialistsError) throw specialistsError;

      const formattedSpecialists = specialistsData
        .map((os: any) => ({
          ...os.specialists,
          quoted_price: os.quoted_price,
          quoted_at: os.quoted_at,
        }))
        .filter((s: any) => s.companies?.id === companyId);

      setSpecialists(formattedSpecialists);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحميل البيانات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !location) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى تحديد الموقع على الخريطة',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 1 && !buildingInfo.trim()) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى إدخال معلومات المبنى',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && !bookingType) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى اختيار نوع الحجز',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && !bookingDateType) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى اختيار تاريخ الحجز',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && bookingDateType === 'custom' && !customDate) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى اختيار التاريخ',
        variant: 'destructive',
      });
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    try {
      const bookingDate = bookingDateType === 'today' 
        ? new Date().toISOString().split('T')[0]
        : bookingDateType === 'tomorrow'
        ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
        : customDate;

      const { error } = await supabase
        .from('orders')
        .update({
          gps_latitude: location?.lat,
          gps_longitude: location?.lng,
          building_info: buildingInfo,
          selected_booking_type: bookingType,
          booking_date: bookingDate,
          booking_date_type: bookingDateType,
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ معلومات الحجز بنجاح',
      });

      // Navigate back or to confirmation page
      navigate(-1);
    } catch (error: any) {
      console.error('Error saving booking:', error);
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getLowestPrice = () => {
    if (specialists.length === 0) return null;
    const prices = specialists
      .map((s) => parseFloat(s.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0'))
      .filter((p) => !isNaN(p));
    return Math.min(...prices);
  };

  const lowestPrice = getLowestPrice();

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: 'الموقع', titleEn: 'Location' },
      { number: 2, title: 'نوع الحجز', titleEn: 'Booking Type' },
      { number: 3, title: 'التاريخ', titleEn: 'Date' },
      { number: 4, title: 'الأسعار', titleEn: 'Prices' }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all',
                    currentStep >= step.number
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {currentStep > step.number ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={cn(
                    'text-sm font-medium',
                    currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.titleEn}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2 transition-all',
                    currentStep > step.number ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Company Header */}
        {company && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-4">
                {company.logo_url ? (
                  <img 
                    src={company.logo_url} 
                    alt={company.name}
                    className="w-20 h-20 rounded-lg object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-2xl">{company.name}</CardTitle>
                  <p className="text-muted-foreground mt-1">أكمل معلومات الحجز</p>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Steps */}
        <Card>
          <CardHeader>
            {renderStepIndicator()}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Location */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">حدد موقع الخدمة</h3>
                
                <MapLocationPicker
                  onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
                  initialLat={location?.lat}
                  initialLng={location?.lng}
                />

                <div className="space-y-2">
                  <Label htmlFor="buildingInfo">معلومات المبنى والعنوان *</Label>
                  <Textarea
                    id="buildingInfo"
                    value={buildingInfo}
                    onChange={(e) => setBuildingInfo(e.target.value)}
                    placeholder="مثال: الطابق الثالث، شقة 305، بجانب مدخل المصعد..."
                    rows={4}
                    dir="auto"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Booking Type */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">اختر نوع الحجز</h3>
                
                <RadioGroup value={bookingType} onValueChange={setBookingType}>
                  <div className="space-y-3">
                    {[
                      { value: 'once', label: 'مرة واحدة', labelEn: 'One Time' },
                      { value: 'weekly', label: 'أسبوعي', labelEn: 'Weekly' },
                      { value: 'bi-weekly', label: 'نصف شهري', labelEn: 'Bi-Weekly' },
                      { value: 'monthly', label: 'شهري', labelEn: 'Monthly' }
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          'flex items-center space-x-3 space-x-reverse border-2 rounded-lg p-4 cursor-pointer transition-all',
                          bookingType === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <RadioGroupItem value={option.value} id={option.value} />
                        <div className="flex-1">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {option.labelEn}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Step 3: Booking Date */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">اختر تاريخ الحجز</h3>
                
                <RadioGroup value={bookingDateType} onValueChange={setBookingDateType}>
                  <div className="space-y-3">
                    {[
                      { value: 'today', label: 'اليوم', labelEn: 'Today' },
                      { value: 'tomorrow', label: 'غداً', labelEn: 'Tomorrow' },
                      { value: 'custom', label: 'تاريخ آخر', labelEn: 'Custom Date' }
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          'flex items-center space-x-3 space-x-reverse border-2 rounded-lg p-4 cursor-pointer transition-all',
                          bookingDateType === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <RadioGroupItem value={option.value} id={option.value} />
                        <div className="flex-1 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">{option.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {option.labelEn}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>

                {bookingDateType === 'custom' && (
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="customDate">اختر التاريخ</Label>
                    <Input
                      type="date"
                      id="customDate"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Specialists & Prices */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  العاملات والأسعار المتاحة
                </h3>

                <div className="space-y-4">
                  {specialists
                    .sort((a, b) => {
                      const priceA = parseFloat(a.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                      const priceB = parseFloat(b.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                      return priceA - priceB;
                    })
                    .map((specialist) => {
                      const price = parseFloat(specialist.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                      const isLowest = price === lowestPrice;

                      return (
                        <div
                          key={specialist.id}
                          className={cn(
                            'border-2 rounded-lg p-4 transition-all',
                            isLowest 
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                              : 'border-border'
                          )}
                        >
                          <div className="flex gap-4">
                            {specialist.image_url ? (
                              <img 
                                src={specialist.image_url} 
                                alt={specialist.name}
                                className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                              />
                            ) : (
                              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                                <Users className="h-12 w-12 text-muted-foreground" />
                              </div>
                            )}

                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold text-lg">{specialist.name}</h4>
                                  {specialist.nationality && (
                                    <p className="text-sm text-muted-foreground">
                                      {specialist.nationality}
                                    </p>
                                  )}
                                </div>
                                <div className="text-left">
                                  <Badge 
                                    className={cn(
                                      'text-lg px-3 py-1',
                                      isLowest && 'bg-green-600 hover:bg-green-700'
                                    )}
                                  >
                                    {specialist.quoted_price}
                                  </Badge>
                                  {isLowest && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                      أقل سعر ⭐
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="text-sm text-muted-foreground" dir="ltr">
                                📞 {specialist.phone}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {specialists.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>لا توجد عروض أسعار متاحة حالياً</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6 border-t">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  السابق
                </Button>
              )}

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  حفظ معلومات الحجز
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
