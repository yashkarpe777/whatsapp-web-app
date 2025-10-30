import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Plus, Activity, Send, CheckCircle2, Megaphone, Sparkles, Calendar, Headphones } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4 sm:p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Welcome, Alex!</h1>
          <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
            <Plus className="h-5 w-5 mr-2" />
            New Campaign
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Active Campaigns"
            value={15}
            trend={{ value: "+2% from last week", isPositive: true }}
            icon={<Activity className="h-6 w-6" />}
          />
          <StatCard
            title="Sent Today"
            value="1,204"
            trend={{ value: "+10% from yesterday", isPositive: true }}
            icon={<Send className="h-6 w-6" />}
          />
          <StatCard
            title="Delivery Rate"
            value="98.7%"
            trend={{ value: "-0.2% from last week", isPositive: false }}
            icon={<CheckCircle2 className="h-6 w-6" />}
          />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Recent Campaigns</h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </div>
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

export default Dashboard;
