import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, DollarSign, Package } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import LanguageSelector from "@/components/specialist/LanguageSelector";

interface Stats {
  totalOrders: number;
  acceptedOrders: number;
  rejectedOrders: number;
  quotedOrders: number;
  skippedOrders: number;
  newOrders: number;
}

export default function SpecialistStats() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    acceptedOrders: 0,
    rejectedOrders: 0,
    quotedOrders: 0,
    skippedOrders: 0,
    newOrders: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('ar');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    fetchStats(specialistId);

    const channel = supabase
      .channel('specialist-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        () => {
          fetchStats(specialistId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSpecialistName(profile.full_name);
        
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id, preferred_language, is_active, suspension_type')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          // Check for PERMANENT suspension - force logout
          if (!specialist.is_active && specialist.suspension_type === 'permanent') {
            console.log('🚫 [PERMANENT SUSPENSION] Logging out specialist');
            await supabase.auth.signOut();
            toast({
              title: "حساب موقوف نهائياً 🚫",
              description: 'تم إيقاف حسابك بشكل نهائي. للمزيد من المعلومات، يرجى مراجعة الإدارة.',
              variant: "destructive",
              duration: 10000,
            });
            navigate('/specialist-auth');
            return;
          }

          setSpecialistId(specialist.id);
          setPreferredLanguage(specialist.preferred_language || 'ar');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchStats = async (specId: string) => {
    try {
      setIsLoading(true);
      const now = new Date().toISOString();

      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          *,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specId);

      if (!orderSpecialists) {
        setIsLoading(false);
        return;
      }

      // Filter for new orders (not expired, no quote, not rejected)
      const newOrders = orderSpecialists.filter((os: any) => {
        if (os.quoted_price || os.rejected_at) return false;
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true;
        return new Date(expiresAt) > new Date(now);
      }).length;

      const quotedOrders = orderSpecialists.filter(os => 
        os.quoted_price && os.is_accepted === null
      ).length;

      const acceptedOrders = orderSpecialists.filter(os => 
        os.is_accepted === true
      ).length;

      const rejectedOrders = orderSpecialists.filter(os => 
        os.is_accepted === false && 
        os.quoted_price &&
        os.rejection_reason !== 'Skipped by specialist'
      ).length;

      const skippedOrders = orderSpecialists.filter(os => 
        os.is_accepted === false && 
        os.rejection_reason === 'Skipped by specialist'
      ).length;

      setStats({
        totalOrders: orderSpecialists.length,
        newOrders,
        quotedOrders,
        acceptedOrders,
        rejectedOrders,
        skippedOrders
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الإحصائيات",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-foreground font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "العروض الجديدة",
      value: stats.newOrders,
      icon: Package,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "عروض مقدمة",
      value: stats.quotedOrders,
      icon: DollarSign,
      color: "from-yellow-500 to-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
      textColor: "text-yellow-600 dark:text-yellow-400"
    },
    {
      title: "طلبات مقبولة",
      value: stats.acceptedOrders,
      icon: CheckCircle,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      textColor: "text-green-600 dark:text-green-400"
    },
    {
      title: "عروض مرفوضة",
      value: stats.rejectedOrders,
      icon: XCircle,
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      textColor: "text-red-600 dark:text-red-400"
    },
    {
      title: "عروض متجاوزة",
      value: stats.skippedOrders,
      icon: Clock,
      color: "from-gray-500 to-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-950/30",
      textColor: "text-gray-600 dark:text-gray-400"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">الإحصائيات</h1>
              <p className="text-sm opacity-90">إجمالي الطلبات: {stats.totalOrders}</p>
            </div>
            {specialistId && (
              <LanguageSelector 
                specialistId={specialistId} 
                currentLanguage={preferredLanguage}
                onLanguageChange={(lang) => setPreferredLanguage(lang)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card 
              key={index}
              className="overflow-hidden hover:shadow-lg transition-all bg-white/90 backdrop-blur-sm border-white/30 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`h-2 w-full bg-gradient-to-r ${card.color}`} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${card.bgColor}`}>
                      <Icon className={`h-6 w-6 ${card.textColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                      <p className="text-3xl font-bold text-foreground">{card.value}</p>
                    </div>
                  </div>
                  <div className={`text-5xl font-bold opacity-10 ${card.textColor}`}>
                    {card.value}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Total Summary */}
        <Card className="bg-white/90 backdrop-blur-sm border-white/30 shadow-lg animate-fade-in" style={{ animationDelay: `${statCards.length * 100}ms` }}>
          <div className="p-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground font-medium">إجمالي الطلبات</p>
              <p className="text-5xl font-bold text-primary">{ stats.totalOrders}</p>
              <p className="text-xs text-muted-foreground">منذ بداية العمل</p>
            </div>
          </div>
        </Card>
      </div>

      <BottomNavigation newOrdersCount={stats.newOrders} />
    </div>
  );
}
