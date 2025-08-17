import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, TouchableOpacity, Linking, StyleSheet, Image } from "react-native";
import { Text } from "~/components/ui/text";
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { IconName, SpectatorInfoBase } from "./SpectatorInfoBase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { theme } from "~/lib/theme";

interface SocialLink {
  name: string;
  icon?: string;
  imageUrl?: string;
  color: string;
  url: string;
}

export function ProfileSpectatorInfo() {
  const socialLinks: SocialLink[] = [
    { 
      name: 'X', 
      imageUrl: 'local://logo-white.png',
      color: '#FFFFFF', 
      url: 'https://x.com/skatehive' 
    },
    { 
      name: 'Instagram', 
      icon: 'instagram', 
      color: '#E4405F', 
      url: 'https://instagram.com/skatehive' 
    },
    { 
      name: 'Discord', 
      imageUrl: 'local://Discord-Symbol-Blurple.png',
      color: '#5865F2', 
      url: 'https://discord.gg/caUtgq3XPC' 
    },
    { 
      name: 'GitHub', 
      icon: 'github', 
      color: '#FFFFFF', 
      url: 'https://github.com/skatehive' 
    }
  ];
  
  const openSocialLink = (url: string) => {
    Linking.openURL(url).catch(err => 
      console.error('Error opening URL:', err)
    );
  };

  const infoItems = [
    {
      icon: "videocam-outline" as IconName,
      title: "Watch",
      text: "Watch this. Get hyped. Understand.",
    },
    {
      icon: "key-outline" as IconName,
      title: "Invitation Only",
      text: "You need an invite. No invite? No ride.",
    },
    {
      icon: "search-outline" as IconName,
      title: "Find Us",
      text: "Find us. We lurk where skaters roll.",
    },
    {
      icon: "logo-discord" as IconName,
      title: "Connect",
      text: "Instagram or Discord? If you know, you know.",
    },
  ];

  return (
    <Card style={styles.card}>
      <CardContent style={styles.cardContent}>
        <SpectatorInfoBase
          iconColor={theme.colors.primary}
          title="No Pass? No Session."
          description="You gotta earn your way in. No brands, no corporations, just raw skate energy. Ready?"
          infoItems={infoItems}
        />
        
        {/* Video Player Section */}
        <View style={styles.videoContainer}>
          <VideoPlayer
            url={'https://ipfs.skatehive.app/ipfs/QmYuM1h51bddDuC44FoAQYp9FRF2CghCncULeS4T3bp727'}
            playing={false}
          />
        </View>
      </CardContent>
        
      <CardFooter style={styles.cardFooter}>
        <CardTitle style={styles.cardTitle}>
          Find Us
        </CardTitle>
        
        <View style={styles.socialLinksContainer}>
          {socialLinks.map((link) => (
            <TouchableOpacity 
              key={link.name} 
              onPress={() => openSocialLink(link.url)}
              accessibilityLabel={`${link.name} social media link`}
              accessibilityRole="link"
              style={styles.socialLink}
            >
              <View style={link.name === 'X' ? [styles.socialLinkContent, styles.xIconContent] : styles.socialLinkContent}>
                {link.imageUrl ? (
                  <Image 
                    source={
                      link.imageUrl.startsWith('local://') 
                        ? link.imageUrl === 'local://logo-white.png'
                          ? require('../../assets/images/logo-white.png')
                          : require('../../assets/images/Discord-Symbol-Blurple.png')
                        : { uri: link.imageUrl }
                    }
                    style={link.name === 'X' ? styles.xLogoImage : styles.socialIconImage}
                    resizeMode="contain"
                  />
                ) : (
                  <FontAwesome name={link.icon as any} size={32} color={link.color} />
                )}
                <Text style={link.name === 'X' ? [styles.socialLinkText, styles.xTextAlignment] : styles.socialLinkText}>{link.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </CardFooter>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  cardContent: {
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cardFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  cardTitle: {
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    lineHeight: theme.fontSizes.xl + theme.spacing.xs,
  },
  socialLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  socialLink: {
    // No specific styling needed for TouchableOpacity
  },
  socialLinkContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 64,
  },
  socialLinkText: {
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  socialIconImage: {
    width: 32,
    height: 32,
  },
  xLogoImage: {
    width: 24,
    height: 24,
    marginTop: 4,
  },
  xTextAlignment: {
    marginTop: 0,
  },
  xIconContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
