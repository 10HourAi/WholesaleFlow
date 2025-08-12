import type { Property } from "@shared/schema";

interface BatchLeadsProperty {
  property_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  year_built: number;
  estimated_value: number;
  last_sale_price: number;
  last_sale_date: string;
  property_type: string;
  owner_name: string;
  owner_phone?: string;
  owner_email?: string;
  equity_percentage: number;
  days_on_market: number;
  distressed_indicator: string;
  motivation_score: number;
}

interface BatchLeadsResponse {
  success: boolean;
  data: BatchLeadsProperty[];
  total_results: number;
  page: number;
  per_page: number;
}

interface SearchCriteria {
  location: string;
  maxPrice?: number;
  minEquity?: number;
  propertyType?: string;
  distressedOnly?: boolean;
  motivationScore?: number;
}

class BatchLeadsService {
  private apiKey: string;
  private baseUrl = 'https://api.batchleads.io/v2';

  constructor() {
    if (!process.env.BATCHLEADS_API_KEY) {
      throw new Error('BATCHLEADS_API_KEY is required');
    }
    this.apiKey = process.env.BATCHLEADS_API_KEY;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add API key and common parameters
    url.searchParams.append('api_key', this.apiKey);
    
    // Add search parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '10HourAi/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`BatchLeads API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchProperties(criteria: SearchCriteria, page = 1, perPage = 50): Promise<BatchLeadsResponse> {
    const params: Record<string, any> = {
      page,
      per_page: perPage,
      location: criteria.location,
    };

    if (criteria.maxPrice) {
      params.max_price = criteria.maxPrice;
    }

    if (criteria.minEquity) {
      params.min_equity_percentage = criteria.minEquity;
    }

    if (criteria.propertyType) {
      params.property_type = criteria.propertyType;
    }

    if (criteria.distressedOnly) {
      params.distressed_only = true;
    }

    if (criteria.motivationScore) {
      params.min_motivation_score = criteria.motivationScore;
    }

    // Add wholesaling-specific filters
    params.investment_properties = true;
    params.sort_by = 'motivation_score';
    params.sort_order = 'desc';

    return this.makeRequest('/properties/search', params);
  }

  async getPropertyDetails(propertyId: string): Promise<BatchLeadsProperty> {
    const response = await this.makeRequest(`/properties/${propertyId}`);
    return response.data;
  }

  async getDistressedProperties(location: string, limit = 25): Promise<BatchLeadsProperty[]> {
    const response = await this.searchProperties({
      location,
      distressedOnly: true,
      motivationScore: 70
    }, 1, limit);

    return response.data;
  }

  // Convert BatchLeads property to our schema format
  convertToProperty(batchProperty: BatchLeadsProperty, userId: string): any {
    const maxOffer = Math.floor(batchProperty.estimated_value * 0.7); // 70% rule
    
    return {
      userId,
      address: batchProperty.address,
      city: batchProperty.city,
      state: batchProperty.state,
      zipCode: batchProperty.zip_code,
      bedrooms: batchProperty.bedrooms,
      bathrooms: batchProperty.bathrooms,
      squareFeet: batchProperty.square_feet,
      arv: batchProperty.estimated_value.toString(),
      maxOffer: maxOffer.toString(),
      status: 'new',
      leadType: this.getLeadType(batchProperty),
      propertyType: batchProperty.property_type,
      yearBuilt: batchProperty.year_built,
      lastSalePrice: batchProperty.last_sale_price?.toString(),
      lastSaleDate: batchProperty.last_sale_date,
      ownerName: batchProperty.owner_name,
      ownerPhone: batchProperty.owner_phone || null,
      ownerEmail: batchProperty.owner_email || null,
      equityPercentage: batchProperty.equity_percentage,
      motivationScore: batchProperty.motivation_score,
      distressedIndicator: batchProperty.distressed_indicator
    };
  }

  private getLeadType(property: BatchLeadsProperty): string {
    if (property.distressed_indicator && property.distressed_indicator !== 'none') {
      return 'distressed';
    }
    if (property.motivation_score >= 80) {
      return 'motivated_seller';
    }
    if (property.equity_percentage >= 50) {
      return 'high_equity';
    }
    return 'standard';
  }
}

export const batchLeadsService = new BatchLeadsService();

// Export types for use in other files
export type { BatchLeadsProperty, SearchCriteria };