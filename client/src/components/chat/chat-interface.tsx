import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, Search, TrendingUp, MessageSquare, FileText, Lightbulb } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation, Message, Property } from "@shared/schema";

const agentTypes = [
  { id: "lead-finder", name: "🔍 Lead Finder Agent", icon: Search },
  { id: "deal-analyzer", name: "📊 Deal Analyzer Agent", icon: TrendingUp },
  { id: "negotiation", name: "💬 Negotiation Agent", icon: MessageSquare },
  { id: "closing", name: "📋 Closing Agent", icon: FileText },
];

export default function ChatInterface() {
  const [selectedAgent, setSelectedAgent] = useState("lead-finder");
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
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
            agentType: 'lead_finder'
          })
        });
        
        if (!demoResponse.ok) {
          throw new Error('Failed to get response from demo chat');
        }
        
        const demoResult = await demoResponse.json();
        
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
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    if (!currentConversation) {
      // Create new conversation
      const agentName = agentTypes.find(a => a.id === selectedAgent)?.name || "Chat";
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title: inputMessage.slice(0, 50) + (inputMessage.length > 50 ? "..." : ""),
      });
    }

    // Send message will be handled after conversation is created or if conversation exists
    if (currentConversation) {
      sendMessageMutation.mutate({
        content: inputMessage,
        role: "user",
      });
    }
  };

  // Send message after conversation is created
  useEffect(() => {
    if (currentConversation && inputMessage && createConversationMutation.isSuccess) {
      sendMessageMutation.mutate({
        content: inputMessage,
        role: "user",
      });
    }
  }, [currentConversation, createConversationMutation.isSuccess]);

  const currentAgent = agentTypes.find(agent => agent.id === selectedAgent);

  const renderPropertyCard = (content: string) => {
    // Enhanced property card rendering for lead finder responses
    if (content.includes("PROPERTY DETAILS") || content.includes("FINANCIAL ANALYSIS") || content.includes("OWNER INFORMATION") || (content.includes("Found a") && content.includes("property"))) {
      // Extract key information for structured display
      const lines = content.split('\n');
      let address = '';
      let value = '';
      let equity = '';
      let ownerName = '';
      let motivationScore = '';
      
      lines.forEach(line => {
        if (line.includes('Estimated Value:')) value = line.split(':')[1]?.trim() || '';
        if (line.includes('Equity Percentage:')) equity = line.split(':')[1]?.trim() || '';
        if (line.includes('Full Name:')) ownerName = line.split(':')[1]?.trim() || '';
        if (line.includes('MOTIVATION SCORE:')) motivationScore = line.split(':')[1]?.trim().split('/')[0] || '';
        if (line.includes('**PROPERTY DETAILS:**')) {
          const nextLineIndex = lines.indexOf(line) + 1;
          if (nextLineIndex < lines.length) address = lines[nextLineIndex]?.trim() || '';
        }
      });

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
              
              {/* Quick stats */}
              {(address || value || equity) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-lg border">
                  {address && (
                    <div>
                      <div className="text-xs font-medium text-slate-500">ADDRESS</div>
                      <div className="text-sm font-semibold text-slate-900">{address}</div>
                    </div>
                  )}
                  {value && (
                    <div>
                      <div className="text-xs font-medium text-slate-500">ESTIMATED VALUE</div>
                      <div className="text-sm font-semibold text-green-700">{value}</div>
                    </div>
                  )}
                  {equity && (
                    <div>
                      <div className="text-xs font-medium text-slate-500">EQUITY</div>
                      <div className="text-sm font-semibold text-blue-700">{equity}</div>
                    </div>
                  )}
                  {ownerName && ownerName !== 'Not available' && (
                    <div>
                      <div className="text-xs font-medium text-slate-500">OWNER</div>
                      <div className="text-sm font-semibold text-slate-900">{ownerName}</div>
                    </div>
                  )}
                </div>
              )}
              
              {motivationScore && (
                <div className="p-2 bg-orange-50 rounded border border-orange-200">
                  <div className="text-xs font-medium text-orange-700">MOTIVATION SCORE</div>
                  <div className="text-lg font-bold text-orange-800">{motivationScore}/100</div>
                </div>
              )}

              <div className="text-sm space-y-1 max-h-64 overflow-y-auto">
                {content.split('\n').map((line, index) => {
                  if (line.includes('**') && line.includes('**')) {
                    // Bold headers
                    const text = line.replace(/\*\*/g, '');
                    return <div key={index} className="font-semibold text-slate-800 mt-2 mb-1 border-b border-slate-200 pb-1">{text}</div>;
                  } else if (line.trim().startsWith('🎯') || line.trim().startsWith('🚨')) {
                    // Important alerts
                    return <div key={index} className="font-semibold text-red-700 bg-red-50 p-2 rounded">{line}</div>;
                  } else if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('  •')) {
                    // Bullet points
                    return <div key={index} className="text-slate-600 ml-2 text-xs">{line}</div>;
                  } else if (line.trim() && !line.includes('💡') && !line.includes('Say')) {
                    // Regular text (exclude call to action)
                    return <div key={index} className="text-slate-700 text-xs">{line}</div>;
                  }
                  return null;
                })}
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
                          onClick={() => setInputMessage("Search properties in Dallas, TX")}
                        >
                          Search by location
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-slate-200"
                          onClick={() => setInputMessage("Find high equity properties in 90210")}
                        >
                          High equity properties
                        </Badge>
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
                  {message.role === "assistant" && renderPropertyCard(message.content)}
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
