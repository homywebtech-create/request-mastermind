import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CustomerHistory } from "@/hooks/useCustomerHistory";
import { 
  User, 
  MapPin, 
  Star, 
  CheckCircle2, 
  XCircle, 
  Package,
  Calendar,
  MessageSquare,
  Globe
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CustomerHistoryCardProps {
  history: CustomerHistory;
  language?: 'ar' | 'en';
}

export function CustomerHistoryCard({ history, language = 'ar' }: CustomerHistoryCardProps) {
  const isArabic = language === 'ar';

  if (!history.customer) {
    return null;
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        className={`h-3 w-3 ${
          index < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'
        }`}
      />
    ));
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20 h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2 font-bold">
          <User className="h-4 w-4 text-primary" />
          {isArabic ? 'معلومات العميل السابقة' : 'Customer History'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Customer Basic Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold">{history.customer.name}</span>
            <Badge variant="secondary" className="gap-1">
              <Globe className="h-3 w-3" />
              {history.customer.preferred_language === 'ar' ? 'عربي' : 'English'}
            </Badge>
          </div>
          {history.customer.area && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {history.customer.area}
            </div>
          )}
        </div>

        <Separator />

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 text-center p-3 bg-primary/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              <span className="text-2xl font-bold">{history.totalOrders}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {isArabic ? 'إجمالي الطلبات' : 'Total Orders'}
            </p>
          </div>
          
          <div className="space-y-2 text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-2xl font-bold">{history.completedOrders}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {isArabic ? 'مكتملة' : 'Completed'}
            </p>
          </div>
          
          <div className="space-y-2 text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              {history.averageRating ? (
                <>
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold">
                    {history.averageRating.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">-</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {isArabic ? 'التقييم' : 'Rating'}
            </p>
          </div>
        </div>

        {history.cancelledOrders > 0 && (
          <div className="flex items-center gap-3 text-base text-destructive bg-destructive/10 p-3 rounded-lg font-medium">
            <XCircle className="h-4 w-4" />
            <span>
              {isArabic 
                ? `${history.cancelledOrders} طلب ملغي` 
                : `${history.cancelledOrders} Cancelled Orders`}
            </span>
          </div>
        )}

        {/* Recent Locations */}
        {history.recentLocations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {isArabic ? 'المواقع السابقة' : 'Previous Locations'}
              </h4>
              <ScrollArea className="h-[140px]">
                <div className="space-y-3">
                  {history.recentLocations.map((location, index) => (
                    <div 
                      key={index} 
                      className="flex items-start justify-between gap-3 text-sm bg-muted/50 p-3 rounded-lg border border-muted"
                    >
                      <div className="flex-1">
                        {location.name && (
                          <p className="font-medium">{location.name}</p>
                        )}
                        <p className="text-muted-foreground">{location.address}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {location.count}×
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Recent Reviews */}
        {history.specialistReviews.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                {isArabic ? 'التقييمات والتعليقات' : 'Reviews & Comments'}
              </h4>
              <ScrollArea className="h-[160px]">
                <div className="space-y-3">
                  {history.specialistReviews.map((review, index) => (
                    <div key={index} className="space-y-2 bg-muted/50 p-3 rounded-lg border border-muted">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {review.rating && renderStars(review.rating)}
                        </div>
                        {review.booking_date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(review.booking_date), 'dd/MM/yyyy', { 
                              locale: isArabic ? ar : undefined 
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {review.service_type}
                      </p>
                      {review.review && (
                        <p className="text-xs text-foreground">{review.review}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Recent Orders */}
        {history.recentOrders.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {isArabic ? 'الطلبات الأخيرة' : 'Recent Orders'}
              </h4>
              <ScrollArea className="h-[140px]">
                <div className="space-y-3">
                  {history.recentOrders.slice(0, 5).map((order) => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-lg border border-muted"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{order.service_type}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(order.created_at), 'dd/MM/yyyy', { 
                            locale: isArabic ? ar : undefined 
                          })}
                        </p>
                      </div>
                      <Badge 
                        variant={
                          order.status === 'completed' ? 'default' : 
                          order.status === 'cancelled' ? 'destructive' : 
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {isArabic 
                          ? order.status === 'completed' ? 'مكتمل' : 
                            order.status === 'cancelled' ? 'ملغي' : 
                            order.status === 'in-progress' ? 'جاري' : 
                            order.status === 'pending' ? 'قيد الانتظار' : order.status
                          : order.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
