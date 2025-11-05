import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";

interface TranslateButtonProps {
  text: string;
  onTranslated: (translatedText: string) => void;
  sourceLanguage?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function TranslateButton({ 
  text, 
  onTranslated, 
  sourceLanguage = 'ar', 
  className = "",
  size = "sm"
}: TranslateButtonProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  
  const handleTranslate = async () => {
    if (!text || text.trim() === '') {
      toast({
        title: language === 'ar' ? "لا يوجد نص للترجمة" : "No text to translate",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-order', {
        body: {
          text: text,
          targetLanguage: language,
          sourceLanguage: sourceLanguage
        }
      });

      if (error) {
        console.error('Translation error:', error);
        throw error;
      }

      if (data?.translatedText) {
        onTranslated(data.translatedText);
        toast({
          title: language === 'ar' ? "✅ تمت الترجمة" : "✅ Translated",
          description: language === 'ar' ? "تم ترجمة النص بنجاح" : "Text translated successfully",
        });
      }
    } catch (error) {
      console.error('Failed to translate:', error);
      toast({
        title: language === 'ar' ? "❌ خطأ في الترجمة" : "❌ Translation Error",
        description: language === 'ar' 
          ? "فشلت الترجمة. يرجى المحاولة مرة أخرى" 
          : "Translation failed. Please try again",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // Don't show translate button if source and target languages are the same
  if (sourceLanguage === language) {
    return null;
  }

  return (
    <Button
      onClick={handleTranslate}
      disabled={isTranslating}
      size={size}
      variant="ghost"
      className={`gap-1.5 ${className}`}
    >
      {isTranslating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Languages className="h-3.5 w-3.5" />
      )}
      <span className="text-xs">
        {isTranslating 
          ? (language === 'ar' ? 'جاري الترجمة...' : 'Translating...') 
          : (language === 'ar' ? 'ترجمة' : 'Translate')
        }
      </span>
    </Button>
  );
}
