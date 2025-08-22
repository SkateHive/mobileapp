import { useEffect, useState } from "react";
import { Client, ExtendedAccount } from "@hiveio/dhive";
import { getProfile } from "../hive-utils";

// Use the same client configuration as hive-utils.ts
const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://techcoderx.com",
  "https://api.hive.blog",
  "https://anyx.io",
  "https://hive-api.arcange.eu",
  "https://hive-api.3speak.tv",
]);

interface HiveAccountMetadataProps {
  [key: string]: any;
}

export interface HiveAccount extends ExtendedAccount {
  metadata?: HiveAccountMetadataProps;
  pending_claimed_accounts?: string | number;
  profile?: any; // Extended profile info from bridge API
}

export default function useHiveAccount(username: string | null) {
  const [hiveAccount, setHiveAccount] = useState<HiveAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleGetHiveAccount = async () => {
      if (!username || username === 'SPECTATOR') {
        setHiveAccount(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch both account data and profile data in parallel
        const [userData, profileData] = await Promise.all([
          HiveClient.database.getAccounts([username]),
          getProfile(username)
        ]);
        
        if (!userData || userData.length === 0) {
          throw new Error('Account not found');
        }

        const userAccount: HiveAccount = {
          ...userData[0],
          profile: profileData, // Add the extended profile info
        };

        // Parse metadata from posting_json_metadata or json_metadata
        if (userAccount.posting_json_metadata) {
          try {
            userAccount.metadata = JSON.parse(userAccount.posting_json_metadata);
          } catch (e) {
            console.warn("Failed to parse posting_json_metadata:", e);
            userAccount.metadata = {};
          }
        } else if (userAccount.json_metadata) {
          try {
            userAccount.metadata = JSON.parse(userAccount.json_metadata);
          } catch (e) {
            console.warn("Failed to parse json_metadata:", e);
            userAccount.metadata = {};
          }
        } else {
          userAccount.metadata = {};
        }

        setHiveAccount(userAccount);
      } catch (error) {
        setError("Loading account error!");
        setHiveAccount(null);
      } finally {
        setIsLoading(false);
      }
    };

    handleGetHiveAccount();
  }, [username]);

  return { hiveAccount, isLoading, error };
}
