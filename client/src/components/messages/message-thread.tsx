import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MoreHorizontal, Paperclip, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Conversation, Message, Contact, Property } from "@shared/schema";

export default function MessageThread() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  const getContactForConversation = (conversation: Conversation) => {
    return contacts.find(contact => contact.id === conversation.contactId);
  };

  const getPropertyForConversation = (conversation: Conversation) => {
    return properties.find(property => property.id === conversation.propertyId);
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const currentContact = currentConversation ? getContactForConversation(currentConversation) : null;
  const currentProperty = currentConversation ? getPropertyForConversation(currentConversation) : null;

  // Select first conversation by default
  if (!selectedConversation && conversations.length > 0) {
    setSelectedConversation(conversations[0].id);
  }

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "now";
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Messages & Communications</h1>
        <Button>New Message</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-4">
            <Input placeholder="Search conversations..." />
          </div>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-slate-500 text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const contact = getContactForConversation(conversation);
                const property = getPropertyForConversation(conversation);
                const lastMessage = messages.filter(m => m.conversationId === conversation.id).slice(-1)[0];
                
                return (
                  <div
                    key={conversation.id}
                    className={`flex items-center p-4 hover:bg-slate-50 cursor-pointer ${
                      selectedConversation === conversation.id ? "border-l-4 border-primary bg-primary-50" : ""
                    }`}
                    onClick={() => setSelectedConversation(conversation.id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage />
                      <AvatarFallback>
                        {contact?.name?.slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {contact?.name || "Unknown Contact"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatTime(lastMessage?.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {property ? `${property.address}, ${property.city}` : conversation.title}
                      </p>
                      {lastMessage && (
                        <p className="text-sm text-slate-500 truncate">
                          {lastMessage.content.slice(0, 50)}...
                        </p>
                      )}
                    </div>
                    {/* Unread indicator placeholder */}
                    <div className="ml-2 w-2 h-2 bg-primary rounded-full opacity-0"></div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Message Thread */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            {/* Message Header */}
            <div className="p-4 bg-white border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {currentContact?.name?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-slate-900">
                      {currentContact?.name || "Unknown Contact"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {currentProperty ? `${currentProperty.address}, ${currentProperty.city} ${currentProperty.state}` : "No property"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">No messages in this conversation</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex items-start space-x-3 ${message.role === "user" ? "justify-end" : ""}`}>
                    {message.role !== "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={message.isAiGenerated ? "bg-primary text-white text-xs" : ""}>
                          {message.isAiGenerated ? "AI" : currentContact?.name?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`flex-1 ${message.role === "user" ? "max-w-xs sm:max-w-md" : ""}`}>
                      <Card className={message.role === "user" ? "bg-blue-100" : "bg-slate-100"}>
                        <CardContent className="p-3">
                          <p className="text-sm text-slate-900">{message.content}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {message.isAiGenerated && "AI-Generated • "}
                            {formatTime(message.createdAt)} ago
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex items-end space-x-3">
                <Button variant="ghost" size="sm">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">AI Assist</Button>
                  <Button>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">No conversation selected</h3>
              <p className="text-slate-600">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
