import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <main className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <Button>
            <Save className="h-5 w-5 mr-2" />
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp API Configuration</CardTitle>
              <CardDescription>Configure your Meta WhatsApp Business API credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="waba-id">WABA ID</Label>
                <Input id="waba-id" placeholder="Enter your WhatsApp Business Account ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone-id">Phone Number ID</Label>
                <Input id="phone-id" placeholder="Enter your Phone Number ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token</Label>
                <Input id="access-token" type="password" placeholder="Enter your permanent access token" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you want to receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="campaign-notifications">Campaign Notifications</Label>
                <Switch id="campaign-notifications" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="delivery-updates">Delivery Updates</Label>
                <Switch id="delivery-updates" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="error-alerts">Error Alerts</Label>
                <Switch id="error-alerts" />
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>Configure your timezone and language preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">EST</SelectItem>
                    <SelectItem value="pst">PST</SelectItem>
                    <SelectItem value="ist">IST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Message Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Message Limits</CardTitle>
              <CardDescription>Configure daily message limits and throttling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Message Limit</Label>
                <Input id="daily-limit" type="number" placeholder="Enter daily limit" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input id="batch-size" type="number" placeholder="Messages per batch" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Delay Between Batches (seconds)</Label>
                <Input id="delay" type="number" placeholder="Enter delay in seconds" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
