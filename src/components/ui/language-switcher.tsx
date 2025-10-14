import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      <span className="hidden sm:inline">
        {language === 'ar' ? 'English' : 'العربية'}
      </span>
    </Button>
  );
}
