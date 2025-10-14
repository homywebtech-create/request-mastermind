export interface Country {
  code: string;
  name: string;
  nameAr: string;
  dialCode: string;
  flag: string;
  currency: string;
  currencySymbol: string;
}

export const countries: Country[] = [
  {
    code: 'QA',
    name: 'Qatar',
    nameAr: 'قطر',
    dialCode: '+974',
    flag: '🇶🇦',
    currency: 'QAR',
    currencySymbol: 'ر.ق'
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameAr: 'السعودية',
    dialCode: '+966',
    flag: '🇸🇦',
    currency: 'SAR',
    currencySymbol: 'ر.س'
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    nameAr: 'الإمارات',
    dialCode: '+971',
    flag: '🇦🇪',
    currency: 'AED',
    currencySymbol: 'د.إ'
  },
  {
    code: 'KW',
    name: 'Kuwait',
    nameAr: 'الكويت',
    dialCode: '+965',
    flag: '🇰🇼',
    currency: 'KWD',
    currencySymbol: 'د.ك'
  },
  {
    code: 'BH',
    name: 'Bahrain',
    nameAr: 'البحرين',
    dialCode: '+973',
    flag: '🇧🇭',
    currency: 'BHD',
    currencySymbol: 'د.ب'
  },
  {
    code: 'OM',
    name: 'Oman',
    nameAr: 'عمان',
    dialCode: '+968',
    flag: '🇴🇲',
    currency: 'OMR',
    currencySymbol: 'ر.ع'
  },
  {
    code: 'JO',
    name: 'Jordan',
    nameAr: 'الأردن',
    dialCode: '+962',
    flag: '🇯🇴',
    currency: 'JOD',
    currencySymbol: 'د.أ'
  },
  {
    code: 'EG',
    name: 'Egypt',
    nameAr: 'مصر',
    dialCode: '+20',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'ج.م'
  },
  {
    code: 'LB',
    name: 'Lebanon',
    nameAr: 'لبنان',
    dialCode: '+961',
    flag: '🇱🇧',
    currency: 'LBP',
    currencySymbol: 'ل.ل'
  },
  {
    code: 'SY',
    name: 'Syria',
    nameAr: 'سوريا',
    dialCode: '+963',
    flag: '🇸🇾',
    currency: 'SYP',
    currencySymbol: 'ل.س'
  },
  {
    code: 'IQ',
    name: 'Iraq',
    nameAr: 'العراق',
    dialCode: '+964',
    flag: '🇮🇶',
    currency: 'IQD',
    currencySymbol: 'د.ع'
  },
  {
    code: 'YE',
    name: 'Yemen',
    nameAr: 'اليمن',
    dialCode: '+967',
    flag: '🇾🇪',
    currency: 'YER',
    currencySymbol: 'ر.ي'
  },
  {
    code: 'PS',
    name: 'Palestine',
    nameAr: 'فلسطين',
    dialCode: '+970',
    flag: '🇵🇸',
    currency: 'ILS',
    currencySymbol: '₪'
  },
  {
    code: 'MA',
    name: 'Morocco',
    nameAr: 'المغرب',
    dialCode: '+212',
    flag: '🇲🇦',
    currency: 'MAD',
    currencySymbol: 'د.م'
  },
  {
    code: 'DZ',
    name: 'Algeria',
    nameAr: 'الجزائر',
    dialCode: '+213',
    flag: '🇩🇿',
    currency: 'DZD',
    currencySymbol: 'د.ج'
  },
  {
    code: 'TN',
    name: 'Tunisia',
    nameAr: 'تونس',
    dialCode: '+216',
    flag: '🇹🇳',
    currency: 'TND',
    currencySymbol: 'د.ت'
  },
  {
    code: 'LY',
    name: 'Libya',
    nameAr: 'ليبيا',
    dialCode: '+218',
    flag: '🇱🇾',
    currency: 'LYD',
    currencySymbol: 'د.ل'
  },
  {
    code: 'SD',
    name: 'Sudan',
    nameAr: 'السودان',
    dialCode: '+249',
    flag: '🇸🇩',
    currency: 'SDG',
    currencySymbol: 'ج.س'
  },
];

export const getCountryByDialCode = (dialCode: string): Country | undefined => {
  return countries.find(country => country.dialCode === dialCode);
};

export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(country => country.code === code);
};
