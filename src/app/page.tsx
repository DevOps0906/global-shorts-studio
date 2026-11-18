import { HomeScreen, HomeSkeleton } from "@/components/home/home-screen";
import { Protected } from "@/components/protected";
import { loadRadarData } from "@/server/radar";

async function HomeData() {
  const data = await loadRadarData();
  const hot = data && {
    items: data.items.filter((v) => v.hours <= 72).sort((a, b) => (b.views ?? -1) - (a.views ?? -1)).slice(0, 5),
    channelCount: data.channels.length,
    lastScanLabel: data.lastScanLabel,
  };
  return <HomeScreen hot={hot} />;
}

export default function Page() {
  return (
    <Protected fallback={<HomeSkeleton />}>
      <HomeData />
    </Protected>
  );
}
