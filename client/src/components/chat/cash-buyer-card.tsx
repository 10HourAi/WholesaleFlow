import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Phone } from "lucide-react";

interface CashBuyerCardProps {
  onStartWizard: () => void;
  buyerData?: any;
  showActionButtons?: boolean;
}

export function CashBuyerCard({ onStartWizard, buyerData, showActionButtons = false }: CashBuyerCardProps) {
  const handleAddToCRM = () => {
    console.log("Add to CRM clicked");
    // Add CRM functionality here
  };

  const handlePass = () => {
    console.log("I'll Pass clicked");
    // Add pass functionality here
  };

  const handleContact = () => {
    console.log("Contact Buyer clicked");
    // Add contact functionality here
  };

  return (
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
                onClick={onStartWizard}
                className="flex items-center gap-2 mb-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                <Search className="h-4 w-4" />
                Use Cash Buyer Wizard
              </Button>
            </div>
            
            {showActionButtons && (
              <div className="flex gap-2 pt-3 mt-3 border-t">
                <Button
                  onClick={handleAddToCRM}
                  variant="outline"
                  size="sm"
                  className="flex-1 items-center gap-1 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs px-3 py-1"
                >
                  <Plus className="h-3 w-3" />
                  Add to CRM
                </Button>
                <Button
                  onClick={handlePass}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs px-3 py-1 bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                >
                  I'll Pass
                </Button>
                <Button
                  onClick={handleContact}
                  variant="outline"
                  size="sm"
                  className="flex-1 items-center gap-1 text-xs px-3 py-1 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                >
                  <Phone className="h-3 w-3" />
                  Contact Buyer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}