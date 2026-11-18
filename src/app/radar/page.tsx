import { RadarView } from "@/components/radar/radar-view";
import { Protected } from "@/components/protected";

export default function Page() {
  return (
    <Protected>
      <RadarView />
    </Protected>
  );
}
