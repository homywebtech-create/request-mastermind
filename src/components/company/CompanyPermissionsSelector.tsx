import { useLanguage } from "@/hooks/useLanguage";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface CompanyPermissionsSelectorProps {
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
}

const permissions = [
  {
    value: "manage_specialists",
    labelAr: "إدارة المحترفات",
    labelEn: "Manage Specialists",
  },
  {
    value: "view_specialists",
    labelAr: "عرض المحترفات",
    labelEn: "View Specialists",
  },
  {
    value: "manage_orders",
    labelAr: "إدارة الطلبات",
    labelEn: "Manage Orders",
  },
  {
    value: "view_orders",
    labelAr: "عرض الطلبات",
    labelEn: "View Orders",
  },
  {
    value: "manage_contracts",
    labelAr: "إدارة العقود",
    labelEn: "Manage Contracts",
  },
  {
    value: "view_contracts",
    labelAr: "عرض العقود",
    labelEn: "View Contracts",
  },
  {
    value: "manage_team",
    labelAr: "إدارة الفريق",
    labelEn: "Manage Team",
  },
  {
    value: "view_reports",
    labelAr: "عرض التقارير",
    labelEn: "View Reports",
  },
];

export function CompanyPermissionsSelector({
  selectedPermissions,
  onPermissionsChange,
}: CompanyPermissionsSelectorProps) {
  const { language } = useLanguage();

  const handleToggle = (permission: string) => {
    if (selectedPermissions.includes(permission)) {
      onPermissionsChange(selectedPermissions.filter(p => p !== permission));
    } else {
      onPermissionsChange([...selectedPermissions, permission]);
    }
  };

  return (
    <div className="space-y-3">
      <Label>{language === "ar" ? "الصلاحيات" : "Permissions"}</Label>
      <div className="grid grid-cols-2 gap-3">
        {permissions.map((perm) => (
          <div key={perm.value} className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id={perm.value}
              checked={selectedPermissions.includes(perm.value)}
              onCheckedChange={() => handleToggle(perm.value)}
            />
            <label
              htmlFor={perm.value}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {language === "ar" ? perm.labelAr : perm.labelEn}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}