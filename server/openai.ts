import OpenAI from "openai";
import type { Property, Contact, Message } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateLeadFinderResponse(userMessage: string, userId?: string): Promise<string> {
  // Check if user is asking for property search
  const isSearchRequest = /find|search|look|properties|leads|distressed|motivated/i.test(userMessage);
  
  if (isSearchRequest && userId) {
    try {
      const { batchLeadsService } = await import("./batchleads");
      const locationMatch = userMessage.match(/in\s+([^,.!?]+)/i);
      const location = locationMatch ? locationMatch[1].trim() : "Dallas, TX";
      
      // Get real distressed properties
      const properties = await batchLeadsService.getDistressedProperties(location, 5);
      
      if (properties.length > 0) {
        const propertyList = properties.map((prop, index) => 
          `${index + 1}. **${prop.address}, ${prop.city}, ${prop.state}**
   - Price: $${prop.estimated_value?.toLocaleString() || 'N/A'}
   - ${prop.bedrooms}BR/${prop.bathrooms}BA, ${prop.square_feet?.toLocaleString()} sq ft
   - Owner: ${prop.owner_name || 'N/A'}
   - Motivation Score: ${prop.motivation_score}/100
   - Equity: ${prop.equity_percentage}%
   - Lead Type: ${prop.distressed_indicator || 'Standard'}
   - Why it's good: ${prop.motivation_score >= 80 ? 'Highly motivated seller' : 'Good equity opportunity'}`
        ).join('\n\n');
        
        return `Great! I found ${properties.length} distressed properties in ${location} that could be excellent wholesale opportunities:

${propertyList}

These are real properties from our BatchLeads database with high motivation scores and distress indicators. Would you like me to help you analyze any of these deals or search for more properties in a different area?`;
      }
    } catch (error) {
      console.error("BatchLeads API error:", error);
      // Fall through to general response
    }
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Lead Finder Agent for real estate wholesaling. Your job is to help find distressed properties, motivated sellers, and off-market deals. You can search by location, property type, price range, and lead criteria. Always be helpful and provide guidance on lead generation strategies. When users ask for specific property searches, encourage them to provide a location so you can find real distressed properties from your database.`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
  });

  return response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
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
