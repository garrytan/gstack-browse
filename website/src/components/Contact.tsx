"use client";

import { useState } from "react";

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Consulting Inquiry from ${form.name}${form.company ? ` — ${form.company}` : ""}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\n\n${form.message}`
    );
    window.location.href = `mailto:hello@michaelmcgowan.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputBase =
    "w-full text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200";
  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  };
  const inputFocusStyle = {
    backgroundColor: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(20,184,166,0.5)",
    boxShadow: "0 0 0 3px rgba(20,184,166,0.1)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    Object.assign(e.currentTarget.style, inputFocusStyle);
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    Object.assign(e.currentTarget.style, inputStyle);
    e.currentTarget.style.boxShadow = "none";
  };

  const contactLinks = [
    {
      Icon: IconMail,
      label: "Email",
      display: "hello@michaelmcgowan.com",
      href: "mailto:hello@michaelmcgowan.com",
    },
    {
      Icon: IconLinkedIn,
      label: "LinkedIn",
      display: "linkedin.com/in/michaelmcgowan",
      href: "https://linkedin.com/in/michaelmcgowan",
    },
  ];

  return (
    <section id="contact" className="py-28" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left */}
          <div className="flex-1 lg:max-w-sm">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#14B8A6" }}
            >
              Contact
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-6 leading-tight tracking-tight">
              Let&apos;s talk about your program
            </h2>
            <p className="text-slate-500 text-[15px] leading-relaxed mb-10">
              Whether you&apos;re de-risking a CMC submission, scaling a cell therapy program, or exploring how AI can
              transform your operations — I&apos;d love to hear about your challenges.
            </p>

            <div className="space-y-4">
              {contactLinks.map(({ Icon, label, display, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-4 group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
                    style={{ backgroundColor: "rgba(20,184,166,0.12)", color: "#14B8A6" }}
                  >
                    <Icon />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</p>
                    <p
                      className="text-sm font-semibold group-hover:underline"
                      style={{ color: "#14B8A6" }}
                    >
                      {display}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 w-full">
            <div
              className="rounded-2xl p-8"
              style={{
                backgroundColor: "#0F172A",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
              }}
            >
              {submitted ? (
                <div className="text-center py-8">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(20,184,166,0.15)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Message ready to send</h3>
                  <p className="text-slate-400 text-sm">Your email client should have opened. If not, email me directly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { name: "name", label: "Name", placeholder: "Jane Smith", type: "text", required: true },
                      { name: "company", label: "Company", placeholder: "Acme Biotech", type: "text", required: false },
                    ].map((field) => (
                      <div key={field.name}>
                        <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                          {field.label}
                          {field.required && <span style={{ color: "#14B8A6" }}> *</span>}
                        </label>
                        <input
                          type={field.type}
                          name={field.name}
                          required={field.required}
                          placeholder={field.placeholder}
                          value={form[field.name as keyof typeof form]}
                          onChange={handleChange}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          className={inputBase}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                      Email <span style={{ color: "#14B8A6" }}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="jane@acmebio.com"
                      value={form.email}
                      onChange={handleChange}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      className={inputBase}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                      Message <span style={{ color: "#14B8A6" }}>*</span>
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell me about your program, stage, and what you're looking for..."
                      value={form.message}
                      onChange={handleChange}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      className={`${inputBase} resize-none`}
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full text-white font-semibold py-3.5 rounded-xl text-sm transition-all duration-200 hover:brightness-110"
                    style={{
                      backgroundColor: "#14B8A6",
                      boxShadow: "0 4px 20px rgba(20,184,166,0.25)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(20,184,166,0.4)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(20,184,166,0.25)")
                    }
                  >
                    Send Message →
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
