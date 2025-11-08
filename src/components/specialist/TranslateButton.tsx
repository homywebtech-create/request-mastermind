import { useState } from "react";
import { Languages, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TranslateButtonProps {
  text: string;
  onTranslated: (translatedText: string) => void;
  sourceLanguage?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nameAr: 'الإنجليزية' },
  { code: 'ar', name: 'Arabic', nameAr: 'العربية' },
  { code: 'tl', name: 'Tagalog', nameAr: 'التاغالوغية' },
  { code: 'hi', name: 'Hindi', nameAr: 'الهندية' },
  { code: 'si', name: 'Sinhala', nameAr: 'السنهالية' },
  { code: 'bn', name: 'Bengali', nameAr: 'البنغالية' },
  { code: 'sw', name: 'Swahili', nameAr: 'السواحيلية' },
  { code: 'am', name: 'Amharic', nameAr: 'الأمهرية' },
  { code: 'ti', name: 'Tigrinya', nameAr: 'التيغرينية' },
  { code: 'fa', name: 'Persian', nameAr: 'الفارسية' },
];

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
  const isAr = language === 'ar';
  
  const handleTranslate = async (targetLang: string) => {
    if (!text || text.trim() === '') {
      toast({
        title: isAr ? "لا يوجد نص للترجمة" : "No text to translate",
        variant: "destructive",
      });
      return;
    }

    // Don't translate if source and target are the same
    if (sourceLanguage === targetLang) {
      toast({
        title: isAr ? "لا حاجة للترجمة" : "No translation needed",
        description: isAr ? "النص بنفس اللغة المختارة" : "Text is already in selected language",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-order', {
        body: {
          text: text,
          targetLanguage: targetLang,
          sourceLanguage: sourceLanguage
        }
      });

      if (error) {
        console.error('Translation error:', error);
        throw error;
      }

      if (data?.translatedText) {
        onTranslated(data.translatedText);
        const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
        toast({
          title: isAr ? "✅ تمت الترجمة" : "✅ Translated",
          description: isAr 
            ? `تم ترجمة النص إلى ${targetLangName?.nameAr || targetLang}` 
            : `Text translated to ${targetLangName?.name || targetLang}`,
        });
      }
    } catch (error) {
      console.error('Failed to translate:', error);
      toast({
        title: isAr ? "❌ خطأ في الترجمة" : "❌ Translation Error",
        description: isAr 
          ? "فشلت الترجمة. يرجى المحاولة مرة أخرى" 
          : "Translation failed. Please try again",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
              ? (isAr ? 'جاري الترجمة...' : 'Translating...') 
              : (isAr ? 'ترجمة' : 'Translate')
            }
          </span>
          {!isTranslating && <ChevronDown className="h-3 w-3 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={isAr ? "end" : "start"} 
        className="w-48 max-h-[300px] overflow-y-auto bg-background z-50"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleTranslate(lang.code)}
            disabled={isTranslating || sourceLanguage === lang.code}
            className="cursor-pointer"
          >
            <Languages className="h-4 w-4 mr-2" />
            <span>{isAr ? lang.nameAr : lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
