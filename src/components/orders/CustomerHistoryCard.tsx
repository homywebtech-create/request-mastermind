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
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          {isArabic ? 'معلومات العميل السابقة' : 'Customer History'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Basic Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{history.customer.name}</span>
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
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <Package className="h-4 w-4" />
              <span className="text-lg font-bold">{history.totalOrders}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? 'إجمالي الطلبات' : 'Total Orders'}
            </p>
          </div>
          
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-lg font-bold">{history.completedOrders}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? 'مكتملة' : 'Completed'}
            </p>
          </div>
          
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1">
              {history.averageRating ? (
                <>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-bold">
                    {history.averageRating.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-muted-foreground">-</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? 'التقييم' : 'Rating'}
            </p>
          </div>
        </div>

        {history.cancelledOrders > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
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
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {isArabic ? 'المواقع السابقة' : 'Previous Locations'}
              </h4>
              <ScrollArea className="h-[100px]">
                <div className="space-y-2">
                  {history.recentLocations.map((location, index) => (
                    <div 
                      key={index} 
                      className="flex items-start justify-between gap-2 text-xs bg-muted/50 p-2 rounded"
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
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                {isArabic ? 'التقييمات والتعليقات' : 'Reviews & Comments'}
              </h4>
              <ScrollArea className="h-[120px]">
                <div className="space-y-3">
                  {history.specialistReviews.map((review, index) => (
                    <div key={index} className="space-y-1 bg-muted/50 p-2 rounded">
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
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {isArabic ? 'الطلبات الأخيرة' : 'Recent Orders'}
              </h4>
              <ScrollArea className="h-[100px]">
                <div className="space-y-2">
                  {history.recentOrders.slice(0, 5).map((order) => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded"
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
