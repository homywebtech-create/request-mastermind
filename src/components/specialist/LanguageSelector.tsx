import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/useLanguage";

interface LanguageSelectorProps {
  specialistId: string;
  currentLanguage?: string;
  onLanguageChange?: (language: string) => void;
}

const languageOptions = [
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'tl', label: 'Tagalog', flag: '🇵🇭' },
  { value: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { value: 'si', label: 'සිංහල', flag: '🇱🇰' },
  { value: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { value: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { value: 'am', label: 'አማርኛ', flag: '🇪🇹' },
  { value: 'ti', label: 'ትግርኛ', flag: '🇪🇷' },
  { value: 'fa', label: 'فارسی', flag: '🇮🇷' },
];

export default function LanguageSelector({ 
  specialistId, 
  currentLanguage = 'ar',
  onLanguageChange 
}: LanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const { toast } = useToast();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      const { error } = await supabase
        .from('specialists')
        .update({ preferred_language: newLanguage })
        .eq('id', specialistId);

      if (error) throw error;

      setSelectedLanguage(newLanguage);
      
      toast({
        title: isAr ? "✅ تم التحديث" : "✅ Updated",
        description: isAr 
          ? "تم تحديث لغة العرض بنجاح. سيتم ترجمة جميع الطلبات تلقائياً."
          : "Display language updated successfully. All orders will be translated automatically.",
      });

      if (onLanguageChange) {
        onLanguageChange(newLanguage);
      }

      // Reload the page to apply translation
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: isAr ? "❌ خطأ" : "❌ Error",
        description: isAr ? "فشل تحديث اللغة" : "Failed to update language",
        variant: "destructive",
      });
    }
  };

  const currentOption = languageOptions.find(opt => opt.value === selectedLanguage);

  return (
    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
      <Globe className="h-5 w-5 text-white" />
      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="h-10 min-w-[160px] border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors">
          <SelectValue>
            <span className="flex items-center gap-2 font-medium">
              <span className="text-lg">{currentOption?.flag}</span>
              <span>{currentOption?.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white">
          {languageOptions.map(option => (
            <SelectItem key={option.value} value={option.value} className="cursor-pointer">
              <span className="flex items-center gap-2">
                <span className="text-lg">{option.flag}</span>
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
