import AppointmentList from './components/AppointmentList';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="logo" aria-hidden="true">+</div>
        <div>
          <h1>Система управления клиникой</h1>
          <p>Клиентская часть: записи на приём. Данные хранятся в localStorage браузера.</p>
        </div>
      </header>
      <main>
        <AppointmentList />
      </main>
    </div>
  );
}
