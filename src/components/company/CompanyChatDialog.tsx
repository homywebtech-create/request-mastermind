import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CompanyChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  companyPhone?: string;
  companyLogo?: string;
  adminName?: string; // Name of admin user for display in chat
  isAdminView?: boolean; // If true, this is admin viewing, if false/undefined, company viewing
}

interface Message {
  id: string;
  message: string;
  sender_type: "admin" | "company";
  created_at: string;
  is_read: boolean;
}

export function CompanyChatDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  companyPhone,
  companyLogo,
  adminName,
  isAdminView = false,
}: CompanyChatDialogProps) {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      initializeChat();
    }
  }, [open, companyId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "company_chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const initializeChat = async () => {
    try {
      setLoading(true);

      // Check if chat exists
      let { data: existingChat } = await supabase
        .from("company_chats")
        .select("*")
        .eq("company_id", companyId)
        .single();

      if (!existingChat) {
        // Create new chat
        const { data: newChat, error: chatError } = await supabase
          .from("company_chats")
          .insert({ company_id: companyId })
          .select()
          .single();

        if (chatError) throw chatError;
        existingChat = newChat;
      }

      setChatId(existingChat.id);

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("company_chat_messages")
        .select("*")
        .eq("chat_id", existingChat.id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((messagesData as Message[]) || []);

      // Mark messages as read based on who is viewing
      if (isAdminView) {
        // Admin is viewing - mark company messages as read
        await supabase
          .from("company_chat_messages")
          .update({ is_read: true })
          .eq("chat_id", existingChat.id)
          .eq("sender_type", "company")
          .eq("is_read", false);

        // Reset unread count when admin opens chat
        await supabase
          .from("company_chats")
          .update({ unread_count: 0 })
          .eq("id", existingChat.id);
      } else {
        // Company is viewing - mark admin messages as read
        await supabase
          .from("company_chat_messages")
          .update({ is_read: true })
          .eq("chat_id", existingChat.id)
          .eq("sender_type", "admin")
          .eq("is_read", false);
      }


    } catch (error) {
      console.error("Error initializing chat:", error);
      toast.error(language === "ar" ? "فشل تحميل المحادثة" : "Failed to load chat");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId || sending) return;

    try {
      setSending(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const senderType = isAdminView ? "admin" : "company";

      const { error: messageError } = await supabase
        .from("company_chat_messages")
        .insert({
          chat_id: chatId,
          sender_type: senderType,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (messageError) throw messageError;

      // Update chat last message
      // If company is sending, increment unread count for admin
      if (isAdminView) {
        // Admin sending - just update last message, unread stays 0
        await supabase
          .from("company_chats")
          .update({
            last_message: newMessage.trim(),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", chatId);
      } else {
        // Company sending - increment unread count for admin
        const { data: currentChat } = await supabase
          .from("company_chats")
          .select("unread_count")
          .eq("id", chatId)
          .single();

        await supabase
          .from("company_chats")
          .update({
            last_message: newMessage.trim(),
            last_message_at: new Date().toISOString(),
            unread_count: (currentChat?.unread_count || 0) + 1,
          })
          .eq("id", chatId);
      }

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(language === "ar" ? "فشل إرسال الرسالة" : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={companyLogo} alt={companyName} />
              <AvatarFallback>{companyName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span>{companyName}</span>
              {companyPhone && (
                <span className="text-xs text-muted-foreground font-normal">
                  {companyPhone}
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 rounded-lg">
          {loading ? (
            <div className="text-center text-muted-foreground">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              {language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = isAdminView 
                ? msg.sender_type === "admin" 
                : msg.sender_type === "company";
              
              const senderName = isCurrentUser 
                ? (isAdminView 
                    ? (adminName ? `MOBO - ${adminName}` : "MOBO Technology") 
                    : companyName)
                : (isAdminView 
                    ? companyName 
                    : (adminName ? `MOBO - ${adminName}` : "MOBO Technology"));
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={companyLogo} alt={senderName} />
                      <AvatarFallback>{senderName[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-1">
                    {!isCurrentUser && (
                      <span className="text-xs text-muted-foreground px-1">
                        {senderName}
                      </span>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isCurrentUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_at), "PPp", {
                          locale: language === "ar" ? ar : undefined,
                        })}
                      </p>
                    </div>
                  </div>
                  {isCurrentUser && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={companyLogo} alt={senderName} />
                      <AvatarFallback>{senderName[0]}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."
            }
            className="min-h-[80px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}