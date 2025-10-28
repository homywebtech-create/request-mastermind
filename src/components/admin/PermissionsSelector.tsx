import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Permission } from "@/config/permissions";

interface PermissionsSelectorProps {
  selectedPermissions: Permission[];
  onPermissionsChange: (permissions: Permission[]) => void;
  language: 'ar' | 'en';
}

interface PermissionGroup {
  title: { ar: string; en: string };
  permissions: {
    key: Permission;
    label: { ar: string; en: string };
  }[];
}

const permissionGroups: PermissionGroup[] = [
  {
    title: { ar: "لوحة التحكم", en: "Dashboard" },
    permissions: [
      { key: 'view_dashboard', label: { ar: "عرض لوحة التحكم", en: "View Dashboard" } }
    ]
  },
  {
    title: { ar: "الطلبات", en: "Orders" },
    permissions: [
      { key: 'view_orders', label: { ar: "عرض الطلبات", en: "View Orders" } },
      { key: 'manage_orders', label: { ar: "إدارة الطلبات", en: "Manage Orders" } },
      { key: 'create_order', label: { ar: "إنشاء طلب", en: "Create Order" } },
      { key: 'update_order', label: { ar: "تحديث طلب", en: "Update Order" } },
      { key: 'delete_order', label: { ar: "حذف طلب", en: "Delete Order" } },
      { key: 'view_new_requests', label: { ar: "عرض الطلبات الجديدة", en: "View New Requests" } },
      { key: 'view_awaiting_response', label: { ar: "عرض قيد الانتظار", en: "View Awaiting Response" } },
      { key: 'view_upcoming', label: { ar: "عرض القادمة", en: "View Upcoming" } },
      { key: 'view_in_progress', label: { ar: "عرض قيد التنفيذ", en: "View In Progress" } },
      { key: 'view_completed', label: { ar: "عرض المكتملة", en: "View Completed" } }
    ]
  },
  {
    title: { ar: "الشركات", en: "Companies" },
    permissions: [
      { key: 'view_companies', label: { ar: "عرض الشركات", en: "View Companies" } },
      { key: 'manage_companies', label: { ar: "إدارة الشركات", en: "Manage Companies" } }
    ]
  },
  {
    title: { ar: "المحترفات", en: "Specialists" },
    permissions: [
      { key: 'view_specialists', label: { ar: "عرض المحترفات", en: "View Specialists" } },
      { key: 'manage_specialists', label: { ar: "إدارة المحترفات", en: "Manage Specialists" } }
    ]
  },
  {
    title: { ar: "الخدمات", en: "Services" },
    permissions: [
      { key: 'view_services', label: { ar: "عرض الخدمات", en: "View Services" } },
      { key: 'manage_services', label: { ar: "إدارة الخدمات", en: "Manage Services" } }
    ]
  },
  {
    title: { ar: "العقود", en: "Contracts" },
    permissions: [
      { key: 'view_contracts', label: { ar: "عرض العقود", en: "View Contracts" } },
      { key: 'manage_contracts', label: { ar: "إدارة العقود", en: "Manage Contracts" } }
    ]
  },
  {
    title: { ar: "طلبات الحذف", en: "Deletion Requests" },
    permissions: [
      { key: 'view_deletion_requests', label: { ar: "عرض طلبات الحذف", en: "View Deletion Requests" } },
      { key: 'manage_deletion_requests', label: { ar: "إدارة طلبات الحذف", en: "Manage Deletion Requests" } }
    ]
  },
  {
    title: { ar: "المستخدمين", en: "Users" },
    permissions: [
      { key: 'view_users', label: { ar: "عرض المستخدمين", en: "View Users" } },
      { key: 'manage_users', label: { ar: "إدارة المستخدمين", en: "Manage Users" } }
    ]
  },
  {
    title: { ar: "العملاء", en: "Customers" },
    permissions: [
      { key: 'view_customers', label: { ar: "عرض العملاء", en: "View Customers" } },
      { key: 'manage_customers', label: { ar: "إدارة العملاء", en: "Manage Customers" } }
    ]
  },
  {
    title: { ar: "سجل النشاطات", en: "Activity Logs" },
    permissions: [
      { key: 'view_activity_logs', label: { ar: "عرض سجل النشاطات", en: "View Activity Logs" } }
    ]
  }
];

export function PermissionsSelector({ selectedPermissions, onPermissionsChange, language }: PermissionsSelectorProps) {
  const handleTogglePermission = (permission: Permission) => {
    if (selectedPermissions.includes(permission)) {
      onPermissionsChange(selectedPermissions.filter(p => p !== permission));
    } else {
      onPermissionsChange([...selectedPermissions, permission]);
    }
  };

  const handleToggleGroup = (group: PermissionGroup, checked: boolean) => {
    const groupPermissions = group.permissions.map(p => p.key);
    if (checked) {
      // Add all permissions from this group
      const newPermissions = [...selectedPermissions];
      groupPermissions.forEach(p => {
        if (!newPermissions.includes(p)) {
          newPermissions.push(p);
        }
      });
      onPermissionsChange(newPermissions);
    } else {
      // Remove all permissions from this group
      onPermissionsChange(selectedPermissions.filter(p => !groupPermissions.includes(p)));
    }
  };

  const isGroupFullySelected = (group: PermissionGroup) => {
    return group.permissions.every(p => selectedPermissions.includes(p.key));
  };

  const isGroupPartiallySelected = (group: PermissionGroup) => {
    const selected = group.permissions.filter(p => selectedPermissions.includes(p.key));
    return selected.length > 0 && selected.length < group.permissions.length;
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {language === 'ar' 
          ? 'اختر الصلاحيات المطلوبة للمستخدم:'
          : 'Select required permissions for the user:'}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {permissionGroups.map((group) => (
          <Card key={group.title.en} className="p-4 space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse pb-2 border-b">
              <Checkbox
                id={`group-${group.title.en}`}
                checked={isGroupFullySelected(group)}
                onCheckedChange={(checked) => handleToggleGroup(group, checked as boolean)}
                className={isGroupPartiallySelected(group) ? "opacity-50" : ""}
              />
              <Label
                htmlFor={`group-${group.title.en}`}
                className="font-semibold cursor-pointer"
              >
                {group.title[language]}
              </Label>
            </div>
            
            <div className="space-y-2 ps-6">
              {group.permissions.map((permission) => (
                <div key={permission.key} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id={permission.key}
                    checked={selectedPermissions.includes(permission.key)}
                    onCheckedChange={() => handleTogglePermission(permission.key)}
                  />
                  <Label
                    htmlFor={permission.key}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {permission.label[language]}
                  </Label>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        {language === 'ar' 
          ? `عدد الصلاحيات المحددة: ${selectedPermissions.length}`
          : `Selected permissions: ${selectedPermissions.length}`}
      </div>
    </div>
  );
}
