"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

const landingAnchors = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "methodology", label: "Methodology" },
  { id: "pricing", label: "Pricing" },
];

export function LandingHeaderNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed left-1/2 z-50 w-[95%] max-w-5xl -translate-x-1/2 transition-all duration-300 ${scrolled ? "top-4" : "top-6"}`}
      aria-label="Main navigation"
    >
      <div className="relative flex w-full items-center justify-between rounded-[9999px] border border-[#e2e8f0]/20 bg-[#0f172a] px-[25px] py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-[6px]">
        {/* Logo */}
        <ProgressLink
          href="/"
          className="flex shrink-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59b00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          aria-label="MathWiz home"
        >
          <img
            src="/mathwiz-logo.svg"
            alt="MathWiz"
            className="h-[40px] w-[40px] object-contain"
          />
        </ProgressLink>

        {/* Desktop Nav — centered */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center lg:flex">
          <div className="flex items-center gap-[32px] text-[14px] font-semibold text-white">
            {landingAnchors.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="leading-[20px] transition-colors hover:text-[#f49700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59b00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden shrink-0 items-center gap-[8px] lg:flex">
          <ProgressLink
            href="/auth/sign-up"
            className="flex flex-col items-center justify-center rounded-[9999px] bg-[#f49700] px-[20px] py-[8px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#e08900]"
          >
            <span className="text-center text-[14px] font-bold leading-[20px] text-white">
              Start Now
            </span>
          </ProgressLink>
          <ProgressLink
            href="/auth/login"
            className="flex flex-col items-center justify-center rounded-[9999px] bg-[#f1f5f9] px-[20px] py-[8px] transition-colors hover:bg-white"
          >
            <span className="text-center text-[14px] font-bold leading-[20px] text-[#0f172a]">
              Login
            </span>
          </ProgressLink>
        </div>

        {/* Mobile Toggle */}
        <button
          className="shrink-0 p-2 text-white transition-colors hover:text-[#f49700] lg:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <div
        className={`absolute left-0 right-0 top-full mt-4 flex origin-top flex-col gap-4 rounded-3xl border border-[#e2e8f0]/20 bg-[#0f172a]/95 p-6 shadow-xl backdrop-blur-md transition-all duration-300 lg:hidden ${isOpen ? "scale-y-100 opacity-100" : "pointer-events-none scale-y-0 opacity-0"}`}
        role="menu"
      >
        {landingAnchors.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="text-lg font-semibold text-white hover:text-[#f49700]"
            onClick={() => setIsOpen(false)}
            role="menuitem"
          >
            {item.label}
          </a>
        ))}
        <div className="my-2 h-px bg-white/10" />
        <ProgressLink
          href="/auth/sign-up"
          className="rounded-full bg-[#f49700] px-5 py-3 text-center font-bold text-white"
          onClick={() => setIsOpen(false)}
        >
          Start Now
        </ProgressLink>
        <ProgressLink
          href="/auth/login"
          className="rounded-full bg-[#f1f5f9] py-3 text-center font-bold text-[#0f172a]"
          onClick={() => setIsOpen(false)}
        >
          Login
        </ProgressLink>
      </div>
    </nav>
  );
}
