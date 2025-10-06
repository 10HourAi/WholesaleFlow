
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Home, DollarSign, Phone, Mail } from "lucide-react";

interface BuyerCardDisplayProps {
  content: string;
}

export function BuyerCardDisplay({ content }: BuyerCardDisplayProps) {
  // Extract buyer data from formatted text
  const extractBuyerData = (text: string) => {
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

    // Extract last activity
    const activityMatch = text.match(/Last Activity: (.+)/);
    data.lastActivity = activityMatch ? activityMatch[1] : 'N/A';

    // Extract recent purchase address
    const addressMatch = text.match(/📍 (.+?)\n.*?(.+?), (.+?) (\d{5})/s);
    if (addressMatch) {
      data.recentAddress = addressMatch[1].trim();
      data.city = addressMatch[2].trim();
      data.state = addressMatch[3].trim();
      data.zipCode = addressMatch[4].trim();
    }

    // Extract property type and square feet
    const propertyDetailsMatch = text.match(/🏘️ (.+?) • (.+?) sqft/);
    if (propertyDetailsMatch) {
      data.propertyType = propertyDetailsMatch[1].trim();
      data.squareFeet = propertyDetailsMatch[2].trim();
    }

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

    // Extract mailing address
    const mailingMatch = text.match(/📮 (.+?)(?:\n|$)/);
    data.mailingAddress = mailingMatch ? mailingMatch[1].trim() : 'N/A';

    // Extract phone numbers
    const phoneMatches = text.match(/📱 (.+?)(?:\n|$)/);
    data.phone = phoneMatches ? phoneMatches[1].trim() : 'Contact for details';

    // Extract DNC phones
    const dncMatch = text.match(/🚫 DNC: (.+?)(?:\n|$)/);
    data.dncPhone = dncMatch ? dncMatch[1].trim() : null;

    return data;
  };

  const buyerData = extractBuyerData(content);

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-600" />
              {buyerData.investorName}
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {buyerData.location || 'Location'}
            </p>
          </div>
          <Badge className="bg-blue-600 text-white border-0 px-3 py-1">
            Cash Buyer
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Properties Owned</p>
            <p className="text-2xl font-bold text-slate-800">
              {buyerData.propertiesCount}
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-green-600">
              ${buyerData.portfolioValue}
            </p>
          </div>
        </div>

        {/* Financial Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Purchase</p>
            <p className="text-lg font-semibold text-slate-800">
              ${buyerData.avgPurchasePrice}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last Activity</p>
            <p className="text-lg font-semibold text-slate-800">
              {buyerData.lastActivity}
            </p>
          </div>
        </div>

        {/* Recent Purchase Details */}
        {buyerData.recentAddress && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Recent Purchase</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Property Type</p>
                <p className="text-sm font-medium text-slate-800">
                  {buyerData.propertyType || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Square Feet</p>
                <p className="text-sm font-medium text-slate-800">
                  {buyerData.squareFeet || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Beds</p>
                <p className="text-sm font-medium text-slate-800">
                  {buyerData.bedrooms}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Baths</p>
                <p className="text-sm font-medium text-slate-800">
                  {buyerData.bathrooms}
                </p>
              </div>
            </div>
            <div className="mt-3 bg-green-50 p-3 rounded-lg">
              <p className="text-xs text-green-700 mb-1">Last Sale Price</p>
              <p className="text-xl font-bold text-green-700">
                ${buyerData.lastSalePrice}
              </p>
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Contact Information</p>
          <div className="space-y-2">
            {buyerData.email && buyerData.email !== 'Contact for details' && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-slate-800">{buyerData.email}</span>
              </div>
            )}
            {buyerData.phone && buyerData.phone !== 'Contact for details' && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-slate-500" />
                <span className="text-slate-800">{buyerData.phone}</span>
              </div>
            )}
            {buyerData.dncPhone && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <Phone className="h-4 w-4" />
                <span>{buyerData.dncPhone}</span>
                <Badge variant="destructive" className="text-xs">DNC</Badge>
              </div>
            )}
            {buyerData.mailingAddress && buyerData.mailingAddress !== 'N/A' && (
              <div className="text-sm">
                <span className="text-slate-500">Mailing: </span>
                <span className="text-slate-800">{buyerData.mailingAddress}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              // TODO: Implement add to CRM functionality
              console.log('Add to CRM clicked');
            }}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Add to CRM
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
            onClick={() => {
              // TODO: Implement pass functionality
              console.log('Pass clicked');
            }}
          >
            I'll Pass
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => {
              // TODO: Implement contact buyer functionality
              console.log('Contact buyer clicked');
            }}
          >
            <Phone className="h-4 w-4 mr-2" />
            Contact Buyer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
