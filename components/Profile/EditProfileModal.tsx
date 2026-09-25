import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Text } from '~/components/ui/text';
import { Input } from '~/components/ui/input';
import { theme } from '~/lib/theme';
import { t, locale } from '~/lib/i18n';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import { HiveClient } from '~/lib/hive-utils';
import { uploadImageToHive, uploadImageViaUserbase } from '~/lib/upload/image-upload';
import { isUserbaseSession, updateProfile } from '~/lib/posting';
import { getIgHandle, setIgHandle as setIgHandleApi, deleteIgHandle, hasEligibleHiveAccount } from '~/lib/instagram';
import { InstagramHandleModal } from '~/components/Instagram/InstagramHandleModal';

const COUNTRIES = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
];

// The English `name` is what gets saved to the Hive profile; only the label on screen is translated.
function countryLabel(country: { code: string }): string {
  return t(`profile.country.${country.code.toLowerCase()}`);
}

function getCountryByName(name: string) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return COUNTRIES.find(
    (c) => c.name.toLowerCase() === lower || c.code.toLowerCase() === lower
  );
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentProfile: {
    name?: string;
    about?: string;
    location?: string;
    website?: string;
    profile_image?: string;
    cover_image?: string;
  };
  onSaved: () => void;
}

export function EditProfileModal({ visible, onClose, currentProfile, onSaved }: EditProfileModalProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [profileImage, setProfileImage] = useState('');

  // Instagram handle — shown only for accounts with an eligible (>=100 HP) Hive
  // account: key accounts, or email accounts with an eligible attached Hive.
  const [igEligible, setIgEligible] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [igModalVisible, setIgModalVisible] = useState(false);
  const [igSaving, setIgSaving] = useState(false);

  useEffect(() => {
    if (!visible || !session) return;
    let cancelled = false;
    (async () => {
      const ok = await hasEligibleHiveAccount(session);
      if (cancelled) return;
      setIgEligible(ok);
      if (ok) {
        const { handle } = await getIgHandle(session);
        if (!cancelled) setInstagramHandle(handle || '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const saveInstagram = async (handle: string) => {
    if (!session) return setIgModalVisible(false);
    try {
      setIgSaving(true);
      await setIgHandleApi(handle, session);
      setInstagramHandle(handle);
      showToast(t('profile.ig.handle_saved'), 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('profile.ig.save_error'), 'error');
    } finally {
      setIgSaving(false);
      setIgModalVisible(false);
    }
  };

  const removeInstagram = async () => {
    if (!session) return setIgModalVisible(false);
    try {
      setIgSaving(true);
      await deleteIgHandle(session);
      setInstagramHandle('');
    } finally {
      setIgSaving(false);
      setIgModalVisible(false);
    }
  };

  const selectedCountry = useMemo(() => getCountryByName(location), [location]);

  const filteredCountries = useMemo(() => {
    const byLabel = [...COUNTRIES].sort((a, b) => countryLabel(a).localeCompare(countryLabel(b), locale));
    if (!countrySearch) return byLabel;
    const q = countrySearch.toLowerCase();
    return byLabel.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        countryLabel(c).toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Sync form when modal opens
  useEffect(() => {
    if (visible) {
      setName(currentProfile.name || '');
      setAbout(currentProfile.about || '');
      setLocation(currentProfile.location || '');
      setWebsite(currentProfile.website || '');
      setProfileImage(currentProfile.profile_image || '');
    }
  }, [visible]);

  const pickAvatar = async () => {
    if (!session) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);

    try {
      // Email (userbase) accounts have no local key to sign the image
      // challenge, so the server signs + uploads on their behalf.
      const uploaded = isUserbaseSession(session)
        ? await uploadImageViaUserbase(
            asset.uri,
            asset.fileName || 'avatar.jpg',
            asset.mimeType || 'image/jpeg',
            session.userbaseToken!,
          )
        : await uploadImageToHive(
            asset.uri,
            asset.fileName || 'avatar.jpg',
            asset.mimeType || 'image/jpeg',
            { username: session.username, privateKey: session.decryptedKey },
          );
      setProfileImage(uploaded.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      showToast(t('profile.edit.avatar_error'), 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;

    setSaving(true);
    try {
      const formFields: Record<string, any> = {
        name: name.trim(),
        about: about.trim(),
        location: location.trim(),
        website: website.trim(),
        profile_image: profileImage,
        version: 2,
      };

      // Email (userbase) accounts: the server merges these fields over the
      // current on-chain profile of the account it actually signs as, so we
      // send only the form fields (session.username may not be that account).
      // Classic key accounts sign locally, so merge the current profile here.
      let updatedProfile = formFields;
      if (!isUserbaseSession(session)) {
        const [account] = await HiveClient.database.getAccounts([session.username]);
        let existingProfile: Record<string, any> = {};
        try {
          const parsed = JSON.parse(account?.posting_json_metadata || '{}');
          existingProfile = parsed.profile || {};
        } catch {}
        updatedProfile = { ...existingProfile, ...formFields };
      }

      await updateProfile(session, updatedProfile);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('profile.edit.saved'), 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      // The Hive node reports a lack of resource credits in English, so this match stays on its text.
      if (err.message?.includes('insufficient')) {
        showToast(t('profile.edit.rc_error'), 'error');
      } else {
        showToast(err.message || t('profile.edit.save_error'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    name !== (currentProfile.name || '') ||
    about !== (currentProfile.about || '') ||
    location !== (currentProfile.location || '') ||
    website !== (currentProfile.website || '') ||
    profileImage !== (currentProfile.profile_image || '');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('profile.edit.title')}</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !hasChanges}
            hitSlop={12}
            style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <Pressable onPress={pickAvatar} style={styles.avatarSection}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={32} color={theme.colors.muted} />
                </View>
              )}
              <View style={styles.avatarOverlay}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Ionicons name="camera" size={16} color={theme.colors.white} />
                )}
              </View>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.edit.label_name')}</Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('profile.edit.placeholder_name')}
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.edit.label_about')}</Text>
              <Input
                value={about}
                onChangeText={setAbout}
                placeholder={t('profile.edit.placeholder_about')}
                maxLength={500}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.edit.label_location')}</Text>
              <Pressable
                style={styles.countryPicker}
                onPress={() => {
                  setCountrySearch('');
                  setCountryPickerVisible(true);
                }}
              >
                {selectedCountry ? (
                  <>
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryName}>{countryLabel(selectedCountry)}</Text>
                  </>
                ) : location ? (
                  <Text style={styles.countryName}>{location}</Text>
                ) : (
                  <Text style={styles.countryPlaceholder}>{t('profile.edit.select_country')}</Text>
                )}
                <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.edit.label_website')}</Text>
              <Input
                value={website}
                onChangeText={setWebsite}
                placeholder="https://..."
                maxLength={200}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            {igEligible && (
              <View style={styles.field}>
                <Text style={styles.label}>Instagram</Text>
                <Pressable style={styles.countryPicker} onPress={() => setIgModalVisible(true)}>
                  {instagramHandle ? (
                    <Text style={styles.countryName}>@{instagramHandle}</Text>
                  ) : (
                    <Text style={styles.countryPlaceholder}>
                      {t('profile.edit.ig_placeholder')}
                    </Text>
                  )}
                  <Ionicons name="logo-instagram" size={16} color={theme.colors.muted} />
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InstagramHandleModal
        visible={igModalVisible}
        initialHandle={instagramHandle}
        saving={igSaving}
        onSave={saveInstagram}
        onRemove={removeInstagram}
        onClose={() => setIgModalVisible(false)}
      />

      {/* Country Picker Modal */}
      <Modal visible={countryPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => setCountryPickerVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('profile.edit.country_title')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <Input
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={t('profile.edit.search_placeholder')}
              style={styles.searchInput}
              autoFocus
            />
          </View>
          {location ? (
            <Pressable
              style={styles.clearCountry}
              onPress={() => {
                setLocation('');
                setCountryPickerVisible(false);
              }}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.clearCountryText}>{t('profile.edit.clear_location')}</Text>
            </Pressable>
          ) : null}
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.countryItem,
                  location === item.name && styles.countryItemSelected,
                ]}
                onPress={() => {
                  setLocation(item.name);
                  setCountryPickerVisible(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.countryItemFlag}>{item.flag}</Text>
                <Text style={styles.countryItemName}>{countryLabel(item)}</Text>
                {location === item.name && (
                  <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>{t('profile.edit.no_countries')}</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  content: {
    flex: 1,
  },
  avatarRow: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  avatarSection: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: theme.spacing.sm,
  },
  countryPicker: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  countryPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    height: 40,
  },
  clearCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  clearCountryText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  countryItemSelected: {
    backgroundColor: 'rgba(50, 205, 50, 0.08)',
  },
  countryItemFlag: {
    fontSize: 24,
  },
  countryItemName: {
    flex: 1,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  emptySearch: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptySearchText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
});
