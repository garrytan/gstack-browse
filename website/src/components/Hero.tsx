import Image from "next/image";

export default function Hero() {
  return (
    <section className="min-h-screen bg-[#0F172A] flex items-center pt-20">
      <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col-reverse md:flex-row items-center gap-16">
        {/* Text */}
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{ color: "#2DD4BF" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" style={{ backgroundColor: "#2DD4BF" }}></span>
            Available for Consulting
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Turning Biotech{" "}
            <span style={{ color: "#14B8A6" }}>Science</span>{" "}
            into Reality
          </h1>
          <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
            CMC strategy, cell &amp; gene therapy manufacturing, and AI-powered workflows —
            from Pre-clinical through Phase 3 commercialization.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <a
              href="#services"
              className="px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: "#14B8A6" }}
            >
              View Services
            </a>
            <a
              href="#contact"
              className="px-6 py-3 rounded-xl text-white font-semibold text-sm border border-white/20 hover:border-white/40 transition-colors"
            >
              Get in Touch
            </a>
          </div>

          {/* Company logos row */}
          <div className="mt-14">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-4 font-medium">Experience at</p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              {["Vertex", "Bristol Myers Squibb", "Thermo Fisher"].map((co) => (
                <span
                  key={co}
                  className="bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {co}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Headshot */}
        <div className="flex-shrink-0 relative">
          <div
            className="w-60 h-60 md:w-72 md:h-72 rounded-full overflow-hidden relative"
            style={{ boxShadow: "0 0 0 4px #14B8A6, 0 0 0 8px rgba(20,184,166,0.15)" }}
          >
            <Image
              src="/headshot.jpg"
              alt="Michael McGowan"
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
          {/* Floating badge */}
          <div className="absolute -bottom-2 -right-2 bg-[#1E293B] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-semibold shadow-xl">
            🧬 CAR-T Expert
          </div>
        </div>
      </div>
    </section>
  );
}
