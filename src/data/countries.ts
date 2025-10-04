export interface Country {
  code: string;
  name: string;
  nameAr: string;
  dialCode: string;
  flag: string;
}

export const countries: Country[] = [
  {
    code: 'QA',
    name: 'Qatar',
    nameAr: 'قطر',
    dialCode: '+974',
    flag: '🇶🇦'
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameAr: 'السعودية',
    dialCode: '+966',
    flag: '🇸🇦'
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    nameAr: 'الإمارات',
    dialCode: '+971',
    flag: '🇦🇪'
  },
  {
    code: 'KW',
    name: 'Kuwait',
    nameAr: 'الكويت',
    dialCode: '+965',
    flag: '🇰🇼'
  },
  {
    code: 'BH',
    name: 'Bahrain',
    nameAr: 'البحرين',
    dialCode: '+973',
    flag: '🇧🇭'
  },
  {
    code: 'OM',
    name: 'Oman',
    nameAr: 'عمان',
    dialCode: '+968',
    flag: '🇴🇲'
  },
  {
    code: 'JO',
    name: 'Jordan',
    nameAr: 'الأردن',
    dialCode: '+962',
    flag: '🇯🇴'
  },
  {
    code: 'EG',
    name: 'Egypt',
    nameAr: 'مصر',
    dialCode: '+20',
    flag: '🇪🇬'
  },
  {
    code: 'LB',
    name: 'Lebanon',
    nameAr: 'لبنان',
    dialCode: '+961',
    flag: '🇱🇧'
  },
  {
    code: 'SY',
    name: 'Syria',
    nameAr: 'سوريا',
    dialCode: '+963',
    flag: '🇸🇾'
  },
  {
    code: 'IQ',
    name: 'Iraq',
    nameAr: 'العراق',
    dialCode: '+964',
    flag: '🇮🇶'
  },
  {
    code: 'YE',
    name: 'Yemen',
    nameAr: 'اليمن',
    dialCode: '+967',
    flag: '🇾🇪'
  },
  {
    code: 'PS',
    name: 'Palestine',
    nameAr: 'فلسطين',
    dialCode: '+970',
    flag: '🇵🇸'
  },
  {
    code: 'MA',
    name: 'Morocco',
    nameAr: 'المغرب',
    dialCode: '+212',
    flag: '🇲🇦'
  },
  {
    code: 'DZ',
    name: 'Algeria',
    nameAr: 'الجزائر',
    dialCode: '+213',
    flag: '🇩🇿'
  },
  {
    code: 'TN',
    name: 'Tunisia',
    nameAr: 'تونس',
    dialCode: '+216',
    flag: '🇹🇳'
  },
  {
    code: 'LY',
    name: 'Libya',
    nameAr: 'ليبيا',
    dialCode: '+218',
    flag: '🇱🇾'
  },
  {
    code: 'SD',
    name: 'Sudan',
    nameAr: 'السودان',
    dialCode: '+249',
    flag: '🇸🇩'
  },
];

export const getCountryByDialCode = (dialCode: string): Country | undefined => {
  return countries.find(country => country.dialCode === dialCode);
};

export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(country => country.code === code);
};
