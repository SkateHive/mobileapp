import { comment } from '../hive-utils';

export interface PostData {
  title: string;
  body: string;
  tags?: string[];
  images?: string[];
  videos?: string[];
}

export interface CreatePostOptions {
  username: string;
  privateKey: string;
  communityTag?: string;
}

/**
 * Generate a permlink for a new post
 * @param title - Post title
 * @returns Formatted permlink
 */
function generatePermlink(title?: string): string {
  const timestamp = new Date().toISOString();
  const basePermlink = title 
    ? title.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
    : 'sh';
  
  const timestampSuffix = timestamp
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 15);
  
  return `${basePermlink}-${timestampSuffix}`;
}

/**
 * Extract hashtags from text
 * @param text - Text to extract hashtags from
 * @returns Array of hashtags without the # symbol
 */
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex) || [];
  return matches.map(hashtag => hashtag.slice(1)); // Remove the '#' symbol
}

/**
 * Create a post on the Hive blockchain
 * @param postData - Post content and metadata
 * @param options - Username, private key, and community info
 * @returns Promise with broadcast result
 */
export async function createHivePost(
  postData: PostData,
  options: CreatePostOptions
): Promise<any> {
  try {
    const { username, privateKey, communityTag = 'hive-173115' } = options;
    
    // Generate permlink
    const permlink = generatePermlink(postData.title);
    
    // Extract hashtags from body
    const bodyHashtags = extractHashtags(postData.body);
    
    // Combine all tags
    const allTags = [
      communityTag,
      ...(postData.tags || []),
      ...bodyHashtags,
    ].filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
    
    // Create JSON metadata
    const jsonMetadata = {
      app: 'mycommunity-mobile',
      tags: allTags,
      ...(postData.images && postData.images.length > 0 && { images: postData.images }),
      ...(postData.videos && postData.videos.length > 0 && { videos: postData.videos }),
    };
    
    // Create the post using the comment function
    const result = await comment(
      privateKey,
      '', // parent_author (empty for top-level post)
      communityTag, // parent_permlink (community tag for top-level post)
      username, // author
      permlink, // permlink
      postData.title || '', // title
      postData.body, // body
      jsonMetadata // json_metadata
    );
    
    return result;
  } catch (error) {
    console.error('Failed to create Hive post:', error);
    throw new Error(`Post creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a comment/reply on the Hive blockchain
 * @param body - Comment body
 * @param parentAuthor - Author of the parent post (empty string for microblog)
 * @param parentPermlink - Permlink of the parent post (community tag for microblog)
 * @param options - Username, private key, and community info
 * @returns Promise with broadcast result
 */
export async function createHiveComment(
  body: string,
  parentAuthor: string,
  parentPermlink: string,
  options: CreatePostOptions
): Promise<any> {
  try {
    const { username, privateKey, communityTag = 'hive-173115' } = options;
    
    // Generate permlink for the comment
    const permlink = generatePermlink();
    
    // Extract hashtags from body
    const bodyHashtags = extractHashtags(body);
    
    // Combine community tag with body hashtags
    const allTags = [
      communityTag,
      ...bodyHashtags,
    ].filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
    
    // Create JSON metadata - always include community tag for microblog posts
    const jsonMetadata = {
      app: 'mycommunity-mobile',
      tags: allTags,
    };
    
    // Create the comment using the comment function
    const result = await comment(
      privateKey,
      parentAuthor, // parent_author
      parentPermlink, // parent_permlink
      username, // author
      permlink, // permlink
      '', // title (empty for comments)
      body, // body
      jsonMetadata // json_metadata
    );
    
    return result;
  } catch (error) {
    console.error('Failed to create Hive comment:', error);
    throw new Error(`Comment creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
