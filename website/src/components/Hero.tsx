"use client";

import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden" style={{ backgroundColor: "#0F172A" }}>
      {/* Background grid + radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 65% 45%, rgba(20,184,166,0.08) 0%, transparent 70%),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "auto, 60px 60px, 60px 60px",
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #0F172A)" }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-32 md:py-0 md:min-h-screen flex flex-col-reverse md:flex-row items-center gap-12 md:gap-20">
        {/* Text */}
        <div className="flex-1 text-center md:text-left">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-8"
            style={{
              backgroundColor: "rgba(20,184,166,0.1)",
              border: "1px solid rgba(20,184,166,0.25)",
              color: "#2DD4BF",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#2DD4BF" }}
            />
            Available for Consulting
          </div>

          <h1 className="text-4xl md:text-[3.5rem] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
            Turning Biotech{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #14B8A6, #2DD4BF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Science
            </span>
            <br />
            into Reality
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg">
            CMC strategy, cell &amp; gene therapy manufacturing, and AI-powered
            workflows — from Pre-clinical through Phase&nbsp;3 commercialization.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <a
              href="#services"
              className="px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: "#14B8A6",
                boxShadow: "0 4px 24px rgba(20,184,166,0.3)",
              }}
            >
              View Services
            </a>
            <a
              href="#contact"
              className="px-6 py-3 rounded-xl text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200"
              style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.35)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)")
              }
            >
              Get in Touch
            </a>
          </div>

          <div className="mt-14">
            <p
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "rgba(148,163,184,0.6)" }}
            >
              Experience at
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              {["Vertex Pharmaceuticals", "Bristol Myers Squibb", "Thermo Fisher Scientific"].map((co) => (
                <span
                  key={co}
                  className="text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {co}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Headshot */}
        <div className="flex-shrink-0 relative">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)",
              transform: "scale(1.3)",
            }}
          />
          <div
            className="relative w-56 h-56 md:w-72 md:h-72 rounded-full overflow-hidden"
            style={{
              boxShadow: "0 0 0 3px #14B8A6, 0 0 0 6px rgba(20,184,166,0.2), 0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <Image
              src="/headshot.jpg"
              alt="Michael McGowan"
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
          {/* Credential badge */}
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full text-white"
            style={{
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            CAR-T &amp; Gene Therapy Expert
          </div>
        </div>
      </div>
    </section>
  );
}
