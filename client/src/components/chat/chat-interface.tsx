import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Search, TrendingUp, MessageSquare, FileText, Lightbulb, ArrowRight, ArrowLeft, Plus, BarChart3, PhoneCall } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Message, Property } from "@shared/schema";

const agentTypes = [
  { id: "lead-finder", name: "🔍 Lead Finder Agent", icon: Search },
  { id: "deal-analyzer", name: "📊 Deal Analyzer Agent", icon: TrendingUp },
  { id: "negotiation", name: "💬 Negotiation Agent", icon: MessageSquare },
  { id: "closing", name: "📋 Closing Agent", icon: FileText },
];

// Safe text renderer for Terry's messages - handles **bold** without XSS risk
const renderFormattedText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the ** markers and wrap in <strong>
      const boldText = part.slice(2, -2);
      return <strong key={index}>{boldText}</strong>;
    }
    // Regular text - React will safely escape any HTML
    return <span key={index}>{part}</span>;
  });
};

interface WizardData {
  city: string;
  state: string;
  sellerType: string;
  propertyType: string;
  minBedrooms?: number;
  maxPrice?: number;
  minPrice?: number;
}

interface BuyerWizardData {
  city: string;
  state: string;
  buyerType: string;
}

// PropertyCard component for rendering property cards with buttons  
const PropertyCard = ({ content }: { content: string }) => {
  const { toast } = useToast();
  
  // Detect card type and extract number
  const isSellerLead = content.includes('🏠 SELLER LEAD');
  const isCashBuyer = content.includes('🎯 QUALIFIED CASH BUYER');
  
  const cardNumber = isSellerLead 
    ? content.match(/🏠 SELLER LEAD (\d+)/)?.[1] || '1'
    : content.match(/🎯 QUALIFIED CASH BUYER #(\d+)/)?.[1] || '1';
  
  const cardType = isSellerLead ? 'Property' : 'Buyer';
  
  const handleAddToCRM = () => {
    toast({
      title: "Added to CRM",
      description: `${cardType} ${cardNumber} has been added to your CRM system.`,
    });
  };
  
  const handleAnalyzeDeal = () => {
    if (isSellerLead) {
      toast({
        title: "Deal Analysis Started", 
        description: `Analyzing deal for property ${cardNumber}...`,
      });
    } else {
      toast({
        title: "Buyer Profile Analysis",
        description: `Analyzing investment profile for buyer ${cardNumber}...`,
      });
    }
  };
  
  const handleContactOwner = () => {
    if (isSellerLead) {
      toast({
        title: "Contact Owner",
        description: `Preparing to contact property owner...`,
      });
    } else {
      toast({
        title: "Contact Investor",
        description: `Preparing to contact cash buyer...`,
      });
    }
  };
  
  // Remove any action sections from content for display
  const displayContent = content
    .replace(/🎯 ACTIONS[\s\S]*?━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━/g, '')
    .trim();
  
  // Dynamic button labels based on card type
  const actionButtons = isSellerLead 
    ? [
        { label: "Add to CRM", icon: Plus, color: "green", action: handleAddToCRM },
        { label: "Analyze Deal", icon: BarChart3, color: "blue", action: handleAnalyzeDeal },
        { label: "Contact Owner", icon: PhoneCall, color: "orange", action: handleContactOwner }
      ]
    : [
        { label: "Add to CRM", icon: Plus, color: "green", action: handleAddToCRM },
        { label: "View Portfolio", icon: BarChart3, color: "blue", action: handleAnalyzeDeal },
        { label: "Contact Investor", icon: PhoneCall, color: "orange", action: handleContactOwner }
      ];
  
  return (
    <div className="space-y-4">
      {/* Display the formatted content */}
      <div className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-3 rounded border">
        {displayContent}
      </div>
      
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {actionButtons.map((button, idx) => {
          const colorClasses = {
            green: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
            blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100", 
            orange: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
          };
          
          return (
            <Button
              key={idx}
              onClick={button.action}
              variant="outline"
              size="sm"
              className={`flex items-center gap-2 ${colorClasses[button.color as keyof typeof colorClasses]}`}
              data-testid={`button-${button.label.toLowerCase().replace(/\s+/g, '-')}-${cardNumber}`}
            >
              <button.icon className="h-4 w-4" />
              {button.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default function ChatInterface() {
  const [selectedAgent, setSelectedAgent] = useState("lead-finder");
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [showBuyerWizard, setShowBuyerWizard] = useState(false);
  const [showTargetMarketFinder, setShowTargetMarketFinder] = useState(false);
  const [targetMarketResults, setTargetMarketResults] = useState(false);
  const [terryMessages, setTerryMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [terryInput, setTerryInput] = useState('');
  const [terryLoading, setTerryLoading] = useState(false);

  const handleTerrySuggestedQuestion = (question: string) => {
    setTerryInput(question);
    handleTerrySendMessage(question);
  };

  const handleTerrySendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || terryInput.trim();
    if (!messageToSend || terryLoading) return;

    // Add user message
    const newMessages = [...terryMessages, { role: 'user' as const, content: messageToSend }];
    setTerryMessages(newMessages);
    setTerryInput('');
    setTerryLoading(true);

    try {
      const response = await fetch('/api/terry/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          history: newMessages
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response from Terry');
      }
      
      // Add Terry's response
      setTerryMessages([...newMessages, { role: 'assistant' as const, content: data.response }]);
    } catch (error: any) {
      console.error('Terry chat error:', error);
      const errorMessage = error.message || "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
      setTerryMessages([...newMessages, { 
        role: 'assistant' as const, 
        content: errorMessage
      }]);
    } finally {
      setTerryLoading(false);
    }
  };
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
    state: "",
    buyerType: ""
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
      
      // Check for and send pending cash buyer response and individual cards
      const pendingResponse = localStorage.getItem('pendingCashBuyerResponse');
      const pendingCards = localStorage.getItem('pendingCashBuyerCards');
      
      if (pendingResponse) {
        localStorage.removeItem('pendingCashBuyerResponse');
        localStorage.removeItem('pendingCashBuyerCards');
        
        // Send the intro message first
        setTimeout(async () => {
          try {
            await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, {
              content: pendingResponse,
              role: "assistant",
              isAiGenerated: true
            });
            
            // If we have individual buyer cards, send each as a separate message
            if (pendingCards) {
              const buyerCards = JSON.parse(pendingCards);
              for (let i = 0; i < buyerCards.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between cards
                await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, {
                  content: buyerCards[i],
                  role: "assistant",
                  isAiGenerated: true
                });
              }
            }
            
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation.id, "messages"] });
          } catch (error) {
            console.error('Failed to send pending cash buyer response:', error);
          }
        }, 200);
      }

      // Check for and send pending seller lead response and individual cards
      const pendingSellerResponse = localStorage.getItem('pendingSellerResponse');
      const pendingSellerCards = localStorage.getItem('pendingSellerCards');
      
      if (pendingSellerResponse) {
        localStorage.removeItem('pendingSellerResponse');
        localStorage.removeItem('pendingSellerCards');
        
        // Send the intro message first
        setTimeout(async () => {
          try {
            await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, {
              content: pendingSellerResponse,
              role: "assistant",
              isAiGenerated: true
            });
            
            // If we have individual property cards, send each as a separate message
            if (pendingSellerCards) {
              const properties = JSON.parse(pendingSellerCards);
              for (let i = 0; i < properties.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 400)); // Small delay between cards
                const property = properties[i];
                
                // Use building data from original BatchData search - no additional API calls needed
                const buildingDetails = `
🏗️ BUILDING DETAILS
   🏠 ${property.bedrooms || 'Contact seller'} bed, ${property.bathrooms || 'Contact seller'} bath${property.squareFeet ? ` | ${property.squareFeet.toLocaleString()} sq ft` : ' | Contact seller for sq ft'}
   📅 Built: ${property.yearBuilt || 'Contact seller for year built'}
   📐 Property Type: ${property.propertyType?.replace(/_/g, ' ') || 'Single Family'}
   💰 Market Value: $${parseInt(property.arv).toLocaleString()}`;
                
                const propertyCard = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SELLER LEAD ${i + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 LOCATION
   ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
${buildingDetails}

💰 INVESTMENT ANALYSIS
   📊 ARV: $${parseInt(property.arv).toLocaleString()}
   💰 Max Offer: $${parseInt(property.maxOffer).toLocaleString()}
   💎 Equity: ${property.equityPercentage}%

👤 OWNER INFO
   Owner: ${property.ownerName}
   📱 Phone: ${property.ownerPhone || 'Contact for details'}
   ✉️ Email: ${property.ownerEmail || 'Contact for details'}
   📬 Mailing: ${property.ownerMailingAddress}

📈 LEAD ANALYSIS
   🎯 Confidence Score: ${property.confidenceScore}/100
   🚨 Distress Indicator: ${property.distressedIndicator.replace(/_/g, ' ')}
   📈 Lead Type: ${property.leadType.replace(/_/g, ' ')}

🎯 ACTIONS
   📋 Add to CRM        📊 Analyze Deal        📞 Contact Owner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                await apiRequest("POST", `/api/conversations/${conversation.id}/messages`, {
                  content: propertyCard,
                  role: "assistant",
                  isAiGenerated: true
                });
              }
            }
            
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation.id, "messages"] });
          } catch (error) {
            console.error('Failed to send pending seller response:', error);
          }
        }, 200);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; role: string }) => {
      if (!currentConversation) throw new Error("No conversation selected");

      // Skip auto-responses for wizard-generated messages
      const isWizardMessage = data.content.toLowerCase().includes('find') && 
                             data.content.toLowerCase().includes('properties') &&
                             (data.content.toLowerCase().includes('distressed') || 
                              data.content.toLowerCase().includes('motivated') ||
                              data.content.toLowerCase().includes('leads'));

      if (selectedAgent === "lead-finder" && !isWizardMessage) {
        // Skip API call for seller leads - we're using dummy data for UI testing
        // const demoResponse = await fetch('/api/demo/chat', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     message: data.content,
        //     agentType: 'lead_finder',
        //     sessionState: sessionState,
        //     excludedPropertyIds: Array.from(shownPropertyIds)
        //   })
        // });

        // Return dummy result for now
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: data.content,
          role: "user"
        });

        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: "API calls are currently paused for UI testing. Please use the Seller Lead Wizard for testing the new card format.",
          role: "assistant",
          isAiGenerated: true
        });

        return { response: "API paused for testing" };
      } else if (isWizardMessage) {
        // For wizard messages, just send the user message without triggering AI response
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: data.content,
          role: "user"
        });
        return { response: "Wizard message sent" };
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

  const handleWizardSubmit = async () => {
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
    // Don't set the input message or close wizard yet - wait until after we send dummy data
    // setInputMessage(searchQuery);
    // setShowWizard(false);
    // setWizardStep(1);

    // Clear any previous search results
    localStorage.removeItem('pendingSellerResponse');
    localStorage.removeItem('pendingSellerCards');

    // Call real BatchData API for seller leads
    try {
      const searchCriteria = {
        location: location,
        sellerType: wizardData.sellerType,
        propertyType: wizardData.propertyType,
        minBedrooms: wizardData.minBedrooms,
        maxPrice: wizardData.maxPrice,
        minPrice: wizardData.minPrice
      };
      
      console.log('🔍 Calling BatchData API for seller leads with criteria:', searchCriteria);
      
      const response = await apiRequest("POST", "/api/properties/batch", {
        count: 5,
        criteria: searchCriteria
      });
      
      // Parse the JSON from the Response object
      const data = await response.json();
      
      console.log('🔍 Frontend received raw response:', response);
      console.log('🔍 Frontend parsed data:', data);
      console.log('🔍 Data properties:', data.properties);
      console.log('🔍 Data properties length:', data.properties?.length);
      
      const properties = data.properties || [];
      
      console.log('🔍 Final properties array:', properties);
      console.log('🔍 Final properties length:', properties.length);
      
      // Handle case when no properties are found
      if (properties.length === 0) {
        const noResultsMessage = `I searched for properties in **${location}** but couldn't find any that match your specific criteria:

🔍 **Search Criteria:**
• Location: ${location}
• Seller Type: ${wizardData.sellerType.replace(/_/g, ' ')}
• Property Type: ${wizardData.propertyType.replace(/_/g, ' ')}
${wizardData.minBedrooms ? `• Min Bedrooms: ${wizardData.minBedrooms}` : ''}
${wizardData.maxPrice ? `• Max Price: $${wizardData.maxPrice.toLocaleString()}` : ''}

💡 **Suggestions:**
• Try a broader location (like a full city/state)
• Increase your price range
• Reduce bedroom requirements
• Try "any" for seller or property type

Would you like to adjust your search criteria and try again?`;

        if (!currentConversation) {
          localStorage.setItem('pendingSellerResponse', noResultsMessage);
          createConversationMutation.mutate({
            agentType: selectedAgent,
            title: `No Results: ${location}`,
          });
        } else {
          await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
            content: searchQuery,
            role: "user"
          });
          await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
            content: noResultsMessage,
            role: "assistant",
            isAiGenerated: true
          });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
        }
        
        setShowWizard(false);
        setWizardStep(1);
        setWizardProcessing(false);
        return;
      }

      // Create intro message with real data
      const introMessage = `Great! I found ${properties.length} motivated seller leads in **${location}**. Here are your top prospects:`;
      
      if (!currentConversation) {
        // Store the data for when the new conversation is created
        localStorage.setItem('pendingSellerResponse', introMessage);
        localStorage.setItem('pendingSellerCards', JSON.stringify(properties));
        
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Lead Search: ${wizardData.city}, ${wizardData.state}`,
        });
        
        // The cards will be displayed when the new conversation is created
        // due to the useEffect that checks for pendingSellerResponse
      } else {
        // Send user query first
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: searchQuery,
          role: "user"
        });

        // Send the intro message
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: introMessage,
          role: "assistant",
          isAiGenerated: true
        });

        // Send property cards after intro message with a small delay
        setTimeout(async () => {
          const storedCards = localStorage.getItem('pendingSellerCards');
          if (storedCards) {
            localStorage.removeItem('pendingSellerCards');
            const properties = JSON.parse(storedCards);
            
            for (let i = 0; i < properties.length; i++) {
              await new Promise(resolve => setTimeout(resolve, 400)); // Small delay between cards
              const property = properties[i];
              
              // Use building data from original BatchData search - no additional API calls needed
              const buildingDetails = `
🏗️ BUILDING DETAILS
   🏠 ${property.bedrooms || 'Contact seller'} bed, ${property.bathrooms || 'Contact seller'} bath${property.squareFeet ? ` | ${property.squareFeet.toLocaleString()} sq ft` : ' | Contact seller for sq ft'}
   📅 Built: ${property.yearBuilt || 'Contact seller for year built'}
   📐 Property Type: ${property.propertyType?.replace(/_/g, ' ') || 'Single Family'}
   💰 Market Value: $${parseInt(property.arv).toLocaleString()}`;
              
              const propertyCard = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SELLER LEAD ${i + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 LOCATION
   ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
${buildingDetails}

💰 INVESTMENT ANALYSIS
   📊 ARV: $${parseInt(property.arv).toLocaleString()}
   💰 Max Offer: $${parseInt(property.maxOffer).toLocaleString()}
   💎 Equity: ${property.equityPercentage}%

👤 OWNER INFO
   Owner: ${property.ownerName}
   📱 Phone: ${property.ownerPhone || 'Contact for details'}
   ✉️ Email: ${property.ownerEmail || 'Contact for details'}
   📬 Mailing: ${property.ownerMailingAddress}

📈 LEAD ANALYSIS
   🎯 Confidence Score: ${property.confidenceScore}/100
   🚨 Distress Indicator: ${property.distressedIndicator.replace(/_/g, ' ')}
   📈 Lead Type: ${property.leadType.replace(/_/g, ' ')}

🎯 ACTIONS
   📋 Add to CRM        📊 Analyze Deal        📞 Contact Owner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

              await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
                content: propertyCard,
                role: "assistant",
                isAiGenerated: true
              });
            }
            
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
          }
        }, 500); // Wait for intro message to be sent first

        queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
      }

      // Now close the wizard and reset state
      setShowWizard(false);
      setWizardStep(1);
      setWizardProcessing(false);
    } catch (error) {
      console.error('Error in wizard submit:', error);
      setShowWizard(false);
      setWizardStep(1);
      setWizardProcessing(false);
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
    
    // Clear any previous search results to prevent mixing with new search
    localStorage.removeItem('pendingCashBuyerResponse');
    localStorage.removeItem('pendingCashBuyerCards');
    
    try {
      // Call real BatchData API for cash buyers
      console.log('🔍 Calling BatchData API for cash buyers in:', location);
      
      const response = await apiRequest("POST", "/api/cash-buyers/search", {
        location: location,
        buyerType: buyerWizardData.buyerType,
        minProperties: 3 // Looking for investors with 3+ properties
      });
      
      const cashBuyerData = await response.json();
      
      if (!cashBuyerData.success) {
        throw new Error(cashBuyerData.error || 'Failed to fetch cash buyers');
      }
      
      // Store individual cash buyer cards to be sent as separate messages
      if (cashBuyerData.buyers && cashBuyerData.buyers.length > 0) {
        // Limit to exactly 5 buyers
        const buyersToShow = cashBuyerData.buyers.slice(0, 5);
        
        // Store intro message
        const introMessage = `Great! I found ${buyersToShow.length} qualified cash buyers with 3+ properties in **${location}**. Here are your leads:`;
        localStorage.setItem('pendingCashBuyerResponse', introMessage);
        
        // Store individual buyer cards
        const buyerCards = buyersToShow.map((buyer: any, index: number) => {
          const address = buyer.address || {};
          const owner = buyer.owner || {};
          const valuation = buyer.valuation || {};
          const building = buyer.building || {};
          const quickLists = buyer.quickLists || {};
          
          // Get best contact info
          const bestPhone = owner.phoneNumbers && owner.phoneNumbers[0] ? 
            `(${owner.phoneNumbers[0].number.slice(0,3)}) ${owner.phoneNumbers[0].number.slice(3,6)}-${owner.phoneNumbers[0].number.slice(6)}` : 
            'Contact for details';
          const bestEmail = owner.emails && owner.emails[0] ? owner.emails[0] : 'Contact for details';
          
          // Get property owner profile data
          const ownerProfile = buyer.propertyOwnerProfile || {};
          const sale = buyer.sale || {};
          
          // Format last sale date
          const lastSaleDate = sale.lastSaleDate ? new Date(sale.lastSaleDate).toLocaleDateString() : 'N/A';
          
          // Format phone numbers with types
          const formatPhoneNumbers = (phones: any[]) => {
            if (!phones || phones.length === 0) return 'Contact for details';
            return phones.map(phone => `${phone.number} (${phone.type})`).join(', ');
          };
          
          // Get emails
          const emailList = owner.emails && owner.emails.length > 0 ? owner.emails.join(', ') : 'Contact for details';
          
          // Get phone numbers (separate regular and DNC)
          const phoneNumbers = owner.phoneNumbers || [];
          const regularPhones = phoneNumbers.filter((p: any) => !p.dnc);
          const dncPhones = phoneNumbers.filter((p: any) => p.dnc);
          
          // Create modern, sleek card design
          let cardContent = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 QUALIFIED CASH BUYER #${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
          
          cardContent += `👤 𝗜𝗡𝗩𝗘𝗦𝗧𝗢𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\n`;
          cardContent += `${owner.fullName || 'ACTIVE CASH INVESTOR'}\n`;
          cardContent += `📍 Based in ${address.city}, ${address.state}\n\n`;
          
          cardContent += `💰 𝗣𝗢𝗥𝗧𝗙𝗢𝗟𝗜𝗢 𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪\n`;
          cardContent += `• Total Portfolio Value: $${ownerProfile.propertiesTotalEstimatedValue ? parseInt(ownerProfile.propertiesTotalEstimatedValue).toLocaleString() : 'N/A'}\n`;
          cardContent += `• Properties Owned: ${ownerProfile.propertiesCount || 'N/A'} properties\n`;
          cardContent += `• Avg Purchase Price: $${ownerProfile.averagePurchasePrice ? parseInt(ownerProfile.averagePurchasePrice).toLocaleString() : 'N/A'}\n`;
          cardContent += `• Last Activity: ${lastSaleDate}\n\n`;
          
          cardContent += `🏠 𝗥𝗘𝗖𝗘𝗡𝗧 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘\n`;
          cardContent += `📍 ${address.street}\n`;
          cardContent += `    ${address.city}, ${address.state} ${address.zip}\n`;
          cardContent += `🏘️ ${building.propertyType || 'Single Family'} • ${building.squareFeet ? parseInt(building.squareFeet).toLocaleString() + ' sqft' : 'N/A'}\n`;
          cardContent += `🛏️ ${building.bedrooms || 'N/A'} bed • 🛁 ${building.bathrooms || 'N/A'} bath\n`;
          cardContent += `💵 Last Sale: $${sale.lastSalePrice ? parseInt(sale.lastSalePrice).toLocaleString() : valuation.estimatedValue ? parseInt(valuation.estimatedValue).toLocaleString() : 'N/A'}\n\n`;
          
          cardContent += `📞 𝗖𝗢𝗡𝗧𝗔𝗖𝗧 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n`;
          cardContent += `📧 ${emailList}\n`;
          cardContent += `📮 ${owner.mailingAddress?.street || address.street}, ${owner.mailingAddress?.city || address.city}, ${owner.mailingAddress?.state || address.state} ${owner.mailingAddress?.zip || address.zip}\n`;
          
          if (regularPhones.length > 0) {
            cardContent += `📱 ${formatPhoneNumbers(regularPhones)}\n`;
          }
          
          if (dncPhones.length > 0) {
            cardContent += `🚫 DNC: ${formatPhoneNumbers(dncPhones)}\n`;
          }
          
          if (regularPhones.length === 0 && dncPhones.length === 0) {
            cardContent += `📱 Contact for details\n`;
          }
          
          cardContent += `\n🎯 ACTIONS
   📋 Add to CRM        📊 View Portfolio        📞 Contact Investor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
          
          return cardContent;
        });
        
        localStorage.setItem('pendingCashBuyerCards', JSON.stringify(buyerCards));
      } else {
        const errorMessage = `No active cash buyers found in ${location}. Try expanding your search area.`;
        localStorage.setItem('pendingCashBuyerResponse', errorMessage);
      }
      
      // Create conversation or send messages directly
      if (!currentConversation) {
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Cash Buyers: ${location} (${buyerWizardData.buyerType.replace(/_/g, ' ')})`,
        });
      } else {
        // Send intro message immediately
        const introMessage = `🎯 **CASH BUYER SEARCH COMPLETE**\n\nFound **5 qualified ${buyerWizardData.buyerType.replace(/_/g, ' ')}** in **${location}**!\n\nHere are your investor leads:`;
        
        await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
          content: introMessage,
          role: "assistant",
          isAiGenerated: true
        });
        
        // Send individual buyer cards with a small delay
        setTimeout(async () => {
          const storedCards = localStorage.getItem('pendingCashBuyerCards');
          if (storedCards) {
            localStorage.removeItem('pendingCashBuyerCards');
            const buyerCards = JSON.parse(storedCards);
            
            for (let i = 0; i < buyerCards.length; i++) {
              await new Promise(resolve => setTimeout(resolve, 400)); // Small delay between cards
              await apiRequest("POST", `/api/conversations/${currentConversation}/messages`, {
                content: buyerCards[i],
                role: "assistant",
                isAiGenerated: true
              });
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
        }, 500);
        
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation, "messages"] });
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
      setBuyerWizardData({ city: "", state: "", buyerType: "" });
    }
  };

  const renderBuyerWizard = () => {
    if (!showBuyerWizard) return null;

    return (
      <Card className="mb-4 border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Cash Buyer Wizard - Step {buyerWizardStep} of 2
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">Find active real estate investors and cash buyers</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {buyerWizardStep === 1 && (
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
          )}

          {buyerWizardStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What type of cash buyer are you looking for?</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "active_landlord", name: "🏠 Active Landlord Buyers", description: "Investors focused on rental properties and portfolio growth" },
                  { id: "fix_and_flip", name: "🔨 Fix and Flip Buyers", description: "Investors who buy, renovate, and resell properties" },
                  { id: "cash_buyers", name: "💰 Cash Buyers", description: "General cash buyers looking for investment opportunities" },
                  { id: "builders", name: "🏗️ Builders", description: "Construction companies and developers looking for projects" }
                ].map((type) => (
                  <div key={type.id} 
                       className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                         buyerWizardData.buyerType === type.id 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 hover:border-green-300'
                       }`}
                       onClick={() => setBuyerWizardData({...buyerWizardData, buyerType: type.id})}
                  >
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (buyerWizardStep === 1) {
                  setShowBuyerWizard(false);
                  setBuyerWizardStep(1);
                  setBuyerWizardData({ city: "", state: "", buyerType: "" });
                } else {
                  setBuyerWizardStep(1);
                }
              }}
            >
              {buyerWizardStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            {buyerWizardStep === 1 ? (
              <Button
                onClick={() => setBuyerWizardStep(2)}
                disabled={!buyerWizardData.city || !buyerWizardData.state}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleBuyerWizardSubmit}
                disabled={!buyerWizardData.buyerType}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <TrendingUp className="h-4 w-4" />
                Find Cash Buyers
              </Button>
            )}
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
        
        {/* Target Market Finder Results - Separate Output Page */}
        {targetMarketResults && (
          <Card className="mb-4 border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-600" />
                Target Market Finder - Chat with Terry
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">Interactive market analysis and research with AI • Third of 3 Lead Finder wizards</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[600px] flex flex-col">
                {/* Chat Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                  {/* Initial Welcome Message */}
                  {terryMessages.length === 0 && (
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 text-white">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm max-w-md">
                        <p className="text-gray-900 font-medium">Hey! I'm your new Target Market Finder Agent! I can help find the best market in your area.</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Chat Messages */}
                  {terryMessages.map((message, index) => (
                    <div key={index} className={`flex items-start gap-3 mb-6 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-blue-600' 
                          : 'bg-gray-800'
                      }`}>
                        <div className="w-4 h-4 text-white">
                          {message.role === 'user' ? (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className={`rounded-2xl p-4 shadow-sm max-w-md ${
                        message.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white text-gray-900'
                      }`}>
                        <div className="prose prose-sm max-w-none">
                          {message.role === 'assistant' ? (
                            <div className="whitespace-pre-wrap">
                              {renderFormattedText(message.content)}
                            </div>
                          ) : (
                            <p>{message.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Loading Indicator */}
                  {terryLoading && (
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 text-white">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm max-w-md">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Suggested Questions (only show initially) */}
                {terryMessages.length === 0 && (
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                      <button
                        onClick={() => handleTerrySuggestedQuestion("Terry, can you tell me what you do and how you can help me become more successful with real estate investing?")}
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Terry, can you tell me what you do and how you can help me become more successful with...
                      </button>
                      <button
                        onClick={() => handleTerrySuggestedQuestion("Terry, can you do market research in my area?")}
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Terry, can you do market research in my area?
                      </button>
                      <button
                        onClick={() => handleTerrySuggestedQuestion("Hey Terry, find me the best niche markets with the highest cash landlord purchase activity")}
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Hey Terry, find me the best niche markets with the highest cash landlord purchase...
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Input Area */}
                <div className="px-6 py-4 bg-white border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 text-gray-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={terryInput}
                      onChange={(e) => setTerryInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleTerrySendMessage()}
                      placeholder="Let's Get Started! Type Anything You Need Help With"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={terryLoading}
                    />
                    <button
                      onClick={() => handleTerrySendMessage()}
                      disabled={!terryInput.trim() || terryLoading}
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTargetMarketResults(false);
                        setTerryMessages([]);
                        setTerryInput('');
                      }}
                      className="flex-1"
                    >
                      Start New Chat
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setTargetMarketResults(false)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Back to Wizards
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
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

        {messages.length === 0 && !currentConversation && !showWizard && !showBuyerWizard && !targetMarketResults && !wizardProcessing && !buyerWizardProcessing && (
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
                    <TrendingUp className="h-4 w-4" />
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
            
            {/* Target Market Finder - Only for Lead Finder */}
            {selectedAgent === "lead-finder" && (
              <div className="flex items-start space-x-3">
                <Avatar>
                  <AvatarImage />
                  <AvatarFallback>
                    <Lightbulb className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-900">
                        Hello! I'm your Target Market Finder. I help identify and analyze ideal market areas for real estate investing. Click below to access the interactive market analysis tool!
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowTargetMarketFinder(false);
                            setTargetMarketResults(true);
                          }}
                          className="flex items-center gap-2 mb-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        >
                          <Lightbulb className="h-4 w-4" />
                          Use Target Market Finder
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
                    onClick={async () => {
                      if (wizardStep < 4) {
                        setWizardStep(wizardStep + 1);
                      } else {
                        await handleWizardSubmit();
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
                  {(message.content.includes('🏠 SELLER LEAD') || 
                    message.content.includes('🎯 QUALIFIED CASH BUYER #')) ? (
                    <PropertyCard content={message.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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