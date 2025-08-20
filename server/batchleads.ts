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

    // Apply quicklists from search criteria (mapped from wizard step 2)
    if (criteria.quickLists && criteria.quickLists.length > 0) {
      requestBody.searchCriteria.quickLists = criteria.quickLists;
      console.log(`🎯 Using quicklists: ${criteria.quickLists.join(', ')}`);
    }

    // Add property type filters
    if (criteria.propertyType === 'single_family') {
      // Don't override quicklists, just ensure we're looking for residential
      if (!requestBody.searchCriteria.property) {
        requestBody.searchCriteria.property = {};
      }
      requestBody.searchCriteria.property.propertyType = 'single-family';
    } else if (criteria.propertyType === 'multi_family') {
      if (!requestBody.searchCriteria.property) {
        requestBody.searchCriteria.property = {};
      }
      requestBody.searchCriteria.property.propertyType = 'multi-family';
    } else if (criteria.propertyType === 'condo') {
      if (!requestBody.searchCriteria.property) {
        requestBody.searchCriteria.property = {};
      }
      requestBody.searchCriteria.property.propertyType = 'condominium';
    }

    // Add equity filter if specified
    if (criteria.minEquity || (criteria.quickLists && criteria.quickLists.includes('high-equity'))) {
      if (!requestBody.searchCriteria.valuation) {
        requestBody.searchCriteria.valuation = {};
      }
      requestBody.searchCriteria.valuation.equityPercent = {
        min: criteria.minEquity || 70
      };
    }

    // Add bedroom filter - this should filter at API level
    if (criteria.minBedrooms) {
      if (!requestBody.searchCriteria.building) {
        requestBody.searchCriteria.building = {};
      }
      // Try multiple filter approaches for better API compatibility
      requestBody.searchCriteria.building.bedrooms = {
        min: criteria.minBedrooms,
        gte: criteria.minBedrooms  // Also try "greater than or equal" syntax
      };
      
      // Also try filtering out null/empty bedroom data
      requestBody.searchCriteria.building.bedroomsExists = true;
      
      console.log(`🛏️ Added comprehensive bedroom filter: min ${criteria.minBedrooms} bedrooms (with existence check)`);
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
      console.log(`💰 Added price filter: max $${criteria.maxPrice.toLocaleString()}`);
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

  // Search for multiple valid properties with exclusion support
  async searchValidProperties(criteria: any, count: number = 5, excludePropertyIds: string[] = []): Promise<{
    data: any[];
    totalChecked: number;
    filtered: number;
    hasMore: boolean;
  }> {
    let totalChecked = 0;
    let filtered = 0;
    const validProperties = [];
    let page = 1;
    const maxPages = 10; // Prevent infinite loops

    console.log(`🔍 Searching for ${count} properties with criteria:`, criteria);
    console.log(`🚫 Excluding ${excludePropertyIds.length} property IDs:`, excludePropertyIds);

    while (validProperties.length < count && page <= maxPages) {
      try {
        const response = await this.searchProperties(criteria, page, 50);

        if (!response.data || response.data.length === 0) {
          console.log(`📄 Page ${page}: No more properties available`);
          break;
        }

        console.log(`📄 Page ${page}: Found ${response.data.length} raw properties`);

        for (const rawProperty of response.data) {
          totalChecked++;

          // Generate property ID for deduplication
          const propertyId = rawProperty._id || `${rawProperty.address?.street}_${rawProperty.owner?.fullName}`;

          // Skip if already shown
          if (excludePropertyIds.includes(propertyId)) {
            console.log(`⏭️ Skipping already shown property: ${propertyId}`);
            filtered++;
            continue;
          }

          const convertedProperty = this.convertToProperty(rawProperty, 'demo-user', criteria);

          if (convertedProperty !== null) {
            // Add the property ID for future exclusion
            convertedProperty.id = propertyId;
            validProperties.push(convertedProperty);
            console.log(`✅ Added valid property ${validProperties.length}/${count}: ${convertedProperty.address}`);

            if (validProperties.length >= count) {
              break;
            }
          } else {
            filtered++;
          }
        }

        page++;
      } catch (error) {
        console.error(`❌ Error on page ${page}:`, error);
        break;
      }
    }

    console.log(`📊 Search complete: ${validProperties.length} valid properties, ${totalChecked} checked, ${filtered} filtered`);

    return {
      data: validProperties,
      totalChecked,
      filtered,
      hasMore: page <= maxPages && totalChecked > 0
    };
  }

  // Get next valid property with error handling and filtering
  async getNextValidProperty(criteria: any, sessionState?: any): Promise<{
    property: any | null;
    sessionState: any;
    hasMore: boolean;
    totalChecked: number;
    filtered: number;
  }> {
    let page = sessionState?.currentPage || 1;
    let totalChecked = 0;
    let filtered = 0;
    const maxPages = 10; // Prevent infinite loops
    const excludePropertyIds = sessionState?.excludePropertyIds || [];

    while (page <= maxPages) {
      try {
        const response = await this.searchProperties(criteria, page, 50);

        if (!response.data || response.data.length === 0) {
          console.log(`📄 Page ${page}: No more properties available`);
          break;
        }

        console.log(`📄 Page ${page}: Found ${response.data.length} raw properties`);

        for (const rawProperty of response.data) {
          totalChecked++;

          // Generate property ID for deduplication
          const propertyId = rawProperty._id || `${rawProperty.address?.street}_${rawProperty.owner?.fullName}`;

          // Skip if already shown
          if (excludePropertyIds.includes(propertyId)) {
            console.log(`⏭️ Skipping already shown property: ${propertyId}`);
            filtered++;
            continue;
          }

          const convertedProperty = this.convertToProperty(rawProperty, 'demo-user', criteria);

          if (convertedProperty !== null) {
            return {
              property: rawProperty,
              sessionState: {
                ...sessionState,
                currentPage: page,
                searchCriteria: criteria,
                excludePropertyIds: [...excludePropertyIds, propertyId]
              },
              hasMore: true,
              totalChecked,
              filtered
            };
          } else {
            filtered++;
          }
        }

        page++;
      } catch (error) {
        console.error(`❌ Error on page ${page}:`, error);
        break;
      }
    }

    console.log(`📊 No more valid properties found.`);
    return {
      property: null,
      sessionState: {
        ...sessionState,
        currentPage: page,
        searchCriteria: criteria,
        excludePropertyIds
      },
      hasMore: false,
      totalChecked,
      filtered
    };
  }


  // Convert BatchData property to our schema format with enhanced data extraction
  convertToProperty(batchProperty: any, userId: string, criteria?: SearchCriteria): any {
    console.log(`🔍 Converting property with ID: ${batchProperty._id}`);

    const estimatedValue = batchProperty.valuation?.estimatedValue || 0;
    const equityPercent = batchProperty.valuation?.equityPercent;

    // Extract comprehensive building details from tax assessor data
    const building = batchProperty.building || {};
    const taxAssessor = batchProperty.taxAssessor || {};
    
    // Enhanced building data extraction - check multiple sources
    const bedrooms = building.bedrooms || taxAssessor.bedrooms || building.rooms || 
                     batchProperty.propertyDetails?.bedrooms || null;
    const bathrooms = building.bathrooms || taxAssessor.bathrooms || building.fullBaths || 
                      building.halfBaths || batchProperty.propertyDetails?.bathrooms || null;
    const squareFeet = building.livingArea || building.totalLivingArea || taxAssessor.livingArea || 
                      building.buildingSquareFeet || taxAssessor.squareFeet || 
                      batchProperty.propertyDetails?.squareFeet || null;
    const yearBuilt = building.yearBuilt || taxAssessor.yearBuilt || 
                     batchProperty.propertyDetails?.yearBuilt || null;
    
    // Extract address information
    const address = batchProperty.address?.street;
    const city = batchProperty.address?.city;
    const state = batchProperty.address?.state;
    const zipCode = batchProperty.address?.zip;
    const ownerName = batchProperty.owner?.fullName;

    console.log(`📋 Extracted values:`, {
      estimatedValue,
      equityPercent,
      address,
      city,
      state,
      zipCode,
      ownerName,
      bedrooms: bedrooms !== null ? bedrooms : 'Not provided by API',
      bathrooms: bathrooms !== null ? bathrooms : 'Not provided by API',
      squareFeet: squareFeet !== null ? squareFeet : 'Not provided by API',
      hasBuildingData: !!(bedrooms !== null || bathrooms !== null || squareFeet !== null),
      passesSquareFootageFilter: squareFeet === null || squareFeet > 0
    });

    // Apply state filtering based on location criteria  
    if (criteria?.location && state) {
      const locationLower = criteria.location.toLowerCase();
      const stateLower = state.toLowerCase();
      
      // Check if location specifies a state and property state matches
      if (locationLower.includes(', pa') && stateLower !== 'pa') {
        console.log(`❌ Property filtered out - wrong state (property in ${state}, search for PA)`);
        return null;
      }
      if (locationLower.includes(', ca') && stateLower !== 'ca') {
        console.log(`❌ Property filtered out - wrong state (property in ${state}, search for CA)`);
        return null;
      }
      if (locationLower.includes(', ny') && stateLower !== 'ny') {
        console.log(`❌ Property filtered out - wrong state (property in ${state}, search for NY)`);
        return null;
      }
      // Add more states as needed - prioritize common search states
      if (locationLower.includes(', fl') && stateLower !== 'fl') {
        console.log(`❌ Property filtered out - wrong state (property in ${state}, search for FL)`);
        return null;
      }
      if (locationLower.includes(', tx') && stateLower !== 'tx') {
        console.log(`❌ Property filtered out - wrong state (property in ${state}, search for TX)`);
        return null;
      }
    }

    // Apply bedroom filter if provided in criteria
    if (criteria?.minBedrooms) {
      // Reject properties with no bedroom data when bedroom criteria is specified
      if (bedrooms === null || bedrooms === undefined) {
        console.log(`❌ Property filtered out - no bedroom data available (required: ${criteria.minBedrooms}+ bedrooms)`);
        return null;
      }
      
      // Reject properties that don't meet minimum bedroom requirement
      if (bedrooms < criteria.minBedrooms) {
        console.log(`❌ Property filtered out - does not meet minimum bedroom requirement (${bedrooms} bedrooms found, ${criteria.minBedrooms} required)`);
        return null;
      }
    }

    // Apply price filter if provided in criteria
    if (criteria?.maxPrice && estimatedValue > criteria.maxPrice) {
      console.log(`❌ Property filtered out - exceeds max price (${estimatedValue} > ${criteria.maxPrice})`);
      return null;
    }

    // Balanced validation - require core data but allow properties when building data is not provided by API
    if (!estimatedValue ||
        estimatedValue <= 10000 ||
        !address ||
        !city ||
        !state ||
        !zipCode) {
      console.log(`❌ Property filtered out - missing critical financial or address data`);
      return null;
    }

    // Only filter out if we have building data AND it's invalid (0 or negative)
    if ((bedrooms !== null && bedrooms <= 0) || (squareFeet !== null && squareFeet <= 0)) {
      console.log(`❌ Property filtered out - invalid building data (0 bedrooms or 0 sq ft)`);
      return null;
    }

    // Use default equity if not available
    const finalEquityPercent = equityPercent !== undefined && equityPercent !== null ? equityPercent : 50;

    const maxOffer = Math.floor(estimatedValue * 0.7); // 70% rule

    const convertedProperty = {
      userId,
      address: address,
      city: city,
      state: state,
      zipCode: zipCode,
      bedrooms: bedrooms !== null ? bedrooms : null, // Preserve null for missing data
      bathrooms: bathrooms !== null ? bathrooms : null, // Preserve null for missing data
      squareFeet: squareFeet !== null ? squareFeet : null, // Preserve null for missing data
      arv: estimatedValue.toString(),
      maxOffer: maxOffer.toString(),
      status: 'new',
      leadType: this.getLeadType(batchProperty),
      propertyType: batchProperty.building?.propertyType || 'single_family',
      yearBuilt: batchProperty.building?.yearBuilt || null,
      lastSalePrice: batchProperty.sale?.lastSale?.salePrice?.toString() || 
                     batchProperty.sale?.priorSale?.salePrice?.toString() || 
                     batchProperty.propertyDetails?.lastSalePrice?.toString() || null,
      lastSaleDate: batchProperty.sale?.lastSale?.saleDate || 
                    batchProperty.sale?.priorSale?.saleDate || 
                    batchProperty.propertyDetails?.lastSaleDate || null,
      ownerName: ownerName || 'Contact info available via skip trace',
      ownerPhone: 'Available via skip trace',
      ownerEmail: 'Available via skip trace',
      ownerMailingAddress: batchProperty.owner?.mailingAddress ?
        `${batchProperty.owner.mailingAddress.street}, ${batchProperty.owner.mailingAddress.city}, ${batchProperty.owner.mailingAddress.state} ${batchProperty.owner.mailingAddress.zip}` :
        `${address}, ${city}, ${state} ${zipCode}`,
      equityPercentage: Math.round(finalEquityPercent),
      motivationScore: this.calculateMotivationScore(batchProperty),
      distressedIndicator: this.getDistressedIndicator(batchProperty)
    };

    console.log(`✅ Successfully converted property:`, convertedProperty);
    return convertedProperty;
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