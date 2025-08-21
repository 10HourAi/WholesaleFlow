import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import ChatInterface from "@/components/chat/chat-interface";
import LeadsTable from "@/components/crm/leads-table";
import KanbanBoard from "@/components/pipeline/kanban-board";
import MessageThread from "@/components/messages/message-thread";
import DocumentGrid from "@/components/documents/document-grid";
import MetricsDashboard from "@/components/dashboard/metrics-dashboard";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Section = "chat" | "crm" | "pipeline" | "messages" | "documents" | "dashboard";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const renderContent = () => {
    switch (activeSection) {
      case "chat":
        return <ChatInterface />;
      case "crm":
        return <LeadsTable />;
      case "pipeline":
        return <KanbanBoard />;
      case "messages":
        return <MessageThread />;
      case "documents":
        return <DocumentGrid />;
      case "dashboard":
        return <MetricsDashboard />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className={`${isMobile ? (sidebarOpen ? "block" : "hidden") : "block"} ${isMobile ? "absolute inset-0 z-50" : "relative"} w-64`}>
        <Sidebar 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
            <h1 className="text-lg font-semibold text-slate-900">10HourAi</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Content */}
        {renderContent()}
      </div>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
