import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
  const { toast } = useToast();

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
        toast({
          title: "Deal Analysis Complete",
          description: "AI analysis has been generated successfully.",
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

  const handleAnalyzeDeal = () => {
    const analysisRequest: DealAnalysisRequest = {
      propertyId: property.id,
      analysisOptions: {
        includeComps: true,
        includeRepairEstimates: true,
        includeRentals: false,
      },
    };
    analyzeDealMutation.mutate(analysisRequest);
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

        {/* Deal Analysis Results */}
        {showAnalysis && analysisResult && (
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
                {/* Strategy & Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Deal Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Strategy:</span>
                      <span className="font-semibold capitalize">{analysisResult.strategy}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>ARV:</span>
                      <span className="font-mono">${analysisResult.arv.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Max Offer:</span>
                      <span className="font-mono">${analysisResult.max_offer_price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Rehab Cost:</span>
                      <span className="font-mono">${analysisResult.rehab_cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-green-600 border-t pt-1">
                      <span>Profit Margin:</span>
                      <span className="font-mono">{analysisResult.profit_margin_pct}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Assessment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Risk Level:</span>
                      <Badge 
                        variant={analysisResult.risk_level === 'low' ? 'default' : analysisResult.risk_level === 'medium' ? 'secondary' : 'destructive'} 
                        className="text-xs capitalize"
                      >
                        {analysisResult.risk_level}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Total Investment:</span>
                      <span className="font-mono">${(analysisResult.max_offer_price + analysisResult.rehab_cost).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Estimated Profit:</span>
                      <span className="font-mono text-green-600">${(analysisResult.arv - analysisResult.max_offer_price - analysisResult.rehab_cost).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Assumptions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key Assumptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {analysisResult.key_assumptions.map((assumption, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">•</span>
                          {assumption}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Comparable Sales */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Comparable Sales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysisResult.comp_summary.map((comp, index) => (
                      <div key={index} className="text-xs border-b pb-2 last:border-b-0">
                        <div className="font-semibold">{comp.addr}</div>
                        <div className="flex justify-between">
                          <span>${comp.sold_price.toLocaleString()}</span>
                          <span className="text-slate-500">
                            {comp.dist_mi ? `${comp.dist_mi}mi` : ''} {comp.dom ? `• ${comp.dom} DOM` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Next Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-blue-600">Next Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {analysisResult.next_actions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">→</span>
                        {action}
                      </li>
                    ))}
                  </ul>
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-analyze-deal"
            onClick={handleAnalyzeDeal}
            disabled={analyzeDealMutation.isPending}
          >
            {analyzeDealMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            {analyzeDealMutation.isPending ? "Analyzing..." : "Analyze Deal"}
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