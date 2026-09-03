import { Clock } from "@/components/Clock";
import { HeaderStatus } from "@/components/HeaderStatus";
import { WeatherCard } from "@/components/WeatherCard";
import { CommuteCard } from "@/components/CommuteCard";
import { CalendarCard } from "@/components/CalendarCard";
import { UpcomingEventsCard } from "@/components/UpcomingEventsCard";
import { TrafficMapCard } from "@/components/TrafficMapCard";
import { AlarmController } from "@/components/AlarmController";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh max-w-[1800px] flex-col gap-[0.8vh] overflow-hidden p-[1.5vh]">
      <AlarmController />
      <div className="flex shrink-0 items-start justify-between gap-[1vh]">
        <Clock />
        <HeaderStatus />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-[1.2vh]">
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
