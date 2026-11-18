import { ChannelsSkeleton, ChannelsView } from "@/components/channels/channels-view";
import { Protected } from "@/components/protected";
import { loadRadarData } from "@/server/radar";

async function ChannelsData() {
  return <ChannelsView data={await loadRadarData(false)} />;
}

export default function Page() {
  return (
    <Protected fallback={<ChannelsSkeleton />}>
      <ChannelsData />
    </Protected>
  );
}
