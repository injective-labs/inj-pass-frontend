'use client';

const ACCOUNT_NAME_STORAGE_PREFIX = 'inj-pass:account-name:';
export const DEFAULT_ACCOUNT_NAME = 'Account 1';

function getAccountNameKey(address?: string) {
  return `${ACCOUNT_NAME_STORAGE_PREFIX}${(address || 'default').toLowerCase()}`;
}

export function loadAccountName(address?: string, fallbackName: string = DEFAULT_ACCOUNT_NAME) {
  if (typeof window === 'undefined') {
    return fallbackName;
  }

  try {
    const scopedValue = window.localStorage.getItem(getAccountNameKey(address));
    if (scopedValue && scopedValue.trim()) {
      return scopedValue.trim();
    }

    const fallbackValue = window.localStorage.getItem(getAccountNameKey());
    if (fallbackValue && fallbackValue.trim()) {
      return fallbackValue.trim();
    }
  } catch (error) {
    console.error('Failed to load account name:', error);
  }

  return fallbackName;
}

export function saveAccountName(name: string, address?: string) {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCOUNT_NAME;
  }

  const nextValue = name.trim() || DEFAULT_ACCOUNT_NAME;

  try {
    window.localStorage.setItem(getAccountNameKey(address), nextValue);
    window.localStorage.setItem(getAccountNameKey(), nextValue);
  } catch (error) {
    console.error('Failed to save account name:', error);
  }

  return nextValue;
}
