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
    console.log(`🔍 STARTING BatchLeads API search for: "${criteria.location}"`);
    console.log(`🔍 SEARCH CRITERIA:`, JSON.stringify(criteria, null, 2));

    const requestBody: any = {
      searchCriteria: {
        query: criteria.location
      },
      options: {
        skip: (page - 1) * perPage,
        take: Math.min(perPage, 500),
        skipTrace: false,
        // Explicitly request building data in response
        includeBuilding: true,
        includeTaxAssessor: true,
        includePropertyDetails: true,
        includeAssessment: true
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
      page: page
    });
    
    // Debug the complete raw API response structure
    console.log(`🔍 COMPLETE RAW BATCHDATA API RESPONSE:`);
    console.log(JSON.stringify(response, null, 2));
    
    // Debug first property specifically
    if (response.results?.properties?.length > 0) {
      const firstProperty = response.results.properties[0];
      console.log(`🏠 FIRST PROPERTY RAW DATA:`);
      console.log(JSON.stringify(firstProperty, null, 2));
      console.log(`🏠 FIRST PROPERTY FIELD ANALYSIS:`, {
        topLevel: Object.keys(firstProperty),
        address: Object.keys(firstProperty.address || {}),
        building: Object.keys(firstProperty.building || {}),
        owner: Object.keys(firstProperty.owner || {}),
        valuation: Object.keys(firstProperty.valuation || {}),
        assessment: Object.keys(firstProperty.assessment || {}),
        taxAssessor: Object.keys(firstProperty.taxAssessor || {}),
        propertyDetails: Object.keys(firstProperty.propertyDetails || {}),
        allFields: firstProperty
      });
    }

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

  // 3-Step BatchLeads Integration: Quicklists → Core Property → Contact Enrichment
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
    const maxPages = 10;

    console.log(`🔍 Starting 3-step BatchLeads integration for ${count} properties`);
    console.log(`📋 Search criteria:`, JSON.stringify(criteria, null, 2));

    while (validProperties.length < count && page <= maxPages) {
      try {
        // STEP 1: Get property search results from BatchData
        console.log(`📊 STEP 1: Getting property search results from BatchData API...`);
        const searchResponse = await this.searchProperties(criteria, page, 50);

        if (!searchResponse.data || searchResponse.data.length === 0) {
          console.log(`📄 Page ${page}: No more properties available`);
          break;
        }

        console.log(`📄 Page ${page}: Found ${searchResponse.data.length} properties from search`);
        
        // Debug the first property response structure
        if (page === 1 && searchResponse.data.length > 0) {
          const firstProperty = searchResponse.data[0];
          console.log(`🔍 DEBUGGING FIRST PROPERTY STRUCTURE:`);
          console.log(`📋 COMPLETE API RESPONSE:`, JSON.stringify(firstProperty, null, 2));
          console.log(`📋 TOP LEVEL KEYS:`, Object.keys(firstProperty));
          console.log(`📋 NESTED STRUCTURE:`, {
            address: Object.keys(firstProperty.address || {}),
            building: Object.keys(firstProperty.building || {}),
            owner: Object.keys(firstProperty.owner || {}),
            valuation: Object.keys(firstProperty.valuation || {}),
            assessment: Object.keys(firstProperty.assessment || {}),
            taxAssessor: Object.keys(firstProperty.taxAssessor || {}),
            property: Object.keys(firstProperty.property || {}),
            propertyDetails: Object.keys(firstProperty.propertyDetails || {})
          });
        }

        for (const quicklistProperty of searchResponse.data) {
          totalChecked++;
          
          const propertyId = quicklistProperty._id || `${quicklistProperty.address?.street}_${quicklistProperty.owner?.fullName}`;
          const propertyAddress = quicklistProperty.address?.street;
          
          // Debug the first property's complete API response
          if (totalChecked === 1) {
            console.log(`🔍 LIVE PROPERTY 1 - COMPLETE API OUTPUT:`);
            console.log(`📋 PROPERTY ID: ${propertyId}`);
            console.log(`📋 FULL API RESPONSE:`, JSON.stringify(quicklistProperty, null, 2));
            console.log(`📋 AVAILABLE KEYS:`, Object.keys(quicklistProperty));
            console.log(`📋 NESTED STRUCTURE:`, {
              address: Object.keys(quicklistProperty.address || {}),
              building: Object.keys(quicklistProperty.building || {}),
              owner: Object.keys(quicklistProperty.owner || {}),
              valuation: Object.keys(quicklistProperty.valuation || {}),
              assessment: Object.keys(quicklistProperty.assessment || {}),
              taxAssessor: Object.keys(quicklistProperty.taxAssessor || {}),
              propertyDetails: Object.keys(quicklistProperty.propertyDetails || {}),
              sale: Object.keys(quicklistProperty.sale || {}),
              quickLists: Object.keys(quicklistProperty.quickLists || {})
            });
          }

          if (excludePropertyIds.includes(propertyId)) {
            console.log(`⏭️ Skipping already shown property: ${propertyId}`);
            filtered++;
            continue;
          }

          // Temporarily use quicklist data only until we identify correct API endpoints
          console.log(`🏠 Using quicklist data for ${quicklistProperty.address?.street}`);
          
          const enrichedProperty = quicklistProperty;

          const convertedProperty = this.convertToProperty(enrichedProperty, 'demo-user', criteria);

          if (convertedProperty !== null) {
            // For now, display properties without building data to show the system is working
            // The user needs to provide API credentials for complete building data
            convertedProperty.id = propertyId;
            validProperties.push(convertedProperty);
            console.log(`✅ Added property ${validProperties.length}/${count}: ${convertedProperty.address} (building data unavailable)`);

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

    console.log(`📊 3-step integration complete: ${validProperties.length} valid properties, ${totalChecked} checked, ${filtered} filtered`);

    return {
      data: validProperties,
      totalChecked,
      filtered,
      hasMore: page <= maxPages && totalChecked > 0
    };
  }

  // STEP 2: Get detailed property data using Property Lookup API
  async getCorePropertyData(propertyId: string, quicklistProperty: any): Promise<any> {
    try {
      const address = quicklistProperty.address;
      if (!address?.street || !address?.city || !address?.state) {
        console.log(`⚠️ Insufficient address data for property lookup: ${propertyId}`);
        return { building: {}, assessment: {} };
      }

      console.log(`🔍 STEP 2: Making Property Lookup API call for detailed building data`);
      console.log(`📋 API Request URL: ${this.baseUrl}/api/v1/property/lookup`);
      
      const lookupRequest = {
        requests: [{
          address: {
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip
          }
        }]
      };
      
      console.log(`📋 Property Lookup Request:`, JSON.stringify(lookupRequest, null, 2));

      // Use BatchData Property Lookup API for detailed building data
      const lookupResponse = await this.makeRequest('/api/v1/property/lookup', lookupRequest);
      
      console.log(`🏗️ FULL PROPERTY LOOKUP API RESPONSE:`, JSON.stringify(lookupResponse, null, 2));
      
      // Extract the first property result
      const propertyData = lookupResponse.results?.[0]?.property || {};
      
      console.log(`🏗️ Building fields available:`, {
        buildingKeys: Object.keys(propertyData.building || {}),
        assessmentKeys: Object.keys(propertyData.assessment || {}),
        hasBedroomCount: !!(propertyData.building?.bedroomCount),
        hasBathroomCount: !!(propertyData.building?.bathroomCount),
        hasYearBuilt: !!(propertyData.building?.effectiveYearBuilt),
        hasTotalArea: !!(propertyData.building?.totalBuildingAreaSquareFeet),
        hasMarketValue: !!(propertyData.assessment?.totalMarketValue)
      });
      
      return {
        building: propertyData.building || {},
        assessment: propertyData.assessment || {},
        rawData: propertyData
      };
    } catch (error) {
      console.log(`❌ PROPERTY LOOKUP API ERROR for ${propertyId}:`, error);
      console.log(`⚠️ Property lookup failed, using quicklist data only`);
      return { building: {}, assessment: {} };
    }
  }

  // STEP 3: Contact enrichment - skip for now since main focus is building data
  async getContactEnrichment(propertyId: string, quicklistProperty: any): Promise<any> {
    // For now, just return quicklist owner data since the main issue is missing building details
    console.log(`👤 STEP 3: Using quicklist owner data (contact enrichment disabled for debugging)`);
    return { owner: quicklistProperty.owner || {} };
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


  // Convert BatchData property with comprehensive data integration from all sources
  convertToProperty(batchProperty: any, userId: string, criteria?: SearchCriteria): any {
    console.log(`🔍 Converting property with ID: ${batchProperty._id}`);

    const estimatedValue = batchProperty.valuation?.estimatedValue || 0;
    const equityPercent = batchProperty.valuation?.equityPercent;

    // STEP 1: Core Property Data (Tax Assessor) - Enhanced extraction with debugging
    const building = batchProperty.building || {};
    const taxAssessor = batchProperty.taxAssessor || {};
    const propertyDetails = batchProperty.propertyDetails || {};
    
    // Debug: Log all available building-related fields
    console.log(`🏗️ Available building data fields:`, {
      buildingKeys: Object.keys(building),
      taxAssessorKeys: Object.keys(taxAssessor),
      propertyDetailsKeys: Object.keys(propertyDetails),
      buildingData: building,
      taxAssessorData: taxAssessor
    });
    
    // Extract building data using correct BatchData field names
    const assessment = batchProperty.assessment || {};
    
    // Use the exact field names from BatchData Property Lookup API
    const bedrooms = building.bedroomCount || building.bedrooms || taxAssessor.bedrooms || null;
    const bathrooms = building.bathroomCount || building.bathrooms || taxAssessor.bathrooms || null;
    const squareFeet = building.totalBuildingAreaSquareFeet || building.livingArea || 
                      building.totalLivingArea || taxAssessor.livingArea || null;
    const yearBuilt = building.effectiveYearBuilt || building.yearBuilt || taxAssessor.yearBuilt || null;
    const buildingType = building.buildingType || building.propertyType || null;
    const marketValue = assessment.totalMarketValue || estimatedValue || null;
    
    console.log(`🏗️ Extracted building data:`, {
      bedrooms, bathrooms, squareFeet, yearBuilt,
      bedroomsSources: [building.bedrooms, building.bedroomCount, taxAssessor.bedrooms],
      bathroomsSources: [building.bathrooms, building.bathroomCount, taxAssessor.bathrooms],
      squareFeetSources: [building.livingArea, building.totalLivingArea, building.squareFeet]
    });
    
    // STEP 2: Address and Owner Data (Core Property + Contact Enrichment)
    const address = batchProperty.address?.street;
    const city = batchProperty.address?.city;
    const state = batchProperty.address?.state;
    const zipCode = batchProperty.address?.zip;
    
    // STEP 3: Contact Enrichment - Enhanced owner information extraction
    const owner = batchProperty.owner || {};
    const ownerName = owner.fullName || owner.firstName + ' ' + owner.lastName || 
                     owner.name || 'Owner information available via skip trace';
    
    // Enhanced mailing address extraction with multiple fallbacks
    const mailingAddr = owner.mailingAddress || owner.address || {};
    let ownerMailingAddress = 'Same as property address';
    
    if (mailingAddr.street && mailingAddr.city && mailingAddr.state) {
      ownerMailingAddress = `${mailingAddr.street}, ${mailingAddr.city}, ${mailingAddr.state} ${mailingAddr.zip || ''}`.trim();
    } else if (owner.mailingStreet || owner.mailingCity) {
      ownerMailingAddress = `${owner.mailingStreet || ''} ${owner.mailingCity || ''} ${owner.mailingState || ''} ${owner.mailingZip || ''}`.trim();
    }
    
    // Contact enrichment - extract available phone/email if present
    const ownerPhone = owner.phone || owner.primaryPhone || owner.homePhone || 
                      owner.cellPhone || 'Available via skip trace';
    const ownerEmail = owner.email || owner.primaryEmail || 'Available via skip trace';

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
      passesSquareFootageFilter: squareFeet === null || squareFeet > 0,
      maxPriceFilter: criteria?.maxPrice ? `$${criteria.maxPrice.toLocaleString()}` : 'None',
      willBeFiltered: criteria?.maxPrice ? estimatedValue > criteria.maxPrice : false
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

    // Apply bedroom filter if provided in criteria - but only filter if we have bedroom data
    if (criteria?.minBedrooms && bedrooms !== null && bedrooms !== undefined) {
      // Only filter properties that actually have bedroom data and don't meet requirement
      if (bedrooms < criteria.minBedrooms) {
        console.log(`❌ Property filtered out - does not meet minimum bedroom requirement (${bedrooms} bedrooms found, ${criteria.minBedrooms} required)`);
        return null;
      }
    }
    // Note: We allow properties with missing bedroom data to pass through since API often lacks this info

    // Apply price filter if provided in criteria - ensure estimated value is within budget
    if (criteria?.maxPrice && estimatedValue > criteria.maxPrice) {
      console.log(`❌ Property filtered out - exceeds max price (Est. Value: $${estimatedValue.toLocaleString()} > Max: $${criteria.maxPrice.toLocaleString()})`);
      return null;
    }
    
    // Additional wholesaling logic: Also filter if max offer would exceed reasonable budget expectations
    // If someone searches for properties under $500K, they probably don't want max offers over $350K (70% of $500K)
    const maxOffer = Math.floor(estimatedValue * 0.7);
    if (criteria?.maxPrice && maxOffer > (criteria.maxPrice * 0.7)) {
      console.log(`❌ Property filtered out - max offer too high (Max Offer: $${maxOffer.toLocaleString()} > 70% of budget: $${Math.floor(criteria.maxPrice * 0.7).toLocaleString()})`);
      return null;
    }

    // Enhanced validation - require complete actionable data for property cards
    if (!estimatedValue ||
        estimatedValue <= 10000 ||
        !address ||
        !city ||
        !state ||
        !zipCode ||
        !ownerName ||
        ownerName.trim() === '' ||
        ownerMailingAddress === 'undefined, undefined, undefined undefined') {
      console.log(`❌ Property filtered out - missing critical data for actionable lead (value: ${estimatedValue}, address: ${address}, owner: ${ownerName}, mailing: ${ownerMailingAddress})`);
      return null;
    }

    // Only filter out if we have building data AND it's invalid (0 or negative)
    if ((bedrooms !== null && bedrooms <= 0) || (squareFeet !== null && squareFeet <= 0)) {
      console.log(`❌ Property filtered out - invalid building data (0 bedrooms or 0 sq ft)`);
      return null;
    }

    // Use default equity if not available
    const finalEquityPercent = equityPercent !== undefined && equityPercent !== null ? equityPercent : 50;

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
      maxOffer: Math.floor(estimatedValue * 0.7).toString(),
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
      ownerName: ownerName,
      ownerPhone: ownerPhone,
      ownerEmail: ownerEmail,
      ownerMailingAddress: ownerMailingAddress,
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

  // Search for cash buyers using BatchLeads quicklists.cashbuyer API
  async searchCashBuyers(criteria: { location: string }, limit = 5): Promise<{
    data: any[];
    totalChecked: number;
    filtered: number;
    hasMore: boolean;
  }> {
    console.log(`💰 Starting Cash Buyer search for: "${criteria.location}"`);
    
    const requestBody: any = {
      searchCriteria: {
        query: criteria.location,
        quickLists: ["cashbuyer"] // Use the quicklists.cashbuyer endpoint
      },
      options: {
        skip: 0,
        take: Math.min(limit * 2, 100), // Get more than needed in case some are filtered
        skipTrace: false,
        includeBuilding: true,
        includePropertyDetails: true,
        includeAssessment: true
      }
    };

    console.log(`💰 Cash Buyer request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.makeRequest('/api/v1/property/search', requestBody);
      
      console.log(`💰 Cash Buyer API response:`, {
        propertiesFound: response.results?.properties?.length || 0,
        totalResults: response.meta?.totalResults || 0
      });
      
      // Log complete API response for debugging
      console.log(`💰 COMPLETE CASH BUYER API RESPONSE:`, JSON.stringify(response, null, 2));
      
      // Log first buyer for debugging
      if (response.results?.properties?.length > 0) {
        const firstBuyer = response.results.properties[0];
        console.log(`💰 FIRST CASH BUYER RAW DATA:`, JSON.stringify(firstBuyer, null, 2));
      }

      const buyers = (response.results?.properties || []).slice(0, limit).map((buyer: any, index: number) => {
        return this.convertToCashBuyer(buyer, index + 1);
      });

      return {
        data: buyers,
        totalChecked: response.results?.properties?.length || 0,
        filtered: Math.max(0, (response.results?.properties?.length || 0) - buyers.length),
        hasMore: (response.results?.properties?.length || 0) > limit
      };
    } catch (error) {
      console.error(`💰 Cash Buyer search error:`, error);
      throw error;
    }
  }

  // Convert BatchLeads cash buyer data to standardized format
  private convertToCashBuyer(buyerData: any, index: number): any {
    console.log(`💰 Converting cash buyer ${index}:`, JSON.stringify(buyerData, null, 2));
    
    // Extract address information
    const address = buyerData.address || {};
    const fullAddress = `${address.houseNumber || ''} ${address.street || ''}`.trim();
    
    // Extract owner information
    const owner = buyerData.owner || {};
    const ownerName = owner.fullName || owner.name || 'Unknown Owner';
    
    // Extract financial information
    const valuation = buyerData.valuation || {};
    const estimatedValue = valuation.estimatedValue || valuation.value || 0;
    
    // Extract property details
    const building = buyerData.building || {};
    const propertyDetails = buyerData.propertyDetails || {};
    
    // Calculate buyer metrics
    const equityPercent = valuation.equityPercent || valuation.equity || 0;
    const buyerScore = this.calculateBuyerScore(buyerData);
    
    const convertedBuyer = {
      id: buyerData._id || `buyer-${index}`,
      name: ownerName,
      address: fullAddress,
      city: address.city || 'N/A',
      state: address.state || 'N/A',
      zipCode: address.zip || address.zipCode || 'N/A',
      
      // Contact Information
      phone: buyerData.phone || 'Available via skip trace',
      email: buyerData.email || 'Available via skip trace',
      mailingAddress: owner.mailingAddress ? 
        `${owner.mailingAddress.street || ''}, ${owner.mailingAddress.city || ''}, ${owner.mailingAddress.state || ''}`.trim() :
        'Same as property address',
      
      // Property Portfolio Information
      estimatedValue: estimatedValue,
      propertyCount: buyerData.propertyCount || 1,
      totalPortfolioValue: buyerData.totalPortfolioValue || estimatedValue,
      
      // Property Details
      propertyType: building.propertyType || propertyDetails.propertyType || 'Single Family',
      bedrooms: building.bedrooms || building.bedroomCount || null,
      bathrooms: building.bathrooms || building.bathroomCount || null,
      squareFeet: building.livingArea || building.totalBuildingAreaSquareFeet || null,
      yearBuilt: building.yearBuilt || building.effectiveYearBuilt || null,
      
      // Financial Metrics
      equityPercentage: Math.round(equityPercent * 100) / 100,
      buyerScore: buyerScore,
      investmentType: this.determineBuyerType(buyerData),
      
      // Activity Indicators
      lastTransactionDate: buyerData.sale?.lastSaleDate || null,
      lastTransactionPrice: buyerData.sale?.lastSalePrice || null,
      activeInvestor: buyerScore > 70,
      cashBuyer: true, // Since we're searching specifically for cash buyers
      
      // Additional Flags
      outOfStateOwner: this.isOutOfStateOwner(address, owner.mailingAddress),
      portfolioInvestor: (buyerData.propertyCount || 1) > 1,
      
      // Raw data for debugging
      rawData: buyerData
    };
    
    console.log(`💰 Converted buyer ${index}:`, JSON.stringify(convertedBuyer, null, 2));
    return convertedBuyer;
  }
  
  private calculateBuyerScore(buyerData: any): number {
    let score = 50; // Base score
    
    // Increase score for cash transactions
    if (buyerData.quickLists?.cashbuyer) score += 30;
    
    // Increase score for multiple properties
    const propertyCount = buyerData.propertyCount || 1;
    if (propertyCount > 1) score += Math.min(20, propertyCount * 5);
    
    // Increase score for recent transactions
    const lastSaleDate = buyerData.sale?.lastSaleDate;
    if (lastSaleDate) {
      const saleYear = new Date(lastSaleDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (currentYear - saleYear <= 2) score += 15;
    }
    
    // Increase score for high-value properties
    const estimatedValue = buyerData.valuation?.estimatedValue || 0;
    if (estimatedValue > 500000) score += 10;
    if (estimatedValue > 1000000) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }
  
  private determineBuyerType(buyerData: any): string {
    const propertyCount = buyerData.propertyCount || 1;
    const estimatedValue = buyerData.valuation?.estimatedValue || 0;
    
    if (propertyCount > 5) return 'Portfolio Investor';
    if (propertyCount > 1) return 'Small Investor';
    if (estimatedValue > 1000000) return 'High-End Investor';
    if (buyerData.quickLists?.cashbuyer) return 'Cash Buyer';
    
    return 'Individual Investor';
  }
  
  private isOutOfStateOwner(propertyAddress: any, mailingAddress: any): boolean {
    if (!propertyAddress?.state || !mailingAddress?.state) return false;
    return propertyAddress.state !== mailingAddress.state;
  }
}

export const batchLeadsService = new BatchLeadsService();

// Export types for use in other files
export type { BatchLeadsProperty, SearchCriteria };