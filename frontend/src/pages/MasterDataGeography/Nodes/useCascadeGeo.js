import { useState, useEffect } from 'react';
import { getProvinces, getCities } from '../../../api/locationNode.api';

export function useCascadeGeo({ regionId, provinceId, onProvinceReset, onCityReset, activeOnly = true }) {
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (!regionId) {
      setProvinces([]);
      onProvinceReset?.();
      return;
    }
    (async () => {
      try {
        const { data } = await getProvinces({
          limit: 500,
          region_id: regionId,
          ...(activeOnly && { is_active: true }),
        });
        setProvinces(data.data || data || []);
      } catch {
        setProvinces([]);
      }
    })();
  }, [regionId]);

  useEffect(() => {
    if (!provinceId) {
      setCities([]);
      onCityReset?.();
      return;
    }
    (async () => {
      try {
        const { data } = await getCities({
          limit: 500,
          province_id: provinceId,
          ...(activeOnly && { is_active: true }),
        });
        setCities(data.data || data || []);
      } catch {
        setCities([]);
      }
    })();
  }, [provinceId]);

  return { provinces, cities };
}