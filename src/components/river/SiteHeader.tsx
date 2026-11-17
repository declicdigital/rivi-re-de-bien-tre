import { useEffect, useState } from "react";
import { ChevronDown, Menu, X, ArrowUpRight } from "lucide-react";
import { NAV } from "./nav";

type Props = { active: string | null; onNavigate: (id: string) => void };

export function SiteHeader({ active, onNavigate }: Props) {
  const [open, setOpen] = useState<string | null>(null); // menu déroulant ouvert (desktop)
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (id: string) => {
    setOpen(null);
    setMobile(false);
    onNavigate(id);
  };

  const isActive = (item: (typeof NAV)[number]) =>
    "children" in item ? item.children.some((c) => c.target === active) : item.target === active;

  return (
    <>
      <header className="rj-header" onMouseLeave={() => setOpen(null)}>
        <button className="rj-logo" onClick={() => go("top")} aria-label="Retour au début">
          <span className="rj-logo-mark" aria-hidden>
            <svg viewBox="0 0 32 32">
              <path d="M2 18c5-6 9-6 14 0s9 6 14 0" />
              <path d="M2 24c5-6 9-6 14 0s9 6 14 0" opacity=".5" />
            </svg>
          </span>
          <span className="rj-logo-text">
            Enaloël Perriollat
            <small>Masseuse fascialiste</small>
          </span>
        </button>

        <nav className="rj-nav" aria-label="Menu principal">
          {NAV.map((item) =>
            "children" in item ? (
              <div
                key={item.label}
                className="rj-nav-group"
                onMouseEnter={() => setOpen(item.label)}
              >
                <button
                  className={`rj-nav-link ${isActive(item) ? "is-active" : ""}`}
                  aria-expanded={open === item.label}
                  onClick={() => setOpen(open === item.label ? null : item.label)}
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    className={`rj-chevron ${open === item.label ? "is-open" : ""}`}
                  />
                </button>
                <div className={`rj-dropdown ${open === item.label ? "is-open" : ""}`}>
                  <div className="rj-dropdown-inner">
                    <p className="rj-eyebrow">Les soins</p>
                    <ul>
                      {item.children.map((c) => (
                        <li key={c.label}>
                          <button
                            onClick={() => go(c.target)}
                            className={c.target === active ? "is-active" : ""}
                          >
                            <span className="rj-dd-title">{c.label}</span>
                            <span className="rj-dd-desc">{c.desc}</span>
                            <ArrowUpRight size={16} className="rj-dd-arrow" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <button
                key={item.label}
                className={`rj-nav-link ${isActive(item) ? "is-active" : ""}`}
                onMouseEnter={() => setOpen(null)}
                onClick={() => go(item.target)}
              >
                {item.label}
              </button>
            ),
          )}
        </nav>

        <div className="rj-actions">
          <button className="rj-btn rj-btn-ghost" onClick={() => go("contact")}>
            Contact
          </button>
          <button className="rj-btn rj-btn-solid" onClick={() => go("contact")}>
            Prendre rendez-vous
          </button>
          <button className="rj-burger" onClick={() => setMobile(true)} aria-label="Ouvrir le menu">
            <Menu size={22} />
          </button>
        </div>
      </header>

      <div className={`rj-mobile ${mobile ? "is-open" : ""}`} aria-hidden={!mobile}>
        <button
          className="rj-mobile-close"
          onClick={() => setMobile(false)}
          aria-label="Fermer le menu"
        >
          <X size={24} />
        </button>
        <nav className="rj-mobile-nav" aria-label="Menu mobile">
          {NAV.map((item) =>
            "children" in item ? (
              <div key={item.label} className="rj-mobile-group">
                <p className="rj-eyebrow">{item.label}</p>
                {item.children.map((c) => (
                  <button key={c.label} onClick={() => go(c.target)}>
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <button key={item.label} onClick={() => go(item.target)}>
                {item.label}
              </button>
            ),
          )}
          <button className="rj-btn rj-btn-solid rj-mobile-cta" onClick={() => go("contact")}>
            Prendre rendez-vous
          </button>
        </nav>
      </div>
    </>
  );
}
