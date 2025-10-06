
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Phone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BuyerCardDisplayProps {
  content: string;
}

export function BuyerCardDisplay({ content }: BuyerCardDisplayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract buyer data from formatted text
  const extractBuyerData = (text: string) => {
    const lines = text.split('\n');
    const data: any = {};

    // Extract buyer number
    const buyerMatch = text.match(/QUALIFIED CASH BUYER #(\d+)/);
    data.buyerNumber = buyerMatch ? buyerMatch[1] : '1';

    // Extract investor name
    const nameMatch = text.match(/👤 𝗜𝗡𝗩𝗘𝗦𝗧𝗢𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\s*\n\s*(.+?)\s*\n/);
    data.investorName = nameMatch ? nameMatch[1] : 'Cash Investor';

    // Extract location
    const locationMatch = text.match(/📍 Based in (.+)/);
    data.location = locationMatch ? locationMatch[1] : '';

    // Extract portfolio value
    const portfolioMatch = text.match(/Total Portfolio Value: \$([0-9,]+)/);
    data.portfolioValue = portfolioMatch ? portfolioMatch[1] : 'N/A';

    // Extract properties count
    const propertiesMatch = text.match(/Properties Owned: (\d+) properties/);
    data.propertiesCount = propertiesMatch ? propertiesMatch[1] : 'N/A';

    // Extract average purchase price
    const avgPriceMatch = text.match(/Avg Purchase Price: \$([0-9,]+)/);
    data.avgPurchasePrice = avgPriceMatch ? avgPriceMatch[1] : 'N/A';

    // Extract recent purchase address
    const addressMatch = text.match(/📍 (.+?)\n.*?(.+?), (.+?) (\d{5})/s);
    if (addressMatch) {
      data.recentAddress = addressMatch[1].trim();
      data.city = addressMatch[2].trim();
      data.state = addressMatch[3].trim();
      data.zipCode = addressMatch[4].trim();
    }

    // Extract property type
    const typeMatch = text.match(/🏘️ (.+?) •/);
    data.propertyType = typeMatch ? typeMatch[1] : 'Single Family';

    // Extract beds/baths
    const bedsMatch = text.match(/🛏️ (\d+) bed/);
    const bathsMatch = text.match(/🛁 (\d+) bath/);
    data.bedrooms = bedsMatch ? bedsMatch[1] : 'N/A';
    data.bathrooms = bathsMatch ? bathsMatch[1] : 'N/A';

    // Extract last sale price
    const saleMatch = text.match(/💵 Last Sale: \$([0-9,]+)/);
    data.lastSalePrice = saleMatch ? saleMatch[1] : 'N/A';

    // Extract email
    const emailMatch = text.match(/📧 (.+?)\n/);
    data.email = emailMatch ? emailMatch[1].trim() : 'Contact for details';

    // Extract phone numbers (multiple formats)
    const phoneMatches = text.match(/📱 (.+?)(?:\n|$)/);
    data.phone = phoneMatches ? phoneMatches[1].trim() : 'Contact for details';

    return data;
  };

  const buyerData = extractBuyerData(content);

  const handleAddToCRM = async () => {
    try {
      // Create property entry for this cash buyer
      const propertyData = {
        address: buyerData.recentAddress || 'Cash Buyer Property',
        city: buyerData.city || '',
        state: buyerData.state || '',
        zipCode: buyerData.zipCode || '',
        bedrooms: parseInt(buyerData.bedrooms) || 0,
        bathrooms: parseInt(buyerData.bathrooms) || 0,
        propertyType: buyerData.propertyType?.toLowerCase().replace(/\s+/g, '_') || 'single_family',
        ownerName: buyerData.investorName,
        ownerEmail: buyerData.email !== 'Contact for details' ? buyerData.email : null,
        ownerPhone: buyerData.phone !== 'Contact for details' ? buyerData.phone : null,
        leadType: 'cash_buyer',
        status: 'new',
      };

      await apiRequest("POST", "/api/properties", propertyData);

      toast({
        title: "Added to CRM",
        description: `${buyerData.investorName} has been added to your CRM.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    } catch (error: any) {
      console.error("Error adding buyer to CRM:", error);
      toast({
        title: "Error",
        description: "Failed to add buyer to CRM.",
        variant: "destructive",
      });
    }
  };

  const handleContactBuyer = () => {
    const phone = buyerData.phone;
    const email = buyerData.email;

    if (phone && phone !== 'Contact for details') {
      // Clean phone number for tel: link
      const cleanPhone = phone.replace(/[^\d]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    } else if (email && email !== 'Contact for details') {
      window.location.href = `mailto:${email}`;
    } else {
      toast({
        title: "No Contact Info",
        description: "This buyer has no phone or email available.",
        variant: "destructive",
      });
    }
  };

  const handlePass = () => {
    toast({
      title: "Passed",
      description: "Moving to next buyer...",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-white border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        {/* Header with Investor Name and Badge */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Cash Buyer #{buyerData.buyerNumber}</p>
            <p className="font-semibold text-lg text-gray-800">
              {buyerData.investorName}
            </p>
            {buyerData.location && (
              <p className="text-sm text-gray-600 mt-1">📍 {buyerData.location}</p>
            )}
          </div>
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Buyer
          </Badge>
        </div>

        {/* Portfolio Overview */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-2">💰 Portfolio Overview</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-600">Total Value</p>
              <p className="font-semibold text-gray-900">${buyerData.portfolioValue}</p>
            </div>
            <div>
              <p className="text-gray-600">Properties</p>
              <p className="font-semibold text-gray-900">{buyerData.propertiesCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Avg Purchase</p>
              <p className="font-semibold text-gray-900">${buyerData.avgPurchasePrice}</p>
            </div>
          </div>
        </div>

        {/* Recent Purchase */}
        {buyerData.recentAddress && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">🏠 Recent Purchase</p>
            <p className="text-sm text-gray-800">{buyerData.recentAddress}</p>
            <p className="text-xs text-gray-600">
              {buyerData.propertyType} • {buyerData.bedrooms} bed / {buyerData.bathrooms} bath
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Last Sale: ${buyerData.lastSalePrice}
            </p>
          </div>
        )}

        {/* Contact Information */}
        <div className="mb-4 text-sm">
          <p className="text-xs font-semibold text-gray-700 mb-2">📞 Contact</p>
          <div className="space-y-1 text-xs">
            <p className="text-gray-600">
              📧 {buyerData.email}
            </p>
            <p className="text-gray-600">
              📱 {buyerData.phone}
            </p>
          </div>
        </div>
      </CardContent>

      {/* Action buttons */}
      <div className="bg-gray-50 p-4 flex gap-2 justify-between border-t">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          onClick={handleAddToCRM}
        >
          <Plus className="h-4 w-4 mr-2" /> Add to CRM
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
          onClick={handlePass}
        >
          <X className="h-4 w-4 mr-2" /> I'll Pass
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
          onClick={handleContactBuyer}
        >
          <Phone className="h-4 w-4 mr-2" /> Contact Buyer
        </Button>
      </div>
    </Card>
  );
}
