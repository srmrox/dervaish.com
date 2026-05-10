import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const workflows = ["Listen", "Companion", "Archive", "Submit", "Community", "Admin"];

function App() {
  return (
    <main className="shell">
      <aside className="nav" aria-label="Primary workflows">
        <div className="brand">
          <span className="mark">D</span>
          <div>
            <strong>Dervaish</strong>
            <span>Greenfield platform</span>
          </div>
        </div>
        <nav>
          {workflows.map((workflow) => (
            <a key={workflow} href={`#${workflow.toLowerCase()}`}>
              {workflow}
            </a>
          ))}
        </nav>
      </aside>
      <section className="content">
        <header>
          <p>Phase 1 scaffold</p>
          <h1>Preservation-focused devotional media platform</h1>
        </header>
        <div className="grid">
          <article>
            <span>Backend</span>
            <h2>Django, DRF, Celery</h2>
            <p>Core apps are scaffolded for accounts, media, catalog, archive, lyrics, community, video generation, public APIs, and admin workflows.</p>
          </article>
          <article>
            <span>Frontend</span>
            <h2>Workflow shell</h2>
            <p>The React shell establishes Dervaish navigation and design tokens without replacing the current prototype app.</p>
          </article>
          <article>
            <span>Data</span>
            <h2>Minimal seeds</h2>
            <p>Fresh role fixtures support the first implementation phase while avoiding mandatory demo-data migration.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
