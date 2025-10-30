import { Send, User } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <Link to="/" className="flex items-center gap-2">
        <Send className="h-7 w-7 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Campaigns</h1>
      </Link>
      <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors">
        <User className="h-5 w-5 text-muted-foreground" />
      </button>
    </header>
  );
};
