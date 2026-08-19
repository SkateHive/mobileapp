import { useQuery } from "@tanstack/react-query";
import { ExtendedAccount } from "@hiveio/dhive";
import { HiveClient, getProfile, isMissingAccountError } from "~/lib/hive-utils";

interface HiveAccountMetadataProps {
  [key: string]: any;
}

export interface HiveAccount extends ExtendedAccount {
  metadata?: HiveAccountMetadataProps;
  pending_claimed_accounts?: string | number;
  profile?: any; // Extended profile info from bridge API
}

// The profile header is the most-opened screen in the app and its data barely
// moves — an avatar, a bio, a follower count. Five minutes matches useProfile,
// which reads the same account from the API side (#65).
const HIVE_ACCOUNT_STALE_TIME = 1000 * 60 * 5;

async function fetchHiveAccount(username: string): Promise<HiveAccount> {
  const [userData, profileData] = await Promise.all([
    HiveClient.database.getAccounts([username]),
    getProfile(username),
  ]);

  if (!userData || userData.length === 0) {
    throw new Error("Account not found");
  }

  const userAccount: HiveAccount = {
    ...userData[0],
    profile: profileData,
  };

  // Parse metadata from posting_json_metadata or json_metadata
  const rawMeta = userAccount.posting_json_metadata || userAccount.json_metadata;
  try {
    userAccount.metadata = rawMeta ? JSON.parse(rawMeta) : {};
  } catch {
    userAccount.metadata = {};
  }

  return userAccount;
}

export default function useHiveAccount(username: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hiveAccount", username],
    queryFn: () => fetchHiveAccount(username as string),
    enabled: !!username && username !== "SPECTATOR",
    staleTime: HIVE_ACCOUNT_STALE_TIME,
    // A handle that is not on chain is an answer, not a failure. The global
    // default retries twice with backoff, which would sit a lite account in
    // front of a spinner for seconds before its explainer card appears (#61).
    retry: (failureCount, err) => !isMissingAccountError(err) && failureCount < 2,
  });

  return {
    hiveAccount: data ?? null,
    isLoading,
    // Callers match on the text (isMissingAccountError), so hand them the
    // message rather than the Error, the way this hook always has.
    error: error ? error.message : null,
    refetch,
  };
}
