import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import MangaDetail from "./pages/MangaDetail";
import ChapterReader from "./pages/ChapterReader";
import Leaderboard from "./pages/Leaderboard";
import Contests from "./pages/Contests";
import Community from "./pages/Community";
import CreatorProfile from "./pages/CreatorProfile";
import CreatorDashboard from "./pages/CreatorDashboard";
import UserProfile from "./pages/UserProfile";
import GenrePage from "./pages/GenrePage";
import InfoPage from "./pages/InfoPages";
import Login from "./pages/Login";
import Store from "./pages/Store";
import StoreProduct from "./pages/StoreProduct";
import PaymentStatus from "./pages/PaymentStatus";
import MockPay from "./pages/MockPay";
import Library from "./pages/Library";
import Admin from "./pages/Admin";
import { AuthProvider, useAuth } from "./lib/auth";
import { FEATURES } from "./lib/features";
import { rememberRef } from "./lib/api";
import Settings from "./pages/Settings";
import Onboarding, { OnboardingGate } from "./pages/Onboarding";
import TeamInvite from "./pages/TeamInvite";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Menu, X, Trophy, Users, Sparkles, ShoppingBag, LogOut, Library as LibraryIcon, User, PenTool, Shield, Settings as SettingsIcon } from "lucide-react";
import { useLocation } from "wouter";
const logoMark = `${import.meta.env.BASE_URL}surituk-mark.svg`;

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight text-foreground ${className}`}>
      Sur<span className="text-primary">i</span>tuk
    </span>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }
});

function UserMenu() {
  const { me, logout } = useAuth();
  const [, navigate] = useLocation();
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/40 hover:border-primary transition-colors shrink-0 hidden sm:block" aria-label="Account">
        <img src={me.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="font-semibold truncate">{me.displayName}</div>
          <div className="text-xs text-muted-foreground truncate">{me.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}><User className="w-4 h-4 mr-2" /> Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/library")}><LibraryIcon className="w-4 h-4 mr-2" /> My Library</DropdownMenuItem>
        {me.creatorId
          ? <DropdownMenuItem onClick={() => navigate("/creator-dashboard")}><PenTool className="w-4 h-4 mr-2" /> Creator Studio</DropdownMenuItem>
          : <DropdownMenuItem onClick={() => navigate("/settings?tab=pro")}><PenTool className="w-4 h-4 mr-2" /> Become a Creator</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => navigate("/settings")}><SettingsIcon className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
        {me.role === "admin" && <DropdownMenuItem onClick={() => navigate("/admin")}><Shield className="w-4 h-4 mr-2" /> Admin</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { logout(); navigate("/"); }}><LogOut className="w-4 h-4 mr-2" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { me, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group" onClick={() => setMenuOpen(false)}>
            <img src={logoMark} alt="Surituk" className="w-9 h-9 object-contain transition-transform duration-500 group-hover:rotate-[-8deg]" />
            <Wordmark className="text-2xl hidden sm:block" />
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 text-sm font-medium">
            <Link href="/browse" className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 hover:text-primary text-foreground/70">
              Browse
            </Link>
            <Link href="/leaderboard" className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 hover:text-primary text-foreground/70 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </Link>
            {FEATURES.contests && <Link href="/contests" className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 hover:text-primary text-foreground/70 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Contests
            </Link>}
            <Link href="/community" className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 hover:text-primary text-foreground/70 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Community
            </Link>
            {FEATURES.store && <Link href="/store" className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 hover:text-primary text-foreground/70 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Store
            </Link>}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/browse" className="hidden lg:flex items-center w-40 h-9 px-3 rounded-lg bg-white/5 border border-border text-muted-foreground text-sm gap-2 hover:bg-white/8 transition-colors">
            <Search className="w-3.5 h-3.5 shrink-0" /> Search...
          </Link>
          {me && (
            <Link href="/profile?tab=notifications" className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground" aria-label="Notifications">
              <Bell className="w-4 h-4" />
            </Link>
          )}
          {me ? <UserMenu /> : (
            <Link href="/login" className="hidden sm:flex items-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              Log in
            </Link>
          )}
          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background/98 px-4 py-4 flex flex-col gap-1">
          {[
            { href: "/browse", label: "Browse" },
            ...(FEATURES.store ? [{ href: "/store", label: "Store" }] : []),
            { href: "/leaderboard", label: "Leaderboard" },
            ...(FEATURES.contests ? [{ href: "/contests", label: "Contests" }] : []),
            { href: "/community", label: "Community" },
            ...(me ? [
              { href: "/library", label: "My Library" },
              { href: "/profile", label: "My Profile" },
              { href: me.creatorId ? "/creator-dashboard" : "/settings?tab=pro", label: me.creatorId ? "Creator Studio" : "Become a Creator" },
              { href: "/settings", label: "Settings" },
            ] : [{ href: "/login", label: "Log in / Sign up" }]),
            ...(me?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="py-3 px-2 text-sm text-foreground/80 hover:text-primary transition-colors border-b border-white/5 last:border-0"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {me && <button onClick={() => { logout(); setMenuOpen(false); }} className="py-3 px-2 text-sm text-left text-muted-foreground hover:text-primary">Log out</button>}
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-8 mt-16">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoMark} alt="Surituk" className="w-8 h-8 object-contain" />
              <Wordmark className="text-xl" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Stories that bind. A home for graphic novels & manga — and the creators who draw them.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-sm">Platform</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/browse" className="hover:text-primary transition-colors">Browse</Link></li>
              <li><Link href="/leaderboard" className="hover:text-primary transition-colors">Leaderboard</Link></li>
              <li><Link href="/community" className="hover:text-primary transition-colors">Community</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-sm">Creators</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/settings?tab=pro" className="hover:text-primary transition-colors">Become a Creator</Link></li>
              <li><Link href="/creator-dashboard" className="hover:text-primary transition-colors">Creator Studio</Link></li>

            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-sm">Genres</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/genres/action" className="hover:text-primary transition-colors">Action</Link></li>
              <li><Link href="/genres/romance" className="hover:text-primary transition-colors">Romance</Link></li>
              <li><Link href="/genres/fantasy" className="hover:text-primary transition-colors">Fantasy</Link></li>
              <li><Link href="/genres/horror" className="hover:text-primary transition-colors">Horror</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-sm">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
              <li><Link href="/dmca" className="hover:text-primary transition-colors">DMCA</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} Surituk. All rights reserved.</span>
          <span>Built for graphic novel & manga lovers.</span>
        </div>
      </div>
    </footer>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col w-full bg-background text-foreground selection:bg-primary/30">
      <Navbar />
      <OnboardingGate />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function ReaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col w-full bg-black text-foreground">
      <main className="flex-1">{children}</main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Chapter reader — no nav/footer */}
      <Route path="/manga/:mangaId/chapter/:chapterId">
        {() => (
          <ReaderLayout>
            <ChapterReader />
          </ReaderLayout>
        )}
      </Route>
      {/* All other pages */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/browse" component={Browse} />
            <Route path="/manga/:mangaId" component={MangaDetail} />
            <Route path="/leaderboard" component={Leaderboard} />
            {FEATURES.contests && <Route path="/contests" component={Contests} />}
            <Route path="/community" component={Community} />
            <Route path="/creator/:creatorId" component={CreatorProfile} />
            <Route path="/creator-dashboard" component={CreatorDashboard} />
            <Route path="/profile" component={UserProfile} />
            <Route path="/user/:userId" component={UserProfile} />
            <Route path="/genres/:slug" component={GenrePage} />
            <Route path="/login" component={Login} />
            {FEATURES.store && <Route path="/store" component={Store} />}
            {FEATURES.store && <Route path="/store/:id" component={StoreProduct} />}
            {FEATURES.store && <Route path="/payment/status" component={PaymentStatus} />}
            {FEATURES.store && <Route path="/payment/mock" component={MockPay} />}
            <Route path="/settings" component={Settings} />
            <Route path="/welcome" component={Onboarding} />
            <Route path="/join/team/:token" component={TeamInvite} />
            <Route path="/join/creator/:token">{(p: { token: string }) => <Settings key={p.token} />}</Route>
            <Route path="/library" component={Library} />
            <Route path="/admin" component={Admin} />
            <Route path="/about" component={InfoPage} />
            <Route path="/contact" component={InfoPage} />
            <Route path="/terms" component={InfoPage} />
            <Route path="/privacy" component={InfoPage} />
            <Route path="/dmca" component={InfoPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

rememberRef();

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
