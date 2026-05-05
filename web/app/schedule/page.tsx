import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSchedule } from "@/lib/schedule-data";
import { ScheduleView } from "./schedule-view";

export const metadata = {
  title: "Schedule · WC 2026 Forecaster",
  description: "All 104 World Cup 2026 matches in your local timezone.",
};

export default async function SchedulePage() {
  const schedule = await getSchedule();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Badge variant="outline" className="text-xs gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          11 Jun – 19 Jul 2026 · 104 matches
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground">
          All World Cup 2026 kickoffs in the timezone of your choice. Default is{" "}
          <span className="font-medium text-foreground">Europe/Berlin</span>; switch with the
          selector below.
        </p>
      </section>

      <ScheduleView matches={schedule.matches} />
    </div>
  );
}
