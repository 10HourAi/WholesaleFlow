import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, FileText, Download, Eye, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Document } from "@shared/schema";

const documentTypes = [
  { id: "all", name: "All Documents" },
  { id: "purchase_agreement", name: "Purchase Agreements" },
  { id: "assignment_contract", name: "Assignment Contracts" },
  { id: "closing_statement", name: "Closing Documents" },
  { id: "template", name: "Templates" },
];

export default function DocumentGrid() {
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const filteredDocuments = documents.filter(doc => 
    activeFilter === "all" || doc.type === activeFilter
  );

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "purchase_agreement":
        return "bg-red-100 text-red-600";
      case "assignment_contract":
        return "bg-blue-100 text-blue-600";
      case "closing_statement":
        return "bg-green-100 text-green-600";
      case "template":
        return "bg-purple-100 text-purple-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-slate-100 text-slate-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "signed": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Document Storage</h1>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Generate Contract
          </Button>
        </div>
      </div>

      {/* Document Categories */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-1">
          {documentTypes.map((type) => (
            <Button
              key={type.id}
              variant={activeFilter === type.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter(type.id)}
              className={activeFilter === type.id ? "bg-primary-100 text-primary-700 hover:bg-primary-200" : ""}
            >
              {type.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredDocuments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No documents found</h3>
                <p className="text-slate-600 mb-4">
                  {activeFilter === "all" 
                    ? "Start by uploading your first document or generating a contract."
                    : `No ${documentTypes.find(t => t.id === activeFilter)?.name.toLowerCase()} found.`
                  }
                </p>
                <div className="space-x-2">
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.map((document) => (
              <Card key={document.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getDocumentIcon(document.type)}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 mb-1">{document.name}</h3>
                    <p className="text-sm text-slate-500 mb-2">
                      {document.type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <div className="flex items-center space-x-2 mb-3">
                      <Badge className={getStatusColor(document.status)}>
                        {document.status}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {formatDate(document.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Template Creation Card */}
            <Card className="border-2 border-dashed border-slate-300 hover:border-primary transition-colors">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">Contract Template</h3>
                <p className="text-sm text-slate-500 mb-3">Create new document</p>
                <Button size="sm" className="w-full">
                  Generate
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
