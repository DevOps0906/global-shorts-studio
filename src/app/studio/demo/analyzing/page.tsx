import { Suspense } from "react";
import { AnalyzingScreen } from "@/components/home/analyzing-screen";

export default function Page() {
  return (
    <Suspense>
      <AnalyzingScreen />
    </Suspense>
  );
}
