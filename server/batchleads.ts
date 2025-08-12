import type { Property } from "@shared/schema";

interface BatchLeadsProperty {
  _id: string;
  address: {
    houseNumber: string;
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  building?: {
    bedrooms: number;
    bathrooms: number;
    livingArea: number;
    yearBuilt: number;
    propertyType: string;
  };
  valuation?: {
    estimatedValue: number;
    equityPercent: number;
  };
  sale?: {
    lastSaleDate: string;
    lastSalePrice: number;
  };
  owner?: {
    fullName: string;
    mailingAddress?: {
      street: string;
      city: string;
      state: string;
    };
  };
  quickLists?: {
    ownerOccupied: boolean;
    absenteeOwner: boolean;
    highEquity: boolean;
    freeAndClear: boolean;
    vacant: boolean;
    preforeclosure: boolean;
  };
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
  private baseUrl = 'https://api.batchdata.com';

  constructor() {
    if (!process.env.BATCHLEADS_API_KEY) {
      throw new Error('BATCHLEADS_API_KEY is required');
    }
    this.apiKey = process.env.BATCHLEADS_API_KEY;
  }

  private async makeRequest(endpoint: string, requestBody: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'User-Agent': '10HourAi/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BatchData API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async searchProperties(criteria: SearchCriteria, page = 1, perPage = 50): Promise<BatchLeadsResponse> {
    const requestBody: any = {
      searchCriteria: {
        query: criteria.location
      },
      options: {
        skip: (page - 1) * perPage,
        take: Math.min(perPage, 500),
        skipTrace: false
      }
    };

    // Add property type filter for single family homes
    if (criteria.propertyType === 'single_family') {
      requestBody.searchCriteria.quickLists = ['not-owner-occupied'];
    }

    // Add distressed property filters
    if (criteria.distressedOnly) {
      requestBody.searchCriteria.quickLists = [
        'preforeclosure',
        'high-equity', 
        'absentee-owner',
        'vacant'
      ];
    }

    // Add equity filter
    if (criteria.minEquity) {
      if (!requestBody.searchCriteria.valuation) {
        requestBody.searchCriteria.valuation = {};
      }
      requestBody.searchCriteria.valuation.equityPercent = {
        min: criteria.minEquity
      };
    }

    // Add price filter
    if (criteria.maxPrice) {
      if (!requestBody.searchCriteria.valuation) {
        requestBody.searchCriteria.valuation = {};
      }
      requestBody.searchCriteria.valuation.estimatedValue = {
        max: criteria.maxPrice
      };
    }

    const response = await this.makeRequest('/api/v1/property/search', requestBody);
    
    // Transform response to match expected format
    return {
      success: true,
      data: response.results?.properties || [],
      total_results: response.meta?.totalResults || 0,
      page: page,
      per_page: perPage
    };
  }

  async getPropertyDetails(propertyId: string): Promise<BatchLeadsProperty> {
    // BatchData doesn't have individual property lookup by ID in this endpoint
    throw new Error('Property details lookup by ID not implemented for BatchData API');
  }

  async getDistressedProperties(location: string, limit = 25): Promise<BatchLeadsProperty[]> {
    const response = await this.searchProperties({
      location,
      distressedOnly: true,
      propertyType: 'single_family'
    }, 1, limit);

    return response.data;
  }

  // Convert BatchData property to our schema format
  convertToProperty(batchProperty: any, userId: string): any {
    const estimatedValue = batchProperty.valuation?.estimatedValue || 0;
    const maxOffer = Math.floor(estimatedValue * 0.7); // 70% rule
    const equityPercent = batchProperty.valuation?.equityPercent || 0;
    
    return {
      userId,
      address: batchProperty.address?.street || '',
      city: batchProperty.address?.city || '',
      state: batchProperty.address?.state || '',
      zipCode: batchProperty.address?.zip || '',
      bedrooms: batchProperty.building?.bedrooms || null,
      bathrooms: batchProperty.building?.bathrooms || null,
      squareFeet: batchProperty.building?.livingArea || null,
      arv: estimatedValue.toString(),
      maxOffer: maxOffer.toString(),
      status: 'new',
      leadType: this.getLeadType(batchProperty),
      propertyType: batchProperty.building?.propertyType || 'single_family',
      yearBuilt: batchProperty.building?.yearBuilt || null,
      lastSalePrice: batchProperty.sale?.lastSalePrice?.toString() || null,
      lastSaleDate: batchProperty.sale?.lastSaleDate || null,
      ownerName: batchProperty.owner?.fullName || null,
      ownerPhone: null,
      ownerEmail: null,
      equityPercentage: Math.round(equityPercent),
      motivationScore: this.calculateMotivationScore(batchProperty),
      distressedIndicator: this.getDistressedIndicator(batchProperty)
    };
  }

  private getLeadType(property: any): string {
    const equityPercent = property.valuation?.equityPercent || 0;
    const isAbsenteeOwner = property.quickLists?.absenteeOwner || false;
    const isVacant = property.quickLists?.vacant || false;
    const isPreforeclosure = property.quickLists?.preforeclosure || false;
    
    if (isPreforeclosure) {
      return 'preforeclosure';
    }
    if (equityPercent >= 70) {
      return 'high_equity';
    }
    if (isAbsenteeOwner) {
      return 'absentee_owner';
    }
    if (isVacant) {
      return 'vacant';
    }
    if (equityPercent >= 50) {
      return 'motivated_seller';
    }
    return 'standard';
  }

  private calculateMotivationScore(property: any): number {
    let score = 50; // Base score
    
    const equityPercent = property.valuation?.equityPercent || 0;
    const quickLists = property.quickLists || {};
    
    // High equity adds points
    if (equityPercent >= 70) score += 30;
    else if (equityPercent >= 50) score += 20;
    
    // Various distress indicators add points
    if (quickLists.absenteeOwner) score += 20;
    if (quickLists.vacant) score += 25;
    if (quickLists.preforeclosure) score += 35;
    if (quickLists.freeAndClear) score += 15;
    if (quickLists.highEquity) score += 25;
    
    // Old property adds points
    const yearBuilt = property.building?.yearBuilt || new Date().getFullYear();
    const age = new Date().getFullYear() - yearBuilt;
    if (age >= 40) score += 15;
    else if (age >= 20) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private getDistressedIndicator(property: any): string {
    const quickLists = property.quickLists || {};
    
    if (quickLists.preforeclosure) return 'preforeclosure';
    if (quickLists.vacant) return 'vacant';
    if (quickLists.highEquity && quickLists.absenteeOwner) return 'high_equity_absentee';
    if (quickLists.highEquity) return 'high_equity';
    if (quickLists.absenteeOwner) return 'absentee_owner';
    if (quickLists.freeAndClear) return 'free_and_clear';
    return 'standard';
  }
}

export const batchLeadsService = new BatchLeadsService();

// Export types for use in other files
export type { BatchLeadsProperty, SearchCriteria };