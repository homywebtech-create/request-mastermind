import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCountryByDialCode, type Country } from '@/data/countries';

interface UseCompanyCountryResult {
  country: Country | null;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  isLoading: boolean;
}

/**
 * Hook to get company's country information based on their phone country code
 * Returns country details including currency information
 */
export function useCompanyCountry(companyId: string | null): UseCompanyCountryResult {
  const [result, setResult] = useState<UseCompanyCountryResult>({
    country: null,
    countryCode: '+966',
    currency: 'SAR',
    currencySymbol: 'ر.س',
    isLoading: true,
  });

  useEffect(() => {
    async function fetchCompanyCountry() {
      if (!companyId) {
        setResult(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const { data, error } = await supabase
          .from('companies')
          .select('country_code')
          .eq('id', companyId)
          .single();

        if (error) throw error;

        const dialCode = data?.country_code || '+966';
        const country = getCountryByDialCode(dialCode);

        setResult({
          country: country || null,
          countryCode: dialCode,
          currency: country?.currency || 'SAR',
          currencySymbol: country?.currencySymbol || 'ر.س',
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching company country:', error);
        setResult(prev => ({ ...prev, isLoading: false }));
      }
    }

    fetchCompanyCountry();
  }, [companyId]);

  return result;
}

/**
 * Hook to get specialist's company country information
 * Fetches specialist data first, then gets company country info
 */
export function useSpecialistCompanyCountry(specialistId: string | null): UseCompanyCountryResult {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const companyCountry = useCompanyCountry(companyId);

  useEffect(() => {
    async function fetchSpecialistCompany() {
      if (!specialistId) {
        setIsLoadingCompany(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('specialists')
          .select('company_id')
          .eq('id', specialistId)
          .single();

        if (error) throw error;

        setCompanyId(data?.company_id || null);
      } catch (error) {
        console.error('Error fetching specialist company:', error);
      } finally {
        setIsLoadingCompany(false);
      }
    }

    fetchSpecialistCompany();
  }, [specialistId]);

  return {
    ...companyCountry,
    isLoading: isLoadingCompany || companyCountry.isLoading,
  };
}
