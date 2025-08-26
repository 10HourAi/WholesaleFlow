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