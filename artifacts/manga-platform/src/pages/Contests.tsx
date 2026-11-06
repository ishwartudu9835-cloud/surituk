import { useState } from "react";
import { useListContests, useGetContest, useGetContestWinners, getGetContestQueryKey, getGetContestWinnersQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, Users, Zap, Award, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ContestCard({ contestId }: { contestId: number }) {
  const { data: contest } = useGetContest(contestId, {
    query: { queryKey: getGetContestQueryKey(contestId) }
  });
  const { data: winners } = useGetContestWinners(contestId, {
    query: { queryKey: getGetContestWinnersQueryKey(contestId) }
  });
  const [expanded, setExpanded] = useState(false);

  if (!contest) return <Skeleton className="h-48 rounded-xl" />;

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ended: "bg-white/10 text-muted-foreground border-white/20",
  };
  const typeLabels: Record<string, string> = {
    weekly_quiz: "Weekly Quiz",
    monthly_mega: "Monthly Mega Quiz",
    special: "Special Event",
  };

  const daysLeft = Math.max(0, Math.ceil((new Date(contest.endDate).getTime() - Date.now()) / 86400000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all overflow-hidden ${contest.status === "active" ? "border-primary/30 bg-primary/5" : "border-white/10 bg-card/30"}`}
      data-testid={`card-contest-${contestId}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className={statusColors[contest.status]}>{contest.status}</Badge>
              <Badge variant="secondary" className="text-xs">{typeLabels[contest.type] || contest.type}</Badge>
            </div>
            <h3 className="text-lg font-bold">{contest.title}</h3>
            <p className="text-muted-foreground text-sm mt-1">{contest.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-primary">{contest.prizePool}</div>
            <div className="text-xs text-muted-foreground">Prize Pool</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{(contest.participantCount ?? 0).toLocaleString()} participants</span>
          <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-yellow-400" />{contest.entryTokenCost} tokens to enter</span>
          {contest.status === "active" && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-green-400" />{daysLeft} days left</span>}
          {contest.status === "upcoming" && <span className="text-blue-400">Starts {new Date(contest.startDate).toLocaleDateString()}</span>}
          {contest.status === "ended" && <span>Ended {new Date(contest.endDate).toLocaleDateString()}</span>}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
          data-testid={`button-expand-${contestId}`}
        >
          {expanded ? "Hide details" : "View details"}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-0 border-t border-white/10 mt-0 pt-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Rules */}
                {contest.rules && contest.rules.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Rules</h4>
                    <ul className="space-y-2">
                      {contest.rules.map((rule, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Prizes */}
                {contest.prizes && contest.prizes.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Prizes</h4>
                    <div className="space-y-2">
                      {contest.prizes.map((prize) => (
                        <div key={prize.place} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                          <Award className={`w-5 h-5 ${prize.place === 1 ? "text-yellow-400" : prize.place === 2 ? "text-slate-300" : "text-amber-600"}`} />
                          <span className="text-sm font-medium">#{prize.place}</span>
                          <span className="text-sm text-muted-foreground">{prize.reward}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Winners */}
              {contest.status === "ended" && winners && winners.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3 text-sm">Winners</h4>
                  <div className="flex flex-wrap gap-3">
                    {winners.map(w => (
                      <div key={w.userId} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                        <img src={w.avatar} alt={w.username} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-medium">#{w.place} {w.username}</p>
                          <p className="text-xs text-muted-foreground">{w.prize}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Contests() {
  const { data: contests, isLoading } = useListContests();

  const active = contests?.filter(c => c.status === "active") ?? [];
  const upcoming = contests?.filter(c => c.status === "upcoming") ?? [];
  const ended = contests?.filter(c => c.status === "ended") ?? [];

  return (
    <div className="container px-4 py-8">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-2">Contests & Quizzes</h1>
        <p className="text-muted-foreground">Test your manga knowledge and win real prizes</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Active Now
              </h2>
              <div className="space-y-4">{active.map(c => <ContestCard key={c.id} contestId={c.id} />)}</div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Coming Soon</h2>
              <div className="space-y-4">{upcoming.map(c => <ContestCard key={c.id} contestId={c.id} />)}</div>
            </section>
          )}
          {ended.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 text-muted-foreground">Past Contests</h2>
              <div className="space-y-4">{ended.map(c => <ContestCard key={c.id} contestId={c.id} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
