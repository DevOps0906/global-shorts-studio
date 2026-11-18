import { RadarSkeleton, RadarView } from "@/components/radar/radar-view";
import { Protected } from "@/components/protected";
import { loadRadarData } from "@/server/radar";

async function RadarData() {
  return <RadarView data={await loadRadarData()} />;
}

export default function Page() {
  return (
    <Protected fallback={<RadarSkeleton />}>
      <RadarData />
    </Protected>
  );
}
