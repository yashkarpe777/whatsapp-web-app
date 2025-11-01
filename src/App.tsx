import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { Header } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Contacts from "./pages/Contacts";
import Automations from "./pages/Automations";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import ActiveCampaigns from "@/pages/ActiveCampaigns";

const queryClient = new QueryClient();
const AppLayout = () => {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col w-full">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SidebarProvider>
        <Routes>
          {/* Public routes (no layout) */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes with AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/active-campaigns" element={<ActiveCampaigns />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            {/* 404 catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </SidebarProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;