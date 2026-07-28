import ScorchedGame from "./game/ScorchedGame";

export default function Home() {
  return (
    <main className="game-shell">
      <header className="game-masthead">
        <h1 className="wordmark" aria-label="Afterglow Artillery">
          <span>AFTERGLOW</span>
          <span className="wordmark-divider" aria-hidden="true">
            {"//"}
          </span>
          <span>ARTILLERY</span>
        </h1>

        <div className="session-status" aria-label="Режим: локальный бой">
          <span className="session-status-light" aria-hidden="true" />
          <span>Локальный бой</span>
        </div>
      </header>

      <section className="game-stage" aria-label="Игровое поле">
        <ScorchedGame />
      </section>

      <aside className="rotate-notice" aria-label="Подсказка ориентации">
        <div className="rotate-device" aria-hidden="true">
          <span>↻</span>
        </div>
        <p className="rotate-eyebrow">Поле боя готово</p>
        <p className="rotate-title">Поверните телефон</p>
        <p className="rotate-copy">
          Игра рассчитана на горизонтальный экран — так видны траектория,
          рельеф и все элементы управления.
        </p>
      </aside>
    </main>
  );
}
