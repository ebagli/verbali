import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom"; 
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import TranscriptionEditor from "./pages/TranscriptionEditor";
import Speakers from "./pages/Speakers";
import DatabaseDashboard from "./pages/DatabaseDashboard";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <HashRouter>
      <Routes>
        <Route path="/*" element={
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/transcription/:id" element={<TranscriptionEditor />} />
              <Route path="/speakers" element={<Speakers />} />
              <Route path="/database" element={<DatabaseDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        } />
      </Routes>
    </HashRouter>
  </TooltipProvider>
);

export default App;