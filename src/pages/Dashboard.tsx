import { useState, useEffect } from "react";
import { StatCard } from "@/components/StatCard";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Plus, Activity, Send, CheckCircle2, Megaphone, Sparkles, Calendar, Headphones, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { campaignsAPI, mockDashboardStats } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Map string icon names to actual icon components
const iconMap = {
  Megaphone: <Megaphone className="h-6 w-6" />,
  Sparkles: <Sparkles className="h-6 w-6" />,
  Calendar: <Calendar className="h-6 w-6" />,
  Headphones: <Headphones className="h-6 w-6" />
};

const Dashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(mockDashboardStats);

  // Function to fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    
    try {
      // Fetch dashboard stats
      const dashboardStats = await campaignsAPI.getDashboardStats();
      setStats(dashboardStats);
      
      // Fetch recent campaigns
      const recentCampaigns = await campaignsAPI.getRecent(4);
      setCampaigns(recentCampaigns);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle creating a new campaign
  const handleCreateCampaign = () => {
    // Navigate to campaigns page with a query parameter to open the create dialog
    navigate("/campaigns?create=true");
  };

  // Get the user's first name for personalized greeting
  const firstName = user?.username?.split(' ')[0] || "there";

  return (
    <div className="p-4 sm:p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Welcome, {firstName}!</h1>
          <Button 
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            onClick={handleCreateCampaign}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Campaign
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Active Campaigns"
                value={stats.activeCampaigns}
                trend={stats.activeCampaignsTrend}
                icon={<Activity className="h-6 w-6" />}
              />
              <StatCard
                title="Sent Today"
                value={stats.sentToday}
                trend={stats.sentTodayTrend}
                icon={<Send className="h-6 w-6" />}
              />
              <StatCard
                title="Delivery Rate"
                value={stats.deliveryRate}
                trend={stats.deliveryRateTrend}
                icon={<CheckCircle2 className="h-6 w-6" />}
              />
            </div>

            <div className="rounded-xl bg-gradient-to-br from-primary via-primary to-purple-600 p-8 text-white mb-8">
              <h1 className="text-4xl font-bold mb-2">Welcome back, {firstName}!</h1>
              <p className="text-white/90 mb-6">Ready to launch your next successful campaign? Let's get started.</p>
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 font-semibold"
                onClick={handleCreateCampaign}
              >
                Create New Campaign
              </Button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">Recent Campaigns</h2>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/campaigns")}
                >
                  View All
                </Button>
              </div>
              
              {campaigns.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-card">
                  <p className="text-muted-foreground mb-4">No campaigns yet</p>
                  <Button 
                    onClick={handleCreateCampaign}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Campaign
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {campaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      name={campaign.name}
                      status={campaign.status}
                      date={campaign.date}
                      icon={iconMap[campaign.icon] || <Megaphone className="h-6 w-6" />}
                      stats={campaign.stats}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl"
        onClick={handleCreateCampaign}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Dashboard;
