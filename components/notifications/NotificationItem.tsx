import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { HiveNotification } from '~/lib/types';
import { Text } from '../ui/text';
import { ConversationDrawer } from '../Feed/ConversationDrawer';
import { getContent } from '~/lib/hive-utils';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

interface NotificationItemProps {
  notification: HiveNotification;
}

export const NotificationItem = React.memo(({ notification }: NotificationItemProps) => {
  const [isConversationDrawerVisible, setIsConversationDrawerVisible] = useState(false);
  const [postData, setPostData] = useState<Discussion | null>(null);

  // Extract author from the notification message (usually starts with @username)
  const getAuthor = (msg: string): string => {
    const match = msg.match(/@([a-zA-Z0-9.-]+)/);
    return match ? match[1] : 'user';
  };

  // Determine notification type based on message content and type
  const getNotificationType = (notification: HiveNotification): 'reply' | 'mention' | 'vote' | 'follow' | 'other' => {
    const msg = notification.msg.toLowerCase();
    const type = notification.type;
    
    // Check for replies and mentions
    if (msg.includes('replied to') || msg.includes('commented on') || type === 'reply') {
      return 'reply';
    }
    
    if (msg.includes('mentioned you') || msg.includes('mentioned') || type === 'mention') {
      return 'mention';
    }
    
    // Check for votes
    if (msg.includes('upvoted') || msg.includes('voted') || msg.includes('liked') || type === 'vote') {
      return 'vote';
    }
    
    // Check for follows
    if (msg.includes('started following') || msg.includes('followed') || type === 'follow') {
      return 'follow';
    }
    
    return 'other';
  };

  // Extract post data from notification URL for conversation drawer
  const getPostDataFromUrl = (url: string): { author: string; permlink: string } | null => {
    try {
      // Parse URLs like: /@author/permlink or /category/@author/permlink
      const match = url.match(/@([a-zA-Z0-9.-]+)\/([a-zA-Z0-9-]+)/);
      if (match) {
        return {
          author: match[1],
          permlink: match[2]
        };
      }
    } catch (error) {
      console.error('Error parsing notification URL:', error);
    }
    return null;
  };

  // Fetch the actual reply content from the notification URL
  const fetchReplyContent = async (url: string): Promise<Discussion | null> => {
    const postInfo = getPostDataFromUrl(url);
    if (!postInfo) return null;

    try {
      const content = await getContent(postInfo.author, postInfo.permlink);
      return content;
    } catch (error) {
      console.error('Error fetching reply content:', error);
      return null;
    }
  };

  // Format the notification date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'Z');
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return date.toLocaleDateString();
  };

  const handlePress = async () => {
    const notificationType = getNotificationType(notification);
    const author = getAuthor(notification.msg);
    
    try {
      if (notificationType === 'reply' || notificationType === 'mention') {
        // For replies and mentions, open conversation drawer
        const postInfo = getPostDataFromUrl(notification.url);
        if (postInfo) {
          // Fetch the actual reply content
          const replyContent = await fetchReplyContent(notification.url);
          
          // Create a discussion object for the parent post (we need the parent, not the reply itself)
          let parentDiscussion: Discussion;
          
          if (replyContent && replyContent.parent_author && replyContent.parent_permlink) {
            // Fetch the parent post
            const parentContent = await getContent(replyContent.parent_author, replyContent.parent_permlink);
            if (parentContent) {
              parentDiscussion = parentContent;
            } else {
              // Fallback: create minimal parent discussion
              parentDiscussion = {
                author: replyContent.parent_author,
                permlink: replyContent.parent_permlink,
                title: '',
                body: '',
                category: '',
                created: '',
                last_update: '',
                depth: 0,
                children: 0,
                net_rshares: '0',
                abs_rshares: '0',
                vote_rshares: '0',
                children_abs_rshares: '0',
                cashout_time: '',
                max_cashout_time: '',
                total_vote_weight: '0',
                reward_weight: 10000,
                total_payout_value: '0.000 HBD',
                curator_payout_value: '0.000 HBD',
                author_rewards: '0',
                net_votes: 0,
                root_comment: 0,
                max_accepted_payout: '1000000.000 HBD',
                percent_hbd: 10000,
                allow_replies: true,
                allow_votes: true,
                allow_curation_rewards: true,
                beneficiaries: [],
                url: `/@${replyContent.parent_author}/${replyContent.parent_permlink}`,
                pending_payout_value: '0.000 HBD',
                total_pending_payout_value: '0.000 HBD',
                active_votes: [],
                replies: [],
                author_reputation: 0,
                promoted: '0.000 HBD',
                body_length: '0',
                reblogged_by: [],
                blacklists: [],
                parent_author: '',
                parent_permlink: '',
                json_metadata: '{}',
                last_payout: '1970-01-01T00:00:00',
                active: '',
                id: 0,
                root_title: '',
                stats: {
                  hide: false,
                  gray: false,
                  total_votes: 0,
                  flag_weight: 0
                }
              } as unknown as Discussion;
            }
          } else {
            // If we can't get the reply content, create a minimal discussion for the original URL
            parentDiscussion = {
              author: postInfo.author,
              permlink: postInfo.permlink,
              title: '',
              body: '',
              category: '',
              created: '',
              last_update: '',
              depth: 0,
              children: 0,
              net_rshares: '0',
              abs_rshares: '0',
              vote_rshares: '0',
              children_abs_rshares: '0',
              cashout_time: '',
              max_cashout_time: '',
              total_vote_weight: '0',
              reward_weight: 10000,
              total_payout_value: '0.000 HBD',
              curator_payout_value: '0.000 HBD',
              author_rewards: '0',
              net_votes: 0,
              root_comment: 0,
              max_accepted_payout: '1000000.000 HBD',
              percent_hbd: 10000,
              allow_replies: true,
              allow_votes: true,
              allow_curation_rewards: true,
              beneficiaries: [],
              url: notification.url,
              pending_payout_value: '0.000 HBD',
              total_pending_payout_value: '0.000 HBD',
              active_votes: [],
              replies: [],
              author_reputation: 0,
              promoted: '0.000 HBD',
              body_length: '0',
              reblogged_by: [],
              blacklists: [],
              parent_author: '',
              parent_permlink: '',
              json_metadata: '{}',
              last_payout: '1970-01-01T00:00:00',
              active: '',
              id: 0,
              root_title: '',
              stats: {
                hide: false,
                gray: false,
                total_votes: 0,
                flag_weight: 0
              }
            } as unknown as Discussion;
          }
          
          setPostData(parentDiscussion);
          setIsConversationDrawerVisible(true);
        }
      } else {
        // For votes, follows, and other notifications, navigate to the user's profile
        router.push({
          pathname: "/(tabs)/profile",
          params: { username: author }
        });
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
      // Fallback: navigate to user profile
      router.push({
        pathname: "/(tabs)/profile",
        params: { username: author }
      });
    }
  };

  const author = getAuthor(notification.msg);
  const isUnread = !notification.isRead;

  return (
    <>
      <Pressable 
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed
        ]} 
        onPress={handlePress}
      >
        {/* Unread indicator - red dot on the right */}
        {isUnread && <View style={styles.unreadIndicator} />}
        
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: `https://images.hive.blog/u/${author}/avatar/small` }}
            style={styles.avatar}
          />
        </View>
        
        <View style={styles.content}>
          <Text style={[styles.message, isUnread && styles.unreadText]} numberOfLines={3}>
            {notification.msg}
          </Text>
          <Text style={styles.date}>
            {formatDate(notification.date)}
          </Text>
        </View>
      </Pressable>

      {/* Conversation Drawer for replies and mentions */}
      {postData && (
        <ConversationDrawer
          visible={isConversationDrawerVisible}
          onClose={() => setIsConversationDrawerVisible(false)}
          discussion={postData}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'flex-start',
    position: 'relative',
  },
  pressed: {
    backgroundColor: '#111',
  },
  unreadIndicator: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.spacing.md + 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
    zIndex: 1,
  },
  avatarContainer: {
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  message: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.regular,
  },
  unreadText: {
    fontFamily: theme.fonts.bold,
    fontWeight: 'bold',
  },
  date: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.regular,
  },
});
