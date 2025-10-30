import { Header } from "@/components/Header";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Megaphone, Sparkles, Calendar, Headphones, Gift, Bell, Mail, Heart } from "lucide-react";

const Campaigns = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
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
            />
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CampaignCard
                name="Summer Sale Promotion"
                status="active"
                date="15 June 2024"
                icon={<Megaphone className="h-6 w-6" />}
                stats={{ sent: 10500, delivered: 10342 }}
              />
              <CampaignCard
                name="New Feature Announcement"
                status="paused"
                date="12 June 2024"
                icon={<Sparkles className="h-6 w-6" />}
                stats={{ sent: 8200, delivered: 8100 }}
              />
              <CampaignCard
                name="Holiday Greetings Blast"
                status="completed"
                date="10 June 2024"
                icon={<Calendar className="h-6 w-6" />}
                stats={{ sent: 15000, delivered: 14850 }}
              />
              <CampaignCard
                name="Customer Support Follow-up"
                status="active"
                date="8 June 2024"
                icon={<Headphones className="h-6 w-6" />}
                stats={{ sent: 3200, delivered: 3180 }}
              />
              <CampaignCard
                name="Flash Sale Alert"
                status="completed"
                date="5 June 2024"
                icon={<Gift className="h-6 w-6" />}
                stats={{ sent: 12000, delivered: 11880 }}
              />
              <CampaignCard
                name="Product Update Notification"
                status="active"
                date="3 June 2024"
                icon={<Bell className="h-6 w-6" />}
                stats={{ sent: 6500, delivered: 6435 }}
              />
              <CampaignCard
                name="Newsletter - June Edition"
                status="completed"
                date="1 June 2024"
                icon={<Mail className="h-6 w-6" />}
                stats={{ sent: 18000, delivered: 17820 }}
              />
              <CampaignCard
                name="Customer Appreciation"
                status="draft"
                date="Draft"
                icon={<Heart className="h-6 w-6" />}
              />
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CampaignCard
                name="Summer Sale Promotion"
                status="active"
                date="15 June 2024"
                icon={<Megaphone className="h-6 w-6" />}
                stats={{ sent: 10500, delivered: 10342 }}
              />
              <CampaignCard
                name="Customer Support Follow-up"
                status="active"
                date="8 June 2024"
                icon={<Headphones className="h-6 w-6" />}
                stats={{ sent: 3200, delivered: 3180 }}
              />
              <CampaignCard
                name="Product Update Notification"
                status="active"
                date="3 June 2024"
                icon={<Bell className="h-6 w-6" />}
                stats={{ sent: 6500, delivered: 6435 }}
              />
            </div>
          </TabsContent>

          <TabsContent value="paused" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CampaignCard
                name="New Feature Announcement"
                status="paused"
                date="12 June 2024"
                icon={<Sparkles className="h-6 w-6" />}
                stats={{ sent: 8200, delivered: 8100 }}
              />
            </div>
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CampaignCard
                name="Holiday Greetings Blast"
                status="completed"
                date="10 June 2024"
                icon={<Calendar className="h-6 w-6" />}
                stats={{ sent: 15000, delivered: 14850 }}
              />
              <CampaignCard
                name="Flash Sale Alert"
                status="completed"
                date="5 June 2024"
                icon={<Gift className="h-6 w-6" />}
                stats={{ sent: 12000, delivered: 11880 }}
              />
              <CampaignCard
                name="Newsletter - June Edition"
                status="completed"
                date="1 June 2024"
                icon={<Mail className="h-6 w-6" />}
                stats={{ sent: 18000, delivered: 17820 }}
              />
            </div>
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
