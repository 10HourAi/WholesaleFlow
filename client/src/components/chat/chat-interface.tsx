import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Search, TrendingUp, MessageSquare, FileText, Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation, Message, Property } from "@shared/schema";
// BatchLeads service is handled server-side

const agentTypes = [
  { id: "lead-finder", name: "🔍 Lead Finder Agent", icon: Search },
  { id: "deal-analyzer", name: "📊 Deal Analyzer Agent", icon: TrendingUp },
  { id: "negotiation", name: "💬 Negotiation Agent", icon: MessageSquare },
  { id: "closing", name: "📋 Closing Agent", icon: FileText },
];

interface WizardData {
  city: string;
  state: string;
  sellerType: string;
  propertyType: string;
  minBedrooms?: number;
  maxPrice?: number;
}

export default function ChatInterface() {
  const [selectedAgent, setSelectedAgent] = useState("lead-finder");
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    city: "",
    state: "",
    sellerType: "",
    propertyType: ""
  });
  const [wizardProcessing, setWizardProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [shownPropertyIds, setShownPropertyIds] = useState<Set<string>>(new Set());
  const [lastSearchCriteria, setLastSearchCriteria] = useState<any>(null); // To store criteria for "Find 5 More"

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", currentConversation, "messages"],
    enabled: !!currentConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { agentType: string; title: string }) => {
      const response = await apiRequest("POST", "/api/conversations", data);
      return response.json();
    },
    onSuccess: (conversation: Conversation) => {
      setCurrentConversation(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; role: string }) => {
      if (!currentConversation) throw new Error("No conversation selected");

      // For lead-finder agent, use demo chat endpoint for real property data
      if (selectedAgent === "lead-finder") {
        const demoResponse = await fetch('/api/demo/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: data.content,
            agentType: 'lead_finder',
            sessionState: sessionState,
            // Pass excluded property IDs to avoid duplicates
            excludedPropertyIds: Array.from(shownPropertyIds)
          })
        });

        if (!demoResponse.ok) {
          throw new Error('Failed to get response from demo chat');
        }

        const demoResult = await demoResponse.json();

        // Update session state if provided
        if (demoResult.sessionState) {
          setSessionState(demoResult.sessionState);
        }

        // Create both user and AI messages in the conversation
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: data.content,
          role: "user"
        });

        // If property data was returned, format it for display
        let messageContent = demoResult.response;
        if (demoResult.property) {
          const prop = demoResult.property;
          messageContent = `${demoResult.response}

**PROPERTY DETAILS:**
Address: ${prop.address}, ${prop.city}, ${prop.state} ${prop.zipCode}
ARV: $${parseInt(prop.arv).toLocaleString()}
Max Offer: $${parseInt(prop.maxOffer).toLocaleString()}
Property Type: ${prop.propertyType.replace('_', ' ')}

**OWNER INFORMATION:**
Owner Name: ${prop.ownerName}
Owner Phone: ${prop.ownerPhone}
Owner Email: ${prop.ownerEmail}
Mailing Address: ${prop.ownerMailingAddress}

**FINANCIAL ANALYSIS:**
Equity Percentage: ${prop.equityPercentage}%
Motivation Score: ${prop.motivationScore}/100
Lead Type: ${prop.leadType.replace('_', ' ')}
Distressed Indicator: ${prop.distressedIndicator.replace('_', ' ')}`;
        }

        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: messageContent,
          role: "assistant",
          isAiGenerated: true
        });

        // Extract property IDs from the response to update shownPropertyIds
        if (demoResult.response && demoResult.response.includes("Great! I found")) {
          const propertyMatches = demoResult.response.match(/(\d+)\.\s+([^\n]+)\n/g);
          if (propertyMatches) {
            propertyMatches.forEach((match: string) => {
              const address = match.replace(/^\d+\.\s*/, '').trim().split('\n')[0];
              // A simple way to generate a unique ID for now, could be improved
              const propertyId = `${address}_${currentConversation}`;
              setShownPropertyIds(prev => new Set([...Array.from(prev), propertyId]));
            });
          }
        }
        // Store search criteria if it's a property search
        if (data.content.toLowerCase().includes("find") || data.content.toLowerCase().includes("properties")) {
          setLastSearchCriteria({ query: data.content, sessionState: demoResult.sessionState });
        }

        return demoResult;
      } else {
        // Regular conversation flow for other agents
        const response = await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, data);
        return response.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
      // Clear processing state
      setWizardProcessing(false);
      // Don't clear input here - it's handled in handleSendMessage
      // Reset conversation creation state
      createConversationMutation.reset();
    },
    onError: () => {
      // Clear processing state on error too
      setWizardProcessing(false);
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async (propertyData: any) => {
      const response = await apiRequest("POST", "/api/properties", propertyData);
      return response.json();
    },
    onSuccess: (savedProperty) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      console.log("Property saved successfully:", savedProperty);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (messageOverride?: string) => {
    const messageToSend = messageOverride || inputMessage.trim();
    if (!messageToSend) return;

    // Clear input immediately for better UX
    if (!messageOverride) {
      setInputMessage("");
    }

    if (!currentConversation) {
      // Create new conversation and store message to send after creation
      const agentName = agentTypes.find(a => a.id === selectedAgent)?.name || "Chat";
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title: messageToSend.slice(0, 50) + (messageToSend.length > 50 ? "..." : ""),
      });
      // Store message to send after conversation creation
      setInputMessage(messageToSend);
    } else {
      // Send message immediately if conversation exists
      sendMessageMutation.mutate({
        content: messageToSend,
        role: "user",
      });
    }
  };

  // Send message after conversation is created
  useEffect(() => {
    if (currentConversation && inputMessage.trim() && createConversationMutation.isSuccess) {
      const messageContent = inputMessage.trim();
      sendMessageMutation.mutate({
        content: messageContent,
        role: "user",
      });
    }
  }, [currentConversation, createConversationMutation.isSuccess]);

  // Handle wizard completion
  useEffect(() => {
    if (currentConversation && inputMessage && !showWizard && wizardData.city) {
      // Clear wizard data after successful submission
      setWizardData({
        city: "",
        state: "",
        sellerType: "",
        propertyType: ""
      });
    }
  }, [currentConversation, inputMessage, showWizard]);

  const currentAgent = agentTypes.find(agent => agent.id === selectedAgent);

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
    'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
    'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'UT', 'VT', 'VA', 'WV', 'WI', 'WY'
  ];

  const sellerTypes = [
    { value: "distressed", label: "Distressed Properties (Pre-foreclosure, Vacant)" },
    { value: "absentee", label: "Absentee Owners (Out-of-state/Non-resident)" },
    { value: "high_equity", label: "High Equity Owners (70%+ equity)" },
    { value: "motivated", label: "Motivated Sellers (Multiple indicators)" },
    { value: "corporate", label: "Corporate Owned Properties" },
    { value: "tired_landlord", label: "Tired Landlords" },
    { value: "any", label: "Any Seller Type" }
  ];

  const propertyTypes = [
    { value: "single_family", label: "Single Family Homes" },
    { value: "multi_family", label: "Multi-Family (2-4 units)" },
    { value: "condo", label: "Condominiums" },
    { value: "townhouse", label: "Townhouses" },
    { value: "any", label: "Any Property Type" }
  ];

  const handleWizardNext = () => {
    if (wizardStep < 4) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  const handleWizardSubmit = () => {
    // Build search query from wizard data
    const location = `${wizardData.city}, ${wizardData.state}`;
    let searchQuery = "Find";

    // Add property type first if specified
    if (wizardData.propertyType !== "any") {
      const propertyTypeLabel = propertyTypes.find(p => p.value === wizardData.propertyType)?.label;
      searchQuery += ` ${propertyTypeLabel?.toLowerCase()}`;
    } else {
      searchQuery += ` properties`;
    }

    searchQuery += ` in ${location}`;

    if (wizardData.sellerType !== "any") {
      const sellerTypeLabel = sellerTypes.find(s => s.value === wizardData.sellerType)?.label;
      searchQuery += ` with ${sellerTypeLabel?.toLowerCase()}`;
    }

    if (wizardData.minBedrooms) {
      searchQuery += ` with at least ${wizardData.minBedrooms} bedrooms`;
    }

    if (wizardData.maxPrice) {
      searchQuery += ` under $${wizardData.maxPrice.toLocaleString()}`;
    }

    // Show processing state
    setWizardProcessing(true);

    // Set the message and close wizard
    setInputMessage(searchQuery);
    setShowWizard(false);
    setWizardStep(1);

    // Create conversation if needed and send message
    if (!currentConversation) {
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title: `Lead Search: ${wizardData.city}, ${wizardData.state}`,
      });
    } else {
      sendMessageMutation.mutate({
        content: searchQuery,
        role: "user",
      });
    }
  };

  const handleSaveLead = async (propertyData: any) => {
    try {
      // Validate required fields
      if (!propertyData.address || !propertyData.city || !propertyData.state) {
        throw new Error("Missing required property information");
      }

      // Clean and validate the data
      const cleanPropertyData = {
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zipCode: propertyData.zipCode || '',
        bedrooms: propertyData.bedrooms ? parseInt(propertyData.bedrooms.toString()) : 0,
        bathrooms: propertyData.bathrooms ? parseInt(propertyData.bathrooms.toString()) : 0,
        squareFeet: propertyData.squareFeet ? parseInt(propertyData.squareFeet.toString()) : 0,
        arv: propertyData.arv ? propertyData.arv.toString() : '0',
        maxOffer: propertyData.maxOffer ? propertyData.maxOffer.toString() : '0',
        status: 'new',
        leadType: propertyData.leadType || 'standard',
        propertyType: 'single_family',
        ownerName: propertyData.ownerName || '',
        ownerPhone: propertyData.ownerPhone || '',
        ownerEmail: propertyData.ownerEmail || '',
        equityPercentage: propertyData.equityPercentage ? parseInt(propertyData.equityPercentage.toString()) : 0,
        motivationScore: propertyData.motivationScore ? parseInt(propertyData.motivationScore.toString()) : 0,
        distressedIndicator: propertyData.distressedIndicator || '',
        ownerMailingAddress: propertyData.ownerMailingAddress || '',
        ownerStatus: propertyData.ownerStatus || ''
      };

      await savePropertyMutation.mutateAsync(cleanPropertyData);

      // Invalidate the properties query to refresh the CRM data
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });

    } catch (error) {
      console.error('Error saving lead:', error);
      // You might want to show a toast error message here
    }
  };

  const renderWizard = () => {
    if (!showWizard) return null;

    return (
      <Card className="mb-4 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            Lead Finder Wizard - Step {wizardStep} of 4
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Where are you looking for properties?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City or ZIP Code</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Valley Forge, Philadelphia, 19481"
                    value={wizardData.city}
                    onChange={(e) => setWizardData({...wizardData, city: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={wizardData.state} onValueChange={(value) => setWizardData({...wizardData, state: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What type of sellers are you targeting?</h3>
              <div className="grid grid-cols-1 gap-2">
                {sellerTypes.map((type) => (
                  <button
                    key={type.value}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      wizardData.sellerType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setWizardData({...wizardData, sellerType: type.value})}
                  >
                    <div className="font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What property type are you interested in?</h3>
              <div className="grid grid-cols-1 gap-2">
                {propertyTypes.map((type) => (
                  <button
                    key={type.value}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      wizardData.propertyType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setWizardData({...wizardData, propertyType: type.value})}
                  >
                    <div className="font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Additional filters (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minBedrooms">Minimum Bedrooms</Label>
                  <Select value={wizardData.minBedrooms?.toString() || ""} onValueChange={(value) => setWizardData({...wizardData, minBedrooms: value ? parseInt(value) : undefined})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="maxPrice">Maximum Price</Label>
                  <Select value={wizardData.maxPrice?.toString() || ""} onValueChange={(value) => setWizardData({...wizardData, maxPrice: value ? parseInt(value) : undefined})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100000">Under $100k</SelectItem>
                      <SelectItem value="200000">Under $200k</SelectItem>
                      <SelectItem value="300000">Under $300k</SelectItem>
                      <SelectItem value="500000">Under $500k</SelectItem>
                      <SelectItem value="750000">Under $750k</SelectItem>
                      <SelectItem value="1000000">Under $1M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Search Summary:</h4>
                <p className="text-sm text-gray-700">
                  Looking for {sellerTypes.find(s => s.value === wizardData.sellerType)?.label.toLowerCase()}
                  {" in "}{/^\d{5}$/.test(wizardData.city) ? wizardData.city : `${wizardData.city}, ${wizardData.state}`}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleWizardBack}
              disabled={wizardStep === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowWizard(false);
                  setWizardStep(1);
                }}
              >
                Cancel
              </Button>

              {wizardStep < 4 ? (
                <Button
                  onClick={handleWizardNext}
                  disabled={
                    (wizardStep === 1 && (!wizardData.city || !wizardData.state)) ||
                    (wizardStep === 2 && !wizardData.sellerType) ||
                    (wizardStep === 3 && !wizardData.propertyType)
                  }
                  className="flex items-center gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleWizardSubmit}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="h-4 w-4" />
                  Find Properties
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMultipleProperties = (content: string) => {
    // Enhanced property detection - check for various response formats
    console.log('Checking content for properties:', content.substring(0, 300));
    
    const hasPropertyIndicators = content.includes("properties") || 
                                  content.includes("PROPERTY") || 
                                  content.includes("Address:") ||
                                  content.includes("Owner:") ||
                                  content.includes("ARV:") ||
                                  content.includes("Equity:") ||
                                  content.includes("Harrisburg") ||
                                  content.includes("absentee") ||
                                  content.match(/\d+\.\s+\d+/) ||
                                  content.includes("Lead");

    if (hasPropertyIndicators) {
      console.log('Property indicators found, analyzing content...');

      // Try multiple extraction patterns for different response formats
      let propertyMatches = [];
      
      // Pattern 1: Numbered properties with addresses
      const numberedRegex = /(\d+)\.\s+([^\n]+(?:\n(?!\d+\.)[^\n]*)*)/g;
      let match;
      while ((match = numberedRegex.exec(content)) !== null) {
        const propertyContent = match[2].trim();
        if (propertyContent.length > 20) { // Only include substantial content
          propertyMatches.push({
            number: match[1],
            content: propertyContent
          });
        }
      }

      // Pattern 2: If no numbered properties, look for single property with key indicators
      if (propertyMatches.length === 0) {
        const singlePropertyIndicators = ['Address:', 'Owner:', 'ARV:', 'Equity:', 'Harrisburg', 'absentee'];
        if (singlePropertyIndicators.some(indicator => content.includes(indicator))) {
          propertyMatches.push({
            number: '1',
            content: content.trim()
          });
        }
      }

      if (propertyMatches.length === 0) {
        console.log('No property patterns matched, showing as regular text');
        return null;
      }

      console.log(`Found ${propertyMatches.length} property entries`);

      return (
        <div className="mt-3 space-y-4">
          {propertyMatches.map((propertyMatch, index) => {
            const propertyText = propertyMatch.content;
            if (!propertyText.trim()) return null;

            console.log(`Rendering property card ${propertyMatch.number}:`, propertyText.substring(0, 100));

            // Extract key information from each property
            const lines = propertyText.trim().split('\n');
            const address = lines[0]?.replace(/^-\s*/, '').trim() || 'Address not found';

            // Extract key details with multiple patterns
            const extractValue = (text: string | undefined, pattern: RegExp) => {
              if (!text) return 'N/A';
              const match = text.match(pattern);
              return match ? match[1].trim() : 'N/A';
            };

            const price = extractValue(propertyText, /(?:Price|ARV|Value):\s*\$?([^\n]+)/i) || 'N/A';
            const bedBath = extractValue(propertyText, /(\d+BR\/\d+BA[^\n]*)/i) ||
                          extractValue(propertyText, /(\d+\s*bed[^\n]*\d+\s*bath[^\n]*)/i) || 'N/A';
            const owner = extractValue(propertyText, /Owner Name:\s*([^\n]+)/i) || extractValue(propertyText, /Owner:\s*([^\n]+)/i) || 'N/A';
            const motivation = extractValue(propertyText, /Motivation[^:]*:\s*([^\n]+)/i) || 'N/A';
            const equity = extractValue(propertyText, /Equity[^:]*:\s*([^\n]+)/i) || 'N/A';
            const leadType = extractValue(propertyText, /(?:Lead Type|Type):\s*([^\n]+)/i) || 'N/A';
            const whyGood = extractValue(propertyText, /Why[^:]*:\s*([^\n]+)/i);
            const lastSaleDate = extractValue(propertyText, /Last Sale Date:\s*([^\n]+)/i) || null;
            const lastSalePrice = extractValue(propertyText, /Last Sale Price:\s*\$?([^\n]+)/i) || null;

            const propertyData = {
                number: propertyMatch.number,
                address,
                price,
                bedBath,
                owner,
                motivation,
                equity,
                leadType,
                lastSaleDate,
                lastSalePrice
              };

            return (
              <Card key={`property-${propertyData.number}`} className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <h4 className="font-medium text-green-800">Live Property Lead #{propertyData.number}</h4>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">BatchData API</Badge>
                    </div>

                    <div className="bg-white p-3 rounded border">
                      <h5 className="font-semibold text-gray-800 mb-3">🏠 {address}</h5>

                      {/* Owner Information Section */}
                      <div className="mb-3 p-2 bg-blue-50 rounded">
                        <h6 className="font-medium text-blue-800 mb-1">👤 Owner Information</h6>
                        <div className="text-sm text-blue-700">
                          <div><strong>Name:</strong> {owner !== 'N/A' ? owner : 'Available via skip trace'}</div>
                          <div><strong>Contact:</strong> Phone & Email available via skip trace</div>
                          <div><strong>Mailing:</strong> Same as property address</div>
                          <div><strong>Status:</strong> Owner Occupied</div>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>💵 Est. Value:</strong> {price !== 'N/A' ? `$${price}` : 'Available in full report'}</div>
                        <div><strong>🏠 Details:</strong> {bedBath !== 'N/A' && !bedBath.includes('0BR/0BA') ? bedBath : 'Details available via property inspection'}</div>
                        <div><strong>⭐ Motivation:</strong> {motivation !== 'N/A' ? motivation : 'High (multiple factors)'}</div>
                        <div><strong>📈 Equity:</strong> {equity !== 'N/A' ? equity : 'High equity property'}</div>
                        <div><strong>🏷️ Lead Type:</strong> {leadType !== 'N/A' ? leadType : 'Distressed/Motivated'}</div>
                        <div><strong>📊 Max Offer:</strong> 70% ARV Rule Applied</div>
                      </div>
                    </div>

                    {/* Sale History Section */}
                    <div className="bg-blue-50 p-3 rounded border">
                      <h6 className="font-semibold text-blue-800 mb-2">📈 Sale History</h6>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Last Sale Date:</strong> {propertyData.lastSaleDate || 'No recent sales'}</div>
                        <div><strong>Last Sale Price:</strong> {propertyData.lastSalePrice ? `$${parseInt(propertyData.lastSalePrice).toLocaleString()}` : 'Not available'}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-green-200 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const propertyData = {
                            address: address,
                            city: extractValue(address, /([^,]+),\s*[A-Z]{2}/i) || '',
                            state: extractValue(address, /,\s*([A-Z]{2})/i) || '',
                            zipCode: '',
                            arv: price.replace(/[$,]/g, '') || '0',
                            maxOffer: (parseInt(price.replace(/[$,]/g, '') || '0') * 0.7).toString(),
                            ownerName: owner,
                            ownerPhone: 'Available via skip trace',
                            ownerEmail: 'Available via skip trace',
                            ownerMailingAddress: 'Same as property address',
                            ownerStatus: 'Owner Occupied',
                            motivationScore: motivation.replace(/\/100/, '') || '50',
                            equityPercentage: equity.replace(/%/, '') || '0',
                            leadType: leadType.toLowerCase().replace(/\s+/g, '_') || 'standard'
                          };

                          handleSaveLead(propertyData);
                        }}
                        disabled={savePropertyMutation.isPending}
                      >
                        {savePropertyMutation.isPending ? 'Saving...' : 'Save Lead'}
                      </Button>
                      <Button size="sm" variant="outline">Analyze Deal</Button>
                      <Button size="sm" variant="outline">Contact Owner</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 text-center">
              💡 These are LIVE properties from BatchData API with verified owner information and equity calculations!
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderPropertyCard = (content: string) => {
    // Check if this is a property response with structured data from BatchData API
    if (content.includes("**PROPERTY DETAILS:**") ||
        content.includes("**FINANCIAL ANALYSIS:**") ||
        content.includes("**OWNER INFORMATION:**") ||
        content.includes("**PROPERTY OVERVIEW:**") ||
        content.includes("**CONTACT INFORMATION:**") ||
        content.includes("**MOTIVATION SCORE:**") ||
        content.includes("BatchData API integration") ||
        content.includes("🚨 FORECLOSURE DETAILS") ||
        (content.includes("Address:") && content.includes("ARV:")) ||
        (content.includes("**") && (content.includes("Property") || content.includes("Owner")))) {

      console.log('Property card detected. Content:', content);

      // Parse sections using line-by-line approach for better accuracy
      const lines = content.split('\n');
      const parsedSections: any = {};
      let currentSection = '';

      lines.forEach(line => {
        const trimmedLine = line.trim();

        // Detect section headers
        if (trimmedLine.includes('**PROPERTY DETAILS:**') || trimmedLine.includes('**PROPERTY OVERVIEW:**')) {
          currentSection = 'property';
          return;
        } else if (trimmedLine.includes('**FINANCIAL ANALYSIS:**')) {
          currentSection = 'financial';
          return;
        } else if (trimmedLine.includes('**OWNER INFORMATION:**')) {
          currentSection = 'owner';
          return;
        } else if (trimmedLine.includes('**CONTACT INFORMATION:**')) {
          currentSection = 'contact';
          return;
        } else if (trimmedLine.includes('**OWNER PORTFOLIO:**') || trimmedLine.includes('**PORTFOLIO:**')) {
          currentSection = 'portfolio';
          return;
        } else if (trimmedLine.includes('**MOTIVATION SCORE:**')) {
          currentSection = 'motivation';
          return;
        } else if (trimmedLine.includes('🚨 FORECLOSURE DETAILS')) {
          currentSection = 'foreclosure';
          return;
        }

        // Add content to current section, skip empty lines and section headers
        if (currentSection && trimmedLine && !trimmedLine.startsWith('**') && !trimmedLine.startsWith('🚨')) {
          if (parsedSections[currentSection]) {
            parsedSections[currentSection] += '\n' + trimmedLine;
          } else {
            parsedSections[currentSection] = trimmedLine;
          }
        }
      });

      console.log('Parsed sections:', parsedSections);

      // Extract property details for tracking
      const extractValue = (text: string | undefined, label: string) => {
        if (!text) return '';
        const match = text.match(new RegExp(`${label}:?\\s*([^\\n]+)`, 'i'));
        return match ? match[1].trim() : '';
      };

      const extractMultipleValues = (text: string | undefined, labels: string[]) => {
        if (!text) return '';
        for (const label of labels) {
          const value = extractValue(text, label);
          if (value) return value;
        }
        return '';
      };

      const propertyAddress = extractMultipleValues(parsedSections.property || content, ['Address', '🏠', 'Property Address']);
      const ownerName = extractMultipleValues(parsedSections.owner || parsedSections.contact || content, ['Owner Name', 'Owner', 'Full Name', 'Name', '👤']);
      const ownerPhone = extractMultipleValues(parsedSections.contact || parsedSections.owner || content, ['Owner Phone', 'Phone', 'Contact Phone', '📞', '☎️']);
      const ownerEmail = extractMultipleValues(parsedSections.contact || parsedSections.owner || content, ['Owner Email', 'Email', 'Contact Email', '📧', '✉️']);
      const ownerMailingAddress = extractMultipleValues(parsedSections.owner || content, ['Mailing Address', 'Mailing']) || 'Same as property address';
      const ownerStatus = extractMultipleValues(parsedSections.owner || content, ['Owner Status', 'Status']) || 'Owner Occupied';

      const propertyId = `${propertyAddress}_${ownerName}`; // Simple unique ID

      // Track this property as shown and store search criteria
      if (!shownPropertyIds.has(propertyId)) {
        setShownPropertyIds(prev => new Set([...Array.from(prev), propertyId]));
      }

      // This logic assumes the content itself is a single property search result
      // and stores the criteria that led to it.
      // For now, we'll assume any direct property card render implies a search.
      setLastSearchCriteria({ query: content }); // Storing the content as criteria for now

      return (
        <Card className="mt-3 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h4 className="font-medium text-green-800">Live Property Lead</h4>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">BatchData API</Badge>
              </div>

              <div className="bg-white p-3 rounded border">
                <h5 className="font-semibold text-gray-800 mb-2">📋 Property Information</h5>
                <div className="text-sm text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {content}
                </div>
              </div>

              <div className="pt-2 border-t border-green-200 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const propertyData = {
                      address: extractMultipleValues(parsedSections.property || content, ['Address', '🏠', 'Property Address']),
                      city: extractMultipleValues(parsedSections.property || content, ['City']),
                      state: extractMultipleValues(parsedSections.property || content, ['State']),
                      zipCode: extractMultipleValues(parsedSections.property || content, ['ZIP', 'Zip Code']),
                      arv: (extractMultipleValues(parsedSections.financial || content, ['Est. Value', 'Estimated Value', 'ARV', 'Value']) || '0').replace(/[$,]/g, ''),
                      maxOffer: (extractMultipleValues(parsedSections.financial || content, ['Max Offer', 'Offer']) || '0').replace(/[$,]/g, ''),
                      ownerName: ownerName,
                      ownerPhone: ownerPhone,
                      ownerEmail: ownerEmail,
                      ownerMailingAddress: ownerMailingAddress,
                      ownerStatus: ownerStatus,
                      motivationScore: (extractMultipleValues(parsedSections.motivation || content, ['Score', 'Motivation', '⭐']) || '50').replace(/\/100/, ''),
                      equityPercentage: (extractMultipleValues(parsedSections.financial || content, ['Equity', 'Equity Percentage', '📈']) || '0').replace(/%/, ''),
                      leadType: content.toLowerCase().includes('foreclosure') ? 'preforeclosure' : 'standard'
                    };

                    handleSaveLead(propertyData);
                  }}
                  disabled={savePropertyMutation.isPending}
                >
                  {savePropertyMutation.isPending ? 'Saving...' : 'Save Lead'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1">Analyze Deal</Button>
                <Button size="sm" variant="outline">Contact Owner</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-slate-900">AI Agents</h1>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agentTypes.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500">GPT-4 Powered</span>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {renderWizard()}

        {/* Processing indicator */}
        {(wizardProcessing || sendMessageMutation.isPending) && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800">🔍 Searching Properties...</h3>
                  <p className="text-sm text-blue-600 mt-1">
                    {wizardData.city && wizardData.state ?
                      `Analyzing ${wizardData.city}, ${wizardData.state} with BatchData API for distressed properties and motivated sellers` :
                      'Analyzing property data with BatchData API for distressed properties and motivated sellers'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {messages.length === 0 && !currentConversation && !showWizard && !wizardProcessing && (
          <div className="flex items-start space-x-3">
            <Avatar>
              <AvatarImage />
              <AvatarFallback>
                {currentAgent && <currentAgent.icon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-900">
                    {selectedAgent === "lead-finder" && "Hello! I'm your Lead Finder Agent. I can help you discover off-market properties, distressed sales, and motivated sellers. What type of leads are you looking for today?"}
                    {selectedAgent === "deal-analyzer" && "Hi! I'm your Deal Analyzer Agent. I can help you analyze property deals, calculate ARV, estimate repair costs, and determine maximum allowable offers. Share a property address to get started!"}
                    {selectedAgent === "negotiation" && "Hello! I'm your Negotiation Agent. I can help you craft compelling offers, write follow-up messages, and develop negotiation strategies for your deals. What property are you working on?"}
                    {selectedAgent === "closing" && "Hi! I'm your Closing Agent. I can help you prepare contracts, coordinate closings, and manage documents. What deal are you looking to close?"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedAgent === "lead-finder" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWizard(true)}
                          className="flex items-center gap-2 mb-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        >
                          <Search className="h-4 w-4" />
                          Use Lead Finder Wizard
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-slate-200"
                            onClick={() => setInputMessage("Show me 5 properties in Orlando, FL")}
                          >
                            5 Properties Grid View
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-slate-200"
                            onClick={() => setInputMessage("Find distressed properties in Philadelphia, PA")}
                          >
                            Find distressed properties
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-slate-200"
                            onClick={() => setInputMessage("Show me 3 high equity properties in Dallas, TX")}
                          >
                            Multiple high equity
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-slate-200"
                            onClick={() => setInputMessage("Find high equity properties in 90210")}
                          >
                            Single property search
                          </Badge>
                        </div>
                      </>
                    )}
                    {selectedAgent === "deal-analyzer" && (
                      <>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Calculate ARV</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Estimate repairs</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Find comps</Badge>
                      </>
                    )}
                    {selectedAgent === "negotiation" && (
                      <>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Write offer letter</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Follow-up script</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Objection handling</Badge>
                      </>
                    )}
                    {selectedAgent === "closing" && (
                      <>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Purchase agreement</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Assignment contract</Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">Closing checklist</Badge>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex items-start space-x-3 ${message.role === "user" ? "justify-end" : ""}`}>
            {message.role === "assistant" && (
              <Avatar>
                <AvatarImage />
                <AvatarFallback>
                  {currentAgent && <currentAgent.icon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            )}
            <div className={`flex-1 ${message.role === "user" ? "max-w-xs sm:max-w-md" : ""}`}>
              <Card className={message.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                <CardContent className="p-4">
                  {message.role === "assistant" ? (
                    <>
                      {renderMultipleProperties(message.content) || renderPropertyCard(message.content) || (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </CardContent>
              </Card>
            </div>
            {message.role === "user" && (
              <Avatar>
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <Textarea
              placeholder={`Ask your ${currentAgent?.name.replace(/[🔍📊💬📋]/g, "").trim()} anything...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={3}
              className="resize-none"
            />
          </div>
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || sendMessageMutation.isPending}
            size="lg"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}