import { Ionicons } from "@expo/vector-icons";
import { t } from "~/lib/i18n";
import { SpectatorInfoBase } from "./SpectatorInfoBase";

// Use the exact icon names from Ionicons
type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function RewardsSpectatorInfo() {
  const rewardsInfoItems = [
    {
      icon: "trending-up-outline" as IconName,
      title: t("auth.spectator.rewards_title_1"),
      text: t("auth.spectator.rewards_text_1"),
    },
    {
      icon: "chatbubble-outline" as IconName,
      title: t("auth.spectator.rewards_title_2"),
      text: t("auth.spectator.rewards_text_2"),
    },
    {
      icon: "journal-outline" as IconName,
      title: t("auth.spectator.rewards_title_3"),
      text: t("auth.spectator.rewards_text_3"),
    },
    {
      icon: "ribbon-outline" as IconName,
      title: t("auth.spectator.rewards_title_4"),
      text: t("auth.spectator.rewards_text_4"),
    },
  ];

  return (
    <SpectatorInfoBase
      icon="megaphone-outline"
      iconColor="#34C759"
      title={t("auth.spectator.rewards_heading")}
      description={t("auth.spectator.rewards_description")}
      infoItems={rewardsInfoItems}
    />
  );
}
