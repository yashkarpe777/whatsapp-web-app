import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Send,
  Users,
  Bot,
  BarChart3,
  PlayCircle,
  Settings as SettingsIcon,
  ChevronRight, 
  Menu,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  requiresAdmin?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Campaigns", url: "/campaigns", icon: Send },
  { title: "Active Campaigns", url: "/active-campaigns", icon: PlayCircle },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Automations", url: "/automations", icon: Bot },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: SettingsIcon, requiresAdmin: true },
];

export function AppSidebar() {
  // NOTE: The 'collapsed' state is kept for potential future use or external control,
  // but the collapse button and its visual effects are removed per request.
  const [collapsed, setCollapsed] = useState(false); 
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const checkIsAdmin = useAuthStore((state) => state.isAdmin);
  const isAdmin = checkIsAdmin();

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.requiresAdmin || isAdmin),
    [isAdmin],
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Ensure mobile sidebar is never collapsed
      if (mobile && collapsed) setCollapsed(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed]);

  // Set the sidebar to the un-collapsed width (w-64) since the button is removed
  const sidebarWidth = "w-64"; 

  // Render a single nav item
  const renderNavItem = (item: NavItem) => (
    <li key={item.title}>
      <NavLink
        to={item.url}
        end={item.url === "/"}
        // Simplified classes since 'collapsed' state visual effects are now largely unused
        className={({ isActive }) => `
          flex items-center gap-3 px-3 py-2 rounded-lg
          transition-all duration-200
          ${"justify-start"} 
          ${
            isActive
              ? "bg-blue-700/30 text-white dark:bg-blue-600/10 dark:text-blue-500"
              : "text-white hover:bg-blue-700/40 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white"
          }
        `}
        title={item.title}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {/* Always show text since the sidebar is fixed to w-64 */}
        <span className="text-sm font-medium truncate">{item.title}</span>
      </NavLink>
    </li>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 
          ${sidebarWidth}
          bg-[#1E40AF] text-white dark:bg-[#0F172A] dark:text-slate-400 
          border-r border-slate-800 flex flex-col
          transition-all duration-300 ease-in-out z-50
          ${
            isMobile
              ? mobileOpen
                ? "translate-x-0"
                : "-translate-x-full"
              : "translate-x-0"
          }
        `}
      >
        {/* 1. Header (Logo and Title) - Remains at the top */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 w-full">
            {/* Logo */}
            <div className="h-9 w-9 rounded-xl bg-blue-700/30 dark:bg-blue-600/10 flex items-center justify-center flex-shrink-0">
              <Send className="h-5 w-5 text-blue-500" />
            </div>

            {/* Title */}
            <span className="text-lg font-semibold text-white dark:text-slate-200">
              Campaigner
            </span>
            {/* Collapse button removed here */}
          </div>
        </div>

        {/* 2. Navigation Menu - Placed directly below the logo. Uses flex-1 to push the footer down. */}
        <nav className="flex-1 overflow-y-auto pt-4 pb-2"> 
          <ul className="px-2 space-y-1"> 
            {visibleNavItems.map(renderNavItem)}
          </ul>
        </nav>

        {/* 3. Footer - Only the copyright text at the bottom. Removed border-t. */}
        <div className="p-4">
            <p className="text-xs text-slate-300 dark:text-slate-500">
              {new Date().getFullYear()} Campaigner
            </p>
            {/* Collapse button removed here */}
        </div>
      </aside>

      {/* Content Spacer (for layout shift prevention) */}
      {!isMobile && (
        <div
          className={`${sidebarWidth} flex-shrink-0 transition-all duration-300`}
        />
      )}

      {/* Mobile Menu Button (kept for mobile functionality) */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 h-10 w-10 flex items-center justify-center 
            rounded-lg bg-blue-700 text-white shadow-lg backdrop-blur-sm dark:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </>
  );
}