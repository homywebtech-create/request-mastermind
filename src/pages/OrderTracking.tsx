import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Share2, CheckCircle, Play, Pause, AlertTriangle, Phone, XCircle, FileText, Clock, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Stage = 'moving' | 'arrived' | 'working' | 'completed';

interface Order {
  id: string;
  service_type: string;
  notes: string | null;
  booking_date: string | null;
  hours_count: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  building_info: string | null;
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
  } | null;
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [stage, setStage] = useState<Stage>('moving');
  const [movingTimer, setMovingTimer] = useState(60); // 60 seconds
  const [arrivedTimer, setArrivedTimer] = useState(60); // 60 seconds
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [workingTime, setWorkingTime] = useState(0);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Timer for moving stage (60 seconds countdown)
  useEffect(() => {
    if (stage === 'moving' && movingTimer > 0) {
      const timer = setInterval(() => {
        setMovingTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, movingTimer]);

  // Timer for arrived stage (60 seconds countdown)
  useEffect(() => {
    if (stage === 'arrived' && arrivedTimer > 0) {
      const timer = setInterval(() => {
        setArrivedTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, arrivedTimer]);

  // Timer for working stage (count up)
  useEffect(() => {
    if (stage === 'working' && !isPaused) {
      const timer = setInterval(() => {
        setWorkingTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, isPaused]);

  // Calculate total work seconds from hours_count
  useEffect(() => {
    if (order?.hours_count) {
      const hours = parseFloat(order.hours_count);
      setTotalWorkSeconds(hours * 3600); // Convert hours to seconds
    }
  }, [order]);

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          service_type,
          notes,
          booking_date,
          hours_count,
          gps_latitude,
          gps_longitude,
          building_info,
          customer:customers (
            name,
            whatsapp_number,
            area
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات الطلب",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openMaps = () => {
    if (!order?.gps_latitude || !order?.gps_longitude) {
      toast({
        title: "خطأ",
        description: "موقع العميل غير متوفر",
        variant: "destructive",
      });
      return;
    }

    // Open maps with coordinates - will open in default map app on phone
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${order.gps_latitude},${order.gps_longitude}`;
    window.open(mapsUrl, '_blank');
  };

  const getMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          toast({
            title: "تم الحصول على الموقع",
            description: `خط العرض: ${position.coords.latitude.toFixed(4)}, خط الطول: ${position.coords.longitude.toFixed(4)}`,
          });
        },
        (error) => {
          toast({
            title: "خطأ",
            description: "فشل في الحصول على موقعك",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "خطأ",
        description: "المتصفح لا يدعم خدمة الموقع",
        variant: "destructive",
      });
    }
  };

  const shareLocation = async () => {
    if (navigator.share && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await navigator.share({
              title: 'موقعي الحالي',
              text: `موقعي: https://www.google.com/maps/search/?api=1&query=${position.coords.latitude},${position.coords.longitude}`,
            });
          } catch (error) {
            console.error('Error sharing:', error);
          }
        },
        () => {
          toast({
            title: "خطأ",
            description: "فشل في الحصول على موقعك",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "خطأ",
        description: "المشاركة غير متاحة على هذا الجهاز",
        variant: "destructive",
      });
    }
  };

  const handleArrived = () => {
    setStage('arrived');
    toast({
      title: "تم التأكيد",
      description: "تم تسجيل وصولك إلى الموقع",
    });
  };

  const handleStartWork = () => {
    setStage('working');
    toast({
      title: "بدء العمل",
      description: "تم بدء عداد الوقت",
    });
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "استئناف العمل" : "إيقاف مؤقت",
      description: isPaused ? "تم استئناف العمل" : "تم إيقاف العمل مؤقتاً",
    });
  };

  const handleEmergency = () => {
    // Get company phone from order - in real app, this would come from order data
    toast({
      title: "الاتصال بالطوارئ",
      description: "سيتم الاتصال بالشركة الآن",
    });
    // In real implementation, call the company
  };

  const handleCancelWork = () => {
    if (!cancelReason) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار سبب الإلغاء",
        variant: "destructive",
      });
      return;
    }

    if (cancelReason === 'other' && !otherReason.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى كتابة السبب",
        variant: "destructive",
      });
      return;
    }

    // Handle cancellation
    toast({
      title: "تم إلغاء العمل",
      description: "تم تسجيل الإلغاء بنجاح",
    });
    setShowCancelDialog(false);
    navigate(-1);
  };

  const handleRequestInvoice = () => {
    toast({
      title: "طلب الفاتورة",
      description: "تم إرسال طلب الفاتورة للإدارة",
    });
    navigate(-1);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">الطلب غير موجود</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Order Info Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">{order.customer?.name}</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">الخدمة:</span> {order.service_type}</p>
            <p><span className="font-semibold">المنطقة:</span> {order.customer?.area}</p>
            <p><span className="font-semibold">عدد الساعات:</span> {order.hours_count}</p>
          </div>
        </Card>

        {/* Moving Stage */}
        {stage === 'moving' && (
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-6">الانتقال إلى العميل</h3>
            
            <Button onClick={openMaps} className="w-full" size="lg">
              <Navigation className="ml-2 h-5 w-5" />
              فتح الخريطة
            </Button>

            <Button onClick={getMyLocation} variant="outline" className="w-full" size="lg">
              <MapPin className="ml-2 h-5 w-5" />
              الحصول على موقعي الحالي
            </Button>

            <Button onClick={shareLocation} variant="outline" className="w-full" size="lg">
              <Share2 className="ml-2 h-5 w-5" />
              مشاركة موقعي
            </Button>

            <div className="pt-4 border-t">
              <Button
                onClick={handleArrived}
                disabled={movingTimer > 0}
                className="w-full"
                size="lg"
                variant={movingTimer > 0 ? "secondary" : "default"}
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                وصلت إلى المكان
                {movingTimer > 0 && (
                  <span className="mr-2 text-sm">({movingTimer}s)</span>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Arrived Stage */}
        {stage === 'arrived' && (
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-6">وصلت إلى الموقع</h3>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">عنوان العميل:</p>
                  <p className="text-sm text-muted-foreground">{order.building_info || 'لا توجد تفاصيل'}</p>
                </div>
              </div>
            </div>

            <Button onClick={openMaps} variant="outline" className="w-full">
              <Navigation className="ml-2 h-5 w-5" />
              عرض الموقع على الخريطة
            </Button>

            <div className="pt-4 border-t">
              <Button
                onClick={handleStartWork}
                disabled={arrivedTimer > 0}
                className="w-full"
                size="lg"
                variant={arrivedTimer > 0 ? "secondary" : "default"}
              >
                <Play className="ml-2 h-5 w-5" />
                بدء العمل
                {arrivedTimer > 0 && (
                  <span className="mr-2 text-sm">({arrivedTimer}s)</span>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Working Stage */}
        {stage === 'working' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">جاري العمل</h3>
            
            {/* Work Timer */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">
                {formatTime(workingTime)}
              </div>
              <div className="text-sm text-muted-foreground">
                من أصل {formatTime(totalWorkSeconds)}
              </div>
              {workingTime >= totalWorkSeconds && (
                <div className="text-sm font-semibold text-green-600">
                  ⏰ انتهى الوقت المحدد
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min((workingTime / totalWorkSeconds) * 100, 100)}%` }}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={togglePause}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isPaused ? (
                  <>
                    <Play className="ml-2 h-5 w-5" />
                    استئناف العمل
                  </>
                ) : (
                  <>
                    <Pause className="ml-2 h-5 w-5" />
                    إيقاف مؤقت
                  </>
                )}
              </Button>

              <Button
                onClick={handleEmergency}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="ml-2 h-5 w-5" />
                طوارئ - الاتصال بالشركة
              </Button>

              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-white">
                    <XCircle className="ml-2 h-5 w-5" />
                    إلغاء العمل
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>سبب الإلغاء</DialogTitle>
                    <DialogDescription>
                      يرجى اختيار سبب إلغاء العمل
                    </DialogDescription>
                  </DialogHeader>
                  <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="customer_requested" id="customer_requested" />
                      <Label htmlFor="customer_requested">العميل طلب الإلغاء</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="not_family" id="not_family" />
                      <Label htmlFor="not_family">العميل ليس عائلة</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other">أسباب أخرى</Label>
                    </div>
                  </RadioGroup>
                  
                  {cancelReason === 'other' && (
                    <div className="space-y-2">
                      <Label htmlFor="other_reason">اكتب السبب</Label>
                      <Textarea
                        id="other_reason"
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder="اكتب سبب الإلغاء هنا..."
                        rows={4}
                      />
                    </div>
                  )}
                  
                  <Button onClick={handleCancelWork} variant="destructive" className="w-full">
                    تأكيد الإلغاء
                  </Button>
                </DialogContent>
              </Dialog>

              {workingTime >= totalWorkSeconds && (
                <Button
                  onClick={handleRequestInvoice}
                  className="w-full"
                  size="lg"
                >
                  <FileText className="ml-2 h-5 w-5" />
                  طلب الفاتورة
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Back Button */}
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="w-full"
        >
          العودة
        </Button>
      </div>
    </div>
  );
}
