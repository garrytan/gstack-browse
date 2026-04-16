const stats = [
  { label: "Industry Leaders", value: "3", sub: "Vertex · BMS · Thermo Fisher" },
  { label: "FDA-Approved Launch", value: "Abecma", sub: "First patient, commercial launch" },
  { label: "Program Experience", value: "Pre-clinical → Ph. 3", sub: "End-to-end CMC" },
];

export default function About() {
  return (
    <section id="about" className="bg-[#F8FAFC] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-16 items-start">
          {/* Text */}
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#14B8A6" }}>
              About
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-6 leading-tight">
              A rare combination of deep CMC science and modern AI innovation
            </h2>
            <div className="space-y-4 text-slate-600 text-base leading-relaxed">
              <p>
                I&apos;m Michael McGowan, a biotech professional specializing in Chemistry, Manufacturing, and Controls
                (CMC) for cell and gene therapies. Across roles at{" "}
                <strong className="text-[#0F172A]">Vertex Pharmaceuticals</strong>,{" "}
                <strong className="text-[#0F172A]">Bristol Myers Squibb</strong>, and{" "}
                <strong className="text-[#0F172A]">Thermo Fisher Scientific</strong>, I&apos;ve guided complex programs
                from the earliest pre-clinical stages through Phase 3 and into commercial launch.
              </p>
              <p>
                My most meaningful work includes being on the team for the commercial launch of{" "}
                <strong className="text-[#0F172A]">Abecma (ide-cel)</strong> — the first BCMA-targeted CAR-T cell
                therapy approved by the FDA — where I witnessed the first patient receive treatment. I also led
                manufacturing of the first batch of <strong className="text-[#0F172A]">VCAR33</strong>, a next-generation
                CAR-T program targeting AML.
              </p>
              <p>
                Beyond traditional CMC, I&apos;m deeply invested in the future of biotech operations. I build and deploy
                agentic AI workflows that compress timelines, reduce manual overhead, and bring real intelligence to
                CMC data — a discipline I call <strong className="text-[#0F172A]">Agentic CMC Innovation</strong>.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-5 md:w-72 w-full">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-2xl font-extrabold text-[#0F172A] mb-1">{s.value}</p>
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
