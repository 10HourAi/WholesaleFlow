import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search } from "lucide-react";

interface CashBuyerCardProps {
  onStartWizard: () => void;
}

export function CashBuyerCard({ onStartWizard }: CashBuyerCardProps) {
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}