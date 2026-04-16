import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Contact />
      </main>
      <footer className="bg-[#0F172A] border-t border-white/10 py-8 text-center">
        <p className="text-slate-500 text-sm">
          © {new Date().getFullYear()} Michael McGowan. All rights reserved.
        </p>
      </footer>
    </>
  );
}
