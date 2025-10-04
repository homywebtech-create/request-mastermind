// ربط الخدمات بالشركات
// يمكن تحديث هذا الملف لاحقاً من قاعدة البيانات

export interface CompanyService {
  companyId: string;
  companyName: string;
  services: string[];
}

// هذا مثال - يمكن جلبه من قاعدة البيانات
export const getCompaniesForService = (serviceType: string): string[] => {
  // TODO: جلب الشركات التي تقدم هذه الخدمة من قاعدة البيانات
  // حالياً سنرجع جميع الشركات
  return [];
};
