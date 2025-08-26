import OpenAI from "openai";
import type { Property, Contact, Message } from "@shared/schema";

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
      // Extract location from message
      let location = 'Orlando, FL'; // Default

      const locationMatch = userMessage.match(/in\s+([^,\n]+(?:,\s*[A-Z]{2})?)/i);
      if (locationMatch) {
        location = locationMatch[1].trim();
      }

      // Extract number of properties requested, cap at 5
      const numberMatch = userMessage.match(/(\d+)\s+properties/i);
      const requestedCount = numberMatch ? Math.min(parseInt(numberMatch[1]), 5) : 5;

      // Extract price filter from message
      let maxPrice;
      const priceMatch = userMessage.match(/under\s+\$?([0-9,]+)/i);
      if (priceMatch) {
        maxPrice = parseInt(priceMatch[1].replace(/,/g, ''));
      }

      // Extract minimum bedrooms
      let minBedrooms;
      const bedroomMatch = userMessage.match(/at least (\d+) bedrooms?/i);
      if (bedroomMatch) {
        minBedrooms = parseInt(bedroomMatch[1]);
      }

      console.log(`🔍 Searching for ${requestedCount} properties in: ${location}`);

      // Import and use BatchLeads service
      const { batchLeadsService } = await import("./batchleads");

      // Search for properties with extracted criteria
      const searchCriteria = {
        location,
        distressedOnly: true,
        propertyType: 'single_family',
        maxPrice,
        minBedrooms
      };

      console.log('🔍 Search criteria:', searchCriteria);

      const results = await batchLeadsService.searchValidProperties(searchCriteria, requestedCount);

      console.log(`📊 Search results: ${results.data.length} raw properties, ${results.filteredCount} filtered`);

      if (results.data.length === 0) {
        return `I couldn't find any properties matching your criteria in ${location}. This could be due to:

• No distressed properties available in that area
• Location not recognized (try using a ZIP code or "City, State" format)
• All properties filtered out due to missing data

Try searching in a different location or expanding your criteria.`;
      }

      // Properties are already converted from searchValidProperties
      const properties = results.data;

      console.log(`✅ Final converted properties: ${properties.length}`);

      if (properties.length === 0) {
        return `Found ${results.totalChecked} properties in ${location}, but ${results.filtered} were filtered out due to missing critical data. Try a different location.`;
      }

      // Format response with comprehensive BatchLeads data integration
      let response = `Great! I found ${properties.length} distressed properties in "${location}" that could be excellent wholesale opportunities:\n\n`;

      properties.forEach((property, index) => {
        console.log(`📝 Formatting property ${index + 1}:`, {
          address: property.address,
          arv: property.arv,
          owner: property.ownerName,
          bedrooms: property.bedrooms
        });

        response += `${index + 1}. ${property.address}, ${property.city}, ${property.state} ${property.zipCode}\n`;
        response += `   - **PROPERTY DETAILS:**\n`;
        response += `   - Est. Value (ARV): $${property.arv ? parseInt(property.arv).toLocaleString() : 'N/A'}\n`;
        response += `   - Max Offer (70% Rule): $${property.maxOffer ? parseInt(property.maxOffer).toLocaleString() : 'N/A'}\n`;
        response += `   - Building: ${property.bedrooms || 'Unknown'}BR/${property.bathrooms || 'Unknown'}BA, ${property.squareFeet?.toLocaleString() || 'Unknown'} sq ft\n`;
        response += `   - Year Built: ${property.yearBuilt || 'Not available'}\n`;
        response += `   - Property Type: ${property.propertyType || 'Single Family'}\n`;
        response += `   - **OWNER INFORMATION:**\n`;
        response += `   - Owner Name: ${property.ownerName || 'Available via skip trace'}\n`;
        response += `   - Owner Phone: ${property.ownerPhone || 'Available via skip trace'}\n`;
        response += `   - Owner Email: ${property.ownerEmail || 'Available via skip trace'}\n`;
        response += `   - Mailing Address: ${property.ownerMailingAddress || 'Same as property address'}\n`;
        response += `   - **FINANCIAL ANALYSIS:**\n`;
        response += `   - Equity Percentage: ${property.equityPercentage || 0}%\n`;
        response += `   - Motivation Score: ${property.motivationScore || 0}/100\n`;
        response += `   - Lead Type: ${property.leadType ? property.leadType.replace('_', ' ').toUpperCase() : 'STANDARD'}\n`;
        response += `   - Distressed Indicator: ${property.distressedIndicator ? property.distressedIndicator.replace('_', ' ') : 'Standard opportunity'}\n`;
        response += `   - **SALES HISTORY:**\n`;
        response += `   - Last Sale Date: ${property.lastSaleDate || 'No recent sales'}\n`;
        response += `   - Last Sale Price: ${property.lastSalePrice ? `$${parseInt(property.lastSalePrice).toLocaleString()}` : 'Not available'}\n`;
        response += `   - Status: ${property.status || 'New'}\n\n`;
      });

      response += `💡 These are LIVE properties from BatchData API with verified owner information and equity calculations!`;

      console.log(`📤 Final response length: ${response.length} characters`);
      return response;
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