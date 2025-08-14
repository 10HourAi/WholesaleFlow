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
  const [sessionState, setSessionState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
            sessionState: sessionState
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
        
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: demoResult.response,
          role: "assistant",
          isAiGenerated: true
        });
        
        return demoResult;
      } else {
        // Regular conversation flow for other agents
        const response = await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, data);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
      setInputMessage("");
      // Reset conversation creation state
      createConversationMutation.reset();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (messageOverride?: string) => {
    const messageToSend = messageOverride || inputMessage.trim();
    if (!messageToSend) return;

    if (!currentConversation) {
      // Create new conversation and store message to send after creation
      const agentName = agentTypes.find(a => a.id === selectedAgent)?.name || "Chat";
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title: messageToSend.slice(0, 50) + (messageToSend.length > 50 ? "..." : ""),
      });
      // Don't clear input yet - it will be handled after conversation creation
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
    'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
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
    let searchQuery = `Find properties in ${location}`;
    
    if (wizardData.sellerType !== "any") {
      const sellerTypeLabel = sellerTypes.find(s => s.value === wizardData.sellerType)?.label;
      searchQuery += ` with ${sellerTypeLabel?.toLowerCase()}`;
    }
    
    if (wizardData.propertyType !== "any") {
      const propertyTypeLabel = propertyTypes.find(p => p.value === wizardData.propertyType)?.label;
      searchQuery += ` focusing on ${propertyTypeLabel?.toLowerCase()}`;
    }

    if (wizardData.minBedrooms) {
      searchQuery += ` with at least ${wizardData.minBedrooms} bedrooms`;
    }

    if (wizardData.maxPrice) {
      searchQuery += ` under $${wizardData.maxPrice.toLocaleString()}`;
    }

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
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Valley Forge, Philadelphia, Orlando"
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
                  {" in "}{wizardData.city}, {wizardData.state}
                  {wizardData.propertyType !== "any" && ` focusing on ${propertyTypes.find(p => p.value === wizardData.propertyType)?.label.toLowerCase()}`}
                  {wizardData.minBedrooms && ` with at least ${wizardData.minBedrooms} bedrooms`}
                  {wizardData.maxPrice && ` under $${wizardData.maxPrice.toLocaleString()}`}
                </p>
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
    // Check if this is a multiple properties response
    if (content.includes("Here are") && content.includes("properties") && content.includes("PROPERTY OVERVIEW")) {
      return (
        <div className="mt-3 space-y-3">
          {content.split("PROPERTY OVERVIEW").slice(1).map((propertyText, index) => (
            <Card key={index} className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <h4 className="font-medium text-green-800">Property {index + 1}</h4>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">BatchData API</Badge>
                  </div>
                  
                  <div className="text-sm space-y-1 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    **PROPERTY OVERVIEW:**{propertyText}
                  </div>
                  
                  <div className="pt-2 border-t border-green-200 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">Save Lead</Button>
                    <Button size="sm" variant="outline" className="flex-1">Analyze Deal</Button>
                    <Button size="sm" variant="outline">Contact Owner</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderPropertyCard = (content: string) => {
    // Check if this is a property response with structured data
    if (content.includes("PROPERTY DETAILS") || content.includes("FINANCIAL ANALYSIS") || content.includes("OWNER INFORMATION")) {
      return (
        <Card className="mt-3 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h4 className="font-medium text-green-800">Live Property Lead</h4>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">BatchData API</Badge>
              </div>
              
              <div className="text-sm space-y-1 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {content}
              </div>
              
              <div className="pt-2 border-t border-green-200 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">Save Lead</Button>
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
        
        {messages.length === 0 && !currentConversation && (
          <div className="flex items-start space-x-3">
            <Avatar>
              <AvatarImage />
              <AvatarFallback>
                <currentAgent.icon className="h-4 w-4" />
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
                  <currentAgent.icon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className={`flex-1 ${message.role === "user" ? "max-w-xs sm:max-w-md" : ""}`}>
              <Card className={message.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                <CardContent className="p-4">
                  <p className="text-sm">{message.content}</p>
                  {message.role === "assistant" && (renderMultipleProperties(message.content) || renderPropertyCard(message.content))}
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
            onClick={handleSendMessage}
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
