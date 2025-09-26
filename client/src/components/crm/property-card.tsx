import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Home, 
  DollarSign, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  TrendingUp,
  FileText,
  MessageSquare,
  Calculator,
  Loader2
} from "lucide-react";
import type { Property, Contact, DealAnalysisRequest, DealAnalysisResult } from "@shared/schema";

interface PropertyCardProps {
  property: Property | null;
  contact?: Contact;
  isOpen: boolean;
  onClose: () => void;
}

export default function PropertyCard({ property, contact, isOpen, onClose }: PropertyCardProps) {
  // Early return before hooks to avoid hook ordering issues
  if (!property) return null;

  const [analysisResult, setAnalysisResult] = useState<DealAnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamMessage, setStreamMessage] = useState('');
  const [streamedText, setStreamedText] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  // Helper function to transform database fields to DealAnalysisResult format
  const transformPropertyToAnalysisResult = (prop: Property): DealAnalysisResult | null => {
    // Check if we have basic analysis data
    if (prop.isDeal === null || !prop.analysisConfidence) {
      return null;
    }

    return {
      summary: "Property has been analyzed with AI deal analysis.",
      arv_estimate: Number(prop.analysisArv) || Number(prop.arv) || 0,
      max_offer_estimate: Number(prop.analysisMaxOfferPrice) || Number(prop.maxOffer) || 0,
      is_deal: prop.isDeal,
      confidence: Number(prop.analysisConfidence),
      notes: "Analysis completed and saved to database."
    };
  };

  // Check for existing analysis results when property changes
  useEffect(() => {
    if (property) {
      const cachedResult = transformPropertyToAnalysisResult(property);
      if (cachedResult) {
        setAnalysisResult(cachedResult);
        setShowAnalysis(true);
        setHasExistingAnalysis(true);
      } else {
        setAnalysisResult(null);
        setShowAnalysis(false);
        setHasExistingAnalysis(false);
      }
    }
  }, [property]);

  // Mutation for deal analysis
  const analyzeDealMutation = useMutation({
    mutationFn: async (request: DealAnalysisRequest) => {
      const response = await apiRequest("POST", "/api/deals/analyze", request);
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setAnalysisResult(data.data);
        setShowAnalysis(true);
        setHasExistingAnalysis(true);
        toast({
          title: "Deal Analysis Complete",
          description: "New AI analysis has been generated and saved.",
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: data.message || "Failed to analyze deal.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stream-based deal analysis function with token streaming
  const startStreamAnalysis = async () => {
    if (isStreaming || !property) return;
    
    setIsStreaming(true);
    setStreamProgress(10);
    setStreamMessage('Connecting to AI analysis service...');
    setStreamedText('');
    setShowAnalysis(true); // Show analysis section to display streaming text
    
    try {
      // Make POST request to initialize stream
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ propertyId: property.id }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis stream');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No stream reader available');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.replace('event: ', '');
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const data = line.replace('data: ', '');
            if (!data.trim()) continue;

            try {
              const eventData = JSON.parse(data);

              if (chunk.includes('event: status')) {
                if (eventData.stage === 'starting') {
                  setStreamMessage('Initializing AI analysis...');
                  setStreamProgress(20);
                } else if (eventData.stage === 'analyzing') {
                  setStreamMessage('AI is analyzing property data...');
                  setStreamProgress(30);
                }
              }

              if (chunk.includes('event: delta')) {
                // Token streaming - append new text
                setStreamedText(prev => prev + eventData.text);
                setStreamMessage('AI generating analysis...');
                setStreamProgress(60);
              }

              if (chunk.includes('event: done')) {
                // Analysis complete - parse final result
                const analysisData = JSON.parse(data);
                setAnalysisResult(analysisData);
                setStreamMessage('Analysis complete!');
                setStreamProgress(100);
                setHasExistingAnalysis(true);
                setIsStreaming(false);
                
                toast({
                  title: "Deal Analysis Complete",
                  description: "AI analysis generated with live streaming!",
                });
                return;
              }

              if (chunk.includes('event: error')) {
                throw new Error(eventData.message || 'Analysis failed');
              }

            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Stream analysis error:', error);
      setIsStreaming(false);
      toast({
        title: "Analysis Failed",
        description: "Unable to complete analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleAnalyzeDeal = () => {
    // Use streaming analysis by default
    startStreamAnalysis();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-slate-100 text-slate-800 border-slate-300";
      case "contacted": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "qualified": return "bg-green-100 text-green-800 border-green-300";
      case "under_contract": return "bg-blue-100 text-blue-800 border-blue-300";
      case "closed": return "bg-purple-100 text-purple-800 border-purple-300";
      default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "Not available";
    return `$${Number(value).toLocaleString()}`;
  };

  const formatDate = (dateValue: string | Date | null) => {
    if (!dateValue) return "Not available";
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    return date.toLocaleDateString();
  };

  const formatLeadType = (leadType: string | null) => {
    if (!leadType) return "Standard";
    return leadType.replace(/_/g, " ").toUpperCase();
  };

  const formatDistressedIndicator = (indicator: string | null) => {
    if (!indicator) return "Standard opportunity";
    return indicator.replace(/_/g, " ");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MapPin className="w-5 h-5 text-slate-600" />
            {property.address}, {property.city}, {property.state} {property.zipCode}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Home className="w-5 h-5" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Bedrooms:</span>
                  <div>{property.bedrooms || "Unknown"}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Bathrooms:</span>
                  <div>{property.bathrooms || "Unknown"}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Square Feet:</span>
                  <div>{property.squareFeet?.toLocaleString() || "Unknown"} sq ft</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Year Built:</span>
                  <div>{property.yearBuilt || "Unknown"}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Property Type:</span>
                  <div className="capitalize">{property.propertyType?.replace(/_/g, " ") || "Single Family"}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Status:</span>
                  <Badge className={getStatusColor(property.status)}>
                    {property.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5" />
                Financial Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">ARV (After Repair Value):</span>
                  <span className="font-semibold text-green-600">{formatCurrency(property.arv)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">Max Offer (70% Rule):</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(property.maxOffer)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">Equity Percentage:</span>
                  <span className="font-semibold">{property.equityPercentage || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">Confidence Score:</span>
                  <span className="font-semibold">{property.confidenceScore || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">Equity Balance:</span>
                  <span className="font-semibold">{formatCurrency(property.equityBalance)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Owner Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Owner Name:</span>
                  <div className="mt-1">{property.ownerName || "Not available"}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Mailing Address:</span>
                  <div className="mt-1 text-slate-600">
                    {property.ownerMailingAddress || "Same as property address"}
                  </div>
                </div>
                {property.ownerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>{property.ownerPhone}</span>
                  </div>
                )}
                {property.ownerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span>{property.ownerEmail}</span>
                  </div>
                )}
                {property.ownerLandLine && (
                  <div>
                    <span className="font-medium text-slate-700">Land Line:</span>
                    <div className="mt-1">{property.ownerLandLine}</div>
                  </div>
                )}
                {property.ownerMobilePhone && (
                  <div>
                    <span className="font-medium text-slate-700">Mobile Phone:</span>
                    <div className="mt-1">{property.ownerMobilePhone}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lead Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5" />
                Lead Classification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Lead Type:</span>
                  <Badge variant="outline" className="ml-2">
                    {formatLeadType(property.leadType)}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Distressed Indicator:</span>
                  <div className="mt-1 capitalize">{formatDistressedIndicator(property.distressedIndicator)}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Last Sale Date:</span>
                  <div className="mt-1">{formatDate(property.lastSaleDate)}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Last Sale Price:</span>
                  <div className="mt-1">{formatCurrency(property.lastSalePrice)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information (if available) */}
          {contact && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Contact Name:</span>
                    <div className="mt-1">{contact.name}</div>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Record Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Created:</span>
                  <div className="mt-1">{formatDate(property.createdAt)}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Last Updated:</span>
                  <div className="mt-1">{formatDate(property.updatedAt)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streaming Analysis Display */}
        {showAnalysis && isStreaming && (
          <>
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600 animate-pulse" />
                  AI Deal Analysis (Streaming)
                </h3>
                <Badge variant="outline" className="text-xs animate-pulse">
                  Generating...
                </Badge>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Live AI Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-md min-h-[200px]">
                    <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono">
                      {streamedText || "Waiting for AI to start generating analysis..."}
                    </div>
                    {isStreaming && (
                      <div className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {streamMessage}
                  </div>
                  <Progress value={streamProgress} className="mt-2 h-2" />
                </CardContent>
              </Card>
            </div>
            <Separator className="my-4" />
          </>
        )}

        {/* Deal Analysis Results */}
        {showAnalysis && analysisResult && !isStreaming && (
          <>
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  AI Deal Analysis
                </h3>
                <div className="flex gap-2">
                  <Badge variant={analysisResult.is_deal ? "default" : "secondary"} className="text-xs">
                    {analysisResult.is_deal ? "✓ DEAL" : "✗ NO DEAL"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(analysisResult.confidence * 100)}% Confident
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Deal Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>ARV Estimate:</span>
                      <span className="font-mono font-semibold">${analysisResult.arv_estimate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Max Offer:</span>
                      <span className="font-mono font-semibold">${analysisResult.max_offer_estimate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-green-600 border-t pt-2">
                      <span>Potential Equity:</span>
                      <span className="font-mono">${(analysisResult.arv_estimate - analysisResult.max_offer_estimate).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      AI Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {analysisResult.summary}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Analysis Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {analysisResult.notes}
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAnalysis(false)}
                  data-testid="button-hide-analysis"
                >
                  Hide Analysis
                </Button>
              </div>
            </div>
            <Separator className="my-4" />
          </>
        )}

        {/* Streaming Progress Indicator */}
        {isStreaming && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  AI Deal Analysis in Progress
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {streamMessage}
                </div>
              </div>
            </div>
            <Progress 
              value={streamProgress} 
              className="w-full h-2"
            />
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-right">
              {streamProgress}%
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          {/* Show Analysis Button - appears when analysis exists but is hidden */}
          {hasExistingAnalysis && !showAnalysis && (
            <Button 
              variant="outline" 
              size="sm" 
              data-testid="button-show-analysis"
              onClick={() => setShowAnalysis(true)}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Show Analysis
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-analyze-deal"
            onClick={handleAnalyzeDeal}
            disabled={isStreaming || analyzeDealMutation.isPending}
          >
            {(isStreaming || analyzeDealMutation.isPending) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            {(isStreaming || analyzeDealMutation.isPending) ? "Analyzing..." : hasExistingAnalysis ? "Re-analyze Deal" : "Analyze Deal"}
          </Button>
          <Button variant="outline" size="sm" data-testid="button-generate-contract">
            <FileText className="w-4 h-4 mr-2" />
            Generate Contract
          </Button>
          <Button variant="outline" size="sm" data-testid="button-start-conversation">
            <MessageSquare className="w-4 h-4 mr-2" />
            Start Conversation
          </Button>
          <Button onClick={onClose} data-testid="button-close-property-card">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}