"use client";

import { useState } from "react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Consulting Inquiry from ${form.name} — ${form.company}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\n\n${form.message}`
    );
    window.location.href = `mailto:hello@michaelmcgowan.com?subject=${subject}&body=${body}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputClass =
    "w-full bg-[#1E293B] border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500/60 transition-colors";

  return (
    <section id="contact" className="bg-[#F8FAFC] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-16 items-start">
          {/* Left */}
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#14B8A6" }}>
              Contact
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-6 leading-tight">
              Let&apos;s talk about your program
            </h2>
            <p className="text-slate-600 text-base leading-relaxed mb-8">
              Whether you&apos;re de-risking a CMC submission, scaling a cell therapy program, or exploring how AI can
              transform your operations — I&apos;d love to hear about your challenges.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: "rgba(20,184,166,0.12)" }}>
                  📧
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Email</p>
                  <a href="mailto:hello@michaelmcgowan.com" className="text-[#0F172A] font-semibold text-sm hover:underline" style={{ color: "#14B8A6" }}>
                    hello@michaelmcgowan.com
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: "rgba(20,184,166,0.12)" }}>
                  🔗
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">LinkedIn</p>
                  <a href="https://linkedin.com/in/michaelmcgowan" className="text-sm font-semibold hover:underline" style={{ color: "#14B8A6" }}>
                    linkedin.com/in/michaelmcgowan
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 w-full">
            <form
              onSubmit={handleSubmit}
              className="bg-[#0F172A] rounded-2xl p-8 border border-white/10 space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Company</label>
                  <input
                    type="text"
                    name="company"
                    placeholder="Acme Biotech"
                    value={form.company}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="jane@acmebio.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Message</label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell me about your program, stage, and what you're looking for..."
                  value={form.message}
                  onChange={handleChange}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <button
                type="submit"
                className="w-full text-white font-semibold py-3 rounded-xl text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#14B8A6" }}
              >
                Send Message →
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
