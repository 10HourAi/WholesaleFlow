import OpenAI from "openai";
import type { Property, Contact, Message, DealAnalysisResult, DealAnalysisRequest } from "@shared/schema";

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

export async function analyzeDealWithOpenAI(property: Property, options: DealAnalysisRequest['analysisOptions'] = {
  includeComps: true,
  includeRepairEstimates: true,
  includeRentals: false
}): Promise<DealAnalysisResult> {
  try {
    const openaiClient = getOpenAI();
    
    // Create a comprehensive property description for analysis
    const propertyContext = `
Property Details:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
- Property Type: ${property.propertyType || 'Single Family'}
- Bedrooms/Bathrooms: ${property.bedrooms || 'Unknown'}/${property.bathrooms || 'Unknown'}
- Square Feet: ${property.squareFeet ? property.squareFeet.toLocaleString() : 'Unknown'}
- Year Built: ${property.yearBuilt || 'Unknown'}
- Current ARV: ${property.arv ? '$' + Number(property.arv).toLocaleString() : 'Unknown'}
- Max Offer (70% Rule): ${property.maxOffer ? '$' + Number(property.maxOffer).toLocaleString() : 'Unknown'}
- Equity Percentage: ${property.equityPercentage || 'Unknown'}%
- Owner: ${property.ownerName || 'Unknown'}
- Lead Type: ${property.leadType || 'Standard'}
- Distressed Indicator: ${property.distressedIndicator || 'No'}
- Last Sale: ${property.lastSalePrice ? '$' + Number(property.lastSalePrice).toLocaleString() : 'Unknown'} on ${property.lastSaleDate || 'Unknown'}
`;

    const analysisPrompt = `You are an expert real estate wholesaling analyst. Analyze this property deal and provide a comprehensive investment analysis.

${propertyContext}

Please provide a detailed analysis including:
1. Deal summary and investment potential
2. Offer range recommendations (conservative, aggressive, recommended)
3. Repair estimates (cosmetic, structural, total)
4. Financial projections and profit analysis
5. Market analysis and comparable properties assessment
6. Risk factors to consider
7. Timeline estimates for acquisition, repairs, and resale
8. Exit strategy recommendations (wholesale, fix-and-flip, rental, owner financing)
9. Overall confidence level and notes

Focus on realistic numbers based on the property's location, condition indicators, and market data. Consider the property's equity position and distressed status in your analysis.`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert real estate investment analyst specializing in wholesaling and fix-and-flip strategies. Provide detailed, numerical analysis with realistic estimates." },
        { role: "user", content: analysisPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.2, // Low temperature for consistent, analytical responses
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "deal_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              offerRange: {
                type: "object",
                properties: {
                  min: { type: "number" },
                  max: { type: "number" },
                  recommended: { type: "number" }
                },
                required: ["min", "max", "recommended"],
                additionalProperties: false
              },
              repairEstimates: {
                type: "object",
                properties: {
                  cosmetic: { type: "number" },
                  structural: { type: "number" },
                  total: { type: "number" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] }
                },
                required: ["cosmetic", "structural", "total", "confidence"],
                additionalProperties: false
              },
              financialProjection: {
                type: "object",
                properties: {
                  purchasePrice: { type: "number" },
                  repairCosts: { type: "number" },
                  totalInvestment: { type: "number" },
                  arv: { type: "number" },
                  estimatedProfit: { type: "number" },
                  profitMargin: { type: "number" }
                },
                required: ["purchasePrice", "repairCosts", "totalInvestment", "arv", "estimatedProfit", "profitMargin"],
                additionalProperties: false
              },
              marketAnalysis: {
                type: "object",
                properties: {
                  compsSummary: { type: "string" },
                  marketTrend: { type: "string", enum: ["declining", "stable", "improving"] },
                  avgDaysOnMarket: { type: "number" },
                  pricePerSqFt: { type: "number" }
                },
                required: ["compsSummary", "marketTrend"],
                additionalProperties: false
              },
              riskFactors: {
                type: "array",
                items: { type: "string" }
              },
              timeline: {
                type: "object",
                properties: {
                  acquisitionDays: { type: "number" },
                  repairDays: { type: "number" },
                  saleDays: { type: "number" },
                  totalDays: { type: "number" }
                },
                required: ["acquisitionDays", "repairDays", "saleDays", "totalDays"],
                additionalProperties: false
              },
              exitStrategies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    strategy: { type: "string", enum: ["wholesale", "fix_and_flip", "rental", "owner_finance"] },
                    roi: { type: "number" },
                    notes: { type: "string" }
                  },
                  required: ["strategy", "roi", "notes"],
                  additionalProperties: false
                }
              },
              notes: { type: "string" },
              confidence: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["summary", "offerRange", "repairEstimates", "financialProjection", "marketAnalysis", "riskFactors", "timeline", "exitStrategies", "notes", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const analysisContent = response.choices[0]?.message?.content;
    if (!analysisContent) {
      throw new Error("No analysis content received from OpenAI");
    }

    const analysisData = JSON.parse(analysisContent);
    
    // Return the complete analysis with property ID and timestamp
    const result: DealAnalysisResult = {
      propertyId: property.id,
      analysisDate: new Date().toISOString(),
      ...analysisData
    };

    return result;
  } catch (error) {
    console.error("Error analyzing deal with OpenAI:", error);
    
    // Return a fallback analysis structure in case of API failure
    const fallbackAnalysis: DealAnalysisResult = {
      propertyId: property.id,
      summary: "Analysis temporarily unavailable. API calls are currently paused for testing.",
      offerRange: {
        min: property.maxOffer ? Number(property.maxOffer) * 0.85 : 200000,
        max: property.maxOffer ? Number(property.maxOffer) * 1.05 : 250000,
        recommended: property.maxOffer ? Number(property.maxOffer) : 225000
      },
      repairEstimates: {
        cosmetic: 15000,
        structural: 25000,
        total: 40000,
        confidence: "medium" as const
      },
      financialProjection: {
        purchasePrice: property.maxOffer ? Number(property.maxOffer) : 225000,
        repairCosts: 40000,
        totalInvestment: (property.maxOffer ? Number(property.maxOffer) : 225000) + 40000,
        arv: property.arv ? Number(property.arv) : 350000,
        estimatedProfit: (property.arv ? Number(property.arv) : 350000) - ((property.maxOffer ? Number(property.maxOffer) : 225000) + 40000),
        profitMargin: 25.7
      },
      marketAnalysis: {
        compsSummary: "Market analysis temporarily unavailable during testing phase.",
        marketTrend: "stable" as const,
        avgDaysOnMarket: 45,
        pricePerSqFt: property.squareFeet ? Math.round((property.arv ? Number(property.arv) : 350000) / property.squareFeet) : 200
      },
      riskFactors: [
        "API analysis temporarily disabled",
        "Market conditions may vary",
        "Property inspection required"
      ],
      timeline: {
        acquisitionDays: 30,
        repairDays: 60,
        saleDays: 90,
        totalDays: 180
      },
      exitStrategies: [
        {
          strategy: "wholesale" as const,
          roi: 5.2,
          notes: "Quick assignment for immediate profit"
        },
        {
          strategy: "fix_and_flip" as const,
          roi: 18.5,
          notes: "Full renovation and retail sale"
        }
      ],
      notes: "This is a fallback analysis while OpenAI API calls are paused for testing. Real analysis will provide detailed market comps and repair assessments.",
      confidence: "medium" as const,
      analysisDate: new Date().toISOString()
    };

    return fallbackAnalysis;
  }
}

// OpenAI service for Terry chat
export const openaiService = {
  async getChatCompletion(messages: Array<{role: string, content: string}>): Promise<string> {
    try {
      const openaiClient = getOpenAI();
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: messages as any,
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to get response from OpenAI");
    }
  }
};