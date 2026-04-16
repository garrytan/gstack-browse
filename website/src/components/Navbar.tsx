"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 w-full z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(15,23,42,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        boxShadow: scrolled ? "0 1px 40px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#" className="text-white font-semibold text-base tracking-tight">
          Michael McGowan
        </a>

        <div className="hidden md:flex items-center gap-8">
          {["About", "Services", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="relative text-slate-400 hover:text-white transition-colors text-sm font-medium group"
            >
              {item}
              <span
                className="absolute -bottom-0.5 left-0 w-0 h-px group-hover:w-full transition-all duration-300"
                style={{ backgroundColor: "#14B8A6" }}
              />
            </a>
          ))}
          <a
            href="#contact"
            className="text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:brightness-110 hover:shadow-lg"
            style={{
              backgroundColor: "#14B8A6",
              boxShadow: "0 0 0 0 rgba(20,184,166,0)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(20,184,166,0.35)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 rgba(20,184,166,0)")
            }
          >
            Book a Call
          </a>
        </div>

        <button
          className="md:hidden text-slate-300 hover:text-white transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden border-t px-6 py-5 flex flex-col gap-5"
          style={{ backgroundColor: "rgba(15,23,42,0.99)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {["About", "Services", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              {item}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center"
            style={{ backgroundColor: "#14B8A6" }}
          >
            Book a Call
          </a>
        </div>
      )}
    </nav>
  );
}
