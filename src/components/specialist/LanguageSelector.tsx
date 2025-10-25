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

// Language options for content translation
// Note: UI only supports 'ar' and 'en', but content can be translated to any of these
const languageOptions = [
  { value: 'ar', label: 'العربية', flag: '🇸🇦', description: 'Arabic UI & Content' },
  { value: 'en', label: 'English', flag: '🇬🇧', description: 'English UI & Content' },
  { value: 'tl', label: 'Tagalog', flag: '🇵🇭', description: 'English UI + Tagalog Content' },
  { value: 'hi', label: 'हिन्दी', flag: '🇮🇳', description: 'English UI + Hindi Content' },
  { value: 'si', label: 'සිංහල', flag: '🇱🇰', description: 'English UI + Sinhala Content' },
  { value: 'bn', label: 'বাংলা', flag: '🇧🇩', description: 'English UI + Bengali Content' },
  { value: 'sw', label: 'Kiswahili', flag: '🇰🇪', description: 'English UI + Swahili Content' },
  { value: 'am', label: 'አማርኛ', flag: '🇪🇹', description: 'English UI + Amharic Content' },
  { value: 'ti', label: 'ትግርኛ', flag: '🇪🇷', description: 'English UI + Tigrinya Content' },
  { value: 'fa', label: 'فارسی', flag: '🇮🇷', description: 'English UI + Farsi Content' },
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
          ? `تم تحديث لغة العرض بنجاح${newLanguage !== 'ar' && newLanguage !== 'en' ? ' (واجهة المستخدم بالإنجليزية + محتوى الطلبات بـ' + (languageOptions.find(o => o.value === newLanguage)?.label || newLanguage) + ')' : ''}`
          : `Display language updated successfully${newLanguage !== 'ar' && newLanguage !== 'en' ? ' (English UI + ' + (languageOptions.find(o => o.value === newLanguage)?.label || newLanguage) + ' Content)' : ''}`,
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
              <span className="truncate">{currentOption?.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white max-w-xs">
          {languageOptions.map(option => (
            <SelectItem key={option.value} value={option.value} className="cursor-pointer">
              <div className="flex flex-col gap-1 py-1">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{option.flag}</span>
                  <span className="font-medium">{option.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
