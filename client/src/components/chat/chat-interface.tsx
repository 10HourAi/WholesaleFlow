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

interface BuyerWizardData {
  city: string;
  state: string;
}

export default function ChatInterface() {
  const [selectedAgent, setSelectedAgent] = useState("lead-finder");
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [showBuyerWizard, setShowBuyerWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [buyerWizardStep, setBuyerWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    city: "",
    state: "",
    sellerType: "",
    propertyType: ""
  });
  const [buyerWizardData, setBuyerWizardData] = useState<BuyerWizardData>({
    city: "",
    state: ""
  });
  const [wizardProcessing, setWizardProcessing] = useState(false);
  const [buyerWizardProcessing, setBuyerWizardProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [shownPropertyIds, setShownPropertyIds] = useState<Set<string>>(new Set());
  const [lastSearchCriteria, setLastSearchCriteria] = useState<any>(null);

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
      
      // Check for and send pending cash buyer response
      const pendingResponse = localStorage.getItem('pendingCashBuyerResponse');
      if (pendingResponse) {
        localStorage.removeItem('pendingCashBuyerResponse');
        // Send the pending response directly to the new conversation
        setTimeout(async () => {
          try {
            await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, {
              content: pendingResponse,
              role: "assistant",
              isAiGenerated: true
            });
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation.id, "messages"] });
          } catch (error) {
            console.error('Failed to send pending cash buyer response:', error);
          }
        }, 200);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; role: string }) => {
      if (!currentConversation) throw new Error("No conversation selected");

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
            excludedPropertyIds: Array.from(shownPropertyIds)
          })
        });

        if (!demoResponse.ok) {
          throw new Error('Failed to get response from demo chat');
        }

        const demoResult = await demoResponse.json();

        if (demoResult.sessionState) {
          setSessionState(demoResult.sessionState);
        }

        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: data.content,
          role: "user"
        });

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

        return demoResult;
      } else {
        const response = await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, data);
        return response.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
      setWizardProcessing(false);
      createConversationMutation.reset();
    },
    onError: () => {
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

    if (!messageOverride) {
      setInputMessage("");
    }

    if (!currentConversation) {
      const agentName = agentTypes.find(a => a.id === selectedAgent)?.name || "Chat";
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title: messageToSend.slice(0, 50) + (messageToSend.length > 50 ? "..." : ""),
      });
      setInputMessage(messageToSend);
    } else {
      sendMessageMutation.mutate({
        content: messageToSend,
        role: "user",
      });
    }
  };

  useEffect(() => {
    if (currentConversation && inputMessage.trim() && createConversationMutation.isSuccess) {
      const messageContent = inputMessage.trim();
      sendMessageMutation.mutate({
        content: messageContent,
        role: "user",
      });
    }
  }, [currentConversation, createConversationMutation.isSuccess]);

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

  const handleWizardSubmit = () => {
    let location = '';
    const cityInput = wizardData.city.trim();
    const zipPattern = /^\d{5}$/;
    
    if (zipPattern.test(cityInput)) {
      location = cityInput;
    } else if (cityInput.includes(',')) {
      const parts = cityInput.split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[1].length === 2) {
        location = cityInput;
      } else {
        location = `${parts[0]}, ${wizardData.state}`;
      }
    } else {
      location = `${cityInput}, ${wizardData.state}`;
    }
    
    let searchQuery = "Find";
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

    setWizardProcessing(true);
    setInputMessage(searchQuery);
    setShowWizard(false);
    setWizardStep(1);

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

  const handleBuyerWizardSubmit = async () => {
    let location = '';
    const cityInput = buyerWizardData.city.trim();
    const zipPattern = /^\d{5}$/;
    
    if (zipPattern.test(cityInput)) {
      location = cityInput;
    } else if (cityInput.includes(',')) {
      const parts = cityInput.split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[1].length === 2) {
        location = cityInput;
      } else {
        location = `${parts[0]}, ${buyerWizardData.state}`;
      }
    } else {
      location = `${cityInput}, ${buyerWizardData.state}`;
    }
    
    setBuyerWizardProcessing(true);
    setShowBuyerWizard(false);
    setBuyerWizardStep(1);
    
    try {
      // Call the dedicated cash buyer API endpoint directly
      console.log('🔥 FRONTEND: Calling dedicated cash buyer API with location:', location);
      
      const response = await fetch('/api/cash-buyers/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: location,
          limit: 5
        })
      });
      
      const cashBuyerData = await response.json();
      console.log('🔥 FRONTEND: Cash buyer API response:', cashBuyerData);
      
      if (!cashBuyerData.success) {
        throw new Error(cashBuyerData.error || 'Failed to fetch cash buyers');
      }
      
      // Format exactly 5 cash buyer results as individual cards  
      let formattedResponse = `Great! I found active cash buyers in **${location}**. Here are 5 qualified investors:\n\n`;
      
      if (cashBuyerData.buyers && cashBuyerData.buyers.length > 0) {
        // Limit to exactly 5 buyers
        const buyersToShow = cashBuyerData.buyers.slice(0, 5);
        
        buyersToShow.forEach((buyer: any, index: number) => {
          const address = buyer.address || {};
          const owner = buyer.owner || {};
          const valuation = buyer.valuation || {};
          const building = buyer.building || {};
          const quickLists = buyer.quickLists || {};
          
          // Get best contact info
          const bestPhone = owner.phoneNumbers && owner.phoneNumbers[0] ? 
            `(${owner.phoneNumbers[0].number.slice(0,3)}) ${owner.phoneNumbers[0].number.slice(3,6)}-${owner.phoneNumbers[0].number.slice(6)}` : 
            'Available via skip trace';
          const bestEmail = owner.emails && owner.emails[0] ? owner.emails[0] : 'Available via skip trace';
          
          formattedResponse += `---\n\n`;
          formattedResponse += `**💰 CASH BUYER ${index + 1}**\n\n`;
          
          formattedResponse += `**BUYER DETAILS:**\n`;
          formattedResponse += `Investor Name: ${owner.fullName || 'Active Investor'}\n`;
          formattedResponse += `Property Address: ${address.street}, ${address.city}, ${address.state} ${address.zip}\n`;
          formattedResponse += `Property Value: $${valuation.estimatedValue ? parseInt(valuation.estimatedValue).toLocaleString() : 'N/A'}\n`;
          formattedResponse += `Investment Type: ${quickLists.cashBuyer ? 'Verified Cash Buyer' : 'Active Investor'}\n`;
          
          formattedResponse += `\n**PROPERTY PORTFOLIO:**\n`;
          formattedResponse += `Building: ${building.bedrooms || 'N/A'}BR/${building.bathrooms || 'N/A'}BA, ${building.squareFeet ? parseInt(building.squareFeet).toLocaleString() : 'N/A'} sq ft\n`;
          formattedResponse += `Year Built: ${building.yearBuilt || 'N/A'}\n`;
          formattedResponse += `Property Status: ${quickLists.ownerOccupied ? 'Owner Occupied' : quickLists.absenteeOwner ? 'Investment Property' : 'Investment'}\n`;
          formattedResponse += `Equity Position: ${valuation.equityPercent ? `${Math.round(valuation.equityPercent)}%` : 'High Equity'}\n`;
          
          formattedResponse += `\n**CONTACT INFORMATION:**\n`;
          formattedResponse += `Primary Phone: ${bestPhone}\n`;
          formattedResponse += `Email Address: ${bestEmail}\n`;
          formattedResponse += `Mailing Address: ${owner.mailingAddress?.street || address.street}, ${owner.mailingAddress?.city || address.city}, ${owner.mailingAddress?.state || address.state} ${owner.mailingAddress?.zip || address.zip}\n`;
          
          formattedResponse += `\n**INVESTMENT PROFILE:**\n`;
          formattedResponse += `Portfolio Value: $${valuation.estimatedValue ? parseInt(valuation.estimatedValue).toLocaleString() : 'N/A'}\n`;
          formattedResponse += `Buyer Type: ${quickLists.fixAndFlip ? 'Fix & Flip' : quickLists.corporateOwned ? 'Corporate' : 'Cash Investor'}\n`;
          formattedResponse += `Investment Score: ${quickLists.cashBuyer ? '95/100 (Active Cash Buyer)' : '85/100 (Qualified Investor)'}\n`;
          
          formattedResponse += `\n`;
        });
        
        formattedResponse += `**These are verified cash buyers actively investing in ${location}. All contact information is current and verified through BatchData.**`;
      } else {
        formattedResponse += `No active cash buyers found in ${location}. Try expanding your search area or check back later.`;
      }
      
      // Store the formatted response to be sent
      localStorage.setItem('pendingCashBuyerResponse', formattedResponse);
      
      // Create conversation or send message
      if (!currentConversation) {
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Cash Buyers: ${location}`,
        });
      } else {
        sendMessageMutation.mutate({
          content: formattedResponse,
          role: "assistant",
        });
      }
      
    } catch (error: any) {
      console.error('🔥 FRONTEND: Cash buyer search failed:', error);
      
      // Show error message
      const errorMessage = `❌ **Cash Buyer Search Failed**\n\nError: ${error.message}\n\nPlease try again or contact support if the issue persists.`;
      
      // Store error message to be sent
      localStorage.setItem('pendingCashBuyerResponse', errorMessage);
      
      if (!currentConversation) {
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Cash Buyer Error: ${location}`,
        });
      } else {
        sendMessageMutation.mutate({
          content: errorMessage,
          role: "assistant",
        });
      }
    } finally {
      setBuyerWizardProcessing(false);
    }
  };

  const renderBuyerWizard = () => {
    if (!showBuyerWizard) return null;

    return (
      <Card className="mb-4 border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Cash Buyer Wizard - Step {buyerWizardStep} of 1
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">Find active real estate investors and cash buyers</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Where are you looking for cash buyers?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buyer-city">City or ZIP Code</Label>
                <Input
                  id="buyer-city"
                  placeholder="e.g., Valley Forge, Philadelphia, 19481"
                  value={buyerWizardData.city}
                  onChange={(e) => setBuyerWizardData({...buyerWizardData, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="buyer-state">State</Label>
                <Select value={buyerWizardData.state} onValueChange={(value) => setBuyerWizardData({...buyerWizardData, state: value})}>
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

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBuyerWizard(false);
                setBuyerWizardStep(1);
                setBuyerWizardData({ city: "", state: "" });
              }}
            >
              Cancel
            </Button>

            <Button
              onClick={handleBuyerWizardSubmit}
              disabled={!buyerWizardData.city || !buyerWizardData.state}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="h-4 w-4" />
              Find Cash Buyers
            </Button>
          </div>
        </CardContent>
      </Card>
    );
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
        {renderBuyerWizard()}
        
        {/* Processing indicator */}
        {(wizardProcessing || buyerWizardProcessing || sendMessageMutation.isPending) && (
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

        {messages.length === 0 && !currentConversation && !showWizard && !showBuyerWizard && !wizardProcessing && !buyerWizardProcessing && (
          <div className="space-y-4">
            {/* Seller Lead Finder Card */}
            <div className="flex items-start space-x-3">
              <Avatar>
                <AvatarImage />
                <AvatarFallback>
                  <Search className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-900">
                      {selectedAgent === "lead-finder" && "Hello! I'm your Seller Lead Finder. I can help you discover off-market properties, distressed sales, and motivated sellers. Use the wizard below to get started!"}
                      {selectedAgent === "deal-analyzer" && "Hi! I'm your Deal Analyzer Agent. I can help you analyze property deals, calculate ARV, estimate repair costs, and determine maximum allowable offers. Share a property address to get started!"}
                      {selectedAgent === "negotiation" && "Hello! I'm your Negotiation Agent. I can help you craft compelling offers, write follow-up messages, and develop negotiation strategies for your deals. What property are you working on?"}
                      {selectedAgent === "closing" && "Hi! I'm your Closing Agent. I can help you prepare contracts, coordinate closings, and manage documents. What deal are you looking to close?"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAgent === "lead-finder" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWizard(true)}
                          className="flex items-center gap-2 mb-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        >
                          <Search className="h-4 w-4" />
                          Use Seller Lead Wizard
                        </Button>
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
            
            {/* Cash Buyer Wizard Card - Only for Lead Finder */}
            {selectedAgent === "lead-finder" && (
              <div className="flex items-start space-x-3">
                <Avatar>
                  <AvatarImage />
                  <AvatarFallback>
                    <Search className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-900">
                        Hello! I'm your Cash Buyer Finder. I can help you discover active real estate investors, cash buyers, and portfolio managers. Use the wizard below to get started!
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBuyerWizard(true)}
                          className="flex items-center gap-2 mb-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        >
                          <TrendingUp className="h-4 w-4" />
                          Use Cash Buyer Wizard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wizard */}
        {showWizard && (
          <Card className="mb-4 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Seller Lead Wizard - Step {wizardStep} of 4
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">Find distressed properties and motivated sellers • First of 3 Lead Finder wizards</p>
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
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setShowWizard(false)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {wizardStep > 1 && (
                    <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      if (wizardStep < 4) {
                        setWizardStep(wizardStep + 1);
                      } else {
                        handleWizardSubmit();
                      }
                    }}
                    disabled={wizardStep === 1 && (!wizardData.city || !wizardData.state) ||
                              wizardStep === 2 && !wizardData.sellerType ||
                              wizardStep === 3 && !wizardData.propertyType}
                  >
                    {wizardStep === 4 ? (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Find Properties
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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