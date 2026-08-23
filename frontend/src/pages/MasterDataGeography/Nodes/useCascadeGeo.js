import { useState, useEffect } from 'react';
import { getCities } from '../../../api/locationNode.api';

export function useCascadeGeo({ regionId, onCityReset, activeOnly = true }) {
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (!regionId) {
      setCities([]);
      onCityReset?.();
      return;
    }
    (async () => {
      try {
        const { data } = await getCities({
          limit: 500,
          region_id: regionId,
          ...(activeOnly && { is_active: true }),
        });
        setCities(data.data || data || []);
      } catch {
        setCities([]);
      }
    })();
  }, [regionId]);

  return { cities };
}