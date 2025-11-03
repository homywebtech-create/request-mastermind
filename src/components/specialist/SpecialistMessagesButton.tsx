import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
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
  const [selectedChat, setSelectedChat] = useState<{
    specialistId: string;
    companyId: string;
    companyName: string;
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
            name
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowList(true)}
        className={`relative ${
          totalUnread > 0
            ? "bg-green-600 hover:bg-green-700 text-white animate-pulse border-green-600"
            : ""
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "الرسائل" : "Messages"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {chats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد رسائل" : "No messages"}
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChat({
                        specialistId,
                        companyId: chat.company_id,
                        companyName: chat.companies.name,
                      });
                      setShowList(false);
                    }}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      chat.unread_count > 0 ? "bg-green-50 dark:bg-green-900/10 border-green-600" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{chat.companies.name}</h3>
                      {chat.unread_count > 0 && (
                        <Badge variant="default" className="bg-green-600">
                          {chat.unread_count}
                        </Badge>
                      )}
                    </div>
                    {chat.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.last_message}
                      </p>
                    )}
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
          isSpecialistView={true}
        />
      )}
    </>
  );
}
