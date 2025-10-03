import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, BarChart3, MessageSquare, FileText } from "lucide-react";

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            AiClosings
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            The complete AI-powered real estate wholesaling platform. Find deals, analyze properties, 
            negotiate with sellers, and manage your pipeline with intelligent assistance.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => window.location.href = "/auth"}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Get Started
            </Button>
            <Button
              onClick={() => window.location.href = "/auth"}
              variant="outline"
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Building2 className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Lead Finder</CardTitle>
              <CardDescription>
                AI-powered lead generation to find off-market properties and motivated sellers
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Deal Analyzer</CardTitle>
              <CardDescription>
                Automated ARV calculations, comparable analysis, and deal profitability assessment
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle>Negotiation Agent</CardTitle>
              <CardDescription>
                AI-assisted negotiation strategies and automated outreach via text and email
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-orange-600 mb-2" />
              <CardTitle>Closing Agent</CardTitle>
              <CardDescription>
                Complete document management and closing process automation
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-center">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Everything You Need</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 text-left">
              <div>
                <h3 className="font-semibold mb-2">CRM System</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Complete lead management with contact tracking and property details
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Deal Pipeline</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Kanban-style pipeline management to track deals from lead to closing
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Document Hub</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Organized storage for contracts, agreements, and closing documents
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}