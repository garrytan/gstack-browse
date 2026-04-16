"use client";

import React from "react";

function IconDocument() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconDna() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15c6.667-6 13.333 0 20-6" />
      <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
      <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
      <path d="m17 6-2.5-2.5" />
      <path d="m14 8-1-1" />
      <path d="m7 18 2.5 2.5" />
      <path d="m3.5 14.5.5.5" />
      <path d="m20 9 .5.5" />
      <path d="m6.5 12.5 1 1" />
      <path d="m16.5 10.5 1 1" />
      <path d="m10 16 1.5 1.5" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M9 2v2M2 15h2M2 9h2M22 15h-2M22 9h-2M15 22v-2M9 22v-2" />
    </svg>
  );
}

const services = [
  {
    Icon: IconDocument,
    title: "CMC Strategy & Regulatory Support",
    description:
      "End-to-end CMC strategy for IND and BLA submissions. I help biotech teams build robust regulatory packages, prepare for FDA meetings, and navigate CMC-related agency feedback — minimizing holds and accelerating timelines.",
    tags: ["IND/BLA CMC", "Tech Transfer", "FDA Interactions"],
  },
  {
    Icon: IconDna,
    title: "Cell & Gene Therapy Manufacturing",
    description:
      "Process development, scale-up, and GMP manufacturing oversight for cell and gene therapy programs. From viral vector production to autologous and allogeneic CAR-T, I bring hands-on experience with approved and investigational therapies.",
    tags: ["CAR-T", "Viral Vectors", "GMP Oversight", "Scale-Up"],
  },
  {
    Icon: IconRocket,
    title: "Pre-clinical to Phase 3 Program Support",
    description:
      "Embedded CMC leadership for programs at any stage. I partner with science and operations teams to build development plans, manage CRO/CDMOs, and ensure CMC deliverables stay on track from first-in-human to commercial readiness.",
    tags: ["Pre-clinical", "Phase 1–3", "CDMO Management"],
  },
  {
    Icon: IconCpu,
    title: "Agentic AI for Biotech CMC",
    description:
      "I design and deploy agentic AI systems that automate CMC document generation, batch record review, deviation management, and data analysis. Built for biotech teams who want to move faster without adding headcount.",
    tags: ["LLM Workflows", "Document Automation", "CMC Analytics"],
  },
];

export default function Services() {
  return (
    <section id="services" className="py-28" style={{ backgroundColor: "#0F172A" }}>
      {/* Subtle top separator */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(20,184,166,0.3), transparent)" }}
      />

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#14B8A6" }}
          >
            Services
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            What I can help you with
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto text-[15px] leading-relaxed">
            Whether you&apos;re navigating your first IND or scaling a commercial cell therapy program,
            I bring the expertise to move faster and de-risk the path.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {services.map(({ Icon, title, description, tags }) => (
            <div
              key={title}
              className="group rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 1px 20px rgba(0,0,0,0.2)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(20,184,166,0.35)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(20,184,166,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 20px rgba(0,0,0,0.2)";
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: "rgba(20,184,166,0.12)", color: "#14B8A6" }}
              >
                <Icon />
              </div>

              <h3 className="text-white font-bold text-lg mb-3 tracking-tight">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">{description}</p>

              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(20,184,166,0.1)", color: "#2DD4BF" }}
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
