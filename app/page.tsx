import { Clock } from "@/components/Clock";
import { WeatherCard } from "@/components/WeatherCard";
import { CommuteCard } from "@/components/CommuteCard";
import { CalendarCard } from "@/components/CalendarCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { GarminCard } from "@/components/GarminCard";
import { ViewportDebug } from "@/components/ViewportDebug";

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh max-w-[1800px] flex-col gap-[2vh] overflow-hidden p-[2.5vh]">
      <ViewportDebug />
      <div className="shrink-0">
        <Clock />
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-[2vh]">
        <WeatherCard />
        <CommuteCard />
        <WorkoutCard />
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-[2vh]">
        <div className="col-span-2 min-h-0">
          <CalendarCard />
        </div>
        <GarminCard />
      </div>
    </main>
  );
}
