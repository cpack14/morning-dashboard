import { Clock } from "@/components/Clock";
import { WeatherCard } from "@/components/WeatherCard";
import { CommuteCard } from "@/components/CommuteCard";
import { CalendarCard } from "@/components/CalendarCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { GarminCard } from "@/components/GarminCard";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1800px] flex-col justify-center gap-10 p-16">
      <Clock />

      <div className="grid grid-cols-3 gap-10">
        <WeatherCard />
        <CommuteCard />
        <WorkoutCard />
      </div>

      <div className="grid grid-cols-3 gap-10">
        <div className="col-span-2">
          <CalendarCard />
        </div>
        <GarminCard />
      </div>
    </main>
  );
}
