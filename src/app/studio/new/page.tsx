import { Suspense } from "react";
import { SetupScreen } from "@/components/home/setup-screen";
import { Protected } from "@/components/protected";

export default function Page() {
  return (
    <Protected>
      <Suspense>
        <SetupScreen />
      </Suspense>
    </Protected>
  );
}
