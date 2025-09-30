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
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  // Helper function to transform database fields to DealAnalysisResult format
  const transformPropertyToAnalysisResult = (prop: Property): DealAnalysisResult | null => {
    if (!prop.strategy || prop.isDeal === null || !prop.analysisArv || !prop.rehabCost || 
        !prop.analysisMaxOfferPrice || !prop.analysisConfidence) {
      return null;
    }

    return {
      address: `${prop.address}, ${prop.city}, ${prop.state}`,
      strategy: prop.strategy as "wholesale" | "flip" | "rental" | "wholetail",
      is_deal: prop.isDeal,
      arv: prop.analysisArv,
      rehab_cost: prop.rehabCost,
      max_offer_price: prop.analysisMaxOfferPrice,
      profit_margin_pct: Number(prop.profitMarginPct) || 0,
      risk_level: (prop.riskLevel as "low" | "medium" | "high") || "medium",
      confidence: Number(prop.analysisConfidence),
      key_assumptions: (prop.keyAssumptions as string[]) || [],
      comp_summary: (prop.compSummary as any[]) || [],
      next_actions: (prop.nextActions as string[]) || [],
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

  // Stream-based deal analysis function
  const startStreamAnalysis = async () => {
    if (isStreaming || !property) return;
    
    setIsStreaming(true);
    setStreamProgress(0);
    setStreamMessage('Connecting to analysis service...');
    
    try {
      const eventSource = new EventSource(
        `/api/deals/analyze/${property.id}/stream`,
        { withCredentials: true }
      );
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        setStreamProgress(data.progress);
        setStreamMessage(data.message);
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        if (data.success) {
          setAnalysisResult(data.data);
          setShowAnalysis(true);
          setHasExistingAnalysis(true);
          toast({
            title: "Deal Analysis Complete",
            description: "New AI analysis has been generated and saved.",
          });
        }
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        toast({
          title: "Analysis Failed",
          description: data.message || "Failed to analyze deal.",
          variant: "destructive",
        });
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        toast({
          title: "Connection Error",
          description: "Lost connection to analysis service.",
          variant: "destructive",
        });
        setIsStreaming(false);
        eventSource.close();
      };

    } catch (error) {
      console.error('Stream analysis error:', error);
      setIsStreaming(false);
      toast({
        title: "Analysis Failed",
        description: "Unable to start analysis. Please try again.",
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
                {/* Phone Numbers - Rewritten Logic */}
                <div>
                  <span className="font-medium text-slate-700">Phone Numbers:</span>
                  <div className="mt-1 space-y-1">
                    {(() => {
                      // Helper function to clean and validate phone numbers
                      const cleanPhone = (phone) => {
                        if (!phone || phone === 'undefined' || phone === 'null' || phone === null) return null;
                        const cleaned = phone.toString().trim();
                        return cleaned && cleaned !== 'undefined' && cleaned !== 'null' && cleaned !== '' ? cleaned : null;
                      };

                      // Helper function to format phone number
                      const formatPhone = (phone) => {
                        const digits = phone.replace(/\D/g, '');
                        if (digits.length === 10) {
                          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                        }
                        return phone;
                      };

                      // Collect all unique phone numbers
                      const allPhones = new Set();
                      const phoneData = [];

                      // Process ownerPhoneNumbers array first (highest priority)
                      if (property.ownerPhoneNumbers && Array.isArray(property.ownerPhoneNumbers)) {
                        property.ownerPhoneNumbers.forEach((phone, index) => {
                          let phoneNumber = null;
                          let phoneType = `Phone ${index + 1}`;
                          
                          if (typeof phone === 'string') {
                            phoneNumber = cleanPhone(phone);
                          } else if (typeof phone === 'object' && phone !== null) {
                            phoneNumber = cleanPhone(phone.number || phone);
                            phoneType = phone.type || phoneType;
                          }

                          if (phoneNumber && !allPhones.has(phoneNumber)) {
                            allPhones.add(phoneNumber);
                            phoneData.push({ 
                              number: phoneNumber, 
                              type: phoneType,
                              formatted: formatPhone(phoneNumber),
                              source: 'array'
                            });
                          }
                        });
                      }

                      // Add individual phone fields if not already included
                      const individualPhones = [
                        { number: cleanPhone(property.ownerPhone), type: 'Primary', source: 'direct' },
                        { number: cleanPhone(property.ownerLandLine), type: 'Land Line', source: 'direct' },
                        { number: cleanPhone(property.ownerMobilePhone), type: 'Mobile', source: 'direct' }
                      ];

                      individualPhones.forEach(({ number, type, source }) => {
                        if (number && !allPhones.has(number)) {
                          allPhones.add(number);
                          phoneData.push({ 
                            number, 
                            type,
                            formatted: formatPhone(number),
                            source 
                          });
                        }
                      });

                      // Render phone numbers
                      if (phoneData.length === 0) {
                        return (
                          <div className="text-slate-500 text-sm">No phone numbers available</div>
                        );
                      }

                      return phoneData.map((phone, index) => (
                        <div key={`phone-${index}-${phone.number}`} className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span className="font-mono">{phone.formatted}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            phone.type === 'Primary' ? 'bg-blue-100 text-blue-700' :
                            phone.type === 'Mobile' ? 'bg-green-100 text-green-700' :
                            phone.type === 'Land Line' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {phone.type}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Email Addresses */}
                <div>
                  <span className="font-medium text-slate-700">Email Addresses:</span>
                  <div className="mt-1">
                    {property.ownerEmail ? (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <span>{property.ownerEmail}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">No email available</span>
                    )}
                  </div>
                </div>

                {/* DNC Phone Numbers */}
                {(() => {
                  const dncPhones = [];
                  
                  // Process DNC phone string
                  if (property.ownerDncPhone && property.ownerDncPhone !== 'undefined') {
                    const phones = property.ownerDncPhone.split(',')
                      .map(phone => phone.trim())
                      .filter(phone => phone && phone !== 'undefined' && phone !== 'null');
                    dncPhones.push(...phones);
                  }

                  if (dncPhones.length === 0) return null;

                  const formatPhone = (phone) => {
                    const digits = phone.replace(/\D/g, '');
                    if (digits.length === 10) {
                      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    }
                    return phone;
                  };

                  return (
                    <div>
                      <span className="font-medium text-slate-700">DNC Phone Numbers:</span>
                      <div className="mt-1 space-y-1">
                        {dncPhones.map((phone, index) => (
                          <div key={`dnc-${index}-${phone}`} className="flex items-center gap-2 text-red-600">
                            <Phone className="w-4 h-4" />
                            <span className="font-mono">{formatPhone(phone)}</span>
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">DNC</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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

          {/* Contact Information - Show from either contact prop or embedded property data */}
          {(contact || property.ownerPhone || property.ownerEmail || property.ownerLandLine || property.ownerMobilePhone || property.ownerPhoneNumbers?.length > 0) && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Contact Name:</span>
                    <div className="mt-1">{contact?.name || property.ownerName || "Property Owner"}</div>
                  </div>
                  
                  {/* Email */}
                  {(contact?.email || property.ownerEmail) && (
                    <div>
                      <span className="font-medium text-slate-700">Email:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <span>{contact?.email || property.ownerEmail}</span>
                      </div>
                    </div>
                  )}

                  {/* Phone Numbers */}
                  <div className="md:col-span-2">
                    <span className="font-medium text-slate-700">Phone Numbers:</span>
                    <div className="mt-1 space-y-1">
                      {(() => {
                        // Use same phone processing logic as in Owner Information section
                        const cleanPhone = (phone) => {
                          if (!phone || phone === 'undefined' || phone === 'null' || phone === null) return null;
                          const cleaned = phone.toString().trim();
                          return cleaned && cleaned !== 'undefined' && cleaned !== 'null' && cleaned !== '' ? cleaned : null;
                        };

                        const formatPhone = (phone) => {
                          const digits = phone.replace(/\D/g, '');
                          if (digits.length === 10) {
                            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                          }
                          return phone;
                        };

                        const allPhones = new Set();
                        const phoneData = [];

                        // Process ownerPhoneNumbers array
                        if (property.ownerPhoneNumbers && Array.isArray(property.ownerPhoneNumbers)) {
                          property.ownerPhoneNumbers.forEach((phone, index) => {
                            let phoneNumber = null;
                            let phoneType = `Phone ${index + 1}`;
                            
                            if (typeof phone === 'string') {
                              phoneNumber = cleanPhone(phone);
                            } else if (typeof phone === 'object' && phone !== null) {
                              phoneNumber = cleanPhone(phone.number || phone);
                              phoneType = phone.type || phoneType;
                            }

                            if (phoneNumber && !allPhones.has(phoneNumber)) {
                              allPhones.add(phoneNumber);
                              phoneData.push({ number: phoneNumber, type: phoneType, formatted: formatPhone(phoneNumber) });
                            }
                          });
                        }

                        // Add individual phone fields
                        const individualPhones = [
                          { number: cleanPhone(contact?.phone || property.ownerPhone), type: 'Primary' },
                          { number: cleanPhone(property.ownerLandLine), type: 'Land Line' },
                          { number: cleanPhone(property.ownerMobilePhone), type: 'Mobile' }
                        ];

                        individualPhones.forEach(({ number, type }) => {
                          if (number && !allPhones.has(number)) {
                            allPhones.add(number);
                            phoneData.push({ number, type, formatted: formatPhone(number) });
                          }
                        });

                        if (phoneData.length === 0) {
                          return <span className="text-slate-500">No phone numbers available</span>;
                        }

                        return phoneData.map((phone, index) => (
                          <div key={`contact-phone-${index}`} className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span className="font-mono">{phone.formatted}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              phone.type === 'Primary' ? 'bg-blue-100 text-blue-700' :
                              phone.type === 'Mobile' ? 'bg-green-100 text-green-700' :
                              phone.type === 'Land Line' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {phone.type}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
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