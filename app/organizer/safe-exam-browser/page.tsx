import { Download, ExternalLink, KeyRound, ShieldCheck, SlidersHorizontal } from "lucide-react";

const OFFICIAL_LINKS = [
  {
    label: "Download Safe Exam Browser",
    href: "https://safeexambrowser.org/download_en.html",
  },
  {
    label: "SEB Config Key developer guide",
    href: "https://safeexambrowser.org/developer/seb-config-key.html",
  },
  {
    label: "SEB Windows user manual",
    href: "https://safeexambrowser.org/windows/win_usermanual_en.html",
  },
];

const DEFAULTS = [
  "Starts directly on the MathWiz quiz page.",
  "Sends Browser Exam Key and Config Key headers.",
  "Limits navigation to this MathWiz site.",
  "Blocks reload, right click, print screen, common escape keys, and extra displays.",
  "Leaves quit available so participants are not trapped if setup fails.",
];

export default function OrganizerSafeExamBrowserPage() {
  return (
    <main className="shell py-12 md:py-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="space-y-4">
          <span className="eyebrow">Competition Security</span>
          <h1 className="section-heading text-4xl">Safe Exam Browser setup</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Safe Exam Browser is optional by default. Enable it only for quizzes where every participant can install and test SEB before competition time. Once required, MathWiz blocks attempt start unless SEB sends a matching Config Key hash.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Default off",
              body: "Normal quizzes keep existing anti-cheat only. No participant gets blocked by SEB unless organizer enables it.",
            },
            {
              icon: Download,
              title: "Quiz config",
              body: "Each quiz has a downloadable .seb config. Participants use the same file when SEB is required.",
            },
            {
              icon: KeyRound,
              title: "Config Key gate",
              body: "MathWiz stores approved 64-character Config Key hashes and checks the SEB request before attempt start.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="h-6 w-6 text-[#f49700]" />
                <h2 className="mt-4 text-base font-black text-[#10182b]">{item.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{item.body}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-1 h-6 w-6 shrink-0 text-[#f49700]" />
            <div>
              <h2 className="text-xl font-black text-[#10182b]">Recommended organizer workflow</h2>
              <ol className="mt-5 space-y-4 text-sm font-medium leading-6 text-slate-700">
                <li>1. Create and save the quiz draft first, because the SEB config is quiz-specific.</li>
                <li>2. In the scoring and anti-cheat step, set SEB enforcement to Required for this quiz.</li>
                <li>3. Download quiz config from the scoring step.</li>
                <li>4. Open the .seb file in the official SEB Config Tool and save it.</li>
                <li>5. Copy the 64-character Config Key hash from SEB after saving.</li>
                <li>6. Paste the Config Key hash into MathWiz, save the draft, then publish.</li>
                <li>7. Tell participants to download the quiz config from the competition page and open it with SEB.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-black text-[#10182b]">Should organizers modify SEB settings?</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-700">
              Best default: do not modify advanced SEB settings unless you have tested them on participant devices. MathWiz generates a sensible locked config. Advanced organizers may edit settings in the official SEB Config Tool, but every saved edit changes the Config Key hash. After any edit, copy the new hash back into MathWiz.
            </p>
            <ul className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-700">
              {DEFAULTS.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#f49700]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="text-base font-black">Official SEB links</h2>
            <div className="mt-4 space-y-3">
              {OFFICIAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#10182b] underline-offset-4 hover:underline"
                >
                  {link.label}
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
