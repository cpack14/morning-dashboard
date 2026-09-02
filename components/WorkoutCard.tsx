import { Card } from "@/components/Card";
import { todaysWorkout } from "@/lib/workout";

export function WorkoutCard() {
  return (
    <Card title="Workout">
      <p className="text-7xl font-semibold">{todaysWorkout()}</p>
    </Card>
  );
}
