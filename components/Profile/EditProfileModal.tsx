import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  ScrollView,
  FlatList,
  Pressable,
  Image,
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
import { ThemedLoading } from '~/components/ui/ThemedLoading';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import { HiveClient, updateProfile } from '~/lib/hive-utils';
import { uploadImageToHive } from '~/lib/upload/image-upload';

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

  const selectedCountry = useMemo(() => getCountryByName(location), [location]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
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
      const uploaded = await uploadImageToHive(
        asset.uri,
        asset.fileName || 'avatar.jpg',
        asset.mimeType || 'image/jpeg',
        { username: session.username, privateKey: session.decryptedKey },
      );
      setProfileImage(uploaded.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      showToast('Failed to upload avatar', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;

    setSaving(true);
    try {
      // Fetch current posting_json_metadata to merge
      const [account] = await HiveClient.database.getAccounts([session.username]);
      let existingProfile: Record<string, any> = {};
      try {
        const parsed = JSON.parse(account.posting_json_metadata || '{}');
        existingProfile = parsed.profile || {};
      } catch {}

      const updatedProfile = {
        ...existingProfile,
        name: name.trim(),
        about: about.trim(),
        location: location.trim(),
        website: website.trim(),
        profile_image: profileImage,
        version: 2,
      };

      await updateProfile(session.decryptedKey, session.username, updatedProfile);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Profile updated!', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      if (err.message?.includes('insufficient')) {
        showToast('Insufficient RC - wait and try again', 'error');
      } else {
        showToast(err.message || 'Failed to update profile', 'error');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !hasChanges}
            hitSlop={12}
            style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ThemedLoading size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
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
                  <ThemedLoading size="small" color={theme.colors.white} />
                ) : (
                  <Ionicons name="camera" size={16} color={theme.colors.white} />
                )}
              </View>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>About</Text>
              <Input
                value={about}
                onChangeText={setAbout}
                placeholder="Tell us about yourself"
                maxLength={500}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
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
                    <Text style={styles.countryName}>{selectedCountry.name}</Text>
                  </>
                ) : location ? (
                  <Text style={styles.countryName}>{location}</Text>
                ) : (
                  <Text style={styles.countryPlaceholder}>Select country</Text>
                )}
                <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Website</Text>
              <Input
                value={website}
                onChangeText={setWebsite}
                placeholder="https://..."
                maxLength={200}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={countryPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => setCountryPickerVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Select Country</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <Input
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search..."
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
              <Text style={styles.clearCountryText}>Clear location</Text>
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
                <Text style={styles.countryItemName}>{item.name}</Text>
                {location === item.name && (
                  <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>No countries found</Text>
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
