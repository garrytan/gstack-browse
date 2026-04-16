const services = [
  {
    icon: "📋",
    title: "CMC Strategy & Regulatory Support",
    description:
      "End-to-end CMC strategy for IND and BLA submissions. I help biotech teams build robust regulatory packages, prepare for FDA meetings, and navigate CMC-related agency feedback — minimizing holds and accelerating timelines.",
    tags: ["IND/BLA CMC", "Tech Transfer", "FDA Interactions"],
  },
  {
    icon: "🧬",
    title: "Cell & Gene Therapy Manufacturing",
    description:
      "Process development, scale-up, and GMP manufacturing oversight for cell and gene therapy programs. From viral vector production to autologous and allogeneic CAR-T, I bring hands-on experience with approved and investigational therapies.",
    tags: ["CAR-T", "Viral Vectors", "GMP Oversight", "Scale-Up"],
  },
  {
    icon: "🚀",
    title: "Pre-clinical to Phase 3 Program Support",
    description:
      "Embedded CMC leadership for programs at any stage. I partner with science and operations teams to build development plans, manage CRO/CDMOs, and ensure CMC deliverables stay on track from first-in-human to commercial readiness.",
    tags: ["Pre-clinical", "Phase 1–3", "CDMO Management"],
  },
  {
    icon: "🤖",
    title: "Agentic AI for Biotech CMC",
    description:
      "I design and deploy agentic AI systems that automate CMC document generation, batch record review, deviation management, and data analysis. Built for biotech teams who want to move faster without adding headcount.",
    tags: ["LLM Workflows", "Document Automation", "CMC Analytics"],
  },
];

export default function Services() {
  return (
    <section id="services" className="bg-[#0F172A] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#14B8A6" }}>
            Services
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            What I can help you with
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-base">
            Whether you&apos;re a startup navigating your first IND or a large pharma team scaling a commercial cell
            therapy program, I bring the expertise to move faster and de-risk the path.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {services.map((s) => (
            <div
              key={s.title}
              className="bg-[#1E293B] rounded-2xl p-8 border border-white/10 hover:border-teal-500/40 transition-colors group"
              style={{ "--tw-border-opacity": "1" } as React.CSSProperties}
            >
              <div className="text-3xl mb-4">{s.icon}</div>
              <h3 className="text-white font-bold text-xl mb-3">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">{s.description}</p>
              <div className="flex flex-wrap gap-2">
                {s.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(20,184,166,0.12)", color: "#2DD4BF" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
