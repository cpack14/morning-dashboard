import { Clock } from "@/components/Clock";
import { WeatherCard } from "@/components/WeatherCard";
import { CommuteCard } from "@/components/CommuteCard";
import { CalendarCard } from "@/components/CalendarCard";
import { UpcomingEventsCard } from "@/components/UpcomingEventsCard";
import { TrafficMapCard } from "@/components/TrafficMapCard";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh max-w-[1800px] flex-col gap-[2vh] overflow-hidden p-[2.5vh]">
      <div className="shrink-0">
        <Clock />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-[2vh]">
        <WeatherCard />
        <CommuteCard />
        <div className="row-span-2 min-h-0">
          <TrafficMapCard />
        </div>
        <CalendarCard />
        <UpcomingEventsCard />
      </div>
    </main>
  );
}
