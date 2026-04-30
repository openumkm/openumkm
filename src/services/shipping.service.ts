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
    if (!apiKey || !query) return [];

    try {
      const url = `${BASE_URL}/destination/domestic-destination?search=${encodeURIComponent(query)}&limit=${limit}&offset=0`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'key': apiKey },
      });

      if (!response.ok) {
        console.error(`[shipping] Search failed: ${response.status}`);
        return [];
      }

      const data = await response.json() as any;

      // Parse response — RajaOngkir Komerce format
      const results = data?.data || data?.rajaongkir?.results || data?.results || [];
      if (!Array.isArray(results)) return [];

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
      console.error('[shipping] Search error:', err);
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
    if (!apiKey || !origin || !destination) return [];

    const enabledCouriers = await this.getEnabledCouriers();
    if (enabledCouriers.length === 0) return [];

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

      const body = new URLSearchParams({
        origin,
        destination,
        weight: String(Math.max(weight, 1)),
        courier: courierStr,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'key': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        console.error(`[shipping] Calculate failed: ${response.status}`);
        return [];
      }

      const data = await response.json() as any;

      // Parse response — extract all services from all couriers
      const results: ShippingCost[] = [];
      const courierResults = data?.data || data?.rajaongkir?.results || [];

      if (Array.isArray(courierResults)) {
        for (const courier of courierResults) {
          const courierName = courier.name || courier.code || '';
          const costs = courier.costs || [];

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

      // Sort by cost ascending
      results.sort((a, b) => a.cost - b.cost);
      return results;
    } catch (err) {
      console.error('[shipping] Calculate error:', err);
      return [];
    }
  }
}
