import { Send, User, Moon, Sun, LayoutDashboard, Send as SendIcon, Users, Bot, BarChart3 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/campaigns", label: "Campaigns", icon: SendIcon },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/automations", label: "Automations", icon: Bot },
  { path: "/reports", label: "Reports", icon: BarChart3 },
];

export const Header = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Send className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Campaigner</h1>
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {mounted && (
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          )}
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors">
            <User className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};
