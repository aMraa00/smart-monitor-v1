import { useCallback } from 'react';
import { useI18n } from './useI18n';
import { translateApiError } from './apiErrors';

export function useApiError() {
  const { t } = useI18n();
  const message = useCallback((err) => translateApiError(err, t), [t]);
  return { message };
}
