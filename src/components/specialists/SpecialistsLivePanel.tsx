import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Users
} from 'lucide-react';
import { useSpecialistsLiveStatus, SpecialistLiveStatus } from '@/hooks/useSpecialistsLiveStatus';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SpecialistsLivePanelProps {
  companyId: string | null | undefined;
  isAdmin?: boolean;
}

const statusConfig = {
  online: { 
    label: 'متصل', 
    icon: Circle, 
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  offline: { 
    label: 'غير متصل', 
    icon: WifiOff, 
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    borderColor: 'border-gray-200 dark:border-gray-800'
  },
  busy: { 
    label: 'مشغول', 
    icon: Clock, 
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  not_logged_in: { 
    label: 'لم يسجل دخول', 
    icon: XCircle, 
    color: 'text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800'
  },
  on_the_way: { 
    label: 'في الطريق', 
    icon: Truck, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  working: { 
    label: 'يعمل الآن', 
    icon: Briefcase, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    borderColor: 'border-purple-200 dark:border-purple-800'
  }
};

const notificationActionConfig = {
  received: { label: 'استلم', color: 'text-green-600' },
  ignored: { label: 'تجاهل', color: 'text-orange-600' },
  no_response: { label: 'لا رد', color: 'text-red-600' }
};

export default function SpecialistsLivePanel({ companyId, isAdmin = false }: SpecialistsLivePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { specialists, isLoading } = useSpecialistsLiveStatus(companyId, isAdmin);

  const filteredSpecialists = specialists.filter(spec =>
    spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.phone.includes(searchQuery)
  );

  const renderSpecialistCard = (specialist: SpecialistLiveStatus) => {
    const statusInfo = statusConfig[specialist.status];
    const StatusIcon = statusInfo.icon;
    const lastNotifTime = specialist.last_notification_status.time;
    const lastNotifAction = specialist.last_notification_status.action;

    return (
      <Card 
        key={specialist.id} 
        className={`p-3 mb-2 border ${statusInfo.borderColor} ${statusInfo.bgColor}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={specialist.image_url || undefined} />
              <AvatarFallback>{specialist.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-background border-2 ${statusInfo.color}`}>
              <StatusIcon className="h-3 w-3" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{specialist.name}</h4>
              <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                {statusInfo.label}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-2" dir="ltr">
              {specialist.phone}
            </p>

            {/* Daily Stats */}
            <div className="flex items-center gap-3 mb-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                <span className="text-green-600">{specialist.accepted_today}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                <span className="text-red-600">{specialist.rejected_today}</span>
              </div>
            </div>

            {/* Last Notification */}
            {lastNotifTime && lastNotifAction && (
              <div className="text-xs text-muted-foreground">
                آخر إشعار: 
                <span className={`mx-1 ${notificationActionConfig[lastNotifAction].color}`}>
                  {notificationActionConfig[lastNotifAction].label}
                </span>
                {formatDistanceToNow(new Date(lastNotifTime), { 
                  addSuffix: true, 
                  locale: ar 
                })}
              </div>
            )}
            
            {!specialist.has_device_token && (
              <Badge variant="destructive" className="text-xs mt-1">
                لا يستقبل إشعارات
              </Badge>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">المحترفون</h3>
            <Badge variant="secondary">{filteredSpecialists.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        )}
      </div>

      {/* List */}
      {isExpanded && (
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              جاري التحميل...
            </div>
          ) : filteredSpecialists.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'لا توجد نتائج' : 'لا يوجد محترفون'}
            </div>
          ) : (
            filteredSpecialists.map(renderSpecialistCard)
          )}
        </ScrollArea>
      )}
    </Card>
  );
}
