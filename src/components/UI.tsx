import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'warning' | 'success';
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
  warning: { container: { backgroundColor: '#FB8C00' }, text: { color: '#FFFFFF' } },
  success: { container: { backgroundColor: '#43A047' }, text: { color: '#FFFFFF' } },
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
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[styles.buttonText, vs.text]}>{children}</Text>
      ) : (
        <View style={styles.buttonRow}>
          {React.Children.map(children, (child) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <Text style={[styles.buttonText, vs.text]}>{child}</Text>
            ) : (
              child
            )
          )}
        </View>
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
  type?: 'text' | 'password' | 'email' | 'textarea' | 'number';
  style?: StyleProp<TextStyle>;
}

export const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChangeText,
  type = 'text',
  style,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';

  return (
    <View style={styles.inputContainer}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPasswordType && !showPassword}
        keyboardType={type === 'email' ? 'email-address' : type === 'number' ? 'numeric' : 'default'}
        autoCapitalize={type === 'email' ? 'none' : 'sentences'}
        multiline={type === 'textarea'}
        numberOfLines={type === 'textarea' ? 5 : 1}
        style={[
          styles.input,
          type === 'textarea' && styles.textarea,
          isPasswordType && { paddingRight: 50 },
          style
        ]}
      />
      {isPasswordType && (
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setShowPassword(!showPassword)}
          activeOpacity={0.7}
        >
          <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

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
  inputContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
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
  eyeIcon: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
