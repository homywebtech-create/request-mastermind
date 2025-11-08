import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Circle,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Briefcase,
  WifiOff,
  Users,
  Bell,
  BellOff,
  AlertCircle,
  Ban,
  MessageSquare,
  Download,
  CheckCheck
} from 'lucide-react';
import { useSpecialistsLiveStatus, SpecialistLiveStatus } from '@/hooks/useSpecialistsLiveStatus';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/useLanguage';
import { SpecialistChatDialog } from '../specialist/SpecialistChatDialog';

interface SpecialistsLivePanelProps {
  companyId: string | null | undefined;
  isAdmin?: boolean;
}

const getStatusConfig = (language: string) => ({
  online: { 
    label: language === 'ar' ? 'متصل' : 'Online',
    icon: Circle, 
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  offline: { 
    label: language === 'ar' ? 'غير متصل' : 'Offline',
    icon: WifiOff, 
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    borderColor: 'border-gray-200 dark:border-gray-800'
  },
  busy: { 
    label: language === 'ar' ? 'مشغول' : 'Busy',
    icon: Clock, 
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  not_logged_in: { 
    label: language === 'ar' ? 'لم يسجل دخول' : 'Not Logged In',
    icon: XCircle, 
    color: 'text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800'
  },
  on_the_way: { 
    label: language === 'ar' ? 'في الطريق' : 'On The Way',
    icon: Truck, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  working: { 
    label: language === 'ar' ? 'يعمل الآن' : 'Working Now',
    icon: Briefcase, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    borderColor: 'border-purple-200 dark:border-purple-800'
  }
});

const getNotificationActionConfig = (language: string) => ({
  received: { 
    label: language === 'ar' ? 'استلم' : 'Received',
    color: 'text-green-600' 
  },
  ignored: { 
    label: language === 'ar' ? 'تجاهل' : 'Ignored',
    color: 'text-orange-600' 
  },
  no_response: { 
    label: language === 'ar' ? 'لا رد' : 'No Response',
    color: 'text-red-600' 
  }
});

export default function SpecialistsLivePanel({ companyId, isAdmin = false }: SpecialistsLivePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { specialists, isLoading, refresh } = useSpecialistsLiveStatus(companyId, isAdmin);
  const { language } = useLanguage();
  const [selectedChat, setSelectedChat] = useState<{ 
    specialistId: string; 
    specialistName: string; 
    specialistPhone?: string;
    specialistImage?: string;
    companyId: string;
    companyName?: string;
  } | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  
  const statusConfig = getStatusConfig(language);
  const notificationActionConfig = getNotificationActionConfig(language);
  
  // Fetch company name
  useEffect(() => {
    const fetchCompanyName = async () => {
      if (companyId) {
        const { data } = await supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .single();
        
        if (data) {
          setCompanyName(data.name);
        }
      }
    };
    
    fetchCompanyName();
  }, [companyId]);

  // Auto-refresh every 30 seconds for more accurate real-time status
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
      setLastUpdate(new Date());
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredSpecialists = specialists.filter(spec =>
    spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.phone.includes(searchQuery)
  );

  const renderSpecialistCard = (specialist: SpecialistLiveStatus) => {
    const statusInfo = statusConfig[specialist.status];
    const StatusIcon = statusInfo.icon;
    const lastNotifTime = specialist.last_notification_status.time;
    const lastNotifAction = specialist.last_notification_status.action;
    const upcomingTime = specialist.upcoming_order_time;
    
    // Check if specialist has recent activity (last 5 minutes)
    const hasRecentActivity = lastNotifTime && 
      (Date.now() - new Date(lastNotifTime).getTime()) < 5 * 60 * 1000;
    
    // Check if specialist has upcoming order within 1 hour
    const hasUpcomingSoon = upcomingTime && 
      (new Date(upcomingTime).getTime() - Date.now()) > 0 &&
      (new Date(upcomingTime).getTime() - Date.now()) < 60 * 60 * 1000; // 1 hour
    
    // Check if specialist is busy or working (active now)
    const isActiveNow = ['busy', 'on_the_way', 'working'].includes(specialist.status);
    
    // Add pulse animation if there's recent activity, active work, or upcoming order soon
    const shouldPulse = hasRecentActivity || isActiveNow || hasUpcomingSoon;

    // حالة الإيقاف
    const getSuspensionIndicator = () => {
      if (specialist.suspension_type === 'permanent') {
        return (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5 bg-red-600">
            <Ban className="h-2 w-2" />
            {language === 'ar' ? 'موقوف نهائياً' : 'Permanent'}
          </Badge>
        );
      }
      
      if (specialist.suspension_type === 'temporary') {
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5 bg-blue-100 text-blue-800">
            <Clock className="h-2 w-2" />
            {language === 'ar' ? 'موقف مؤقتاً' : 'Temp. Suspended'}
          </Badge>
        );
      }
      
      return null;
    };

    // حالة البطاقة
    const getIdCardIndicator = () => {
      if (!specialist.id_card_expiry_date) return null;
      
      const expiryDate = new Date(specialist.id_card_expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        return (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5 animate-pulse">
            <AlertCircle className="h-2 w-2" />
            {language === 'ar' ? 'بطاقة منتهية' : 'ID Expired'}
          </Badge>
        );
      }
      
      if (daysUntilExpiry <= 5) {
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5 bg-orange-100 text-orange-800">
            <Clock className="h-2 w-2" />
            {language === 'ar' ? `${daysUntilExpiry}د` : `${daysUntilExpiry}d`}
          </Badge>
        );
      }
      
      return null;
    };

    return (
      <Card 
        key={specialist.id} 
        className={`p-2.5 mb-2 border transition-all duration-300 ${statusInfo.borderColor} ${statusInfo.bgColor} ${
          shouldPulse ? 'animate-pulse shadow-lg ring-2 ring-primary/20' : ''
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* Avatar with Update Badge */}
          <div className="relative">
            <Avatar className={`h-10 w-10 ${shouldPulse ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
              <AvatarImage src={specialist.image_url || undefined} />
              <AvatarFallback className="text-xs">{specialist.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            
            {/* Update Warning Badge on Avatar */}
            {specialist.has_device_token && specialist.app_version && !specialist.has_latest_version && (
              <div className="absolute -top-1 -left-1 bg-orange-500 text-white rounded-full p-0.5 animate-bounce shadow-lg">
                <Download className="h-3 w-3" />
              </div>
            )}
            
            <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-background border-2 ${statusInfo.color} ${
              shouldPulse ? 'animate-pulse' : ''
            }`}>
              <StatusIcon className="h-2.5 w-2.5" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <h4 className="font-medium text-xs truncate">{specialist.name}</h4>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.color}`}>
                {statusInfo.label}
              </Badge>
            </div>

            <p className="text-[10px] text-muted-foreground mb-1.5" dir="ltr">
              {specialist.phone}
            </p>

            {/* App Version Indicator - PROMINENT */}
            <div className="mb-2">
              {specialist.has_device_token && specialist.app_version ? (
                specialist.has_latest_version ? (
                  <Badge variant="secondary" className="text-[11px] px-2 py-1 flex items-center gap-1 bg-green-100 text-green-800 border-green-300 font-semibold">
                    <CheckCheck className="h-3 w-3" />
                    {language === 'ar' ? `إصدار ${specialist.app_version}` : `Version ${specialist.app_version}`}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[11px] px-2 py-1 flex items-center gap-1 animate-pulse bg-orange-500 text-white border-orange-600 font-bold shadow-lg">
                    <Download className="h-3 w-3" />
                    {language === 'ar' ? `⚠️ يحتاج تحديث (${specialist.app_version})` : `⚠️ Update Needed (${specialist.app_version})`}
                  </Badge>
                )
              ) : specialist.has_device_token ? (
                <Badge variant="secondary" className="text-[11px] px-2 py-1 flex items-center gap-1 bg-gray-200 text-gray-700 font-semibold">
                  <AlertCircle className="h-3 w-3" />
                  {language === 'ar' ? 'غير معروف' : 'Unknown Version'}
                </Badge>
              ) : null}
            </div>

            {/* Warning Indicators - Suspension & ID Card */}
            <div className="flex items-center gap-1 mb-1.5 flex-wrap">
              {getSuspensionIndicator()}
              {getIdCardIndicator()}
            </div>

            {/* Daily Stats */}
            <div className="flex items-center gap-2.5 mb-1.5 text-[10px]">
              <div className="flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                <span className="text-green-600">{specialist.accepted_today}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <XCircle className="h-2.5 w-2.5 text-red-600" />
                <span className="text-red-600">{specialist.rejected_today}</span>
              </div>
            </div>

            {/* Last Notification */}
            {lastNotifTime && lastNotifAction && (
              <div className={`text-[10px] ${hasRecentActivity ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {language === 'ar' ? 'آخر إشعار' : 'Last notification'}: 
                <span className={`mx-1 ${notificationActionConfig[lastNotifAction].color}`}>
                  {notificationActionConfig[lastNotifAction].label}
                </span>
                {formatDistanceToNow(new Date(lastNotifTime), { 
                  addSuffix: true, 
                  locale: language === 'ar' ? ar : enUS 
                })}
                {hasRecentActivity && (
                  <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 animate-pulse">
                    {language === 'ar' ? 'جديد' : 'New'}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Upcoming Order Alert */}
            {upcomingTime && (
              <div className={`text-[10px] mt-1 ${hasUpcomingSoon ? 'font-semibold text-primary animate-pulse' : 'text-muted-foreground'}`}>
                <Clock className="inline h-2.5 w-2.5 mr-1" />
                {language === 'ar' ? 'طلب قادم' : 'Upcoming order'}: {formatDistanceToNow(new Date(upcomingTime), { 
                  addSuffix: true, 
                  locale: language === 'ar' ? ar : enUS 
                })}
                {hasUpcomingSoon && (
                  <Badge variant="default" className="mr-1 text-[9px] px-1 py-0 bg-orange-500 animate-pulse">
                    {language === 'ar' ? 'قريباً' : 'Soon'}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Notification Status Badge */}
            {specialist.has_device_token ? (
              // If specialist is busy, on the way, or working - they are NOT available for new offers
              isActiveNow ? (
                <div className="flex items-center gap-1 mt-1.5">
                  <BellOff className="h-2.5 w-2.5 text-orange-600" />
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-600 text-orange-600 bg-orange-50">
                    {language === 'ar' ? 'غير متاح' : 'Not Available'}
                  </Badge>
                </div>
              ) : (
                // Otherwise, they are available and waiting for new offers
                <div className="flex items-center gap-1 mt-1.5">
                  <Bell className="h-2.5 w-2.5 text-green-600" />
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-600 text-green-600 bg-green-50">
                    {language === 'ar' ? 'متاح' : 'Available'}
                  </Badge>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1 mt-1.5">
                <BellOff className="h-2.5 w-2.5 text-red-600" />
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                  {language === 'ar' ? 'لن يتلقى إشعارات' : 'No notifications'}
                </Badge>
              </div>
            )}
            
            {/* Chat Button - Only show for companies (not admin view) */}
            {!isAdmin && companyId && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 h-6 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChat({
                    specialistId: specialist.id,
                    specialistName: specialist.name,
                    specialistPhone: specialist.phone,
                    specialistImage: specialist.image_url,
                    companyId: companyId,
                    companyName: companyName,
                  });
                }}
              >
                <MessageSquare className="h-2.5 w-2.5 mr-1" />
                {language === 'ar' ? 'محادثة' : 'Chat'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
    <Card className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{language === 'ar' ? 'المحترفون' : 'Specialists'}</h3>
            <Badge variant="secondary" className="text-xs">{filteredSpecialists.length}</Badge>
            <div className="relative group">
              <Circle className="h-1.5 w-1.5 text-green-500 animate-pulse" />
              <span className="absolute hidden group-hover:block bg-black text-white text-[10px] rounded px-2 py-1 -top-7 right-0 whitespace-nowrap z-50">
                {language === 'ar' ? 'تحديث مباشر' : 'Live Update'}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
        
        <div className="text-[10px] text-muted-foreground mb-2">
          {language === 'ar' ? 'آخر تحديث' : 'Last update'}: {formatDistanceToNow(lastUpdate, { 
            addSuffix: true, 
            locale: language === 'ar' ? ar : enUS 
          })}
        </div>

        {isExpanded && (
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8 h-8 text-xs"
            />
          </div>
        )}
      </div>

      {/* List */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-2.5 min-h-0">
          <div className="space-y-1.5">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-6 text-xs">
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : filteredSpecialists.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-xs">
                {searchQuery 
                  ? (language === 'ar' ? 'لا توجد نتائج' : 'No results') 
                  : (language === 'ar' ? 'لا يوجد محترفون' : 'No specialists')
                }
              </div>
            ) : (
              filteredSpecialists.map(renderSpecialistCard)
            )}
          </div>
        </div>
      )}
    </Card>
    
    {/* Chat Dialog */}
    {selectedChat && companyId && (
      <SpecialistChatDialog
        open={!!selectedChat}
        onOpenChange={(open) => !open && setSelectedChat(null)}
        specialistId={selectedChat.specialistId}
        specialistName={selectedChat.specialistName}
        specialistPhone={selectedChat.specialistPhone}
        specialistImage={selectedChat.specialistImage}
        companyId={companyId}
        companyName={selectedChat.companyName}
        isSpecialistView={false}
      />
    )}
    </>
  );
}
