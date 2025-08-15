import { Ionicons } from "@expo/vector-icons";
import { SpectatorInfoBase } from "./SpectatorInfoBase";

// Use the exact icon names from Ionicons
type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function RewardsSpectatorInfo() {
  const rewardsInfoItems = [
    {
      icon: "trending-up-outline" as IconName,
      title: "Curation Rewards",
      text: "Earn rewards by upvoting and engaging with content. The more you curate, the more you earn!",
    },
    {
      icon: "chatbubble-outline" as IconName,
      title: "Comment Rewards",
      text: "Get rewarded for interacting with posts. Valuable comments can earn upvotes too!",
    },
    {
      icon: "journal-outline" as IconName,
      title: "Magazine Rewards",
      text: "Participate in SkateHive's Magazine and earn extra incentives for your contributions.",
    },
    {
      icon: "ribbon-outline" as IconName,
      title: "More Ways to Earn",
      text: "Through contests, engagement, and consistent contributions, you can unlock even more rewards.",
    },
  ];

  return (
    <SpectatorInfoBase
      icon="megaphone-outline"
      iconColor="#34C759"
      title="Rewards"
      description="Learn how you can earn rewards in the SkateHive community!"
      infoItems={rewardsInfoItems}
    />
  );
}
