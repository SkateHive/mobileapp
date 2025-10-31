import React, { useState } from 'react';
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '~/components/ui/text';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { submitAccountCreationRequest } from '~/lib/hive-utils';
import { theme } from '~/lib/theme';

interface CreateAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateAccountModal({ visible, onClose }: CreateAccountModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateUsername = (username: string): boolean => {
    // HIVE username requirements:
    // - 3-16 characters
    // - lowercase letters, numbers, and hyphens only
    // - must start with a letter
    // - cannot end with a hyphen
    const usernameRegex = /^[a-z][a-z0-9-]{2,15}$/;
    if (!usernameRegex.test(username)) {
      return false;
    }
    if (username.endsWith('-')) {
      return false;
    }
    return true;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    setError('');

    // Validate username
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!validateUsername(username.toLowerCase().trim())) {
      setError(
        'Username must be 3-16 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens'
      );
      return;
    }

    // Validate email
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitAccountCreationRequest(username, email);
      setShowSuccess(true);
      setUsername('');
      setEmail('');
    } catch (error) {
      console.error('Error submitting account request:', error);
      setError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setEmail('');
    setError('');
    setShowSuccess(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {showSuccess ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={64} color={theme.colors.primary} />
                <Text style={styles.successTitle}>Request Submitted!</Text>
                <Text style={styles.successMessage}>
                  Your account creation request has been submitted successfully.
                  {'\n\n'}
                  You should receive an email at <Text style={styles.emailHighlight}>{email}</Text> with instructions on how to complete your account setup.
                  {'\n\n'}
                  Please check your inbox (and spam folder) within the next 24-48 hours.
                </Text>
                <Button onPress={handleClose} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Button>
              </View>
            ) : (
              <>
                <Text style={styles.description}>
                  Enter your desired username and email address. We'll send you instructions to complete your account setup.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Username</Text>
                  <Input
                    value={username}
                    onChangeText={setUsername}
                    placeholder="e.g., johndoe"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <Text style={styles.hint}>
                    3-16 characters, lowercase letters, numbers, and hyphens only
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your.email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={styles.submitButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={theme.colors.background} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  )}
                </Button>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.lg,
  },
  description: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.bold,
  },
  input: {
    marginBottom: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginTop: theme.spacing.xxs,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: '#ef4444',
    fontSize: theme.fontSizes.sm,
  },
  submitButton: {
    marginTop: theme.spacing.md,
  },
  submitButtonText: {
    fontSize: theme.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.fonts.bold,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  successTitle: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.bold,
    paddingTop: theme.spacing.xs,
    lineHeight: 32,
  },
  successMessage: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  emailHighlight: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  doneButton: {
    minWidth: 120,
  },
  doneButtonText: {
    fontSize: theme.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.fonts.bold,
  },
});
