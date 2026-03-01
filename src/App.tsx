import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TranscriptionEditor from "./pages/TranscriptionEditor";
import Speakers from "./pages/Speakers";
import DatabaseDashboard from "./pages/DatabaseDashboard";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/transcription/:id" element={<TranscriptionEditor />} />
                  <Route path="/speakers" element={<Speakers />} />
                  <Route path="/database" element={<DatabaseDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
