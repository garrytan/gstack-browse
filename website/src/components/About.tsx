const stats = [
  {
    value: "3",
    label: "Top-Tier Companies",
    sub: "Vertex · BMS · Thermo Fisher",
    accent: "#14B8A6",
  },
  {
    value: "Abecma",
    label: "FDA-Approved Launch",
    sub: "First patient, ide-cel commercial launch",
    accent: "#6366F1",
  },
  {
    value: "Pre-clinical → Ph. 3",
    label: "Full Program Coverage",
    sub: "End-to-end CMC leadership",
    accent: "#F59E0B",
  },
];

export default function About() {
  return (
    <section id="about" className="py-28" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Text */}
          <div className="flex-1 max-w-2xl">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#14B8A6" }}
            >
              About
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-7 leading-tight tracking-tight">
              Deep CMC science meets{" "}
              <span style={{ color: "#14B8A6" }}>modern AI innovation</span>
            </h2>
            <div className="space-y-5 text-slate-600 text-[15px] leading-relaxed">
              <p>
                I&apos;m Michael McGowan, a biotech professional specializing in Chemistry, Manufacturing, and Controls
                (CMC) for cell and gene therapies. Across roles at{" "}
                <strong className="text-[#0F172A] font-semibold">Vertex Pharmaceuticals</strong>,{" "}
                <strong className="text-[#0F172A] font-semibold">Bristol Myers Squibb</strong>, and{" "}
                <strong className="text-[#0F172A] font-semibold">Thermo Fisher Scientific</strong>, I&apos;ve guided
                complex programs from the earliest pre-clinical stages through Phase 3 and into commercial launch.
              </p>
              <p>
                My most meaningful work includes contributing to the commercial launch of{" "}
                <strong className="text-[#0F172A] font-semibold">Abecma (ide-cel)</strong> — the first BCMA-targeted
                CAR-T cell therapy approved by the FDA — and being present when the first patient received treatment.
                I also led manufacturing of the first batch of{" "}
                <strong className="text-[#0F172A] font-semibold">VCAR33</strong>, a next-generation CAR-T program
                targeting AML.
              </p>
              <p>
                Beyond traditional CMC, I build and deploy agentic AI workflows that compress timelines, reduce manual
                overhead, and bring real intelligence to CMC data — a discipline I call{" "}
                <strong className="text-[#0F172A] font-semibold">Agentic CMC Innovation</strong>.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-4 lg:w-80 w-full">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  borderLeft: `3px solid ${s.accent}`,
                  boxShadow: "0 1px 12px rgba(0,0,0,0.06)",
                }}
              >
                <p className="text-xl font-extrabold text-[#0F172A] mb-0.5 tracking-tight">{s.value}</p>
                <p className="text-sm font-semibold text-[#0F172A]">{s.label}</p>
                <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
