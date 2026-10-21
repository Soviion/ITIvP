import { EmailCard, PasswordCard, TwoFactorCard } from '../components/SettingsCards';

export default function SettingsPage() {
  return (
    <>
      <title>Настройки — Клиника</title>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p>Почта, пароль и двухфакторная защита через Google Authenticator</p>
        </div>
      </div>
      <div className="sections">
        <EmailCard />
        <PasswordCard />
        <TwoFactorCard />
      </div>
    </>
  );
}
