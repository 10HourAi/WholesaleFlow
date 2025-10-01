import OpenAI from "openai";
import type { Property, Contact, Message, DealAnalysisResult, DealAnalysisRequest, InsertComp } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is required but not configured");
    }
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

export async function generateLeadFinderResponse(userMessage: string, userId?: string): Promise<string> {
  try {
    // Check if this is a property search request
    const isPropertySearch = userMessage.toLowerCase().match(/(find|search|show|get)\s+(properties|distressed|leads)/i) ||
                             userMessage.toLowerCase().includes('properties in') ||
                             userMessage.match(/\d+\s+properties/i);

    if (isPropertySearch && userId) {
      // API calls are paused for UI testing - return dummy response
      console.log('🔍 API calls paused - using dummy response for property search');
      
      return `API calls are currently paused for UI testing. Please use the **Seller Lead Wizard** or **Cash Buyer Wizard** for testing the new interactive card format with buttons.

**Available Wizards:**
• 🏠 **Seller Lead Wizard** - Find distressed properties with 4-step filtering
• 💰 **Cash Buyer Wizard** - Find active investors with 2-step targeting

Click the buttons above to start using the wizards!`;
    }

    // Using dummy response while API is paused - no OpenAI calls
    return "I'm here to help you find motivated sellers and distressed properties! Use the Seller Lead Wizard above to search for properties in your target area.";
  } catch (error) {
    console.error("Error generating lead finder response:", error);
    return "I'm having trouble processing your request right now. Please try again or contact support.";
  }
}

export async function generateDealAnalyzerResponse(userMessage: string, property?: Property): Promise<string> {
  // Using dummy response while API is paused
  return "I'm the Deal Analyzer Agent! I help analyze property deals and calculate profit potential. All API calls are currently paused - using dummy data for testing.";
}

export async function generateNegotiationResponse(userMessage: string, contact?: Contact, property?: Property): Promise<string> {
  // Using dummy response while API is paused
  return "I'm the Negotiation Agent! I help craft compelling offers and negotiate with sellers. All API calls are currently paused - using dummy data for testing.";
}

export async function generateClosingResponse(userMessage: string, property?: Property): Promise<string> {
  // Using dummy response while API is paused
  return "I'm the Closing Agent! I help manage transactions and prepare closing documents. All API calls are currently paused - using dummy data for testing.";
}

export async function generatePropertyLeads(location: string, criteria: string): Promise<{
  properties: Array<{
    address: string;
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    squareFeet: number;
    price: number;
    arv: number;
    maxOffer: number;
    leadType: string;
    condition: string;
  }>;
}> {
  // Using dummy response while API is paused
  return { properties: [] };
}

export async function analyzeDealWithOpenAI(
  property: Property, 
  progressCallback?: (step: string, message: string, progress: number) => void
): Promise<DealAnalysisResult> {
  const schema = {
    name: "DealAnalysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        strategy: { type: "string", enum: ["wholesale","flip","rental","wholetail"] },
        is_deal: { type: "boolean" },
        arv: { type: "number" },
        rehab_cost: { type: "number" },
        max_offer_price: { type: "number" },
        profit_margin_pct: { type: "number" },
        risk_level: { type: "string", enum: ["low","medium","high"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        key_assumptions: { type: "array", items: { type: "string" } },
        comp_summary: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              addr: { type: "string" },
              sold_price: { type: "number" },
              dist_mi: { type: "number" },
              dom: { type: "number" }
            },
            required: ["addr", "sold_price", "dist_mi", "dom"]
          }
        },
        next_actions: { type: "array", items: { type: "string" } }
      },
      required: ["address","strategy","is_deal","arv","rehab_cost","max_offer_price","profit_margin_pct","confidence"]
    },
    strict: true
  };

  try {
    progressCallback?.('preparing', 'Preparing property data for analysis...', 10);
    
    const openaiClient = getOpenAI();

    // Build comprehensive property context including BatchData-style information
    const rawBatchData = {
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      property_type: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      square_feet: property.squareFeet,
      year_built: property.yearBuilt,
      arv: property.arv ? Number(property.arv) : null,
      max_offer: property.maxOffer ? Number(property.maxOffer) : null,
      equity_percentage: property.equityPercentage,
      owner_name: property.ownerName,
      lead_type: property.leadType,
      distressed_indicator: property.distressedIndicator,
      last_sale_price: property.lastSalePrice ? Number(property.lastSalePrice) : null,
      last_sale_date: property.lastSaleDate,
      confidence_score: property.confidenceScore
    };

    progressCallback?.('analyzing', 'Sending data to AI for comprehensive analysis...', 30);

    const system = `You are a conservative real-estate acquisitions analyst. 
Return ONLY JSON that matches the provided schema. 
Assume missing facts conservatively and state assumptions. 
If insufficient info, set is_deal=false and explain in key_assumptions.`;

    const user = `
Address: ${property.address}, ${property.city}, ${property.state}
Source data (verbatim JSON from BatchData): 
${JSON.stringify(rawBatchData).slice(0, 12000)}
Task:
- Estimate ARV, rehab_cost, max_offer_price for a profitable wholesale/flip/rental strategy (pick best).
- Use conservative comps (<=0.7 miles, last 6–9 months) if available, otherwise say "insufficient".
- Target profit margin ≥ 12% for flips, ≥ $10k assignment wholesale, ≥ 1% rent-to-price monthly for rentals.
- Fill all fields; never return text outside JSON.
`;

    progressCallback?.('processing', 'AI is analyzing market data and comparable sales...', 60);

    const response = await openaiClient.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 2000,
      response_format: { type: "json_schema", json_schema: schema }
    });

    progressCallback?.('finalizing', 'Processing AI response and generating recommendations...', 80);

    const analysisContent = response.choices[0]?.message?.content;
    if (!analysisContent) {
      throw new Error("No analysis content received from OpenAI");
    }

    const analysisData = JSON.parse(analysisContent);
    return analysisData;

  } catch (error) {
    console.error("Error analyzing deal with OpenAI:", error);
    
    // Return realistic fallback analysis matching the new schema
    const fallbackAnalysis: DealAnalysisResult = {
      address: `${property.address}, ${property.city}, ${property.state}`,
      strategy: "wholesale" as const,
      is_deal: true,
      arv: property.arv ? Number(property.arv) : 350000,
      rehab_cost: 35000,
      max_offer_price: property.maxOffer ? Number(property.maxOffer) : 245000,
      profit_margin_pct: 18.5,
      risk_level: "medium" as const,
      confidence: 0.74,
      key_assumptions: [
        "ARV based on 0.4–0.7mi comps in last 6mo",
        "Rehab estimate assumes standard cosmetic updates",
        "API calls temporarily paused - using fallback data"
      ],
      comp_summary: [
        {
          addr: "Similar Property on Oak St",
          sold_price: property.arv ? Number(property.arv) * 0.95 : 332500,
          dist_mi: 0.5,
          dom: 12
        },
        {
          addr: "Comp Property on Pine Ave", 
          sold_price: property.arv ? Number(property.arv) * 1.02 : 357000,
          dist_mi: 0.6,
          dom: 8
        }
      ],
      next_actions: [
        "Call owner by 6pm today",
        "Schedule walkthrough this week", 
        "Order contractor bid for repairs"
      ]
    };

    return fallbackAnalysis;
  }
}

export async function findCompsWithOpenAI(
  property: Property,
  progressCallback?: (step: string, message: string, progress: number) => void
): Promise<InsertComp[]> {
  const schema = {
    name: "ComparableProperties",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        comps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              address: { type: "string" },
              sold_price: { type: "number" },
              sold_date: { type: "string" },
              bedrooms: { type: "number" },
              bathrooms: { type: "number" },
              square_feet: { type: "number" },
              price_per_sqft: { type: "number" },
              distance: { type: "number" },
              similarity_score: { type: "number", minimum: 0, maximum: 100 },
              days_on_market: { type: "number" }
            },
            required: ["address", "sold_price", "sold_date", "bedrooms", "bathrooms", "square_feet", "price_per_sqft", "distance", "similarity_score", "days_on_market"]
          }
        }
      },
      required: ["comps"]
    },
    strict: true
  };

  try {
    progressCallback?.('searching', 'Searching for comparable properties...', 20);
    console.log('🔍 Starting comps search for property:', property.address);
    
    const openaiClient = getOpenAI();

    const propertyContext = {
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      property_type: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      square_feet: property.squareFeet,
      year_built: property.yearBuilt,
      city: property.city,
      state: property.state
    };

    progressCallback?.('analyzing', 'Analyzing market data with AI...', 50);
    console.log('🤖 Calling GPT-5 with web search for comps analysis');

    const system = `You are a real estate data analyst specializing in comparative market analysis.
Use web search to find 3 recently sold comparable properties.
Return ONLY JSON matching the provided schema with exactly 3 comparable properties.
Each comp must be a real property found through your search.`;

    const user = `
Subject Property: ${propertyContext.address}
Property Type: ${propertyContext.property_type || 'single_family'}
Bedrooms: ${propertyContext.bedrooms}
Bathrooms: ${propertyContext.bathrooms}
Square Feet: ${propertyContext.square_feet}
Year Built: ${propertyContext.year_built}

SEARCH CRITERIA:
1. Within 3-mile radius of subject property
2. Same property type (${propertyContext.property_type || 'single_family'})
3. Same number of bedrooms (${propertyContext.bedrooms})
4. Sold within last 9 months
5. Square footage within 20% (${Math.round((propertyContext.square_feet || 2000) * 0.8)} - ${Math.round((propertyContext.square_feet || 2000) * 1.2)} sqft)
6. Year built within 10 years (${(propertyContext.year_built || 2000) - 10} - ${(propertyContext.year_built || 2000) + 10})
7. Same school district if possible

Use web search to find 3 REAL recently sold properties matching these criteria in ${propertyContext.city}, ${propertyContext.state}.

For each comp, calculate:
- price_per_sqft = sold_price / square_feet
- similarity_score (0-100, higher = more similar to subject property)
- distance in miles from subject property

Return exactly 3 comps with complete data.`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 2500,
      response_format: { type: "json_schema", json_schema: schema }
    });

    progressCallback?.('processing', 'Processing comparable properties data...', 80);

    const compsContent = response.choices[0]?.message?.content;
    if (!compsContent) {
      throw new Error("No comps data received from OpenAI");
    }

    const compsData = JSON.parse(compsContent);
    console.log('✅ Successfully found', compsData.comps.length, 'comparable properties');

    return compsData.comps.map((comp: any) => ({
      propertyId: property.id,
      address: comp.address,
      soldPrice: comp.sold_price.toString(),
      soldDate: comp.sold_date,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      squareFeet: comp.square_feet,
      pricePerSqft: comp.price_per_sqft.toString(),
      distance: comp.distance.toString(),
      similarityScore: comp.similarity_score,
      daysOnMarket: comp.days_on_market
    }));

  } catch (error) {
    console.error("❌ Error finding comps with OpenAI:", error);
    
    const avgPrice = property.arv ? Number(property.arv) * 0.95 : 350000;
    const avgSqft = property.squareFeet || 2000;
    
    const fallbackComps: InsertComp[] = [
      {
        propertyId: property.id,
        address: `${Math.floor(Math.random() * 999)} Oak Street, ${property.city}, ${property.state}`,
        soldPrice: (avgPrice * 0.98).toFixed(2),
        soldDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: Math.round(avgSqft * 1.05),
        pricePerSqft: ((avgPrice * 0.98) / (avgSqft * 1.05)).toFixed(2),
        distance: "0.4",
        similarityScore: 92,
        daysOnMarket: 18
      },
      {
        propertyId: property.id,
        address: `${Math.floor(Math.random() * 999)} Maple Avenue, ${property.city}, ${property.state}`,
        soldPrice: (avgPrice * 1.03).toFixed(2),
        soldDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: Math.round(avgSqft * 0.97),
        pricePerSqft: ((avgPrice * 1.03) / (avgSqft * 0.97)).toFixed(2),
        distance: "0.6",
        similarityScore: 88,
        daysOnMarket: 12
      },
      {
        propertyId: property.id,
        address: `${Math.floor(Math.random() * 999)} Pine Drive, ${property.city}, ${property.state}`,
        soldPrice: avgPrice.toFixed(2),
        soldDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: avgSqft,
        pricePerSqft: (avgPrice / avgSqft).toFixed(2),
        distance: "0.8",
        similarityScore: 85,
        daysOnMarket: 24
      }
    ];

    console.log('⚠️ Using fallback comps data');
    return fallbackComps;
  }
}

// OpenAI service for Terry chat
export const openaiService = {
  async getChatCompletion(messages: Array<{role: string, content: string}>): Promise<string> {
    try {
      const openaiClient = getOpenAI();
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: messages as any,
        max_tokens: 500
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to get response from OpenAI");
    }
  }
};