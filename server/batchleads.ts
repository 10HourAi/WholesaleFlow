// server/batchleads.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Property } from "@shared/schema";

/**
 * Shapes observed in BatchData responses (from your debug logs).
 */
interface BatchLeadsProperty {
  _id?: string;
  address?: {
    houseNumber?: string;
    street?: string;
    streetAddress?: string;
    address?: string;
    city?: string;
    state?: string | { code?: string };
    stateCode?: string;
    zip?: string;
    zipCode?: string;
    postalCode?: string;
  };
  building?: {
    bedrooms?: number;
    bedroomCount?: number;
    bathrooms?: number;
    bathroomCount?: number;
    livingArea?: number;
    totalLivingArea?: number;
    totalBuildingAreaSquareFeet?: number;
    yearBuilt?: number;
    effectiveYearBuilt?: number;
    propertyType?: string;
    buildingType?: string;
  };
  valuation?: {
    estimatedValue?: number;
    equityPercent?: number;
  };
  assessment?: any;
  taxAssessor?: {
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    yearBuilt?: number;
  };
  sale?: {
    lastSaleDate?: string;
    lastSalePrice?: number;
  };
  owner?: {
    fullName?: string;
    full_name?: string;
    name?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    mailingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    address?: any;
    mailingStreet?: string;
    mailingCity?: string;
    mailingState?: string;
    mailingZip?: string;
    phone?: string;
    primaryPhone?: string;
    homePhone?: string;
    cellPhone?: string;
    mobilePhone?: string;
    email?: string;
    primaryEmail?: string;
    workEmail?: string;
    phoneNumbers?: Array<{
      number?: string;
      reachable?: boolean;
      status?: string;
      dnc?: boolean;
      type?: string;
    }>;
    emails?: Array<string | { email?: string }>;
  };
  quickLists?: {
    ownerOccupied?: boolean;
    absenteeOwner?: boolean;
    highEquity?: boolean;
    freeAndClear?: boolean;
    vacant?: boolean;
    preforeclosure?: boolean;
    cashbuyer?: boolean;
  };
  property?: any;
  propertyDetails?: any;
}

interface BatchLeadsSearchResponse {
  results?: { properties?: BatchLeadsProperty[] };
  meta?: { totalResults?: number };
}

interface SearchCriteria {
  location?: string;
  query?: string;

  // price / equity
  minPrice?: number;
  maxPrice?: number;
  minEquity?: number;

  // bedrooms
  minBedrooms?: number;

  // property type(s)
  propertyType?: string;
  propertyTypeList?: string[];

  // seller types coming from UI
  sellerTypes?: string[];

  // direct quickLists from caller (optional)
  quickLists?: string[];

  // pagination hints
  skip?: number;
  take?: number;

  // misc
  distressedOnly?: boolean;
  motivationScore?: number;
}

class BatchLeadsService {
  private apiKey: string;
  private baseUrl = "https://api.batchdata.com";

  constructor() {
    if (!process.env.BATCHLEADS_API_KEY) {
      throw new Error("BATCHLEADS_API_KEY is required");
    }
    this.apiKey = process.env.BATCHLEADS_API_KEY;
  }

  /**
   * Low-level POST helper
   */
  private async makeRequest(
    endpoint: string,
    requestBody: any,
  ): Promise<BatchLeadsSearchResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": "10HourAi/1.0",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `BatchData API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Normalize a list of quicklist identifiers into the canonical keys
   * that BatchData expects (based on your previous mapping).
   */
  private normalizeQuickLists(input: any[]): string[] {
    if (!Array.isArray(input)) return [];

    const map: Record<string, string> = {
      "out-of-state-absentee-owner": "out-of-state-absentee-owner",
      "absentee-owner": "out-of-state-absentee-owner",
      absentee: "out-of-state-absentee-owner",

      "high-equity": "high-equity",

      "not-active-listing": "not-active-listing",
      "not-pending-listing": "not-pending-listing",

      preforeclosure: "preforeclosure",
      vacant: "vacant",

      "cash-buyer": "cash-buyer",

      "free-and-clear": "free-and-clear",
    };

    return Array.from(
      new Set(
        input
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
          .map((k) => map[k] ?? k),
      ),
    );
  }

  /**
   * Map UI sellerTypes to BatchData quickLists.
   * e.g. "absentee" -> "out-of-state-absentee-owner"
   */
  private mergeSellerTypesToQuicklists(sellerTypes: string[] = []): string[] {
    const UI_TO_QUICKLIST: Record<string, string> = {
      distressed: "preforeclosure",
      absentee: "out-of-state-absentee-owner",
      high_equity: "high-equity",
      inherited: "inherited",
      tired_landlord: "tired-landlord",
      corporate: "corporate-owned",
      // passthroughs for canonical keys
      preforeclosure: "preforeclosure",
      "out-of-state-absentee-owner": "out-of-state-absentee-owner",
      "high-equity": "high-equity",
      "tired-landlord": "tired-landlord",
      "corporate-owned": "corporate-owned",
    };

    return Array.from(
      new Set(
        (sellerTypes || [])
          .map((s) => UI_TO_QUICKLIST[s] || null)
          .filter((x): x is string => Boolean(x)),
      ),
    );
  }

  /**
   * Builds the ONE canonical request for BatchData property search.
   * This replaces the previously duplicated blocks that triggered
   * "symbol already declared" errors for `searchCriteria`/`requestOptions`.
   * (Your earlier version had two separate const blocks.) :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6}
   */
  private buildSearchRequest(
    criteria: SearchCriteria = {},
    page = 1,
    perPage = 50,
    options: Partial<{ skipTrace: boolean }> = {},
  ) {
    // 1) Build quicklists from several sources
    const baseQuickLists = ["not-active-listing", "not-pending-listing"];
    const fromSellerTypes = Array.isArray(criteria.sellerTypes)
      ? this.mergeSellerTypesToQuicklists(criteria.sellerTypes)
      : [];
    const incomingQuicklists = Array.isArray(criteria.quickLists)
      ? criteria.quickLists
      : [];

    const combinedQuicklists = Array.from(
      new Set([...baseQuickLists, ...incomingQuicklists, ...fromSellerTypes]),
    );

    const normalizedQuicklists = this.normalizeQuickLists(combinedQuicklists);

    // 2) Build searchCriteria
    const searchCriteria: any = {
      query: criteria.location || criteria.query || "",
    };

    if (normalizedQuicklists.length > 0) {
      searchCriteria.quickLists = normalizedQuicklists;
    }

    if (typeof criteria.minBedrooms === "number") {
      searchCriteria.building = { bedroomCount: { min: criteria.minBedrooms } };
    }

    if (
      typeof criteria.minPrice === "number" ||
      typeof criteria.maxPrice === "number"
    ) {
      searchCriteria.valuation = searchCriteria.valuation || {
        estimatedValue: {} as any,
      };
      if (typeof criteria.minPrice === "number") {
        searchCriteria.valuation.estimatedValue.min = criteria.minPrice;
      }
      if (typeof criteria.maxPrice === "number") {
        searchCriteria.valuation.estimatedValue.max = criteria.maxPrice;
      }
    }

    if (typeof criteria.minEquity === "number") {
      searchCriteria.valuation = searchCriteria.valuation || {};
      searchCriteria.valuation.equityPercent = { min: criteria.minEquity };
    }

    if (
      Array.isArray(criteria.propertyTypeList) &&
      criteria.propertyTypeList.length > 0
    ) {
      searchCriteria.general = {
        propertyTypeDetail: { inList: criteria.propertyTypeList },
      };
    } else if (criteria.propertyType) {
      const labels: Record<string, string> = {
        single_family: "Single Family",
        condominium: "Condominium Unit",
        townhouse: "Townhouse",
        multi_family: "Multi Family",
      };
      searchCriteria.general = {
        propertyTypeDetail: {
          inList: [labels[criteria.propertyType] ?? criteria.propertyType],
        },
      };
    }

    // 3) Pagination / options
    const skip = criteria.skip ?? (page - 1) * perPage;
    const take = criteria.take ?? perPage;

    const requestOptions: any = {
      skip,
      take,
      skipTrace: options.skipTrace ?? true,
      includeBuilding: true,
      includeTaxAssessor: true,
      includePropertyDetails: true,
      includeAssessment: true,
    };

    const requestBody = { searchCriteria, options: requestOptions };

    // Rich logs from your earlier version. :contentReference[oaicite:7]{index=7}
    console.log(
      "➡️ Final quickLists sent to BatchData:",
      searchCriteria.quickLists ?? "(none)",
    );
    console.log("📋 Full request body:", JSON.stringify(requestBody, null, 2));

    return requestBody;
  }

  /**
   * STEP 1: Search properties (page/perPage)
   */
  async searchProperties(
    criteria: SearchCriteria,
    page = 1,
    perPage = 50,
  ): Promise<{
    success: boolean;
    data: BatchLeadsProperty[];
    total_results: number;
    page: number;
    per_page: number;
  }> {
    console.log(
      `📊 STEP 1: Getting property search results from BatchData API...`,
    );

    const requestBody = this.buildSearchRequest(criteria, page, perPage, {
      skipTrace: true,
    });

    try {
      const response = await this.makeRequest(
        "/api/v1/property/search",
        requestBody,
      );

      console.log(`📊 BatchLeads API response:`, {
        propertiesFound: response.results?.properties?.length || 0,
        totalResults: response.meta?.totalResults || 0,
        page,
      });

      const data = response.results?.properties || [];

      if (page === 1 && data.length > 0) {
        // helpful structural debug you had in logs :contentReference[oaicite:8]{index=8}
        const first = data[0];
        console.log(`🏠 FIRST PROPERTY RAW DATA:`);
        console.log(JSON.stringify(first, null, 2));
        console.log(`🏠 FIRST PROPERTY FIELD ANALYSIS:`, {
          topLevel: Object.keys(first),
          address: Object.keys(first.address || {}),
          building: Object.keys(first.building || {}),
          owner: Object.keys(first.owner || {}),
          valuation: Object.keys(first.valuation || {}),
          assessment: Object.keys(first.assessment || {}),
          taxAssessor: Object.keys(first.taxAssessor || {}),
          propertyDetails: Object.keys(first.propertyDetails || {}),
          quickLists: Object.keys(first.quickLists || {}),
        });
      }

      return {
        success: true,
        data,
        total_results: response.meta?.totalResults || 0,
        page,
        per_page: perPage,
      };
    } catch (err: any) {
      console.error(
        "BatchLeadsClient.searchProperties error:",
        err?.response?.data ?? err.message ?? err,
      );
      throw err;
    }
  }

  /**
   * Convert a BatchData property object into your app's Property shape.
   * Uses the field fallbacks observed in your logs. :contentReference[oaicite:9]{index=9}
   */
  private toAppProperty(batchProperty: BatchLeadsProperty): Property {
    const valuation = batchProperty.valuation || {};
    const building = batchProperty.building || {};
    const taxAssessor = batchProperty.taxAssessor || {};
    const assessment = batchProperty.assessment || {};
    const propertyDetails = batchProperty.propertyDetails || {};

    // Address fallbacks
    const addressObj =
      batchProperty.address ||
      (batchProperty as any).propertyAddress ||
      (batchProperty as any).location ||
      {};

    const address =
      addressObj.street ||
      addressObj.streetAddress ||
      addressObj.address ||
      `${addressObj.houseNumber || ""} ${addressObj.streetName || ""}`.trim();

    const city = addressObj.city;
    const state =
      (typeof addressObj.state === "string"
        ? addressObj.state
        : addressObj.state?.code) || addressObj.stateCode;
    const zipCode =
      addressObj.zip || addressObj.zipCode || addressObj.postalCode;

    // Owner fallbacks
    const owner =
      batchProperty.owner ||
      (batchProperty as any).ownerInfo ||
      (batchProperty as any).contact ||
      {};

    const firstName = owner.firstName || owner.first_name || "";
    const lastName = owner.lastName || owner.last_name || "";
    const ownerName =
      owner.fullName ||
      owner.full_name ||
      owner.name ||
      (firstName && lastName ? `${firstName} ${lastName}` : "") ||
      "Owner information available via skip trace";

    // Owner mailing address
    const mailingAddr = owner.mailingAddress || owner.address || {};
    let ownerMailingAddress = "Same as property address";
    if (mailingAddr.street && mailingAddr.city && mailingAddr.state) {
      ownerMailingAddress =
        `${mailingAddr.street}, ${mailingAddr.city}, ${mailingAddr.state} ${mailingAddr.zip || ""}`.trim();
    } else if (owner.mailingStreet || owner.mailingCity) {
      ownerMailingAddress =
        `${owner.mailingStreet || ""} ${owner.mailingCity || ""} ${owner.mailingState || ""} ${owner.mailingZip || ""}`.trim();
    }

    // Building-derived fields
    const bedrooms =
      building.bedroomCount ||
      building.bedrooms ||
      taxAssessor.bedrooms ||
      null;

    const bathrooms =
      building.bathroomCount ||
      building.bathrooms ||
      taxAssessor.bathrooms ||
      null;

    const squareFeet =
      building.totalBuildingAreaSquareFeet ||
      building.livingArea ||
      building.totalLivingArea ||
      taxAssessor.livingArea ||
      null;

    const yearBuilt =
      building.effectiveYearBuilt ||
      building.yearBuilt ||
      taxAssessor.yearBuilt ||
      null;

    const buildingType = building.buildingType || building.propertyType || null;
    const estimatedValue = valuation.estimatedValue || null;
    const marketValue = assessment.totalMarketValue || estimatedValue || null;

    return {
      id: batchProperty._id || `${address}-${ownerName}`,

      address,
      city: city || "",
      state: state || "",
      zipCode: zipCode || "",

      ownerName,
      ownerMailingAddress,

      bedrooms,
      bathrooms,
      squareFeet,
      yearBuilt,
      buildingType: buildingType || "",

      estimatedValue,
      marketValue,

      // extend as your app requires
      // You can also pass through phone/emails if present:
      ownerPhone:
        owner.phone ||
        owner.primaryPhone ||
        owner.homePhone ||
        owner.cellPhone ||
        owner.mobilePhone ||
        null,
      ownerEmail: owner.email || owner.primaryEmail || owner.workEmail || null,

      phoneNumbers: (Array.isArray(owner.phoneNumbers)
        ? owner.phoneNumbers.map((p: any) => ({
            number: p?.number || p,
            reachable: p?.reachable || p?.status === "verified" || false,
            dnc: p?.dnc || p?.type === "dnc" || false,
            type: p?.type || "unknown",
          }))
        : []) as any,

      emails: (Array.isArray(owner.emails)
        ? owner.emails
            .map((e: any) => (typeof e === "string" ? e : e?.email))
            .filter(Boolean)
        : []) as any,
    } as unknown as Property;
  }

  /**
   * STEP 2/3 pipeline: page through search results until we collect `count`
   * valid (converted) properties. Mirrors your earlier flow & logs. :contentReference[oaicite:10]{index=10}
   */
  async searchValidProperties(
    criteria: SearchCriteria,
    count: number = 5,
    excludePropertyIds: string[] = [],
  ): Promise<{
    data: Property[];
    totalChecked: number;
    filtered: number;
    hasMore: boolean;
  }> {
    let totalChecked = 0;
    let filtered = 0;
    const valid: Property[] = [];
    let page = 1;
    const perPage = 50;
    const maxPages = 10;

    console.log(`🚀 SEARCHVALIDPROPERTIES FUNCTION CALLED - DEBUGGING START`);
    console.log(`🚀 Parameters: count=${count}, criteria=`, criteria);
    console.log(
      `🔍 Starting 3-step BatchLeads integration for ${count} properties`,
    );
    console.log(`📋 Search criteria:`, JSON.stringify(criteria, null, 2));

    while (valid.length < count && page <= maxPages) {
      try {
        const searchResp = await this.searchProperties(criteria, page, perPage);
        const props = searchResp.data;

        if (!props || props.length === 0) {
          console.log(`📄 Page ${page}: No more properties available`);
          break;
        }

        console.log(
          `📄 Page ${page}: Found ${props.length} properties from search`,
        );

        for (const bp of props) {
          totalChecked++;

          // build a stable id for filtering
          const pid =
            bp._id ||
            `${bp.address?.street}_${bp.owner?.fullName}` ||
            `${bp.address?.streetAddress}_${bp.owner?.fullName}` ||
            `${bp.address?.address}_${bp.owner?.fullName}` ||
            undefined;

          if (pid && excludePropertyIds.includes(pid)) {
            filtered++;
            continue;
          }

          // Convert to app Property
          const appProp = this.toAppProperty(bp);
          valid.push(appProp);

          if (valid.length >= count) break;
        }

        if (valid.length >= count) break;

        page += 1;
      } catch (err) {
        console.error(`❌ Error while paging search results:`, err);
        break;
      }
    }

    return {
      data: valid.slice(0, count),
      totalChecked,
      filtered,
      hasMore: page <= maxPages,
    };
  }

  /**
   * Optional: specialized cash buyer searches retained from your code. :contentReference[oaicite:11]{index=11}
   */
  async searchCashBuyersRaw(criteria: { location: string; limit?: number }) {
    const limit = criteria.limit || 5;

    const requestBody = {
      searchCriteria: { query: criteria.location, quickLists: ["cash-buyer"] },
      options: {
        skip: 0,
        take: Math.max(limit * 10, 50),
        skipTrace: true,
        includeBuilding: true,
        includePropertyDetails: true,
        includeAssessment: true,
        images: false,
      },
    };

    const response = await this.makeRequest(
      "/api/v1/property/search",
      requestBody,
    );

    const all = response.results?.properties || [];
    // simple heuristic filter (kept from your version)
    const filteredBuyers = all.filter((buyer: any) => {
      const propertyCount = buyer.propertyOwnerProfile?.propertiesCount;
      const hasMinProperties = propertyCount && propertyCount >= 3;

      const lastSaleDate =
        buyer.salesHistory?.lastSaleDate ||
        buyer.lastSaleDate ||
        buyer.deed?.recordingDate ||
        buyer.sales?.lastSaleDate ||
        buyer.propertyOwnerProfile?.lastSaleDate ||
        buyer.saleHistory?.mostRecentSaleDate;

      let hasRecentSale = false;
      if (lastSaleDate) {
        const saleDate = new Date(lastSaleDate);
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        hasRecentSale = saleDate >= twelveMonthsAgo;
      } else {
        hasRecentSale = (propertyCount || 0) >= 5;
      }

      return hasMinProperties && hasRecentSale;
    });

    const buyers = filteredBuyers.slice(0, limit);
    return {
      buyers,
      totalFound: filteredBuyers.length,
      location: criteria.location,
    };
  }

  async searchCashBuyers(criteria: { location: string }, limit = 5) {
    const requestBody: any = {
      searchCriteria: { query: criteria.location, quickLists: ["cash-buyer"] },
      options: {
        skip: 0,
        take: Math.min(limit * 2, 100),
        skipTrace: true,
        includeBuilding: true,
        includePropertyDetails: true,
        includeAssessment: true,
      },
    };

    const response = await this.makeRequest(
      "/api/v1/property/search",
      requestBody,
    );
    const properties = response.results?.properties || [];
    return {
      data: properties.slice(0, limit) as any[],
      totalChecked: properties.length,
      filtered: 0,
      hasMore: properties.length > limit,
    };
  }
}

export const batchLeadsService = new BatchLeadsService();
export type { SearchCriteria, BatchLeadsProperty };
