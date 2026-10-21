import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Breadcrumbs from './Breadcrumbs';
import Icon from '../ui/Icon';
import Logo from '../ui/Logo';
import RetryBanner from '../ui/RetryBanner';
import { useToast } from '../ui/toastContext';

// Пункты выпадающего списка пользователя
const PATIENT_ITEMS = [
  { to: '/cabinet/card', icon: 'user', label: 'Моя медицинская карта' },
  { to: '/cabinet/tickets', icon: 'calendar', label: 'Мои талоны' },
  { to: '/cabinet/history', icon: 'list', label: 'Моя история болезни' },
  { to: '/cabinet/settings', icon: 'shield', label: 'Настройки' },
];
const STAFF_ITEMS = [
  { to: '/staff', icon: 'calendar', label: 'Регистратура: записи' },
  { to: '/cabinet/settings', icon: 'shield', label: 'Настройки' },
];

// Справа в шапке: имя, кружок с выпадающим списком и кнопка «Выйти»
function UserArea() {
  const { user, isStaff, displayName, initials, signOut } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // меню закрывается по клику снаружи и по Esc
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = isStaff ? STAFF_ITEMS : PATIENT_ITEMS;

  return (
    <div className="user-area" ref={ref}>
      <span className="user-name">{displayName}</span>
      <button type="button" className="avatar-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Меню пользователя">
        <span className="avatar">{initials}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <span>{isStaff ? 'Сотрудник регистратуры' : 'Вы вошли как'}</span>
            <strong>{user.email}</strong>
            {user.twoFactorEnabled && <span className="badge badge-ok"><Icon name="shieldCheck" size={12} />2FA включена</span>}
          </div>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
              <Icon name={item.icon} size={16} />{item.label}
            </NavLink>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-secondary btn-sm logout-btn" onClick={() => { signOut(); toast.info('Вы вышли из аккаунта'); }}>
        <Icon name="logout" size={15} /><span>Выйти</span>
      </button>
    </div>
  );
}

export default function SiteLayout() {
  const { status, isStaff } = useAuth();
  const toast = useToast();
  const { pathname } = useLocation();

  // страница не перезагружается, поэтому при переходе между разделами сами возвращаемся к началу
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="Клиника — на главную"><Logo /></NavLink>
          <nav className="nav" aria-label="Основная навигация">
            <NavLink to="/" end><Icon name="calendar" size={16} />Запись на приём</NavLink>
            {isStaff && <NavLink to="/staff"><Icon name="list" size={16} />Регистратура</NavLink>}
          </nav>
          <div className="topbar-right">
            <button type="button" className="btn btn-ghost btn-sm a11y-btn" onClick={() => toast.info('Версия для слабовидящих в разработке')} aria-label="Версия для слабовидящих" title="Версия для слабовидящих">
              <Icon name="eye" size={16} /><span>Для слабовидящих</span>
            </button>
            {status === 'authed' ? <UserArea /> : <Link to="/" className="btn btn-secondary btn-sm">Войти</Link>}
          </div>
        </div>
        <RetryBanner />
      </header>
      <main className="content">
        <Breadcrumbs />
        <Outlet />
      </main>
    </div>
  );
}
