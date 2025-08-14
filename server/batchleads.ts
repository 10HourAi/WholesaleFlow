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
  minBedrooms?: number;
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
    console.log(`🔍 BatchLeads API search for: "${criteria.location}"`);
    
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

    // Add bedroom filter
    if (criteria.minBedrooms) {
      if (!requestBody.searchCriteria.building) {
        requestBody.searchCriteria.building = {};
      }
      requestBody.searchCriteria.building.bedrooms = {
        min: criteria.minBedrooms
      };
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

    console.log(`📋 Full request body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.makeRequest('/api/v1/property/search', requestBody);
    
    console.log(`📊 BatchLeads API response:`, {
      propertiesFound: response.results?.properties?.length || 0,
      totalResults: response.meta?.totalResults || 0,
      page: page,
      rawResponse: JSON.stringify(response, null, 2)
    });
    
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

  // Search for valid properties with target count
  async searchValidProperties(criteria: SearchCriteria, targetCount = 5): Promise<{ success: boolean; data: any[]; total_results: number; validCount: number; filteredCount: number }> {
    let validProperties: any[] = [];
    let totalFiltered = 0;
    let currentPage = 1;
    const maxPages = 5; // Limit to prevent infinite loops
    
    while (validProperties.length < targetCount && currentPage <= maxPages) {
      const response = await this.searchProperties(criteria, currentPage, 25);
      
      if (!response.success || !response.data.length) {
        break;
      }
      
      // Convert and filter properties
      for (const prop of response.data) {
        const converted = this.convertToProperty(prop, 'temp-user');
        if (converted !== null) {
          validProperties.push(prop); // Store original property for return
          if (validProperties.length >= targetCount) break;
        } else {
          totalFiltered++;
        }
      }
      
      currentPage++;
    }
    
    return {
      success: true,
      data: validProperties,
      total_results: validProperties.length + totalFiltered,
      validCount: validProperties.length,
      filteredCount: totalFiltered
    };
  }

  // Get next valid property one at a time with session state
  async getNextValidProperty(criteria: SearchCriteria, sessionState?: { page: number; index: number; currentBatch?: any[] }): Promise<{ property: any | null; hasMore: boolean; sessionState: { page: number; index: number; currentBatch?: any[] }; totalChecked: number; filtered: number }> {
    let currentPage = sessionState?.page || 1;
    let currentIndex = sessionState?.index || 0;
    let currentBatch = sessionState?.currentBatch || [];
    let totalChecked = 0;
    let filtered = 0;
    const maxPages = 10; // Allow more pages for one-at-a-time searching
    
    while (currentPage <= maxPages) {
      // If we need a new batch of data
      if (currentBatch.length === 0 || currentIndex >= currentBatch.length) {
        const response = await this.searchProperties(criteria, currentPage, 25);
        
        if (!response.success || !response.data.length) {
          return {
            property: null,
            hasMore: false,
            sessionState: { page: currentPage, index: 0, currentBatch: [] },
            totalChecked,
            filtered
          };
        }
        
        currentBatch = response.data;
        currentIndex = 0;
      }
      
      // Check properties one by one
      while (currentIndex < currentBatch.length) {
        const prop = currentBatch[currentIndex];
        totalChecked++;
        
        const converted = this.convertToProperty(prop, 'temp-user');
        if (converted !== null) {
          // Found a valid property - return it and update session state
          return {
            property: prop,
            hasMore: true,
            sessionState: { page: currentPage, index: currentIndex + 1, currentBatch },
            totalChecked,
            filtered
          };
        } else {
          filtered++;
        }
        
        currentIndex++;
      }
      
      // Move to next page
      currentPage++;
      currentBatch = [];
      currentIndex = 0;
    }
    
    return {
      property: null,
      hasMore: false,
      sessionState: { page: currentPage, index: 0, currentBatch: [] },
      totalChecked,
      filtered
    };
  }

  // Convert BatchData property to our schema format
  convertToProperty(batchProperty: any, userId: string): any {
    const estimatedValue = batchProperty.valuation?.estimatedValue || 0;
    const equityPercent = batchProperty.valuation?.equityPercent;
    const bedrooms = batchProperty.building?.bedrooms || 0;
    const bathrooms = batchProperty.building?.bathrooms || 0;
    const squareFeet = batchProperty.building?.livingArea || 0;
    const address = batchProperty.address?.street;
    const city = batchProperty.address?.city;
    const state = batchProperty.address?.state;
    const zipCode = batchProperty.address?.zip;
    const ownerName = batchProperty.owner?.fullName;
    
    // Essential validation - only filter out properties missing core financial and contact data
    if (!estimatedValue || 
        estimatedValue <= 1000 || 
        equityPercent === undefined || 
        equityPercent === null || 
        isNaN(estimatedValue) ||
        isNaN(equityPercent) ||
        !address || 
        !city || 
        !state || 
        !zipCode ||
        !ownerName) {
      return null;
    }
    
    const maxOffer = Math.floor(estimatedValue * 0.7); // 70% rule
    
    return {
      userId,
      address: address,
      city: city,
      state: state,
      zipCode: zipCode,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      squareFeet: squareFeet || null,
      arv: estimatedValue.toString(),
      maxOffer: maxOffer.toString(),
      status: 'new',
      leadType: this.getLeadType(batchProperty),
      propertyType: batchProperty.building?.propertyType || 'single_family',
      yearBuilt: batchProperty.building?.yearBuilt || null,
      lastSalePrice: batchProperty.sale?.lastSalePrice?.toString() || null,
      lastSaleDate: batchProperty.sale?.lastSaleDate || null,
      ownerName: ownerName,
      ownerPhone: batchProperty.owner?.phoneNumbers?.[0] || null,
      ownerEmail: batchProperty.owner?.emailAddresses?.[0] || null,
      ownerMailingAddress: batchProperty.owner?.mailingAddress ? 
        `${batchProperty.owner.mailingAddress.street}, ${batchProperty.owner.mailingAddress.city}, ${batchProperty.owner.mailingAddress.state} ${batchProperty.owner.mailingAddress.zip}` : null,
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