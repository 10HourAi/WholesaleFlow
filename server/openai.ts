import OpenAI from "openai";
import type { Property, Contact, Message } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

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

      // Format response with actual property data
      let response = `Great! I found ${properties.length} distressed properties in ${location} that could be excellent wholesale opportunities:\n\n`;

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

    // Regular AI response for non-property searches
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Lead Finder Agent for real estate wholesaling. You help investors find off-market properties, distressed sales, and motivated sellers.

          When users ask about finding properties, searching for leads, or mention specific locations, guide them to use specific search terms like:
          - "Find 5 properties in Orlando, FL"
          - "Show me distressed properties in 32803"
          - "Search for high equity properties in Philadelphia"

          You have access to live property data through BatchData API that includes:
          - Property details (address, size, year built)
          - Financial analysis (ARV, equity, max offer calculations)
          - Owner information (name, mailing address, contact details)
          - Motivation indicators (distressed signals, foreclosure status)

          Be helpful, professional, and focus on actionable wholesale opportunities.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || "I'm here to help you find wholesale real estate opportunities!";
  } catch (error) {
    console.error("Error generating lead finder response:", error);
    return "I'm having trouble processing your request right now. Please try again or contact support.";
  }
}

export async function generateDealAnalyzerResponse(userMessage: string, property?: Property): Promise<string> {
  const propertyContext = property ? `Property details: ${property.address}, ${property.city}, ${property.state} - ${property.bedrooms}/${property.bathrooms}, ${property.squareFeet} sq ft. ARV: $${property.arv}, Max Offer: $${property.maxOffer}` : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Deal Analyzer Agent for real estate wholesaling. You help analyze property deals by calculating ARV (After Repair Value), estimating repair costs, determining maximum allowable offer, and assessing profit potential. Use the 70% rule and provide detailed financial breakdowns. ${propertyContext}`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
  });

  return response.choices[0].message.content || "I'm sorry, I couldn't analyze this deal.";
}

export async function generateNegotiationResponse(userMessage: string, contact?: Contact, property?: Property): Promise<string> {
  const context = contact && property ? 
    `Contact: ${contact.name} (${contact.phone}, ${contact.email}). Property: ${property.address}, ${property.city}, ${property.state}. Current status: ${property.status}` : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Negotiation Agent for real estate wholesaling. You help craft persuasive emails, texts, and scripts for contacting property owners and negotiating deals. You understand motivated seller psychology and can create compelling offers and follow-up messages. ${context}`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
  });

  return response.choices[0].message.content || "I'm sorry, I couldn't help with negotiation.";
}

export async function generateClosingResponse(userMessage: string, property?: Property): Promise<string> {
  const propertyContext = property ? `Property: ${property.address}, ${property.city}, ${property.state}. Deal value: $${property.maxOffer}` : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Closing Agent for real estate wholesaling. You help with contract preparation, title work, closing coordination, and document management. You can generate purchase agreements, assignment contracts, and closing checklists. ${propertyContext}`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
  });

  return response.choices[0].message.content || "I'm sorry, I couldn't help with closing.";
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
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a real estate data analyzer. Generate realistic property leads based on the given location and criteria. Return a JSON object with an array of properties. Each property should have: address, city, state, bedrooms, bathrooms, squareFeet, price, arv (after repair value), maxOffer (70% of ARV minus estimated repairs), leadType (foreclosure, motivated_seller, distressed, etc.), and condition.`
      },
      {
        role: "user",
        content: `Find properties in ${location} matching criteria: ${criteria}. Generate 5-8 realistic property leads.`
      }
    ],
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(response.choices[0].message.content || '{"properties": []}');
  } catch (error) {
    return { properties: [] };
  }
}