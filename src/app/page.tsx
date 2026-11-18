import { HomeScreen } from "@/components/home/home-screen";
import { Protected } from "@/components/protected";

export default function Page() {
  return (
    <Protected>
      <HomeScreen />
    </Protected>
  );
}
