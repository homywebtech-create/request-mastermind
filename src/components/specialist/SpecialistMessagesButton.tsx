import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSoundNotification } from "@/lib/soundNotification";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpecialistChatDialog } from "./SpecialistChatDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";

interface SpecialistMessagesButtonProps {
  specialistId: string;
  companyId: string;
}

interface ChatInfo {
  id: string;
  unread_count: number;
  company_id: string;
  last_message: string | null;
  last_message_at: string;
  companies: {
    name: string;
    logo_url: string | null;
  };
}

export function SpecialistMessagesButton({
  specialistId,
  companyId,
}: SpecialistMessagesButtonProps) {
  const { language } = useLanguage();
  const [totalUnread, setTotalUnread] = useState(0);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [showList, setShowList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<{
    specialistId: string;
    companyId: string;
    companyName: string;
    companyLogo: string | null;
  } | null>(null);
  const previousUnreadCount = useRef(0);

  useEffect(() => {
    fetchChats();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`specialist-messages-${specialistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "specialist_chats",
          filter: `specialist_id=eq.${specialistId}`,
        },
        () => {
          fetchChats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "specialist_chat_messages",
        },
        (payload: any) => {
          // Check if message is for this specialist and from company
          if (payload.new.sender_type === "company") {
            fetchChats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId]);

  const fetchChats = async () => {
    try {
      const { data: chatsData } = await supabase
        .from("specialist_chats")
        .select(`
          id,
          unread_count,
          company_id,
          last_message,
          last_message_at,
          companies (
            name,
            logo_url
          )
        `)
        .eq("specialist_id", specialistId)
        .order("last_message_at", { ascending: false });

      if (chatsData) {
        setChats(chatsData as any);
        const totalUnreadCount = chatsData.reduce(
          (sum, chat) => sum + (chat.unread_count || 0),
          0
        );

        // Check if there are new unread messages
        if (
          totalUnreadCount > previousUnreadCount.current &&
          previousUnreadCount.current > 0
        ) {
          // Play notification sound
          getSoundNotification().playNewQuoteSound();
        }

        previousUnreadCount.current = totalUnreadCount;
        setTotalUnread(totalUnreadCount);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return format(date, "h:mm a", { locale: language === "ar" ? ar : undefined });
    } else if (isYesterday(date)) {
      return language === "ar" ? "أمس" : "Yesterday";
    } else {
      return format(date, "MM/dd/yy", { locale: language === "ar" ? ar : undefined });
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.companies.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Button
        variant={totalUnread > 0 ? "default" : "outline"}
        size="sm"
        onClick={() => setShowList(true)}
        className={`relative ${
          totalUnread > 0
            ? "bg-green-600 hover:bg-green-700 text-white animate-pulse border-green-600 shadow-lg shadow-green-600/30"
            : "bg-background text-foreground hover:bg-accent"
        }`}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {language === "ar" ? "الرسائل" : "Messages"}
        {totalUnread > 0 && (
          <Badge
            variant="secondary"
            className="ml-2 bg-white text-green-700 font-bold"
          >
            {totalUnread}
          </Badge>
        )}
      </Button>

      <Dialog open={showList} onOpenChange={setShowList}>
        <DialogContent className="max-w-md max-h-[80vh] p-0">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="text-xl font-bold">
              {language === "ar" ? "الرسائل" : "Messages"}
            </DialogTitle>
          </DialogHeader>
          
          {/* Search Bar */}
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 max-h-[500px]">
            {filteredChats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? (
                  language === "ar" ? "لا توجد نتائج" : "No results found"
                ) : (
                  language === "ar" ? "لا توجد رسائل" : "No messages"
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChat({
                        specialistId,
                        companyId: chat.company_id,
                        companyName: chat.companies.name,
                        companyLogo: chat.companies.logo_url,
                      });
                      setShowList(false);
                      setSearchQuery("");
                    }}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-start gap-3 ${
                      chat.unread_count > 0 ? "bg-green-50 dark:bg-green-900/10" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={chat.companies.logo_url || undefined} alt={chat.companies.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {chat.companies.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {chat.companies.name}
                        </h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatMessageTime(chat.last_message_at)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${
                          chat.unread_count > 0 
                            ? "text-foreground font-medium" 
                            : "text-muted-foreground"
                        }`}>
                          {chat.last_message || (language === "ar" ? "لا توجد رسائل" : "No messages")}
                        </p>
                        {chat.unread_count > 0 && (
                          <Badge 
                            variant="default" 
                            className="bg-green-600 text-white flex-shrink-0 h-5 min-w-[20px] px-1.5 text-xs"
                          >
                            {chat.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedChat && (
        <SpecialistChatDialog
          open={!!selectedChat}
          onOpenChange={(open) => !open && setSelectedChat(null)}
          specialistId={selectedChat.specialistId}
          specialistName={language === "ar" ? "أنت" : "You"}
          companyId={selectedChat.companyId}
          companyName={selectedChat.companyName}
          specialistImage={selectedChat.companyLogo || undefined}
          isSpecialistView={true}
        />
      )}
    </>
  );
}
