import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";

// Use the exact icon names from Ionicons
export type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface InfoItem {
  icon: IconName;
  title: string;
  text: string;
}

interface SpectatorInfoBaseProps {
  icon?: IconName;
  iconColor?: string;
  title: string;
  titleUppercase?: boolean;
  description: string;
  infoItems: InfoItem[];
}

export function SpectatorInfoBase({
  icon,
  iconColor,
  title,
  titleUppercase = false,
  description,
  infoItems,
}: SpectatorInfoBaseProps) {
  return (
    <>
      <View style={styles.header}>
        {icon && (
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={48} color={iconColor} />
          </View>
        )}
        <Text style={[
          styles.title,
          !icon && styles.titleNoIcon,
          titleUppercase && styles.titleUppercase
        ]}>
          {title}
        </Text>
        <Text style={styles.description}>
          {description}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        {infoItems.map((item, index) => (
          <View key={index} style={styles.infoItem}>
            <View style={styles.infoItemHeader}>
              <Ionicons name={item.icon} size={24} color={iconColor} />
              <Text style={styles.infoTitle}>{item.title}</Text>
            </View>
            <View>
              <Text style={styles.infoText}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSizes.xxxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    lineHeight: theme.fontSizes.xxxl + theme.spacing.sm,
  },
  titleNoIcon: {
    marginTop: 0,
  },
  titleUppercase: {
    textTransform: 'uppercase',
  },
  description: {
    textAlign: 'center',
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
    lineHeight: theme.fontSizes.md + theme.spacing.xs,
  },
  infoContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  infoItem: {
    width: '100%',
    padding: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.borderRadius.xl,
  },
  infoItemHeader: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  infoTitle: {
    fontFamily: theme.fonts.bold,
    marginTop: theme.spacing.sm,
    textTransform: 'uppercase',
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
    lineHeight: theme.fontSizes.lg + theme.spacing.xs,
  },
  infoText: {
    color: theme.colors.muted,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
    lineHeight: theme.fontSizes.md + theme.spacing.xs,
  },
});