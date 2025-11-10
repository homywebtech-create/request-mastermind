import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Settings, Wallet } from "lucide-react";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import BusyGuard from "@/components/specialist/BusyGuard";
import { SpecialistChatDialog } from "@/components/specialist/SpecialistChatDialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { getSoundNotification } from "@/lib/soundNotification";
import { useSpecialistCompanyCountry } from "@/hooks/useCompanyCountry";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";

interface ChatInfo {
  id: string;
  unread_count: number;
  company_id: string;
  last_message: string | null;
  last_message_at: string | null;
  companies: {
    id: string;
    name: string;
    name_en: string | null;
    logo_url: string | null;
  };
}

export default function SpecialistMessages() {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<{ companyId: string; companyName: string; companyNameEn: string | null; companyLogo: string | null } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const isAr = language === 'ar';
  const { currencySymbol, isLoading: currencyLoading } = useSpecialistCompanyCountry(specialistId);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    fetchChats();
    fetchNewOrdersCount(specialistId);

    const channel = supabase
      .channel('specialist-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'specialist_chats',
          filter: `specialist_id=eq.${specialistId}`
        },
        () => {
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'specialist_chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.sender_type === 'company') {
            const soundNotif = getSoundNotification();
            soundNotif.playNewOrderSound();
          }
          fetchChats();
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
        .select('full_name, phone, user_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSpecialistName(profile.full_name);
        
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id, name, phone, company_id')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          setSpecialistId(specialist.id);
          if (specialist.company_id) {
            setCompanyId(specialist.company_id);
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      const { data: chatsData, error } = await supabase
        .from('specialist_chats')
        .select(`
          id,
          unread_count,
          company_id,
          last_message,
          last_message_at,
          companies (
            id,
            name,
            name_en,
            logo_url
          )
        `)
        .eq('specialist_id', specialistId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setChats(chatsData || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "فشل تحميل المحادثات" : "Failed to load chats",
        variant: "destructive",
      });
    }
  };

  const fetchNewOrdersCount = async (specId: string) => {
    try {
      const now = new Date().toISOString();
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          id,
          order_id,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specId)
        .is('quoted_price', null)
        .is('rejected_at', null);

      if (!orderSpecialists) {
        setNewOrdersCount(0);
        return;
      }

      const validOrders = orderSpecialists.filter((os: any) => {
        const expiresAt = os.orders?.expires_at;
        if (!expiresAt) return true;
        return new Date(expiresAt) > new Date(now);
      });

      setNewOrdersCount(validOrders.length);
    } catch (error) {
      console.error('Error fetching new orders count:', error);
      setNewOrdersCount(0);
    }
  };

  const formatMessageTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const locale = isAr ? ar : undefined;
    
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale });
    } else if (isYesterday(date)) {
      return isAr ? 'أمس' : 'Yesterday';
    } else {
      return format(date, 'dd/MM/yy', { locale });
    }
  };

  const filteredChats = chats.filter(chat => {
    const companyName = isAr ? chat.companies.name : (chat.companies.name_en || chat.companies.name);
    return companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.last_message && chat.last_message.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-purple-700">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white font-medium">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <BusyGuard specialistId={specialistId} allowWhenBusy={false}>
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-purple-700 pb-24">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white shadow-lg">
          <div className="w-full px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold mb-0.5 drop-shadow-lg truncate">
                  {isAr ? 'مرحباً' : 'Welcome'}, {specialistName.split(' ')[0]}
                </h1>
                <p className="text-xs sm:text-sm opacity-90 font-medium">
                  {isAr ? '💬 محادثاتك' : '💬 Your Messages'}
                </p>
              </div>
              
              {/* Wallet Display and Settings Button */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Wallet Display */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/30">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="h-4 w-4" />
                    <div className="text-right">
                      <p className="text-[10px] opacity-80 leading-none">{t.specialist.wallet}</p>
                      <p className="text-sm font-bold leading-tight">
                        {currencyLoading ? '...' : `0 ${currencySymbol}`}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings Button */}
                <Button
                  onClick={() => navigate('/specialist/profile')}
                  variant="secondary"
                  size="sm"
                  className="h-10 w-10 p-0"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="w-full px-3 py-3 sm:px-4 sm:py-4 max-w-screen-lg mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={isAr ? "ابحث في المحادثات..." : "Search chats..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 bg-white/90 backdrop-blur-sm border-white/30"
            />
          </div>
        </div>

        {/* Chats List */}
        <div className="w-full px-3 pb-3 sm:px-4 sm:pb-4 max-w-screen-lg mx-auto">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {filteredChats.length === 0 ? (
              <Card className="p-8 text-center bg-white/90 backdrop-blur-sm border-white/30">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-purple-600 opacity-70" />
                <p className="text-lg font-medium text-foreground">
                  {isAr ? 'لا توجد محادثات حالياً' : 'No chats yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {isAr ? 'ستظهر محادثاتك هنا' : 'Your chats will appear here'}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredChats.map((chat, index) => {
                  const companyName = isAr ? chat.companies.name : (chat.companies.name_en || chat.companies.name);
                  return (
                    <Card
                      key={chat.id}
                      className={`p-3 cursor-pointer transition-all bg-white/90 backdrop-blur-sm border-white/30 hover:bg-white hover:shadow-lg animate-fade-in ${
                        chat.unread_count > 0 ? 'bg-green-50/90 border-green-300 shadow-md' : ''
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => setSelectedChat({
                        companyId: chat.company_id,
                        companyName: chat.companies.name,
                        companyNameEn: chat.companies.name_en,
                        companyLogo: chat.companies.logo_url
                      })}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={chat.companies.logo_url || undefined} alt={companyName} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {companyName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-sm truncate">{companyName}</h3>
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(chat.last_message_at)}
                            </span>
                          </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">
                            {chat.last_message || (isAr ? 'لا توجد رسائل' : 'No messages')}
                          </p>
                          {chat.unread_count > 0 && (
                            <Badge variant="default" className="ml-2 bg-green-600">
                              {chat.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Dialog */}
        {selectedChat && (
          <SpecialistChatDialog
            open={!!selectedChat}
            onOpenChange={(open) => !open && setSelectedChat(null)}
            specialistId={specialistId}
            specialistName={specialistName}
            companyId={selectedChat.companyId}
            companyName={selectedChat.companyName}
            companyNameEn={selectedChat.companyNameEn}
            isSpecialistView={true}
          />
        )}

        <BottomNavigation newOrdersCount={newOrdersCount} specialistId={specialistId} />
      </div>
    </BusyGuard>
  );
}
