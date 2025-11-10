import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Phone, Shield, Save, Plus, Users, CreditCard } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { userAPI, adminAPI, RegisterCredentials } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Profile = () => {
  const { user, isAdmin, updateUserInfo } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    credits: 0,
  });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('profile');
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profile = await userAPI.getProfile();
        setUserProfile(profile);
        setFormData(prev => ({
          ...prev,
          username: profile.username || '',
        }));
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [toast]);

  // Fetch users list for admin
  useEffect(() => {
    if (isAdmin() && selectedTab === 'users') {
      const fetchUsers = async () => {
        try {
          setLoading(true);
          const users = await adminAPI.getAllUsers();
          setUsersList(users);
        } catch (error: any) {
          toast({
            title: 'Error',
            description: error.message || 'Failed to load users',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      fetchUsers();
    }
  }, [isAdmin, selectedTab, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewUserInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserForm(prev => ({ 
      ...prev, 
      [name]: name === 'credits' ? parseInt(value) || 0 : value 
    }));
  };

  const handleUpdateProfile = async () => {
    // Validate password match if changing password
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const updateData: any = {};
      
      if (formData.username && formData.username !== userProfile.username) {
        updateData.username = formData.username;
      }
      
      if (formData.newPassword && formData.currentPassword) {
        updateData.password = formData.newPassword;
        updateData.currentPassword = formData.currentPassword;
      }

      if (Object.keys(updateData).length === 0) {
        toast({
          title: 'No changes',
          description: 'No profile changes to save',
        });
        return;
      }

      const updatedProfile = await userAPI.updateProfile(updateData);
      setUserProfile(updatedProfile);
      updateUserInfo({
        username: updatedProfile.username,
      });

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    // Validate form
    if (!newUserForm.username || !newUserForm.email || !newUserForm.password) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (newUserForm.password !== newUserForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const userData: RegisterCredentials & { role?: string; credits?: number } = {
        username: newUserForm.username,
        email: newUserForm.email,
        password: newUserForm.password,
      };

      if (newUserForm.role) {
        userData.role = newUserForm.role;
      }

      if (newUserForm.credits > 0) {
        userData.credits = newUserForm.credits;
      }

      await adminAPI.registerUser(userData);

      toast({
        title: 'Success',
        description: `User ${newUserForm.username} created successfully`,
      });

      // Refresh users list
      if (selectedTab === 'users') {
        const users = await adminAPI.getAllUsers();
        setUsersList(users);
      }

      // Reset form and close dialog
      setNewUserForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        credits: 0,
      });
      setShowAddUserDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferCredits = async (userId: number, amount: number) => {
    try {
      setLoading(true);
      await adminAPI.transferCredits({ userId, amount });
      
      // Refresh users list
      const users = await adminAPI.getAllUsers();
      setUsersList(users);
      
      toast({
        title: 'Success',
        description: `${amount} credits transferred successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to transfer credits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: string) => {
    try {
      setLoading(true);
      await adminAPI.updateUserStatus(userId, status);
      
      // Refresh users list
      const users = await adminAPI.getAllUsers();
      setUsersList(users);
      
      toast({
        title: 'Success',
        description: `User status updated to ${status}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <main className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          {isAdmin() && (
            <div className="flex gap-2">
              <Button onClick={() => setSelectedTab('profile')} variant={selectedTab === 'profile' ? 'default' : 'outline'}>
                <UserCircle className="h-5 w-5 mr-2" />
                Profile
              </Button>
              <Button onClick={() => setSelectedTab('users')} variant={selectedTab === 'users' ? 'default' : 'outline'}>
                <Users className="h-5 w-5 mr-2" />
                Users
              </Button>
              <Button onClick={() => setSelectedTab('credits')} variant={selectedTab === 'credits' ? 'default' : 'outline'}>
                <CreditCard className="h-5 w-5 mr-2" />
                Credits
              </Button>
            </div>
          )}
        </div>

        {selectedTab === 'profile' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userProfile && (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="h-12 w-12 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{userProfile.username}</h3>
                        <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                        <Badge variant="outline" className="mt-1">{userProfile.role}</Badge>
                        {userProfile.credits !== undefined && (
                          <Badge variant="outline" className="mt-1 ml-2">{userProfile.credits} credits</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        name="username"
                        value={formData.username} 
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={userProfile.email} 
                        disabled 
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Update your password and security preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    name="currentPassword"
                    type="password" 
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    name="newPassword"
                    type="password" 
                    value={formData.newPassword}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    name="confirmPassword"
                    type="password" 
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === 'users' && isAdmin() && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users</CardDescription>
              </div>
              <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account with specific role and credits.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-username">Username</Label>
                      <Input
                        id="new-username"
                        name="username"
                        value={newUserForm.username}
                        onChange={handleNewUserInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        name="email"
                        type="email"
                        value={newUserForm.email}
                        onChange={handleNewUserInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Password</Label>
                      <Input
                        id="new-password"
                        name="password"
                        type="password"
                        value={newUserForm.password}
                        onChange={handleNewUserInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-confirm-password">Confirm Password</Label>
                      <Input
                        id="new-confirm-password"
                        name="confirmPassword"
                        type="password"
                        value={newUserForm.confirmPassword}
                        onChange={handleNewUserInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-role">Role</Label>
                      <select
                        id="new-role"
                        name="role"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={newUserForm.role}
                        onChange={handleNewUserInputChange}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-credits">Initial Credits</Label>
                      <Input
                        id="new-credits"
                        name="credits"
                        type="number"
                        min="0"
                        value={newUserForm.credits}
                        onChange={handleNewUserInputChange}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddUser} disabled={loading}>
                      {loading ? 'Creating...' : 'Create User'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      <th className="h-10 px-4 text-left font-medium">Username</th>
                      <th className="h-10 px-4 text-left font-medium">Email</th>
                      <th className="h-10 px-4 text-left font-medium">Role</th>
                      <th className="h-10 px-4 text-left font-medium">Credits</th>
                      <th className="h-10 px-4 text-left font-medium">Status</th>
                      <th className="h-10 px-4 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">{user.username}</td>
                        <td className="p-4">{user.email}</td>
                        <td className="p-4">
                          <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4">{user.credits}</td>
                        <td className="p-4">
                          <Badge 
                            variant="outline" 
                            className={user.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                          >
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleTransferCredits(user.id, 10)}
                            >
                              +10 Credits
                            </Button>
                            <Button 
                              size="sm" 
                              variant={user.status === 'active' ? 'destructive' : 'outline'}
                              onClick={() => handleUpdateUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}
                            >
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          {loading ? 'Loading users...' : 'No users found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedTab === 'credits' && isAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle>Credits Management</CardTitle>
              <CardDescription>Manage and transfer credits between users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground mb-6">
                This feature will be available in the next update.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => setSelectedTab('users')}>
                  Go to User Management
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Profile;
