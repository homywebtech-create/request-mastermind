import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapLocationPicker } from '@/components/booking/MapLocationPicker';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Calendar, Users, ArrowRight, ArrowLeft, Check, Languages, Clock, FileUser, FileText, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReviewsDialog } from '@/components/booking/ReviewsDialog';
import { SpecialistProfileDialog } from '@/components/specialists/SpecialistProfileDialog';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useLanguage } from '@/hooks/useLanguage';
import { TermsAndConditions } from '@/components/booking/TermsAndConditions';
import { MonthlyContract } from '@/components/booking/MonthlyContract';
import { openWhatsApp } from '@/lib/externalLinks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Translations
const translations = {
  ar: {
    completeBooking: 'أكمل معلومات الحجز',
    location: 'الموقع',
    bookingType: 'نوع الحجز',
    contractDuration: 'مدة العقد',
    date: 'التاريخ',
    prices: 'الأسعار',
    selectLocation: 'حدد موقع الخدمة',
    buildingInfo: 'معلومات المبنى والعنوان *',
    buildingPlaceholder: 'مثال: الطابق الثالث، شقة 305، بجانب مدخل المصعد...',
    selectBookingType: 'اختر نوع الحجز',
    selectContractDuration: 'اختر مدة العقد',
    oneMonth: 'شهر واحد',
    twoMonths: 'شهرين',
    threeMonths: '3 أشهر',
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
    selectContractDurationError: 'يرجى اختيار مدة العقد',
    selectDateError: 'يرجى اختيار تاريخ الحجز',
    selectCustomDateError: 'يرجى اختيار التاريخ',
    selectSpecialistError: 'يرجى اختيار محترفة واحدة على الأقل',
    saved: 'تم الحفظ',
    bookingSaved: 'تم حفظ معلومات الحجز بنجاح',
    error: 'خطأ',
    loadError: 'حدث خطأ في تحميل البيانات',
    bookedUntil: 'محجوزة حتى',
    available: 'متاحة',
    selectedCount: 'تم اختيار',
    specialists: 'محترفات',
    perMonth: 'بالشهر',
    months: 'أشهر',
    availableMonths: 'الشهور المتاحة',
    availableFrom: 'متاحة من',
    selectMonth: 'اختر الشهر المتاح',
    termsAndConditions: 'الشروط والأحكام',
    contract: 'العقد',
    pleaseAcceptTerms: 'يرجى الموافقة على الشروط والأحكام',
    pleaseSelectContractType: 'يرجى اختيار نوع العقد',
  },
  en: {
    completeBooking: 'Complete Booking Information',
    location: 'Location',
    bookingType: 'Booking Type',
    contractDuration: 'Contract Duration',
    date: 'Date',
    prices: 'Prices',
    selectLocation: 'Select Service Location',
    buildingInfo: 'Building and Address Information *',
    buildingPlaceholder: 'Example: 3rd floor, Apartment 305, next to elevator entrance...',
    selectBookingType: 'Choose Booking Type',
    selectContractDuration: 'Choose Contract Duration',
    oneMonth: '1 Month',
    twoMonths: '2 Months',
    threeMonths: '3 Months',
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
    selectContractDurationError: 'Please select contract duration',
    selectDateError: 'Please select booking date',
    selectCustomDateError: 'Please select date',
    selectSpecialistError: 'Please select at least one specialist',
    saved: 'Saved',
    bookingSaved: 'Booking information saved successfully',
    error: 'Error',
    loadError: 'An error occurred while loading data',
    bookedUntil: 'Booked until',
    available: 'Available',
    selectedCount: 'Selected',
    specialists: 'specialists',
    perMonth: 'per month',
    months: 'months',
    availableMonths: 'Available Months',
    availableFrom: 'Available from',
    selectMonth: 'Select Available Month',
    termsAndConditions: 'Terms & Conditions',
    contract: 'Contract',
    pleaseAcceptTerms: 'Please accept the terms and conditions',
    pleaseSelectContractType: 'Please select contract type',
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
  face_photo_url?: string | null;
  full_body_photo_url?: string | null;
  id_card_front_url?: string | null;
  id_card_back_url?: string | null;
  id_card_expiry_date?: string | null;
  nationality: string | null;
  quoted_price: string;
  quoted_at: string;
  rating?: number;
  reviews_count?: number;
  experience_years?: number;
  notes?: string;
  countries_worked_in?: string[];
  languages_spoken?: string[];
  has_pet_allergy?: boolean;
  has_cleaning_allergy?: boolean;
  booked_until?: string | null; // Track when specialist is booked until
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
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [company, setCompany] = useState<Company | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [hoursCount, setHoursCount] = useState<number>(1);
  const [serviceType, setServiceType] = useState<string>(''); // To determine if it's monthly or general
  const [isMonthlyService, setIsMonthlyService] = useState(false);
  
  // Customer data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerBudget, setCustomerBudget] = useState('');
  
  // Form data
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [buildingInfo, setBuildingInfo] = useState('');
  const [bookingType, setBookingType] = useState(''); // For general cleaning
  const [contractDuration, setContractDuration] = useState(''); // For monthly contracts
  const [bookingDateType, setBookingDateType] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSpecialistIds, setSelectedSpecialistIds] = useState<string[]>([]); // Multiple selection
  const [showReviews, setShowReviews] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpecialistReview[]>([]);
  const [showProfile, setShowProfile] = useState<string | null>(null); // For profile dialog
  const [termsAccepted, setTermsAccepted] = useState(true); // Auto-checked by default
  const [contractType, setContractType] = useState<'electronic' | 'physical' | ''>('');
  const [showEditOrderInfo, setShowEditOrderInfo] = useState(false);
  const [editedHoursCount, setEditedHoursCount] = useState<number>(1);
  const [editedServiceType, setEditedServiceType] = useState<string>('');
  const [editedCustomerAddress, setEditedCustomerAddress] = useState('');
  const [editedBudget, setEditedBudget] = useState('');
  const [editedMainService, setEditedMainService] = useState<string>('');
  const [editedSubService, setEditedSubService] = useState<string>('');
  const [showEditWarningDialog, setShowEditWarningDialog] = useState(false);
  
  // Specialist schedules for availability checking
  const [specialistSchedules, setSpecialistSchedules] = useState<Record<string, Array<{
    start_time: string;
    end_time: string;
    order_id: string;
    travel_buffer_minutes?: number;
  }>>>({});
  
  // Services and sub-services
  const [services, setServices] = useState<Array<{
    id: string;
    name: string;
    name_en: string | null;
    sub_services: Array<{
      id: string;
      name: string;
      name_en: string | null;
    }>;
  }>>([]);

  const totalSteps = 4;
  const t = translations[language];

  // Convert 24-hour format to 12-hour format with AM/PM
  const formatTimeTo12Hour = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const minuteStr = minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${period}`;
  };

  // Convert 12-hour format with AM/PM to 24-hour format
  const parse12HourTime = (timeStr: string): { hours: number, minutes: number } => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let hours24 = hours;
    if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }
    
    return { hours: hours24, minutes };
  };

  // Generate available time slots from 8:00 AM to 4:00 PM
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 16; hour++) {
      // First half hour slot
      const startTime1 = formatTimeTo12Hour(hour, 0);
      const endTime1 = formatTimeTo12Hour(hour, 30);
      slots.push(`${startTime1}-${endTime1}`);
      
      // Second half hour slot
      const startTime2 = formatTimeTo12Hour(hour, 30);
      const endTime2 = formatTimeTo12Hour(hour + 1, 0);
      slots.push(`${startTime2}-${endTime2}`);
    }
    return slots;
  };

  // Check if time slot is available for a specific specialist
  const isTimeSlotAvailable = (timeSlot: string, selectedDate: Date | null, specialistId?: string) => {
    if (!selectedDate) return false;
    
    const now = new Date();
    const [startTime] = timeSlot.split('-');
    const { hours, minutes } = parse12HourTime(startTime);
    
    // Create a date object for the slot start time
    const slotStartDateTime = new Date(selectedDate);
    slotStartDateTime.setHours(hours, minutes, 0, 0);
    
    // Add 2 hours buffer to current time
    const bufferTime = new Date(now);
    bufferTime.setHours(bufferTime.getHours() + 2);
    
    // Check if slot is in the past (+ 2 hours buffer)
    if (slotStartDateTime < bufferTime) {
      return false;
    }

    // If checking for a specific specialist, check their schedule
    if (specialistId && specialistSchedules[specialistId]) {
      const schedules = specialistSchedules[specialistId];
      
      // Calculate the actual end time of this booking based on hours_count
      const slotEndDateTime = new Date(slotStartDateTime);
      slotEndDateTime.setHours(slotEndDateTime.getHours() + hoursCount);

      // CRITICAL: Fixed 2-hour travel buffer before and after all bookings
      // This ensures specialists have enough time to travel between appointments
      const TRAVEL_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours = 120 minutes
      const newBookingStartWithBuffer = new Date(slotStartDateTime.getTime() - TRAVEL_BUFFER_MS);
      const newBookingEndWithBuffer = new Date(slotEndDateTime.getTime() + TRAVEL_BUFFER_MS);

      // Check if this slot conflicts with any existing booking (including travel buffer)
      const hasConflict = schedules.some(schedule => {
        const scheduleStart = new Date(schedule.start_time);
        const scheduleEnd = new Date(schedule.end_time);
        const travelBufferMinutes = schedule.travel_buffer_minutes || 120; // Default 2 hours
        const travelBufferMs = travelBufferMinutes * 60 * 1000;
        
        // Add travel buffer before and after the existing scheduled booking
        const existingBookingStartWithBuffer = new Date(scheduleStart.getTime() - travelBufferMs);
        const existingBookingEndWithBuffer = new Date(scheduleEnd.getTime() + travelBufferMs);
        
        // Check overlap: bookings conflict if their buffer zones overlap
        // New booking (with buffer) overlaps with existing booking (with buffer) if:
        // - New booking buffer zone starts before existing buffer zone ends AND
        // - New booking buffer zone ends after existing buffer zone starts
        const overlaps = (
          newBookingStartWithBuffer < existingBookingEndWithBuffer && 
          newBookingEndWithBuffer > existingBookingStartWithBuffer
        );
        
        if (overlaps) {
          console.log('⚠️ Schedule conflict detected with 2-hour travel buffer:');
          console.log(`  New booking (${hoursCount}h):`, newBookingStartWithBuffer.toLocaleString(), '-', newBookingEndWithBuffer.toLocaleString());
          console.log(`  Existing booking:`, existingBookingStartWithBuffer.toLocaleString(), '-', existingBookingEndWithBuffer.toLocaleString());
        }
        
        return overlaps;
      });

      if (hasConflict) {
        return false;
      }
    }
    
    return true;
  };

  // Check if specialist has any available time slots on a specific date
  const hasAvailableTimeSlotsOnDate = (specialist: Specialist, date: Date | null) => {
    if (!date) return false;
    
    // Get all time slots
    const allSlots = generateTimeSlots();
    
    // Check if at least one slot is available for this specific specialist
    const hasAvailableSlot = allSlots.some(slot => 
      isTimeSlotAvailable(slot, date, specialist.id)
    );
    
    return hasAvailableSlot;
  };

  // Generate available months for the next 12 months (for monthly contracts)
  const generateAvailableMonths = (specialist?: Specialist) => {
    const months = [];
    const today = new Date();
    
    // If specialist is booked, start from when they're available
    let startMonth = 0;
    if (specialist?.booked_until) {
      const bookedDate = new Date(specialist.booked_until);
      if (bookedDate > today) {
        const monthsDiff = Math.ceil((bookedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
        startMonth = monthsDiff;
      }
    }
    
    for (let i = startMonth; i < startMonth + 12; i++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + i);
      months.push(date);
    }
    
    return months;
  };

  // Format month for display with day
  const formatMonthDisplay = (date: Date) => {
    const monthNames = language === 'ar' 
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Check if a month is booked for a specific specialist
  const isMonthBooked = (monthDate: Date, specialist: Specialist) => {
    if (!specialist.booked_until) return false;
    const bookedUntilDate = new Date(specialist.booked_until);
    // If the month is before or equal to the booked until date, it's booked
    return monthDate <= bookedUntilDate;
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

  // Reload schedules when selected specialists or date changes
  useEffect(() => {
    if (selectedSpecialistIds.length === 0 || !bookingDateType) return;
    
    const reloadSchedules = async () => {
      const selectedDate = new Date(bookingDateType);
      selectedDate.setHours(0, 0, 0, 0);
      const dayStart = new Date(selectedDate);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Fetch ALL schedules that might overlap with the selected day
      // This includes bookings that:
      // 1. Start on this day
      // 2. Start before and end during this day
      // 3. Start during and end after this day
      // 4. Start before and end after this day (covering the entire day)
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('specialist_schedules')
        .select('specialist_id, start_time, end_time, order_id, travel_buffer_minutes')
        .in('specialist_id', selectedSpecialistIds)
        .lte('start_time', dayEnd.toISOString()) // Starts before or during the day
        .gte('end_time', dayStart.toISOString()); // Ends during or after the day
      
      if (schedulesError) {
        console.error('❌ Error reloading schedules:', schedulesError);
      } else {
        const schedulesBySpecialist: Record<string, Array<{
          start_time: string;
          end_time: string;
          order_id: string;
          travel_buffer_minutes: number;
        }>> = {};
        
        schedulesData?.forEach((schedule: any) => {
          if (!schedulesBySpecialist[schedule.specialist_id]) {
            schedulesBySpecialist[schedule.specialist_id] = [];
          }
          schedulesBySpecialist[schedule.specialist_id].push({
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            order_id: schedule.order_id,
            travel_buffer_minutes: schedule.travel_buffer_minutes || 120,
          });
        });
        
        setSpecialistSchedules(schedulesBySpecialist);
        console.log('🔄 Reloaded schedules for selected date:', bookingDateType);
        console.log('📅 Schedules found:', schedulesBySpecialist);
      }
    };
    
    reloadSchedules();
  }, [selectedSpecialistIds, bookingDateType]);

  // Auto-select today's date when component mounts
  useEffect(() => {
    if (!bookingDateType && availableDates.length > 0) {
      const today = availableDates[0].toISOString().split('T')[0];
      setBookingDateType(today);
    }
  }, [availableDates]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch order info to get hours_count and service_type
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          hours_count, 
          service_type,
          customers (
            name,
            whatsapp_number,
            area,
            budget
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      
      // Set customer data
      if (orderData?.customers) {
        setCustomerName(orderData.customers.name || '');
        setCustomerPhone(orderData.customers.whatsapp_number || '');
        setCustomerAddress(orderData.customers.area || '');
        setCustomerBudget(orderData.customers.budget || '');
        setEditedCustomerAddress(orderData.customers.area || '');
        setEditedBudget(orderData.customers.budget || '');
      }
      
      // Parse hours_count (now stored as numeric in DB)
      const hours = orderData?.hours_count || 1;
      setHoursCount(hours);
      setEditedHoursCount(hours);
      
      // Determine if it's a monthly service
      const svcType = orderData?.service_type || '';
      setServiceType(svcType);
      setEditedServiceType(svcType);
      // Check if service type contains keywords for monthly contracts
      const isMonthly = svcType.toLowerCase().includes('شهري') || 
                        svcType.toLowerCase().includes('monthly') ||
                        svcType.toLowerCase().includes('عقود');
      setIsMonthlyService(isMonthly);

      // Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url, phone')
        .eq('id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (companyError) throw companyError;
      
      if (!companyData) {
        toast({
          title: language === 'ar' ? 'الشركة غير موجودة' : 'Company not found',
          variant: 'destructive',
        });
        return;
      }
      
      setCompany(companyData);

      console.log('🔍 Fetching specialists for order:', orderId, 'company:', companyId);

      // Fetch specialists with their quotes for this order
      const { data: specialistsData, error: specialistsError } = await supabase
        .from('order_specialists')
        .select(`
          quoted_price,
          quoted_at,
          specialists!inner (
            id,
            name,
            phone,
            image_url,
            face_photo_url,
            full_body_photo_url,
            id_card_front_url,
            id_card_back_url,
            id_card_expiry_date,
            nationality,
            company_id,
            rating,
            reviews_count,
            experience_years,
            notes,
            countries_worked_in,
            languages_spoken,
            has_pet_allergy,
            has_cleaning_allergy,
            approval_status,
            registration_completed_at,
            is_active,
            suspension_end_date
          )
        `)
        .eq('order_id', orderId)
        .not('quoted_price', 'is', null)
        .is('is_accepted', null)
        .eq('specialists.approval_status', 'approved')
        .eq('specialists.is_active', true)
        .not('specialists.registration_completed_at', 'is', null)
        .or('suspension_end_date.is.null,suspension_end_date.lt.' + new Date().toISOString(), { foreignTable: 'specialists' });

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

      // Check availability for each specialist based on schedules
      const specialistsWithAvailability = await Promise.all(
        formattedSpecialists.map(async (specialist: any) => {
          // Fetch schedules for this specialist
          const { data: schedules, error: schedulesError } = await supabase
            .from('specialist_schedules')
            .select('start_time, end_time, travel_buffer_minutes')
            .eq('specialist_id', specialist.id)
            .gte('end_time', new Date().toISOString());

          if (schedulesError) {
            console.error('Error fetching schedules for specialist:', specialist.id, schedulesError);
            return specialist;
          }

          // If specialist has future bookings, set booked_until to the last end time + buffer
          if (schedules && schedules.length > 0) {
            const latestSchedule = schedules.reduce((latest, current) => {
              const currentEnd = new Date(current.end_time);
              const latestEnd = new Date(latest.end_time);
              return currentEnd > latestEnd ? current : latest;
            });

            const bookedUntil = new Date(latestSchedule.end_time);
            bookedUntil.setMinutes(bookedUntil.getMinutes() + (latestSchedule.travel_buffer_minutes || 120));

            return {
              ...specialist,
              booked_until: bookedUntil.toISOString(),
              has_active_bookings: true,
            };
          }

          return specialist;
        })
      );

      setSpecialists(specialistsWithAvailability);
      
      // Fetch services and sub-services for the service type dropdown
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          id,
          name,
          name_en,
          sub_services (
            id,
            name,
            name_en
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
      } else {
        setServices(servicesData || []);
      }
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
    // Step 1: Booking Type / Contract Duration
    if (currentStep === 1 && isMonthlyService && !contractDuration) {
      toast({
        title: t.missingData,
        description: t.selectContractDurationError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 1 && !isMonthlyService && !bookingType) {
      toast({
        title: t.missingData,
        description: t.selectBookingTypeError,
        variant: 'destructive',
      });
      return;
    }
    
    // Step 2: Date & Specialist
    if (currentStep === 2 && !bookingDateType) {
      toast({
        title: t.missingData,
        description: t.selectDateError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && bookingDateType === 'custom' && !customDate) {
      toast({
        title: t.missingData,
        description: t.selectCustomDateError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && selectedSpecialistIds.length === 0) {
      toast({
        title: t.missingData,
        description: t.selectSpecialistError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && !selectedTime) {
      toast({
        title: t.missingData,
        description: t.selectTimeError,
        variant: 'destructive',
      });
      return;
    }
    
    // Step 3: Terms or Contract
    if (currentStep === 3 && !isMonthlyService && !termsAccepted) {
      toast({
        title: t.missingData,
        description: t.pleaseAcceptTerms,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && isMonthlyService && !contractType) {
      toast({
        title: t.missingData,
        description: t.pleaseSelectContractType,
        variant: 'destructive',
      });
      return;
    }
    
    // Step 4: Location
    if (currentStep === 4 && !location) {
      toast({
        title: t.missingData,
        description: t.selectLocationError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 4 && !buildingInfo.trim()) {
      toast({
        title: t.missingData,
        description: t.enterBuildingInfo,
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
      if (selectedSpecialistIds.length === 0) {
        toast({
          title: t.missingData,
          description: t.selectSpecialistError,
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

      // Verify specialist availability before booking (check only, don't create schedule yet)
      const availabilityChecks = await Promise.all(
        selectedSpecialistIds.map(async (specialistId) => {
          const response = await supabase.functions.invoke('manage-specialist-schedule', {
            body: {
              specialist_id: specialistId,
              order_id: orderId,
              booking_date: bookingDate,
              booking_time: selectedTime,
              hours_count: hoursCount,
              check_only: true, // Only check availability, don't create schedule
            },
          });

          return {
            specialist_id: specialistId,
            available: response.data?.available !== false,
            error: response.error,
          };
        })
      );

      // Check if all specialists are available
      const unavailableSpecialists = availabilityChecks.filter(check => !check.available);
      if (unavailableSpecialists.length > 0) {
        const unavailableNames = unavailableSpecialists
          .map(check => specialists.find(s => s.id === check.specialist_id)?.name)
          .filter(Boolean)
          .join('، ');
        
        toast({
          title: language === 'ar' ? 'خطأ في التوفر' : 'Availability Error',
          description: language === 'ar' 
            ? `الخبيرات التاليات غير متاحات في هذا الوقت: ${unavailableNames}. يرجى اختيار وقت آخر أو خبيرات أخريات.`
            : `The following specialists are not available at this time: ${unavailableNames}. Please choose another time or other specialists.`,
          variant: 'destructive',
        });
        return;
      }

      // Determine the specialist to assign
      let assignedSpecialistId = selectedSpecialistIds.length > 0 ? selectedSpecialistIds[0] : null;
      console.log('🔍 Booking Confirmation - Selected Specialist ID:', assignedSpecialistId);
      console.log('🔍 Booking Confirmation - Selected Specialist IDs:', selectedSpecialistIds);
      
      // If no specialists selected but there are quotes, auto-select the one with lowest price
      if (!assignedSpecialistId) {
        console.log('⚠️ No specialist selected, looking for lowest quote...');
        const { data: quotesData } = await supabase
          .from('order_specialists')
          .select('specialist_id, quoted_price')
          .eq('order_id', orderId)
          .not('quoted_price', 'is', null);

        if (quotesData && quotesData.length > 0) {
          const lowestQuote = quotesData.reduce((lowest, current) => {
            const currentPrice = parseFloat(current.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || 'Infinity');
            const lowestPrice = parseFloat(lowest.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || 'Infinity');
            return currentPrice < lowestPrice ? current : lowest;
          });
          assignedSpecialistId = lowestQuote.specialist_id;
          console.log('✅ Auto-selected specialist with lowest quote:', assignedSpecialistId);
        } else {
          console.log('❌ No quotes found to auto-select from');
        }
      } else {
        console.log('✅ Using manually selected specialist:', assignedSpecialistId);
      }

      // Update order details - set status to upcoming after booking confirmed
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          gps_latitude: location?.lat,
          gps_longitude: location?.lng,
          building_info: buildingInfo,
          selected_booking_type: isMonthlyService ? contractDuration : bookingType,
          booking_date: bookingDate,
          booking_date_type: 'custom',
          booking_time: selectedTime,
          status: 'upcoming', // Set to upcoming after booking is confirmed
          specialist_id: assignedSpecialistId,
          tracking_stage: null,
          // For monthly services, save contract type note
          // For regular services, don't overwrite existing customer notes
          ...(isMonthlyService && { 
            notes: `نوع العقد: ${contractType === 'electronic' ? 'عقد إلكتروني' : 'عقد أصلي (مندوب)'}`
          }),
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Create schedule entry for the assigned specialist
      if (assignedSpecialistId) {
        const scheduleResponse = await supabase.functions.invoke('manage-specialist-schedule', {
          body: {
            specialist_id: assignedSpecialistId,
            order_id: orderId,
            booking_date: bookingDate,
            booking_time: selectedTime,
            hours_count: hoursCount,
            check_only: false, // Actually create the schedule
          },
        });

        if (scheduleResponse.error || !scheduleResponse.data?.success) {
          console.error('❌ Failed to create specialist schedule:', scheduleResponse.error);
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' 
              ? 'فشل حجز الوقت للخبيرة. قد تكون غير متاحة الآن.'
              : 'Failed to book time for the specialist. They may no longer be available.',
            variant: 'destructive',
          });
          return;
        }
        
        console.log('✅ Successfully created specialist schedule');
      }

      // Use the assigned specialist for all operations
      const finalSelectedIds = assignedSpecialistId ? [assignedSpecialistId] : selectedSpecialistIds;
      
      // Accept the assigned specialist and reject others
      if (assignedSpecialistId) {
        console.log('📝 Updating order_specialists for order:', orderId, 'specialist:', assignedSpecialistId);
        
        // Accept the chosen specialist
        const { error: acceptError } = await supabase
          .from('order_specialists')
          .update({ 
            is_accepted: true,
            rejected_at: null,
            rejection_reason: null
          })
          .eq('order_id', orderId)
          .eq('specialist_id', assignedSpecialistId);
        
        if (acceptError) {
          console.error('❌ Error accepting specialist:', acceptError);
          throw new Error('فشل تأكيد المحترفة المختارة');
        } else {
          console.log('✅ Successfully accepted specialist');
        }

        // Update specialist_id in orders table to reflect the assignment
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ specialist_id: assignedSpecialistId })
          .eq('id', orderId);
        
        if (orderUpdateError) {
          console.error('❌ Error updating order specialist_id:', orderUpdateError);
        } else {
          console.log('✅ Successfully updated order specialist_id');
        }

        // Reject all other specialists
        const { error: rejectError } = await supabase
          .from('order_specialists')
          .update({ 
            is_accepted: false,
            rejected_at: new Date().toISOString(),
            rejection_reason: 'تم اختيار محترفة أخرى'
          })
          .eq('order_id', orderId)
          .neq('specialist_id', assignedSpecialistId);
        
        if (rejectError) {
          console.error('❌ Error rejecting other specialists:', rejectError);
        } else {
          console.log('✅ Successfully rejected other specialists');
        }
      } else {
        console.error('⚠️ CRITICAL: No assigned specialist ID - cannot complete booking');
        throw new Error('لم يتم تحديد محترفة للحجز');
      }

      // Notify accepted specialists about booking confirmation → deep link to /order-tracking/:orderId
      try {
        if (finalSelectedIds.length > 0) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              specialistIds: finalSelectedIds,
              title: 'تأكيد الحجز',
              body: `تم تأكيد حجزك - التاريخ: ${bookingDate}, الوقت: ${selectedTime}`,
              data: {
                orderId,
                type: 'booking_confirmed',
              },
            },
          });
        }
      } catch (e) {
        console.warn('🔔 Booking confirmation notification failed (non-blocking):', e);
      }

      console.log('Successfully accepted specialists:', selectedSpecialistIds);

      // Get company data for WhatsApp
      const { data: orderData } = await supabase
        .from('orders')
        .select('customers(whatsapp_number)')
        .eq('id', orderId)
        .single();

      const selectedSpecs = specialists.filter(s => selectedSpecialistIds.includes(s.id));
      const specialistNames = selectedSpecs.map(s => s.name).join('، ');

      toast({
        title: t.saved,
        description: 'تم تأكيد الحجز بنجاح',
      });

      // Detect if device is mobile or desktop
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile && company?.phone) {
        // Mobile: Open WhatsApp without message (will be sent via API later)
        openWhatsApp(company.phone);
      } else {
        // Desktop: Navigate back to admin dashboard
        setTimeout(() => navigate(-1), 1500);
      }
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
        // The quoted_price is already the total price for the entire order
        const price = parseFloat(s.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
        return price;
      })
      .filter((p) => !isNaN(p));
    return Math.min(...prices);
  };

  const lowestPrice = getLowestPrice();

  // Calculate total price for a specialist
  const calculateTotalPrice = (specialist: Specialist) => {
    // The quoted_price is already the total price for the entire order, not per hour
    return specialist.quoted_price || '0';
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
      { number: 1, title: isMonthlyService ? t.contractDuration : t.bookingType },
      { number: 2, title: language === 'ar' ? 'التاريخ والمحترفة' : 'Date & Specialist' },
      { number: 3, title: isMonthlyService ? t.contract : t.termsAndConditions },
      { number: 4, title: t.location }
    ];

    return (
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className={cn(
                    'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all shadow-sm',
                    currentStep >= step.number
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {currentStep > step.number ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <span className="text-sm sm:text-base">{step.number}</span>
                  )}
                </div>
                <div className="mt-1.5 sm:mt-2 text-center max-w-[60px] sm:max-w-none">
                  <div className={cn(
                    'text-[10px] sm:text-xs md:text-sm font-medium leading-tight',
                    currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 transition-all rounded-full',
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
          <LanguageSwitcher />
        </div>

        {/* Company Header - Compact */}
        {currentStep === 1 && (
          <>
            {company ? (
              <div className="flex items-center gap-3 sm:gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 shadow-sm mb-6">
                {/* Company Logo */}
                {company.logo_url ? (
                  <img 
                    src={company.logo_url} 
                    alt={company.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-primary/40 shadow-md flex-shrink-0"
                    onError={(e) => {
                      console.error('❌ Error loading company logo:', company.logo_url);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-primary/40 shadow-md flex-shrink-0">
                    <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                  </div>
                )}
                
                {/* Company Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-1">
                    {language === 'ar' ? 'مقدم الخدمة' : 'Service Provider'}
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                    {company.name}
                  </h2>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 mb-6">
                <p className="text-sm text-yellow-800">
                  {language === 'ar' 
                    ? '⚠️ لا توجد معلومات الشركة. معرف الشركة: ' + (companyId || 'غير محدد')
                    : '⚠️ Company information not found. Company ID: ' + (companyId || 'undefined')
                  }
                </p>
              </div>
            )}
          </>
        )}

        {/* Order Information Card */}
        {currentStep === 1 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <FileUser className="h-5 w-5 text-primary" />
                  {language === 'ar' ? 'معلومات الطلب الحالية' : 'Current Order Information'}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditWarningDialog(true)}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {language === 'ar' ? 'طلب تعديل' : 'Request Edit'}
                </Button>
              </div>
            </CardHeader>
          <CardContent className="space-y-3">
            {!showEditOrderInfo ? (
              /* Display Current Info */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-muted-foreground mb-1 text-xs">
                    {language === 'ar' ? 'المنطقة' : 'Area'}
                  </p>
                  <p className="font-semibold">{customerAddress || '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-muted-foreground mb-1 text-xs">
                    {language === 'ar' ? 'نوع الخدمة' : 'Service Type'}
                  </p>
                  <p className="font-semibold">{serviceType || '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-muted-foreground mb-1 text-xs">
                    {language === 'ar' ? 'عدد الساعات' : 'Hours Count'}
                  </p>
                  <p className="font-semibold">
                    {hoursCount} {language === 'ar' ? 'ساعة' : 'hour(s)'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-muted-foreground mb-1 text-xs">
                    {language === 'ar' ? 'الميزانية المقترحة' : 'Proposed Budget'}
                  </p>
                  <p className="font-semibold">{customerBudget || '-'}</p>
                </div>
              </div>
            ) : (
              /* Edit Form */
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-area">
                      {language === 'ar' ? 'المنطقة' : 'Area'}
                    </Label>
                    <Input
                      id="edit-area"
                      value={editedCustomerAddress}
                      onChange={(e) => setEditedCustomerAddress(e.target.value)}
                      placeholder={language === 'ar' ? 'أدخل المنطقة' : 'Enter area'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-budget">
                      {language === 'ar' ? 'الميزانية المقترحة' : 'Proposed Budget'}
                    </Label>
                    <Input
                      id="edit-budget"
                      value={editedBudget}
                      onChange={(e) => setEditedBudget(e.target.value)}
                      placeholder={language === 'ar' ? 'أدخل الميزانية' : 'Enter budget'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-main-service">
                      {language === 'ar' ? 'الخدمة الرئيسية' : 'Main Service'}
                    </Label>
                    <Select
                      value={editedMainService}
                      onValueChange={(value) => {
                        setEditedMainService(value);
                        setEditedSubService('');
                        setEditedServiceType('');
                      }}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة الرئيسية' : 'Select main service'} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {language === 'ar' ? service.name : (service.name_en || service.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sub-service">
                      {language === 'ar' ? 'الخدمة الفرعية' : 'Sub Service'}
                    </Label>
                    <Select
                      value={editedSubService}
                      onValueChange={(value) => {
                        setEditedSubService(value);
                        // Find the sub-service name and set it as the service type
                        const selectedMainService = services.find(s => s.id === editedMainService);
                        const selectedSubService = selectedMainService?.sub_services?.find(ss => ss.id === value);
                        if (selectedSubService) {
                          setEditedServiceType(language === 'ar' ? selectedSubService.name : (selectedSubService.name_en || selectedSubService.name));
                        }
                      }}
                      disabled={!editedMainService}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة الفرعية' : 'Select sub service'} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {editedMainService && services.find(s => s.id === editedMainService)?.sub_services?.map((subService) => (
                          <SelectItem key={subService.id} value={subService.id}>
                            {language === 'ar' ? subService.name : (subService.name_en || subService.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-hours">
                      {language === 'ar' ? 'عدد الساعات' : 'Hours Count'}
                    </Label>
                    <Input
                      id="edit-hours"
                      type="number"
                      min="1"
                      max="24"
                      value={editedHoursCount}
                      onChange={(e) => setEditedHoursCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditOrderInfo(false);
                      setEditedCustomerAddress(customerAddress);
                      setEditedBudget(customerBudget);
                      setEditedServiceType(serviceType);
                      setEditedHoursCount(hoursCount);
                      setEditedMainService('');
                      setEditedSubService('');
                    }}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => {
                      // Validate that service type is selected
                      if (!editedServiceType) {
                        toast({
                          title: t.missingData,
                          description: language === 'ar' ? 'يرجى اختيار نوع الخدمة' : 'Please select service type',
                          variant: 'destructive',
                        });
                        return;
                      }

                      setShowEditOrderInfo(false);
                      
                      // Open WhatsApp with company
                      if (company?.phone) {
                        const message = encodeURIComponent(
                          `مرحباً، أود تعديل الحجز رقم: ${orderId}\n\n` +
                          `المعلومات الجديدة:\n` +
                          `المنطقة: ${editedCustomerAddress}\n` +
                          `نوع الخدمة: ${editedServiceType}\n` +
                          `عدد الساعات: ${editedHoursCount}\n` +
                          `الميزانية المقترحة: ${editedBudget}\n\n` +
                          `أرجو التواصل معي لتأكيد السعر الجديد.`
                        );
                        openWhatsApp(company.phone, message);
                      }
                    }}
                  >
                    {language === 'ar' ? 'تأكيد التعديل' : 'Confirm Edit'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Edit Warning Dialog */}
        <AlertDialog open={showEditWarningDialog} onOpenChange={setShowEditWarningDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-right">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                {language === 'ar' ? 'تنبيه هام' : 'Important Notice'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right text-base leading-relaxed">
                {language === 'ar' 
                  ? 'في حال تعديل الحجز سيتم إرسال الحجز مرة أخرى للشركات وسيتم الرد عليك عبر رسالة واتساب لتأكيد السعر الجديد'
                  : 'If you modify the booking, it will be sent again to companies and you will receive a WhatsApp message to confirm the new price'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogAction
                onClick={() => {
                  setShowEditWarningDialog(false);
                  setShowEditOrderInfo(true);
                }}
                className="flex-1"
              >
                {language === 'ar' ? 'متابعة عبر واتساب' : 'Continue via WhatsApp'}
              </AlertDialogAction>
              <AlertDialogCancel className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Steps */}
        <Card>
          <CardHeader className="pb-4">
            {renderStepIndicator()}
          </CardHeader>
          <CardContent className="space-y-6 px-3 sm:px-6">
            {/* Step 1: Booking Type or Contract Duration */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Booking Type Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 px-2">
                    {isMonthlyService ? (
                      <>
                        <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        <span>{t.selectContractDuration}</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        <span>{t.selectBookingType}</span>
                      </>
                    )}
                  </h3>
                  
                  {isMonthlyService ? (
                    // Monthly Service - Contract Duration Options
                    <RadioGroup value={contractDuration} onValueChange={setContractDuration}>
                      <div className="space-y-3">
                        {[
                          { value: '1-month', label: t.oneMonth, icon: '📅', duration: '30' },
                          { value: '2-months', label: t.twoMonths, icon: '📆', duration: '60' },
                          { value: '3-months', label: t.threeMonths, icon: '🗓️', duration: '90' }
                        ].map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              'group relative flex items-center space-x-4 space-x-reverse border-2 rounded-2xl p-5 cursor-pointer transition-all active:scale-98 overflow-hidden',
                              contractDuration === option.value
                                ? 'border-primary bg-gradient-to-r from-primary/15 to-primary/5 shadow-lg scale-[1.02]'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:shadow-md'
                            )}
                          >
                            {/* Background decoration */}
                            <div className={cn(
                              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity',
                              contractDuration === option.value && 'opacity-100'
                            )} />
                            
                            <RadioGroupItem value={option.value} id={option.value} className="relative z-10" />
                            
                            {/* Icon */}
                            <div className={cn(
                              'relative z-10 flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl transition-all',
                              contractDuration === option.value
                                ? 'bg-primary/20 scale-110'
                                : 'bg-muted/50 group-hover:bg-muted'
                            )}>
                              {option.icon}
                            </div>
                            
                            <div className="relative z-10 flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-bold text-base sm:text-lg">{option.label}</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  ({option.duration} {language === 'ar' ? 'يوم' : 'days'})
                                </span>
                              </div>
                            </div>
                            
                            {contractDuration === option.value && (
                              <Check className="relative z-10 h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 animate-scale-in" />
                            )}
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  ) : (
                    // General Cleaning - Booking Type Options
                    <RadioGroup value={bookingType} onValueChange={setBookingType}>
                      <div className="space-y-3">
                        {[
                          { value: 'once', label: t.oneTime, icon: '🏠', desc: language === 'ar' ? 'مرة واحدة فقط' : 'One time only' },
                          { value: 'weekly', label: t.weekly, icon: '📅', desc: language === 'ar' ? 'كل أسبوع' : 'Every week' },
                          { value: 'bi-weekly', label: t.biWeekly, icon: '📆', desc: language === 'ar' ? 'كل أسبوعين' : 'Every 2 weeks' },
                          { value: 'monthly', label: t.monthly, icon: '🗓️', desc: language === 'ar' ? 'كل شهر' : 'Every month' }
                        ].map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              'group relative flex items-center space-x-4 space-x-reverse border-2 rounded-2xl p-5 cursor-pointer transition-all active:scale-98 overflow-hidden',
                              bookingType === option.value
                                ? 'border-primary bg-gradient-to-r from-primary/15 to-primary/5 shadow-lg scale-[1.02]'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:shadow-md'
                            )}
                          >
                            {/* Background decoration */}
                            <div className={cn(
                              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity',
                              bookingType === option.value && 'opacity-100'
                            )} />
                            
                            <RadioGroupItem value={option.value} id={option.value} className="relative z-10" />
                            
                            {/* Icon */}
                            <div className={cn(
                              'relative z-10 flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl transition-all',
                              bookingType === option.value
                                ? 'bg-primary/20 scale-110'
                                : 'bg-muted/50 group-hover:bg-muted'
                            )}>
                              {option.icon}
                            </div>
                            
                            <div className="relative z-10 flex-1 min-w-0">
                              <div className="font-bold text-base sm:text-lg">{option.label}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{option.desc}</div>
                            </div>
                            
                            {bookingType === option.value && (
                              <Check className="relative z-10 h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 animate-scale-in" />
                            )}
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Date Selection & Specialists */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Date Selection Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {language === 'ar' ? 'اختر التاريخ المناسب' : 'Choose Date'}
                  </h3>
                  
                  <RadioGroup value={bookingDateType} onValueChange={(value) => {
                    setBookingDateType(value);
                    setSelectedSpecialistIds([]);
                    setSelectedTime('');
                  }}>
                    <div className="relative overflow-hidden">
                      <div className="flex gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-muted/50 [&::-webkit-scrollbar-thumb]:bg-primary/50 [&::-webkit-scrollbar-thumb]:rounded-full -mx-1 px-1">
                        {availableDates.map((date) => {
                          const dateValue = date.toISOString().split('T')[0];
                          const isSelected = bookingDateType === dateValue;
                          const isToday = date.toDateString() === new Date().toDateString();
                          
                          return (
                            <label
                              key={dateValue}
                              className={cn(
                                'flex flex-col items-center justify-center border rounded-md sm:rounded-lg cursor-pointer transition-colors flex-shrink-0 w-[68px] sm:w-20 md:w-28 min-h-[68px] sm:min-h-[80px] md:min-h-[90px] snap-start p-1.5 sm:p-2',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                  : isToday
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'border-border bg-card hover:border-primary/40'
                              )}
                            >
                              <RadioGroupItem value={dateValue} id={dateValue} className="sr-only" />
                              <div className="text-center space-y-0.5">
                                <div className={cn(
                                  "text-[9px] sm:text-[10px] md:text-xs font-medium leading-tight",
                                  isSelected ? "text-primary-foreground" : "text-muted-foreground"
                                )}>
                                  {formatDateDisplay(date)}
                                </div>
                                <div className={cn(
                                  "text-lg sm:text-xl md:text-2xl font-bold leading-none",
                                  isSelected && "text-primary-foreground"
                                )}>
                                  {date.getDate()}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="text-center mt-2 text-[10px] sm:text-xs text-muted-foreground">
                        {language === 'ar' ? '← اسحب لرؤية المزيد من التواريخ →' : '← Scroll for more dates →'}
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Show Specialists after date selection */}
                {bookingDateType && (
                  <div className="space-y-4 pt-6 border-t-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {language === 'ar' ? 'اختر المحترفة والوقت المناسب' : 'Choose Specialist & Time'}
                      </h3>
                      {isMonthlyService && selectedSpecialistIds.length > 0 && (
                        <Badge variant="default" className="text-sm px-3 py-1">
                          {t.selectedCount}: {selectedSpecialistIds.length} {t.specialists}
                        </Badge>
                      )}
                    </div>

                    {specialists.length > 0 ? (
                      <div className="space-y-4">
                        {specialists
                          .sort((a, b) => {
                            // First, sort by availability (available first, booked last)
                            const isBookedA = a.booked_until && new Date(a.booked_until) > new Date();
                            const isBookedB = b.booked_until && new Date(b.booked_until) > new Date();
                            
                            if (isBookedA && !isBookedB) return 1; // a is booked, b is not -> b comes first
                            if (!isBookedA && isBookedB) return -1; // a is not booked, b is -> a comes first
                            
                            // If both have the same availability status, sort by price (total price)
                            const priceA = parseFloat(a.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                            const priceB = parseFloat(b.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                            return priceA - priceB;
                          })
                          .map((specialist) => {
                            // The quoted_price is already the total price
                            const totalPrice = parseFloat(specialist.quoted_price?.match(/(\d+(\.\d+)?)/)?.[1] || '0');
                            const isLowest = totalPrice === lowestPrice;
                            const isSelected = selectedSpecialistIds.includes(specialist.id);
                            // Check if specialist has available time slots on selected date
                            const selectedDateObj = bookingDateType ? new Date(bookingDateType) : null;
                            const hasAvailableSlots = hasAvailableTimeSlotsOnDate(specialist, selectedDateObj);
                            const isBooked = !hasAvailableSlots;

                            return (
                              <div
                                key={specialist.id}
                                className={cn(
                                  'border-2 rounded-xl overflow-hidden transition-all',
                                  isSelected
                                    ? 'border-primary shadow-lg'
                                    : isBooked
                                    ? 'border-gray-400 dark:border-gray-600 opacity-60 bg-gray-50 dark:bg-gray-900/30'
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
                                    isBooked && 'bg-gray-100 dark:bg-gray-800/50 cursor-not-allowed',
                                    isLowest && !isSelected && !isBooked && 'bg-green-50 dark:bg-green-950/20'
                                  )}
                                  onClick={() => {
                                    // Toggle selection for monthly service, single for general
                                    if (isMonthlyService) {
                                      if (isSelected) {
                                        setSelectedSpecialistIds(selectedSpecialistIds.filter(id => id !== specialist.id));
                                      } else {
                                        setSelectedSpecialistIds([...selectedSpecialistIds, specialist.id]);
                                      }
                                    } else {
                                      setSelectedSpecialistIds([specialist.id]);
                                    }
                                  }}
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
                                          {isMonthlyService ? t.perMonth : `${hoursCount} ${language === 'ar' ? 'ساعات' : 'hours'}`}
                                        </p>
                                        {isLowest && (
                                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-bold">
                                            {t.lowestPrice} ⭐
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 mb-3 flex-wrap">
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

                                      {/* Profile Button */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowProfile(specialist.id);
                                        }}
                                      >
                                        <FileUser className="h-3.5 w-3.5" />
                                        <span className="text-xs">
                                          {language === 'ar' ? 'السيرة الذاتية' : 'CV'}
                                        </span>
                                      </Button>
                                    </div>

                                    {/* Available Times/Months Preview - Show only when NOT selected */}
                                    {!isSelected && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                          <Clock className="h-4 w-4" />
                                          <span>
                                            {isMonthlyService 
                                              ? t.availableMonths
                                              : (language === 'ar' ? 'الأوقات المتاحة' : 'Available Times')
                                            }
                                          </span>
                                        </div>
                                        {isMonthlyService ? (
                                          // Show available months for monthly service
                                          <>
                                            <div className="flex gap-2 flex-wrap">
                                              {generateAvailableMonths(specialist).slice(0, 3).map((monthDate) => {
                                                const monthValue = monthDate.toISOString().split('T')[0];
                                                const isBooked = isMonthBooked(monthDate, specialist);
                                                return (
                                                  <div
                                                    key={monthValue}
                                                    className={cn(
                                                      "px-3 py-1.5 rounded-md text-xs font-medium animate-fade-in",
                                                      isBooked 
                                                        ? "bg-muted/30 border border-muted text-muted-foreground/50 opacity-50 cursor-not-allowed"
                                                        : "bg-primary/10 border border-primary/20"
                                                    )}
                                                  >
                                                    {formatMonthDisplay(monthDate)}
                                                    {isBooked && <span className="ml-1">🔒</span>}
                                                  </div>
                                                );
                                              })}
                                              {generateAvailableMonths(specialist).length > 3 && (
                                                <div className="px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                                  +{generateAvailableMonths(specialist).length - 3} {language === 'ar' ? 'المزيد' : 'more'}
                                                </div>
                                              )}
                                            </div>
                                            {specialist.booked_until && new Date(specialist.booked_until) > new Date() && (
                                              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                                                <span>⚠️</span>
                                                <span>
                                                  {t.availableFrom}: {formatMonthDisplay(generateAvailableMonths(specialist)[0])}
                                                </span>
                                              </p>
                                            )}
                                            <p className="text-xs text-primary font-medium animate-pulse">
                                              {language === 'ar' ? '👆 اضغط لاختيار الشهر' : '👆 Click to select month'}
                                            </p>
                                          </>
                                        ) : (
                                          // Show time slots for regular service
                                          <>
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
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Available Times/Months - Show only for selected specialist */}
                                {isSelected && (
                                  <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-t-2 border-primary/20">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                                      <Clock className="h-4 w-4" />
                                      {isMonthlyService ? t.selectMonth : t.selectTime}
                                    </h4>
                                    <RadioGroup value={selectedTime} onValueChange={setSelectedTime}>
                                      {isMonthlyService ? (
                                        // Show available months for monthly service
                                        <>
                                          {specialist.booked_until && new Date(specialist.booked_until) > new Date() && (
                                            <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-300 dark:border-orange-800 rounded-lg">
                                              <p className="text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2">
                                                <span>⚠️</span>
                                                <span>
                                                  {language === 'ar' ? 'محجوزة حتى' : 'Booked until'}: {new Date(specialist.booked_until).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </span>
                                              </p>
                                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                                {t.availableFrom}: {formatMonthDisplay(generateAvailableMonths(specialist)[0])}
                                              </p>
                                            </div>
                                          )}
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {generateAvailableMonths(specialist).map((monthDate) => {
                                              const monthValue = monthDate.toISOString().split('T')[0];
                                              const isBooked = isMonthBooked(monthDate, specialist);
                                              return (
                                                <label
                                                  key={monthValue}
                                                  className={cn(
                                                    'flex items-center justify-center border-2 rounded-lg p-3 transition-all',
                                                    isBooked
                                                      ? 'border-muted bg-muted/30 cursor-not-allowed opacity-50'
                                                      : selectedTime === monthValue
                                                      ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105 cursor-pointer'
                                                      : 'border-border bg-background hover:border-primary/50 hover:shadow-sm cursor-pointer'
                                                  )}
                                                >
                                                  <RadioGroupItem 
                                                    value={monthValue} 
                                                    id={monthValue} 
                                                    className="sr-only" 
                                                    disabled={isBooked}
                                                  />
                                                  <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                      <Calendar className="h-4 w-4" />
                                                      <span className="font-semibold text-xs text-center">
                                                        {formatMonthDisplay(monthDate)}
                                                      </span>
                                                    </div>
                                                    {isBooked && (
                                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        🔒 {language === 'ar' ? 'محجوز' : 'Booked'}
                                                      </span>
                                                    )}
                                                  </div>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </>
                                      ) : (
                                        // Show time slots for regular service
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                          {timeSlots.map((slot) => {
                                            // Check availability for all selected specialists
                                            const isAvailable = selectedSpecialistIds.every(specId => 
                                              isTimeSlotAvailable(slot, bookingDateType ? new Date(bookingDateType) : null, specId)
                                            );
                                            
                                            return (
                                              <label
                                                key={slot}
                                                className={cn(
                                                  'flex items-center justify-center border-2 rounded-lg p-2.5 transition-all',
                                                  !isAvailable && 'opacity-40 cursor-not-allowed bg-muted',
                                                  isAvailable && 'cursor-pointer',
                                                  selectedTime === slot && isAvailable
                                                    ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                                                    : isAvailable && 'border-border bg-background hover:border-primary/50 hover:shadow-sm'
                                                )}
                                              >
                                                <RadioGroupItem 
                                                  value={slot} 
                                                  id={slot} 
                                                  className="sr-only" 
                                                  disabled={!isAvailable}
                                                />
                                                <div className="flex items-center gap-1.5">
                                                  <Clock className="h-4 w-4" />
                                                  <span className="font-semibold text-xs">{slot}</span>
                                                  {!isAvailable && (
                                                    <span className="text-[10px] ml-1">🔒</span>
                                                  )}
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
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

            {/* Step 3: Terms & Conditions or Contract */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {isMonthlyService ? (
                  <MonthlyContract
                    companyName={company?.name || ''}
                    companyLogo={company?.logo_url || null}
                    contractType={contractType}
                    onContractTypeChange={setContractType}
                    contractDuration={contractDuration}
                    specialistNames={specialists
                      .filter(s => selectedSpecialistIds.includes(s.id))
                      .map(s => s.name)
                    }
                    specialists={specialists
                      .filter(s => selectedSpecialistIds.includes(s.id))
                      .map(s => ({
                        name: s.name,
                        nationality: s.nationality || ''
                      }))
                    }
                    startDate={bookingDateType === 'custom' ? customDate : new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    language={language}
                    customerName={customerName}
                    customerPhone={customerPhone}
                    customerAddress={customerAddress || buildingInfo}
                  />
                ) : (
                  <TermsAndConditions
                    accepted={termsAccepted}
                    onAcceptChange={setTermsAccepted}
                    language={language}
                  />
                )}
              </div>
            )}

            {/* Step 4: Location */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.selectLocation}
                </h3>
                
                <MapLocationPicker
                  onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
                  initialLat={location?.lat}
                  initialLng={location?.lng}
                />

                <div className="space-y-2">
                  <Label htmlFor="buildingInfo" className="text-base font-semibold">{t.buildingInfo}</Label>
                  <Textarea
                    id="buildingInfo"
                    value={buildingInfo}
                    onChange={(e) => setBuildingInfo(e.target.value)}
                    placeholder={t.buildingPlaceholder}
                    rows={4}
                    dir="auto"
                    className="resize-none text-base"
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6 border-t mt-6">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex items-center gap-2 h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base font-semibold"
                >
                  {language === 'ar' ? (
                    <>
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      {t.previous}
                    </>
                  ) : (
                    <>
                      <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                      {t.previous}
                    </>
                  )}
                </Button>
              )}

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base font-semibold shadow-md"
                >
                  {language === 'ar' ? (
                    <>
                      {t.next}
                      <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </>
                  ) : (
                    <>
                      {t.next}
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    !location ||
                    !buildingInfo.trim() ||
                    !bookingDateType || 
                    selectedSpecialistIds.length === 0 || 
                    !selectedTime ||
                    (isMonthlyService ? !contractType : !termsAccepted)
                  }
                  className="flex-1 flex items-center justify-center gap-2 h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base font-bold shadow-lg"
                >
                  <Check className="h-5 w-5" />
                  <span className="flex items-center gap-2">
                    <span>{t.submit}</span>
                    {selectedSpecialistIds.length > 0 && (
                      <span className="font-bold flex items-center gap-1">
                        <span>-</span>
                        <span>
                          {selectedSpecialistIds.length} {t.specialists}
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

        {/* Profile Dialog */}
        {showProfile && (
          <SpecialistProfileDialog
            open={!!showProfile}
            onOpenChange={(open) => !open && setShowProfile(null)}
            specialist={specialists.find(s => s.id === showProfile) || {
              id: '',
              name: '',
              phone: '',
              nationality: null,
              image_url: null,
              face_photo_url: null,
              full_body_photo_url: null,
              id_card_front_url: null,
              id_card_back_url: null,
              id_card_expiry_date: null,
              quoted_price: '',
              quoted_at: '',
              rating: 0,
              reviews_count: 0,
              experience_years: 0,
              notes: null,
              countries_worked_in: [],
              languages_spoken: [],
              has_pet_allergy: false,
              has_cleaning_allergy: false
            }}
            language={language}
            hideIdCards={true}
          />
        )}
      </div>
    </div>
  );
}
