import { useCallback, useEffect, useState, useRef } from "react";
import { ExtendedAccount } from "@hiveio/dhive";
import { HiveClient, getProfile } from "../hive-utils";

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
  const requestIdRef = useRef(0);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // Increment request ID to cancel stale responses
    const currentRequestId = ++requestIdRef.current;

    if (!username || username === 'SPECTATOR') {
      setHiveAccount(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchAccount = async () => {
      try {
        const [userData, profileData] = await Promise.all([
          HiveClient.database.getAccounts([username]),
          getProfile(username)
        ]);

        // Bail if a newer request was started
        if (currentRequestId !== requestIdRef.current) return;

        if (!userData || userData.length === 0) {
          throw new Error('Account not found');
        }

        const userAccount: HiveAccount = {
          ...userData[0],
          profile: profileData,
        };

        // Parse metadata from posting_json_metadata or json_metadata
        const rawMeta = userAccount.posting_json_metadata || userAccount.json_metadata;
        if (rawMeta) {
          try {
            userAccount.metadata = JSON.parse(rawMeta);
          } catch {
            userAccount.metadata = {};
          }
        } else {
          userAccount.metadata = {};
        }

        setHiveAccount(userAccount);
      } catch (err) {
        if (currentRequestId !== requestIdRef.current) return;
        setError((err as Error)?.message || "Failed to load account");
        setHiveAccount(null);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchAccount();
  }, [username, reloadCount]);

  // Your own profile is a tab, so it mounts once and stays mounted: without a
  // way to ask again, an avatar or bio edited elsewhere stayed stale until the
  // app was restarted (#65). A counter rather than a cache — the real fix is
  // moving this hook to React Query, which is what that issue is for.
  const refetch = useCallback(() => setReloadCount((n) => n + 1), []);

  return { hiveAccount, isLoading, error, refetch };
}
