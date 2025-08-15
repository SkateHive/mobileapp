import { Ionicons } from "@expo/vector-icons";
import { SpectatorInfoBase } from "./SpectatorInfoBase";

// Use the exact icon names from Ionicons
type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function CreateSpectatorInfo() {
  const createInfoItems = [
    {
      icon: "flash-outline" as IconName,
      title: "GET PAID. FOR REAL",
      text: "No shadowbans. No demonetization. Get paid for every post, comment, and share.",
    },
    {
      icon: "flame-outline" as IconName,
      title: "BUILD YOUR CREW",
      text: "Your followers? They actually see your content. Grow without begging algorithms.",
    },
    {
      icon: "eye-off-outline" as IconName,
      title: "NO CENSORSHIP. NO BS",
      text: "Say what you want. Create what you want. No suits deciding what's 'allowed'.",
    },
    {
      icon: "hammer-outline" as IconName,
      title: "BE YOUR OWN PLATFORM",
      text: "Web3 means you own your content. No bans. No takedowns. No begging for ad revenue.",
    },
  ];

  return (
    <SpectatorInfoBase
      icon="skull-outline"
      iconColor="#34C759"
      title="F*ck Web2"
      titleUppercase={true}
      description="Own Your Content. No ads. No overlords. Just you, your content, and your rewards."
      infoItems={createInfoItems}
    />
  );
}
