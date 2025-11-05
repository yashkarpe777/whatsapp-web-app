import { useEffect, useState } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Megaphone } from "lucide-react";
import { campaignsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import CreateCampaignModal from "@/components/CreateCampaignModal";

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 12;

  const fetchCampaigns = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      // In a real implementation, this would include pagination params
      // For now, we'll simulate pagination client-side
      const data = await campaignsAPI.getAll();
      
      if (append) {
        setCampaigns(prev => [...prev, ...data]);
      } else {
        setCampaigns(data);
      }
      
      // Simulate pagination end
      setHasMore(data.length >= itemsPerPage);
    } catch (err) {
      toast({
        title: "Error fetching campaigns",
        description: "Failed to load campaign data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns(1);
  }, []);
  
  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCampaigns(nextPage, true);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchSearch = c.campaign_name.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchSearch;
    return matchSearch && c.status === activeTab;
  });
  
  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  return (
    <div className="min-h-screen bg-background p-6">
      <main className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <Button
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            onClick={() => setOpenCreate(true)}
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
              <>
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
                
                {hasMore && (
                  <div className="mt-6 text-center">
                    <Button 
                      variant="outline" 
                      onClick={loadMore} 
                      disabled={loading}
                      className="w-full max-w-xs"
                    >
                      {loading ? "Loading..." : "Load More Campaigns"}
                    </Button>
                  </div>
                )}
              </>
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
        onClick={() => setOpenCreate(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CreateCampaignModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={(c) => {
          // Optimistically add new campaign to list
          setCampaigns((prev) => [c, ...prev]);
        }}
      />
    </div>
  );
};

export default Campaigns;
