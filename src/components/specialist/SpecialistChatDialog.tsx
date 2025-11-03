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
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface SpecialistChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialistId: string;
  specialistName: string;
  companyId: string;
  isSpecialistView?: boolean; // true if specialist is viewing, false if company is viewing
}

interface Message {
  id: string;
  message: string;
  sender_type: "company" | "specialist";
  created_at: string;
  is_read: boolean;
}

export function SpecialistChatDialog({
  open,
  onOpenChange,
  specialistId,
  specialistName,
  companyId,
  isSpecialistView = false,
}: SpecialistChatDialogProps) {
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
  }, [open, specialistId, companyId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`specialist-chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "specialist_chat_messages",
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
        .from("specialist_chats")
        .select("*")
        .eq("company_id", companyId)
        .eq("specialist_id", specialistId)
        .single();

      if (!existingChat) {
        // Create new chat
        const { data: newChat, error: chatError } = await supabase
          .from("specialist_chats")
          .insert({
            company_id: companyId,
            specialist_id: specialistId,
          })
          .select()
          .single();

        if (chatError) throw chatError;
        existingChat = newChat;
      }

      setChatId(existingChat.id);

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("specialist_chat_messages")
        .select("*")
        .eq("chat_id", existingChat.id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((messagesData as Message[]) || []);

      // Mark messages as read based on who is viewing
      if (isSpecialistView) {
        // Specialist is viewing - mark company messages as read
        await supabase
          .from("specialist_chat_messages")
          .update({ is_read: true })
          .eq("chat_id", existingChat.id)
          .eq("sender_type", "company")
          .eq("is_read", false);

        // Reset unread count when specialist opens chat
        await supabase
          .from("specialist_chats")
          .update({ unread_count: 0 })
          .eq("id", existingChat.id);
      } else {
        // Company is viewing - mark specialist messages as read
        await supabase
          .from("specialist_chat_messages")
          .update({ is_read: true })
          .eq("chat_id", existingChat.id)
          .eq("sender_type", "specialist")
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

      const senderType = isSpecialistView ? "specialist" : "company";

      const { error: messageError } = await supabase
        .from("specialist_chat_messages")
        .insert({
          chat_id: chatId,
          sender_type: senderType,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (messageError) throw messageError;

      // Update chat last message
      // If specialist is sending, increment unread count for company
      if (isSpecialistView) {
        // Specialist sending - just update last message
        await supabase
          .from("specialist_chats")
          .update({
            last_message: newMessage.trim(),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", chatId);
      } else {
        // Company sending - increment unread count for specialist
        const { data: currentChat } = await supabase
          .from("specialist_chats")
          .select("unread_count")
          .eq("id", chatId)
          .single();

        await supabase
          .from("specialist_chats")
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
          <DialogTitle>
            {language === "ar"
              ? `محادثة مع ${specialistName}`
              : `Chat with ${specialistName}`}
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
              const isCurrentUser = isSpecialistView
                ? msg.sender_type === "specialist"
                : msg.sender_type === "company";

              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isCurrentUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isCurrentUser
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(new Date(msg.created_at), "PPp", {
                        locale: language === "ar" ? ar : undefined,
                      })}
                    </p>
                  </div>
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
