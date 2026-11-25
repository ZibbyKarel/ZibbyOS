import { Suspense } from "react";
import { ActivityLogScreen } from "../../../../features/activity/screens/ActivityLogScreen";

export default function ActivityLogPage() {
  // `useSearchParams` (the `?error=` deep link) needs a Suspense boundary.
  return (
    <Suspense>
      <ActivityLogScreen />
    </Suspense>
  );
}
