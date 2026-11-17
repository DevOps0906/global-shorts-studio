import { Suspense } from "react";
import { SetupScreen } from "@/components/home/setup-screen";

export default function Page() {
  return (
    <Suspense>
      <SetupScreen />
    </Suspense>
  );
}
