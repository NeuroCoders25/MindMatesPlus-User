import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  TextInput,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS } from '../services/dataService';

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const buttonVariants: Record<string, { container: ViewStyle; text: TextStyle }> = {
  primary:   { container: { backgroundColor: COLORS.primary },     text: { color: COLORS.white } },
  secondary: { container: { backgroundColor: COLORS.accentLight }, text: { color: COLORS.white } },
  danger:    { container: { backgroundColor: '#EF4444' },           text: { color: COLORS.white } },
  ghost:     { container: { backgroundColor: 'transparent' },       text: { color: COLORS.accent } },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.accent },
    text: { color: COLORS.accent },
  },
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  style,
  disabled,
}) => {
  const vs = buttonVariants[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.buttonBase, vs.container, disabled && styles.disabled, style]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.buttonText, vs.text]}>{children}</Text>
      ) : (
        <View style={styles.buttonRow}>{children}</View>
      )}
    </TouchableOpacity>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  type?: 'text' | 'password' | 'email' | 'textarea';
  style?: StyleProp<TextStyle>;
}

export const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChangeText,
  type = 'text',
  style,
}) => (
  <TextInput
    placeholder={placeholder}
    placeholderTextColor={COLORS.muted}
    value={value}
    onChangeText={onChangeText}
    secureTextEntry={type === 'password'}
    keyboardType={type === 'email' ? 'email-address' : 'default'}
    autoCapitalize={type === 'email' ? 'none' : 'sentences'}
    multiline={type === 'textarea'}
    numberOfLines={type === 'textarea' ? 5 : 1}
    style={[styles.input, type === 'textarea' && styles.textarea, style]}
  />
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  buttonBase: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  input: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(219, 234, 254, 0.3)',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    color: COLORS.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
