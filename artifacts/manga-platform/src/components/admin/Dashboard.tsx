import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Flag, UserPlus, FileCheck2, AlertTriangle, BookX, Copyright, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { card, timeAgo } from "./shared";

export type DashboardData = {
  users: { total: number; today: number; week: number; restricted: number; banned: number };
  creators: { approved: number; suspended: number; pendingApplications: number };
  content: { stories: number; hiddenStories: number; drafts: number; chapters: number; posts: number; commentsToday: number };
  reports: { open: number; copyright: number };
  deletions: { scheduled: number };
  signupsByDay: { day: string; n: number }[];
  recentUsers: { id: number; displayName: string; username: string; email: string | null; avatar: string; joinedAt: string }[];
  storage: { mode: string; ok: boolean; persistent: boolean; error?: string; advice: string };
  settings: { newCreatorMode: string; signupsOpen: boolean; siteBanner: string; grievanceName: string; grievanceEmail: string };
};

export const useDashboard = () => useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api<DashboardData>("/admin/dashboard"), refetchInterval: 60_000 });

function Stat({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href?: string }) {
  const inner = (
    <div className={`${card} p-4 h-full ${href ? "hover:border-white/25 transition-colors" : ""}`}>
      <div className="font-display text-2xl sm:text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground/80 mt-1">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Dashboard() {
  const { data: d } = useDashboard();
  if (!d) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${card} h-24 animate-pulse`} />)}</div>;

  const todo = [
    d.reports.copyright > 0 && { icon: <Copyright className="w-4 h-4" />, text: `${d.reports.copyright} copyright claim${d.reports.copyright > 1 ? "s" : ""} waiting`, href: "/admin/reports?reason=copyright", tone: "text-red-300" },
    d.reports.open - d.reports.copyright > 0 && { icon: <Flag className="w-4 h-4" />, text: `${d.reports.open - d.reports.copyright} other report${d.reports.open - d.reports.copyright > 1 ? "s" : ""} to review`, href: "/admin/reports", tone: "text-amber-200" },
    d.creators.pendingApplications > 0 && { icon: <FileCheck2 className="w-4 h-4" />, text: `${d.creators.pendingApplications} creator application${d.creators.pendingApplications > 1 ? "s" : ""} waiting`, href: "/admin/applications", tone: "text-sky-300" },
    d.deletions.scheduled > 0 && { icon: <Trash2 className="w-4 h-4" />, text: `${d.deletions.scheduled} account deletion request${d.deletions.scheduled > 1 ? "s" : ""} scheduled`, href: "/admin/deletions", tone: "text-amber-200" },
    (!d.settings.grievanceName || !d.settings.grievanceEmail) && { icon: <AlertTriangle className="w-4 h-4" />, text: "Add the Grievance Officer's name and email (required by law)", href: "/admin/settings", tone: "text-red-300" },
    (!d.storage.ok || !d.storage.persistent) && { icon: <AlertTriangle className="w-4 h-4" />, text: "Photo storage needs attention", href: "/admin/settings", tone: "text-red-300" },
    !d.settings.signupsOpen && { icon: <UserPlus className="w-4 h-4" />, text: "New sign-ups are paused", href: "/admin/settings", tone: "text-amber-200" },
  ].filter(Boolean) as { icon: React.ReactNode; text: string; href: string; tone: string }[];

  const max = Math.max(1, ...d.signupsByDay.map(x => Number(x.n)));

  return (
    <div className="space-y-6">
      <section className={`${card} p-4 sm:p-5`}>
        <h2 className="text-lg mb-3">Needs your attention</h2>
        {todo.length ? (
          <ul className="space-y-2">
            {todo.map(t => (
              <li key={t.text}><Link href={t.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] ${t.tone}`}>{t.icon}<span className="text-sm text-foreground">{t.text}</span></Link></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">All clear. No reports, applications or warnings.</p>}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Users" value={d.users.total} sub={`+${d.users.today} today, +${d.users.week} this week`} href="/admin/users" />
        <Stat label="Creators" value={d.creators.approved} sub={d.creators.suspended ? `${d.creators.suspended} suspended or banned` : undefined} href="/admin/creators" />
        <Stat label="Live stories" value={d.content.stories} sub={`${d.content.drafts} drafts, ${d.content.hiddenStories} unlisted`} href="/admin/stories" />
        <Stat label="Open reports" value={d.reports.open} sub={d.reports.copyright ? `${d.reports.copyright} copyright` : undefined} href="/admin/reports" />
        <Stat label="Chapters" value={d.content.chapters} />
        <Stat label="Community posts" value={d.content.posts} href="/admin/community" />
        <Stat label="Comments today" value={d.content.commentsToday} href="/admin/community?tab=comments" />
        <Stat label="Restricted / banned" value={`${d.users.restricted} / ${d.users.banned}`} href="/admin/users?filter=restricted" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="text-lg mb-4">Sign-ups, last 14 days</h2>
          <div className="flex items-end gap-1.5 h-36" role="img" aria-label="Daily sign-ups">
            {d.signupsByDay.map(x => (
              <div key={x.day} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">{x.n}</span>
                <div className="w-full rounded-t bg-primary/70 group-hover:bg-primary" style={{ height: `${Math.max(3, (Number(x.n) / max) * 100)}%` }} title={`${x.day}: ${x.n}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-2"><span>{d.signupsByDay[0]?.day.slice(5)}</span><span>Today</span></div>
        </section>
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg">Newest users</h2><Link href="/admin/users?filter=new" className="text-xs text-primary">See all</Link></div>
          <ul className="space-y-2.5">
            {d.recentUsers.map(u => (
              <li key={u.id}><Link href={`/admin/users?id=${u.id}`} className="flex items-center gap-3 hover:text-primary">
                <img src={u.avatar} alt={u.displayName} className="w-8 h-8 rounded-full object-cover" />
                <span className="flex-1 min-w-0"><span className="block text-sm truncate">{u.displayName}</span><span className="block text-xs text-muted-foreground truncate">{u.email}</span></span>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(u.joinedAt)}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      </div>

      {d.content.hiddenStories > 0 && (
        <Link href="/admin/stories?filter=unlisted" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><BookX className="w-4 h-4" /> {d.content.hiddenStories} unlisted stor{d.content.hiddenStories > 1 ? "ies" : "y"}</Link>
      )}
    </div>
  );
}
