export interface Country {
  code: string;
  name: string;
  nameAr: string;
  dialCode: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  currencySymbolEn: string;
}

export const countries: Country[] = [
  {
    code: 'QA',
    name: 'Qatar',
    nameAr: 'قطر',
    dialCode: '+974',
    flag: '🇶🇦',
    currency: 'QAR',
    currencySymbol: 'ر.ق',
    currencySymbolEn: 'QAR'
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameAr: 'السعودية',
    dialCode: '+966',
    flag: '🇸🇦',
    currency: 'SAR',
    currencySymbol: 'ر.س',
    currencySymbolEn: 'SAR'
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    nameAr: 'الإمارات',
    dialCode: '+971',
    flag: '🇦🇪',
    currency: 'AED',
    currencySymbol: 'د.إ',
    currencySymbolEn: 'AED'
  },
  {
    code: 'KW',
    name: 'Kuwait',
    nameAr: 'الكويت',
    dialCode: '+965',
    flag: '🇰🇼',
    currency: 'KWD',
    currencySymbol: 'د.ك',
    currencySymbolEn: 'KWD'
  },
  {
    code: 'BH',
    name: 'Bahrain',
    nameAr: 'البحرين',
    dialCode: '+973',
    flag: '🇧🇭',
    currency: 'BHD',
    currencySymbol: 'د.ب',
    currencySymbolEn: 'BHD'
  },
  {
    code: 'OM',
    name: 'Oman',
    nameAr: 'عمان',
    dialCode: '+968',
    flag: '🇴🇲',
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    currencySymbolEn: 'OMR'
  },
  {
    code: 'JO',
    name: 'Jordan',
    nameAr: 'الأردن',
    dialCode: '+962',
    flag: '🇯🇴',
    currency: 'JOD',
    currencySymbol: 'د.أ',
    currencySymbolEn: 'JOD'
  },
  {
    code: 'EG',
    name: 'Egypt',
    nameAr: 'مصر',
    dialCode: '+20',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'ج.م',
    currencySymbolEn: 'EGP'
  },
  {
    code: 'LB',
    name: 'Lebanon',
    nameAr: 'لبنان',
    dialCode: '+961',
    flag: '🇱🇧',
    currency: 'LBP',
    currencySymbol: 'ل.ل',
    currencySymbolEn: 'LBP'
  },
  {
    code: 'SY',
    name: 'Syria',
    nameAr: 'سوريا',
    dialCode: '+963',
    flag: '🇸🇾',
    currency: 'SYP',
    currencySymbol: 'ل.س',
    currencySymbolEn: 'SYP'
  },
  {
    code: 'IQ',
    name: 'Iraq',
    nameAr: 'العراق',
    dialCode: '+964',
    flag: '🇮🇶',
    currency: 'IQD',
    currencySymbol: 'د.ع',
    currencySymbolEn: 'IQD'
  },
  {
    code: 'YE',
    name: 'Yemen',
    nameAr: 'اليمن',
    dialCode: '+967',
    flag: '🇾🇪',
    currency: 'YER',
    currencySymbol: 'ر.ي',
    currencySymbolEn: 'YER'
  },
  {
    code: 'PS',
    name: 'Palestine',
    nameAr: 'فلسطين',
    dialCode: '+970',
    flag: '🇵🇸',
    currency: 'ILS',
    currencySymbol: '₪',
    currencySymbolEn: 'ILS'
  },
  {
    code: 'MA',
    name: 'Morocco',
    nameAr: 'المغرب',
    dialCode: '+212',
    flag: '🇲🇦',
    currency: 'MAD',
    currencySymbol: 'د.م',
    currencySymbolEn: 'MAD'
  },
  {
    code: 'DZ',
    name: 'Algeria',
    nameAr: 'الجزائر',
    dialCode: '+213',
    flag: '🇩🇿',
    currency: 'DZD',
    currencySymbol: 'د.ج',
    currencySymbolEn: 'DZD'
  },
  {
    code: 'TN',
    name: 'Tunisia',
    nameAr: 'تونس',
    dialCode: '+216',
    flag: '🇹🇳',
    currency: 'TND',
    currencySymbol: 'د.ت',
    currencySymbolEn: 'TND'
  },
  {
    code: 'LY',
    name: 'Libya',
    nameAr: 'ليبيا',
    dialCode: '+218',
    flag: '🇱🇾',
    currency: 'LYD',
    currencySymbol: 'د.ل',
    currencySymbolEn: 'LYD'
  },
  {
    code: 'SD',
    name: 'Sudan',
    nameAr: 'السودان',
    dialCode: '+249',
    flag: '🇸🇩',
    currency: 'SDG',
    currencySymbol: 'ج.س',
    currencySymbolEn: 'SDG'
  },
  {
    code: 'PK',
    name: 'Pakistan',
    nameAr: 'باكستان',
    dialCode: '+92',
    flag: '🇵🇰',
    currency: 'PKR',
    currencySymbol: 'Rs',
    currencySymbolEn: 'PKR'
  },
];

export const getCountryByDialCode = (dialCode: string): Country | undefined => {
  return countries.find(country => country.dialCode === dialCode);
};

export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(country => country.code === code);
};
