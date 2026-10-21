import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMe, getErrorMessage, getStatus, isCanceled, onUnauthorized, tokenStorage } from '../api';
import { decodeJwt } from '../utils/jwt';
import { displayNameOf, initialsOf } from '../utils/patient';
import { AuthContext } from './context';

const GUEST = { status: 'guest', user: null, patient: null, record: null, expiresAt: null, notice: '', profile: 'idle', profileError: '' };

// Старт приложения: если в localStorage лежит неистёкший токен, сразу считаем пользователя вошедшим
// (e-mail берём из самого токена), а карточку пациента догружаем с сервера в фоне. Так при недоступном сервере
// пользователь видит рабочий экран с понятной ошибкой, а не пустую заставку.
function initialState() {
  const token = tokenStorage.get();
  if (!token) return GUEST;

  const payload = decodeJwt(token);
  if (!payload?.email || !payload.exp || payload.exp * 1000 <= Date.now()) {
    tokenStorage.clear();
    return { ...GUEST, notice: payload ? 'Сессия истекла. Войдите снова.' : '' };
  }
  return {
    ...GUEST,
    status: 'authed',
    user: { id: payload.id, email: payload.email, role: null, twoFactorEnabled: false },
    expiresAt: payload.exp * 1000,
    profile: 'loading', // loading | ready | error — подтянуты ли данные пользователя с сервера
  };
}

const expiryOf = (token) => {
  const exp = decodeJwt(token)?.exp;
  return exp ? exp * 1000 : null;
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);

  // Фоновая загрузка пользователя, карточки пациента и медицинской карты одним запросом GET /me
  useEffect(() => {
    if (state.status !== 'authed' || state.profile !== 'loading') return undefined;

    const controller = new AbortController();
    fetchMe(controller.signal)
      .then((me) => setState((prev) => ({ ...prev, ...me, profile: 'ready', profileError: '' })))
      .catch((error) => {
        if (isCanceled(error) || getStatus(error) === 401) return; // 401 обработает onUnauthorized
        setState((prev) => ({ ...prev, profile: 'error', profileError: getErrorMessage(error) }));
      });
    return () => controller.abort();
  }, [state.status, state.profile]);

  const signOut = useCallback((notice = '') => {
    tokenStorage.clear();
    setState({ ...GUEST, notice });
  }, []);

  // Сервер ответил 401 на запрос с токеном: срок истёк или токен отозван
  useEffect(() => onUnauthorized(() => signOut('Сессия истекла. Войдите снова.')), [signOut]);

  const signIn = useCallback(({ token, user }) => {
    tokenStorage.set(token);
    setState({ ...GUEST, status: 'authed', user, expiresAt: expiryOf(token), profile: 'loading' });
  }, []);

  // После смены пароля или почты сервер отзывает старые токены и выдаёт новый — подменяем его, чтобы не вылететь из аккаунта
  const replaceToken = useCallback((token) => {
    tokenStorage.set(token);
    setState((prev) => ({ ...prev, expiresAt: expiryOf(token) }));
  }, []);

  const updateUser = useCallback((user) => setState((prev) => ({ ...prev, user })), []);

  // Обновляет данные пациента и карты без перезагрузки страницы: шапка и все экраны сразу видят новые значения
  const updateMe = useCallback((me) => setState((prev) => ({ ...prev, ...me })), []);

  const retryProfile = useCallback(() => setState((prev) => ({ ...prev, profile: 'loading', profileError: '' })), []);

  const value = useMemo(() => ({
    ...state,
    isStaff: state.user?.role === 'staff',
    displayName: state.user ? displayNameOf(state.patient, state.user.email) : '',
    initials: state.user ? initialsOf(state.patient, state.user.email) : '',
    signIn, signOut, replaceToken, updateUser, updateMe, retryProfile,
  }), [state, signIn, signOut, replaceToken, updateUser, updateMe, retryProfile]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
