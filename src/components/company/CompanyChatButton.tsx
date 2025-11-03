import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyChatDialog } from "./CompanyChatDialog";
import { getSoundNotification } from "@/lib/soundNotification";
import { useLanguage } from "@/hooks/useLanguage";

interface CompanyChatButtonProps {
  companyId: string;
  companyName: string;
}

export function CompanyChatButton({ companyId, companyName }: CompanyChatButtonProps) {
  const { language } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const previousUnreadCount = useRef(0);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to realtime changes for company chats
    const channel = supabase
      .channel(`company-chat-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_chats",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "company_chat_messages",
        },
        (payload: any) => {
          // Check if message is for this company and from admin
          if (payload.new.sender_type === "admin") {
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchUnreadCount = async () => {
    try {
      // First get the chat for this company
      const { data: chatData } = await supabase
        .from("company_chats")
        .select("id, unread_count")
        .eq("company_id", companyId)
        .single();

      if (!chatData) return;

      // Count unread messages where sender is admin
      const { count } = await supabase
        .from("company_chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chatData.id)
        .eq("sender_type", "admin")
        .eq("is_read", false);

      const newUnreadCount = count || 0;
      
      // Check if there are new unread messages
      if (newUnreadCount > previousUnreadCount.current && previousUnreadCount.current > 0) {
        // Play notification sound
        getSoundNotification().playNewQuoteSound();
      }

      previousUnreadCount.current = newUnreadCount;
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  return (
    <>
      <Button
        size="lg"
        onClick={() => setIsOpen(true)}
        className={`relative ${
          unreadCount > 0
            ? "bg-destructive hover:bg-destructive/90 animate-pulse shadow-lg shadow-destructive/30"
            : "bg-primary hover:bg-primary/90"
        }`}
      >
        <MessageSquare className="h-5 w-5 mr-2" />
        {language === "ar" ? "الدعم الفني" : "Support Chat"}
        {unreadCount > 0 && (
          <Badge 
            variant="secondary" 
            className="ml-2 animate-bounce bg-white text-destructive font-bold"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      <CompanyChatDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        companyId={companyId}
        companyName={companyName}
      />
    </>
  );
}
