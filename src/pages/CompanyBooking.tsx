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
import { Building2, Calendar, Users, ArrowRight, ArrowLeft, Check, Languages, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReviewsDialog } from '@/components/booking/ReviewsDialog';

// Translations
const translations = {
  ar: {
    completeBooking: 'أكمل معلومات الحجز',
    location: 'الموقع',
    bookingType: 'نوع الحجز',
    date: 'التاريخ',
    prices: 'الأسعار',
    selectLocation: 'حدد موقع الخدمة',
    buildingInfo: 'معلومات المبنى والعنوان *',
    buildingPlaceholder: 'مثال: الطابق الثالث، شقة 305، بجانب مدخل المصعد...',
    selectBookingType: 'اختر نوع الحجز',
    oneTime: 'مرة واحدة',
    weekly: 'أسبوعي',
    biWeekly: 'نصف شهري',
    monthly: 'شهري',
    selectDate: 'اختر تاريخ الحجز',
    today: 'اليوم',
    tomorrow: 'غداً',
    customDate: 'تاريخ آخر',
    chooseDate: 'اختر التاريخ',
    selectTime: 'اختر الوقت المتاح',
    selectTimeError: 'يرجى اختيار الوقت',
    specialistsAndPrices: 'العاملات والأسعار المتاحة',
    lowestPrice: 'أقل سعر',
    noSpecialists: 'لا يوجد محترفون متاحون حالياً',
    previous: 'السابق',
    next: 'التالي',
    submit: 'تأكيد الحجز',
    missingData: 'بيانات ناقصة',
    selectLocationError: 'يرجى تحديد الموقع على الخريطة',
    enterBuildingInfo: 'يرجى إدخال معلومات المبنى',
    selectBookingTypeError: 'يرجى اختيار نوع الحجز',
    selectDateError: 'يرجى اختيار تاريخ الحجز',
    selectCustomDateError: 'يرجى اختيار التاريخ',
    saved: 'تم الحفظ',
    bookingSaved: 'تم حفظ معلومات الحجز بنجاح',
    error: 'خطأ',
    loadError: 'حدث خطأ في تحميل البيانات',
  },
  en: {
    completeBooking: 'Complete Booking Information',
    location: 'Location',
    bookingType: 'Booking Type',
    date: 'Date',
    prices: 'Prices',
    selectLocation: 'Select Service Location',
    buildingInfo: 'Building and Address Information *',
    buildingPlaceholder: 'Example: 3rd floor, Apartment 305, next to elevator entrance...',
    selectBookingType: 'Choose Booking Type',
    oneTime: 'One Time',
    weekly: 'Weekly',
    biWeekly: 'Bi-Weekly',
    monthly: 'Monthly',
    selectDate: 'Select Booking Date',
    today: 'Today',
    tomorrow: 'Tomorrow',
    customDate: 'Custom Date',
    chooseDate: 'Choose Date',
    selectTime: 'Select Available Time',
    selectTimeError: 'Please select time',
    specialistsAndPrices: 'Available Specialists & Prices',
    lowestPrice: 'Lowest Price',
    noSpecialists: 'No specialists available at the moment',
    previous: 'Previous',
    next: 'Next',
    submit: 'Confirm Booking',
    missingData: 'Missing Data',
    selectLocationError: 'Please select location on the map',
    enterBuildingInfo: 'Please enter building information',
    selectBookingTypeError: 'Please select booking type',
    selectDateError: 'Please select booking date',
    selectCustomDateError: 'Please select date',
    saved: 'Saved',
    bookingSaved: 'Booking information saved successfully',
    error: 'Error',
    loadError: 'An error occurred while loading data',
  }
};

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
}

interface Specialist {
  id: string;
  name: string;
  phone: string;
  image_url: string | null;
  nationality: string | null;
  quoted_price: string;
  quoted_at: string;
  rating?: number;
  reviews_count?: number;
}

interface SpecialistReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customers: {
    name: string;
  };
}

export default function CompanyBooking() {
  const { orderId, companyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [company, setCompany] = useState<Company | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [hoursCount, setHoursCount] = useState<number>(1);
  
  // Form data
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [buildingInfo, setBuildingInfo] = useState('');
  const [bookingType, setBookingType] = useState('');
  const [bookingDateType, setBookingDateType] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [showReviews, setShowReviews] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpecialistReview[]>([]);

  const totalSteps = 3;
  const t = translations[language];

  // Generate available time slots from 8:00 AM to 4:00 PM
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 16; hour++) {
      // First half hour slot
      const startTime1 = `${hour.toString().padStart(2, '0')}:00`;
      const endTime1 = `${hour.toString().padStart(2, '0')}:30`;
      slots.push(`${startTime1}-${endTime1}`);
      
      // Second half hour slot
      const startTime2 = `${hour.toString().padStart(2, '0')}:30`;
      const endTime2 = `${(hour + 1).toString().padStart(2, '0')}:00`;
      slots.push(`${startTime2}-${endTime2}`);
    }
    return slots;
  };

  // Generate available dates for the next 15 days
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const timeSlots = generateTimeSlots();
  const availableDates = generateAvailableDates();

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((compareDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return language === 'ar' ? 'اليوم' : 'Today';
    if (diffDays === 1) return language === 'ar' ? 'غداً' : 'Tomorrow';
    
    const dayName = language === 'ar' 
      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()]
      : date.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dateStr = date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return `${dayName} ${dateStr}`;
  };

  useEffect(() => {
    fetchData();
  }, [orderId, companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch order info to get hours_count
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('hours_count')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      
      // Parse hours_count (it's stored as text in DB)
      const hours = orderData?.hours_count ? parseInt(orderData.hours_count) : 1;
      setHoursCount(hours);

      // Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url, phone')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      console.log('🔍 Fetching specialists for order:', orderId, 'company:', companyId);

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
            nationality,
            company_id,
            rating,
            reviews_count
          )
        `)
        .eq('order_id', orderId)
        .not('quoted_price', 'is', null)
        .is('is_accepted', null);

      if (specialistsError) {
        console.error('❌ Error fetching specialists:', specialistsError);
        throw specialistsError;
      }

      console.log('📊 Raw specialists data:', specialistsData);
      console.log('📊 Total specialists with quotes:', specialistsData?.length || 0);

      const formattedSpecialists = specialistsData
        .map((os: any) => ({
          ...os.specialists,
          quoted_price: os.quoted_price,
          quoted_at: os.quoted_at,
        }))
        .filter((s: any) => s.company_id === companyId);

      console.log('✅ Filtered specialists for this company:', formattedSpecialists.length);
      console.log('👥 Specialists:', formattedSpecialists);

      setSpecialists(formattedSpecialists);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: t.error,
        description: t.loadError,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !location) {
      toast({
        title: t.missingData,
        description: t.selectLocationError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 1 && !buildingInfo.trim()) {
      toast({
        title: t.missingData,
        description: t.enterBuildingInfo,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && !bookingType) {
      toast({
        title: t.missingData,
        description: t.selectBookingTypeError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && !bookingDateType) {
      toast({
        title: t.missingData,
        description: t.selectDateError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && bookingDateType === 'custom' && !customDate) {
      toast({
        title: t.missingData,
        description: t.selectCustomDateError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && !selectedSpecialistId) {
      toast({
        title: t.missingData,
        description: language === 'ar' ? 'يرجى اختيار المحترفة' : 'Please select a specialist',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && !selectedTime) {
      toast({
        title: t.missingData,
        description: t.selectTimeError,
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
      if (!selectedSpecialistId) {
        toast({
          title: t.missingData,
          description: 'الرجاء اختيار محترفة',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedTime) {
        toast({
          title: t.missingData,
          description: t.selectTimeError,
          variant: 'destructive',
        });
        return;
      }

      if (!bookingDateType) {
        toast({
          title: t.missingData,
          description: t.selectDateError,
          variant: 'destructive',
        });
        return;
      }

      const bookingDate = bookingDateType; // This is already in ISO format (YYYY-MM-DD)

      // Update order details
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          gps_latitude: location?.lat,
          gps_longitude: location?.lng,
          building_info: buildingInfo,
          selected_booking_type: bookingType,
          booking_date: bookingDate,
          booking_date_type: 'custom', // Fixed: use 'custom' instead of the actual date
          booking_time: selectedTime, // Save the selected time slot
          status: 'in-progress',
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Accept the selected specialist
      const { error: acceptError } = await supabase
        .from('order_specialists')
        .update({ 
          is_accepted: true,
        })
        .eq('order_id', orderId)
        .eq('specialist_id', selectedSpecialistId);

      if (acceptError) throw acceptError;

      // Get company data for WhatsApp
      const { data: orderData } = await supabase
        .from('orders')
        .select('customers(whatsapp_number)')
        .eq('id', orderId)
        .single();

      const selectedSpec = specialists.find(s => s.id === selectedSpecialistId);
      
      // Prepare WhatsApp message
      const totalPrice = calculateTotalPrice(selectedSpec);
      const message = encodeURIComponent(
        `تم تأكيد الحجز ✅\n\n` +
        `المحترفة: ${selectedSpec?.name}\n` +
        `التاريخ: ${bookingDate}\n` +
        `الوقت: ${selectedTime}\n` +
        `نوع الحجز: ${bookingType}\n` +
        `السعر الإجمالي: ${totalPrice} (${hoursCount} ${hoursCount === 1 ? 'ساعة' : 'ساعات'})\n\n` +
        `سيتم التواصل معك قريباً لتأكيد التفاصيل.`
      );

      // Redirect to WhatsApp
      if (company?.phone) {
        window.open(`https://wa.me/${company.phone}?text=${message}`, '_blank');
      }

      toast({
        title: t.saved,
        description: 'تم تأكيد الحجز بنجاح',
      });

      // Navigate back after a short delay
      setTimeout(() => navigate(-1), 2000);
    } catch (error: any) {
      console.error('Error saving booking:', error);
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getLowestPrice = () => {
    if (specialists.length === 0) return null;
    const prices = specialists
      .map((s) => {
        const pricePerHour = parseFloat(s.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
        return pricePerHour * hoursCount;
      })
      .filter((p) => !isNaN(p));
    return Math.min(...prices);
  };

  const lowestPrice = getLowestPrice();

  // Calculate total price for a specialist
  const calculateTotalPrice = (specialist: Specialist) => {
    const pricePerHour = parseFloat(specialist.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
    const total = pricePerHour * hoursCount;
    // Extract currency from original price string
    const currency = specialist.quoted_price?.replace(/[\d.,]/g, '').trim() || '';
    return `${total} ${currency}`;
  };

  // Fetch reviews for a specialist
  const fetchReviews = async (specialistId: string) => {
    try {
      const { data, error } = await supabase
        .from('specialist_reviews')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          customers (
            name
          )
        `)
        .eq('specialist_id', specialistId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
      setShowReviews(specialistId);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    }
  };

  // Render star rating
  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <span key={i} className={`text-yellow-500 ${sizeClass} inline-block`}>★</span>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <span key={i} className={`text-yellow-500 ${sizeClass} inline-block`}>⯨</span>
        );
      } else {
        stars.push(
          <span key={i} className={`text-gray-300 ${sizeClass} inline-block`}>★</span>
        );
      }
    }
    return stars;
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: t.location },
      { number: 2, title: t.bookingType },
      { number: 3, title: language === 'ar' ? 'التاريخ والمحترفة' : 'Date & Specialist' }
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
    <div className="min-h-screen bg-white dark:bg-background py-8 px-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="container mx-auto max-w-4xl">
        {/* Language Toggle */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="gap-2"
          >
            <Languages className="h-4 w-4" />
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>

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
                  <p className="text-muted-foreground mt-1">{t.completeBooking}</p>
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
                <h3 className="text-lg font-semibold">{t.selectLocation}</h3>
                
                <MapLocationPicker
                  onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
                  initialLat={location?.lat}
                  initialLng={location?.lng}
                  language={language}
                />

                <div className="space-y-2">
                  <Label htmlFor="buildingInfo">{t.buildingInfo}</Label>
                  <Textarea
                    id="buildingInfo"
                    value={buildingInfo}
                    onChange={(e) => setBuildingInfo(e.target.value)}
                    placeholder={t.buildingPlaceholder}
                    rows={4}
                    dir="auto"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Booking Type */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">{t.selectBookingType}</h3>
                
                <RadioGroup value={bookingType} onValueChange={setBookingType}>
                  <div className="space-y-3">
                    {[
                      { value: 'once', label: t.oneTime },
                      { value: 'weekly', label: t.weekly },
                      { value: 'bi-weekly', label: t.biWeekly },
                      { value: 'monthly', label: t.monthly }
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
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Step 3: Date Selection & Specialists */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Date Selection Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {language === 'ar' ? 'اختر التاريخ المناسب' : 'Choose Date'}
                  </h3>
                  
                  <RadioGroup value={bookingDateType} onValueChange={(value) => {
                    setBookingDateType(value);
                    setSelectedSpecialistId(null);
                    setSelectedTime('');
                  }}>
                    <div className="relative">
                      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted/50 [&::-webkit-scrollbar-thumb]:bg-primary/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary">
                        {availableDates.map((date) => {
                          const dateValue = date.toISOString().split('T')[0];
                          const isSelected = bookingDateType === dateValue;
                          const isToday = date.toDateString() === new Date().toDateString();
                          
                          return (
                            <label
                              key={dateValue}
                              className={cn(
                                'flex flex-col items-center justify-center border-2 rounded-lg p-3 cursor-pointer transition-all flex-shrink-0 w-24 snap-start',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105'
                                  : isToday
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20 hover:border-green-600'
                                  : 'border-border hover:border-primary/50 hover:shadow-md'
                              )}
                            >
                              <RadioGroupItem value={dateValue} id={dateValue} className="sr-only" />
                              <div className="text-center">
                                <div className={cn(
                                  "text-xs font-medium mb-1",
                                  isSelected ? "text-primary-foreground" : "text-muted-foreground"
                                )}>
                                  {formatDateDisplay(date)}
                                </div>
                                <div className={cn(
                                  "text-lg font-bold",
                                  isSelected && "text-primary-foreground"
                                )}>
                                  {date.getDate()}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="text-center mt-2 text-xs text-muted-foreground">
                        {language === 'ar' ? '← اسحب لرؤية المزيد من التواريخ →' : '← Scroll for more dates →'}
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Show Specialists after date selection */}
                {bookingDateType && (
                  <div className="space-y-4 pt-6 border-t-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {language === 'ar' ? 'اختر المحترفة والوقت المناسب' : 'Choose Specialist & Time'}
                    </h3>

                    {specialists.length > 0 ? (
                      <div className="space-y-4">
                        {specialists
                          .sort((a, b) => {
                            const priceA = parseFloat(a.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0') * hoursCount;
                            const priceB = parseFloat(b.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0') * hoursCount;
                            return priceA - priceB;
                          })
                          .map((specialist) => {
                            const pricePerHour = parseFloat(specialist.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                            const totalPrice = pricePerHour * hoursCount;
                            const isLowest = totalPrice === lowestPrice;
                            const isSelected = selectedSpecialistId === specialist.id;

                            return (
                              <div
                                key={specialist.id}
                                className={cn(
                                  'border-2 rounded-xl overflow-hidden transition-all',
                                  isSelected
                                    ? 'border-primary shadow-lg'
                                    : isLowest 
                                    ? 'border-green-500 shadow-md' 
                                    : 'border-border hover:shadow-md'
                                )}
                              >
                                {/* Specialist Info Header */}
                                <div 
                                  className={cn(
                                    'flex gap-4 p-4 cursor-pointer transition-colors',
                                    isSelected && 'bg-primary/5',
                                    isLowest && !isSelected && 'bg-green-50 dark:bg-green-950/20'
                                  )}
                                  onClick={() => setSelectedSpecialistId(specialist.id)}
                                >
                                  {specialist.image_url ? (
                                    <img 
                                      src={specialist.image_url} 
                                      alt={specialist.name}
                                      className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover border-2 border-border flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-muted flex items-center justify-center border-2 border-border flex-shrink-0">
                                      <Users className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-base md:text-lg flex items-center gap-2 flex-wrap">
                                          <span className="truncate">{specialist.name}</span>
                                          {isSelected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
                                        </h4>
                                        {specialist.nationality && (
                                          <p className="text-sm text-muted-foreground truncate">
                                            {specialist.nationality}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <Badge 
                                          className={cn(
                                            'text-base md:text-lg px-3 py-1 font-bold',
                                            isLowest && 'bg-green-600 hover:bg-green-700'
                                          )}
                                        >
                                          {calculateTotalPrice(specialist)}
                                        </Badge>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {hoursCount} {language === 'ar' ? 'ساعات' : 'hours'}
                                        </p>
                                        {isLowest && (
                                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-bold">
                                            {t.lowestPrice} ⭐
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 mb-3">
                                      {/* Nationality */}
                                      {specialist.nationality && (
                                        <p className="text-sm text-muted-foreground">
                                          {specialist.nationality}
                                        </p>
                                      )}
                                      
                                      {/* Rating Display */}
                                      <div 
                                        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity bg-muted/50 px-2 py-1 rounded-md"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchReviews(specialist.id);
                                        }}
                                      >
                                        <div className="flex items-center">
                                          {renderStars(specialist.rating || 0)}
                                        </div>
                                        <span className="text-sm font-semibold text-foreground">
                                          {specialist.rating?.toFixed(1) || '0.0'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          ({specialist.reviews_count || 0})
                                        </span>
                                      </div>
                                    </div>

                                    {/* Available Times Preview - Show only when NOT selected */}
                                    {!isSelected && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                          <Clock className="h-4 w-4" />
                                          <span>
                                            {language === 'ar' ? 'الأوقات المتاحة' : 'Available Times'}
                                          </span>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                          {timeSlots.slice(0, 4).map((slot) => (
                                            <div
                                              key={slot}
                                              className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium animate-fade-in"
                                            >
                                              {slot}
                                            </div>
                                          ))}
                                          <div className="px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                            +{timeSlots.length - 4} {language === 'ar' ? 'المزيد' : 'more'}
                                          </div>
                                        </div>
                                        <p className="text-xs text-primary font-medium animate-pulse">
                                          {language === 'ar' ? '👆 اضغط للمزيد من الأوقات' : '👆 Click for more times'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Available Times - Show only for selected specialist */}
                                {isSelected && (
                                  <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-t-2 border-primary/20">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                                      <Clock className="h-4 w-4" />
                                      {t.selectTime}
                                    </h4>
                                    <RadioGroup value={selectedTime} onValueChange={setSelectedTime}>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {timeSlots.map((slot) => (
                                          <label
                                            key={slot}
                                            className={cn(
                                              'flex items-center justify-center border-2 rounded-lg p-2.5 cursor-pointer transition-all',
                                              selectedTime === slot
                                                ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                                                : 'border-border bg-background hover:border-primary/50 hover:shadow-sm'
                                            )}
                                          >
                                            <RadioGroupItem value={slot} id={slot} className="sr-only" />
                                            <div className="flex items-center gap-1.5">
                                              <Clock className="h-4 w-4" />
                                              <span className="font-semibold text-xs">{slot}</span>
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                    </RadioGroup>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">{t.noSpecialists}</p>
                      </div>
                    )}
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
                  {language === 'ar' ? (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      {t.previous}
                    </>
                  ) : (
                    <>
                      {t.previous}
                      <ArrowLeft className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {language === 'ar' ? (
                    <>
                      {t.next}
                      <ArrowLeft className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      {t.next}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!bookingDateType || !selectedSpecialistId || !selectedTime}
                  className="flex-1 flex items-center justify-center gap-2 text-base h-12"
                >
                  <Check className="h-5 w-5" />
                  <span className="flex items-center gap-2">
                    <span>{t.submit}</span>
                    {selectedSpecialistId && specialists.find(s => s.id === selectedSpecialistId) && (
                      <span className="font-bold flex items-center gap-1">
                        <span>-</span>
                        <span>{calculateTotalPrice(specialists.find(s => s.id === selectedSpecialistId)!)}</span>
                        <span className="text-sm opacity-80">
                          ({hoursCount} {language === 'ar' ? (hoursCount === 1 ? 'ساعة' : 'ساعات') : (hoursCount === 1 ? 'hour' : 'hours')})
                        </span>
                      </span>
                    )}
                  </span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reviews Dialog */}
        {showReviews && (
          <ReviewsDialog
            open={!!showReviews}
            onOpenChange={(open) => !open && setShowReviews(null)}
            reviews={reviews}
            specialistName={specialists.find(s => s.id === showReviews)?.name || ''}
            language={language}
          />
        )}
      </div>
    </div>
  );
}
