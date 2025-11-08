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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { getSoundNotification } from "@/lib/soundNotification";

interface SpecialistChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialistId: string;
  specialistName: string;
  specialistPhone?: string;
  specialistImage?: string;
  companyId: string;
  companyName?: string;
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
  specialistPhone,
  specialistImage,
  companyId,
  companyName,
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
          const newMessage = payload.new as Message;
          setMessages((current) => [...current, newMessage]);
          
          // Play sound for received messages
          const isReceivedMessage = isSpecialistView 
            ? newMessage.sender_type === "company" 
            : newMessage.sender_type === "specialist";
          
          if (isReceivedMessage) {
            getSoundNotification().playReceivedMessageSound();
          }
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
      
      // Play sound for sent message
      getSoundNotification().playSentMessageSound();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(language === "ar" ? "فشل إرسال الرسالة" : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    try {
      setSending(true);
      
      const audioMessage = `[${language === "ar" ? "رسالة صوتية" : "Voice message"}]`;
      
      if (!chatId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const senderType = isSpecialistView ? "specialist" : "company";

      const { error: messageError } = await supabase
        .from("specialist_chat_messages")
        .insert({
          chat_id: chatId,
          sender_type: senderType,
          sender_id: user.id,
          message: audioMessage,
        });

      if (messageError) throw messageError;

      // Update chat last message
      if (isSpecialistView) {
        await supabase
          .from("specialist_chats")
          .update({
            last_message: audioMessage,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", chatId);
      } else {
        const { data: currentChat } = await supabase
          .from("specialist_chats")
          .select("unread_count")
          .eq("id", chatId)
          .single();

        await supabase
          .from("specialist_chats")
          .update({
            last_message: audioMessage,
            last_message_at: new Date().toISOString(),
            unread_count: (currentChat?.unread_count || 0) + 1,
          })
          .eq("id", chatId);
      }

      // Play sound for sent message
      getSoundNotification().playSentMessageSound();
      
      toast.success(
        language === "ar" 
          ? "تم إرسال الرسالة الصوتية" 
          : "Voice message sent"
      );
    } catch (error) {
      console.error("Error sending voice message:", error);
      toast.error(
        language === "ar" 
          ? "فشل إرسال الرسالة الصوتية" 
          : "Failed to send voice message"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90dvh] sm:h-[600px] flex flex-col p-0 pb-safe">
        <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={specialistImage} alt={specialistName} />
              <AvatarFallback>{specialistName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span>
                {isSpecialistView 
                  ? (companyName || (language === "ar" ? "الشركة" : "Company"))
                  : specialistName}
              </span>
              {specialistPhone && !isSpecialistView && (
                <span className="text-xs text-muted-foreground font-normal">
                  {specialistPhone}
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-4 bg-muted/30">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isCurrentUser = isSpecialistView
                  ? msg.sender_type === "specialist"
                  : msg.sender_type === "company";

                const senderName = isCurrentUser
                  ? (isSpecialistView ? specialistName : (companyName || (language === "ar" ? "الشركة" : "Company")))
                  : (isSpecialistView ? (companyName || (language === "ar" ? "الشركة" : "Company")) : specialistName);

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 mb-4 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isCurrentUser && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarImage src={specialistImage} alt={senderName} />
                        <AvatarFallback>{senderName[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      {!isCurrentUser && (
                        <span className="text-xs text-muted-foreground px-1">
                          {senderName}
                        </span>
                      )}
                      <div
                        className={`rounded-lg p-3 ${
                          isCurrentUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
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
                    {isCurrentUser && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarImage src={specialistImage} alt={senderName} />
                        <AvatarFallback>{senderName[0]}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </ScrollArea>

        <div className="flex gap-2 p-4 pt-3 border-t bg-background flex-shrink-0">
          <div className="flex-1 flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."
              }
              className="min-h-[60px] max-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="flex flex-col gap-2 flex-shrink-0">
              <VoiceRecorder 
                onRecordingComplete={handleVoiceRecording} 
                disabled={sending}
              />
              <Button 
                onClick={sendMessage} 
                disabled={!newMessage.trim() || sending} 
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
