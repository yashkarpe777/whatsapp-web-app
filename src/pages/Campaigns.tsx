import { useEffect, useState } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Megaphone } from "lucide-react";
import { campaignsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const data = await campaignsAPI.getAll();
        setCampaigns(data);
      } catch (err) {
        toast({
          title: "Error fetching campaigns",
          description: "Failed to load campaign data.",
          variant: "destructive",
        });
      }
    };
    fetchCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchSearch = c.campaign_name.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchSearch;
    return matchSearch && c.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <main className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <Button
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            onClick={() => toast({ title: "Create Campaign clicked" })}
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Campaign
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredCampaigns.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCampaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    name={c.campaign_name}
                    status={c.status}
                    date={new Date(c.created_at).toLocaleDateString()}
                    icon={<Megaphone className="h-6 w-6" />}
                    stats={{ sent: 0, delivered: 0 }} // later link to reports table
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                No campaigns found.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Campaigns;
