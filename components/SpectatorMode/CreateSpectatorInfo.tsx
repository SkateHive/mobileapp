import { Ionicons } from "@expo/vector-icons";
import { t } from "~/lib/i18n";
import { SpectatorInfoBase } from "./SpectatorInfoBase";

// Use the exact icon names from Ionicons
type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function CreateSpectatorInfo() {
  const createInfoItems = [
    {
      icon: "flash-outline" as IconName,
      title: t("auth.spectator.create_title_1"),
      text: t("auth.spectator.create_text_1"),
    },
    {
      icon: "flame-outline" as IconName,
      title: t("auth.spectator.create_title_2"),
      text: t("auth.spectator.create_text_2"),
    },
    {
      icon: "eye-off-outline" as IconName,
      title: t("auth.spectator.create_title_3"),
      text: t("auth.spectator.create_text_3"),
    },
    {
      icon: "hammer-outline" as IconName,
      title: t("auth.spectator.create_title_4"),
      text: t("auth.spectator.create_text_4"),
    },
  ];

  return (
    <SpectatorInfoBase
      icon="skull-outline"
      iconColor="#34C759"
      title={t("auth.spectator.create_heading")}
      titleUppercase={true}
      description={t("auth.spectator.create_description")}
      infoItems={createInfoItems}
    />
  );
}
