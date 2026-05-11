import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';

const BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export interface Destination {
  id: string;
  label: string;       // e.g. "Kebon Kelapa, Gambir, Jakarta Pusat, DKI Jakarta"
  subdistrict: string;
  district: string;
  city: string;
  province: string;
}

export interface ShippingCost {
  courier: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

@Injectable()
export class ShippingService {
  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string | null> {
    return this.settingsService.get('rajaongkir_api_key');
  }

  private async getEnabledCouriers(): Promise<string[]> {
    const str = await this.settingsService.get('enabled_couriers');
    return (str || '').split(',').filter(Boolean);
  }

  /**
   * Search domestic destinations (cities/subdistricts).
   * Returns a list of matching locations.
   */
  async searchDestination(query: string, limit = 10): Promise<Destination[]> {
    const apiKey = await this.getApiKey();
    if (!apiKey || !query) {
      console.log(`[shipping:debug] searchDestination skipped — apiKey=${!!apiKey} query="${query}"`);
      return [];
    }

    try {
      const url = `${BASE_URL}/destination/domestic-destination?search=${encodeURIComponent(query)}&limit=${limit}&offset=0`;
      console.log(`[shipping:debug] searchDestination REQUEST`, { url, key: apiKey.slice(0, 8) + '...' });

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'key': apiKey },
      });

      console.log(`[shipping:debug] searchDestination RESPONSE status=${response.status}`);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[shipping:debug] searchDestination FAILED`, { status: response.status, body: errBody.slice(0, 500) });
        return [];
      }

      const data = await response.json() as any;
      console.log(`[shipping:debug] searchDestination RAW RESPONSE`, JSON.stringify(data).slice(0, 1000));

      // Parse response — RajaOngkir Komerce format
      const results = data?.data || data?.rajaongkir?.results || data?.results || [];
      if (!Array.isArray(results)) {
        console.log(`[shipping:debug] searchDestination results is not an array, type=${typeof results}`);
        return [];
      }

      console.log(`[shipping:debug] searchDestination parsed ${results.length} results`);
      return results.map((r: any) => ({
        id: String(r.id || r.subdistrict_id || r.city_id || ''),
        label: [r.subdistrict_name, r.district, r.city_name || r.city, r.province_name || r.province]
          .filter(Boolean).join(', '),
        subdistrict: r.subdistrict_name || '',
        district: r.district || '',
        city: r.city_name || r.city || '',
        province: r.province_name || r.province || '',
      }));
    } catch (err) {
      console.error('[shipping:debug] searchDestination error:', err);
      return [];
    }
  }

  /**
   * Calculate domestic shipping cost.
   * origin/destination are RajaOngkir location IDs.
   * weight in grams.
   */
  async calculateCost(origin: string, destination: string, weight: number): Promise<ShippingCost[]> {
    const apiKey = await this.getApiKey();
    if (!apiKey || !origin || !destination) {
      console.log(`[shipping:debug] calculateCost skipped — apiKey=${!!apiKey} origin="${origin}" dest="${destination}"`);
      return [];
    }

    const enabledCouriers = await this.getEnabledCouriers();
    if (enabledCouriers.length === 0) {
      console.log(`[shipping:debug] calculateCost skipped — no enabled couriers`);
      return [];
    }

    // Map our courier codes to RajaOngkir codes
    const courierMap: Record<string, string> = {
      jne: 'jne', pos: 'pos', tiki: 'tiki', jnt: 'jnt',
      sicepat: 'sicepat', anteraja: 'anteraja', ninja: 'ninja', idexpress: 'ide',
    };

    const courierStr = enabledCouriers
      .map((c) => courierMap[c] || c)
      .join(':');

    try {
      const url = `${BASE_URL}/calculate/domestic-cost`;

      const bodyParams = {
        origin,
        destination,
        weight: String(Math.max(weight, 1)),
        courier: courierStr,
        price: 'lowest',
      };
      const body = new URLSearchParams(bodyParams);

      console.log(`[shipping:debug] calculateCost REQUEST`, { url, key: apiKey.slice(0, 8) + '...', body: bodyParams });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'key': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      console.log(`[shipping:debug] calculateCost RESPONSE status=${response.status}`);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[shipping:debug] calculateCost FAILED`, { status: response.status, body: errBody.slice(0, 500) });
        return [];
      }

      const data = await response.json() as any;
      console.log(`[shipping:debug] calculateCost RAW RESPONSE`, JSON.stringify(data).slice(0, 2000));

      // Parse response — handle both Komerce flat format and old nested format
      const results: ShippingCost[] = [];
      const courierResults = data?.data || data?.rajaongkir?.results || [];

      console.log(`[shipping:debug] calculateCost courierResults type=${typeof courierResults} isArray=${Array.isArray(courierResults)} length=${Array.isArray(courierResults) ? courierResults.length : 'n/a'}`);

      if (Array.isArray(courierResults)) {
        for (const item of courierResults) {
          // Komerce flat format: { name, code, service, description, cost, etd }
          if (item.service && item.cost !== undefined && !item.costs) {
            results.push({
              courier: item.name || item.code || '',
              service: item.service || '',
              description: item.description || '',
              cost: typeof item.cost === 'number' ? item.cost : 0,
              etd: item.etd || '-',
            });
          }
          // Old RajaOngkir nested format: { name, code, costs: [{service, description, cost: [{value, etd}]}] }
          else if (item.costs) {
            const costs = item.costs || [];
            const courierName = item.name || item.code || '';

            for (const svc of costs) {
              const costArr = svc.cost || [];
              const firstCost = costArr[0] || {};

              results.push({
                courier: courierName,
                service: svc.service || '',
                description: svc.description || '',
                cost: firstCost.value || 0,
                etd: firstCost.etd || '-',
              });
            }
          }
        }
      }

      console.log(`[shipping:debug] calculateCost parsed ${results.length} shipping results`);
      // Sort by cost ascending
      results.sort((a, b) => a.cost - b.cost);
      return results;
    } catch (err) {
      console.error('[shipping:debug] calculateCost error:', err);
      return [];
    }
  }
}
