import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Shield } from "lucide-react";
import { CompanyUser } from "@/types/company-team";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

interface CompanyUsersTableProps {
  users: CompanyUser[];
  onEdit: (user: CompanyUser) => void;
  onDelete: (userId: string) => void;
  onToggleActive: (userId: string, currentStatus: boolean) => void;
}

const permissionLabels: Record<string, { ar: string; en: string }> = {
  manage_specialists: { ar: "إدارة المحترفات", en: "Manage Specialists" },
  view_specialists: { ar: "عرض المحترفات", en: "View Specialists" },
  manage_orders: { ar: "إدارة الطلبات", en: "Manage Orders" },
  view_orders: { ar: "عرض الطلبات", en: "View Orders" },
  manage_contracts: { ar: "إدارة العقود", en: "Manage Contracts" },
  view_contracts: { ar: "عرض العقود", en: "View Contracts" },
  manage_team: { ar: "إدارة الفريق", en: "Manage Team" },
  view_reports: { ar: "عرض التقارير", en: "View Reports" },
};

export function CompanyUsersTable({
  users,
  onEdit,
  onDelete,
  onToggleActive,
}: CompanyUsersTableProps) {
  const { language } = useLanguage();

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
            <TableHead>{language === "ar" ? "البريد الإلكتروني" : "Email"}</TableHead>
            <TableHead>{language === "ar" ? "الهاتف" : "Phone"}</TableHead>
            <TableHead>{language === "ar" ? "الصلاحيات" : "Permissions"}</TableHead>
            <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
            <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.full_name}
                  {user.is_owner && (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {language === "ar" ? "مالك" : "Owner"}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.phone || "-"}</TableCell>
              <TableCell>
                {user.is_owner ? (
                  <Badge variant="secondary">
                    {language === "ar" ? "جميع الصلاحيات" : "All Permissions"}
                  </Badge>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.length > 0 ? (
                      user.permissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {language === "ar"
                            ? permissionLabels[perm]?.ar || perm
                            : permissionLabels[perm]?.en || perm}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {language === "ar" ? "لا توجد صلاحيات" : "No permissions"}
                      </span>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={user.is_active}
                  onCheckedChange={() => onToggleActive(user.id, user.is_active)}
                  disabled={user.is_owner}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    disabled={user.is_owner}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(user.id)}
                    disabled={user.is_owner}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}