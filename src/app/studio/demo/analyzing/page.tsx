import { Suspense } from "react";
import { AnalyzingScreen } from "@/components/home/analyzing-screen";
import { Protected } from "@/components/protected";

export default function Page() {
  return (
    <Protected>
      <Suspense>
        <AnalyzingScreen />
      </Suspense>
    </Protected>
  );
}
