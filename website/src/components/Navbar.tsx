"use client";

import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0F172A]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Wordmark */}
        <a href="#" className="text-white font-semibold text-lg tracking-tight">
          Michael McGowan
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
            About
          </a>
          <a href="#services" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
            Services
          </a>
          <a href="#contact" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
            Contact
          </a>
          <a
            href="#contact"
            className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "#14B8A6" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "#0D9488")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "#14B8A6")}
          >
            Book a Call
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0F172A] border-t border-white/10 px-6 py-4 flex flex-col gap-4">
          <a href="#about" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm font-medium">About</a>
          <a href="#services" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm font-medium">Services</a>
          <a href="#contact" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm font-medium">Contact</a>
          <a href="#contact" onClick={() => setMenuOpen(false)} className="text-white text-sm font-semibold px-4 py-2 rounded-lg text-center" style={{ backgroundColor: "#14B8A6" }}>Book a Call</a>
        </div>
      )}
    </nav>
  );
}
