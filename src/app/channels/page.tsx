import { ChannelsView } from "@/components/channels/channels-view";
import { Protected } from "@/components/protected";

export default function Page() {
  return (
    <Protected>
      <ChannelsView />
    </Protected>
  );
}
