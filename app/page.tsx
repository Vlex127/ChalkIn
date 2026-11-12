import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline Attendance for Nigerian Universities",
  description:
    "ChalkIn lets lecturers take class attendance without internet, then syncs automatically when the network returns. Built for large classes and patchy data.",
  alternates: {
    canonical: "/",
  },
};

const GITHUB_URL = "https://github.com/Vlex127/ChalkIn";

const steps = [
  {
    title: "Start a session",
    body: "The lecturer opens the course and starts a session. ChalkIn generates a short check-in code that is only valid for that class period.",
  },
  {
    title: "Students check in offline",
    body: "Students enter the code on their phone. No data connection is needed — the check-in is saved on the device and queued for sync.",
  },
  {
    title: "Sync when there is signal",
    body: "Once the phone reaches a network, queued check-ins upload and the lecturer sees a clean attendance record for the session.",
  },
];

const features = [
  {
    title: "Works without network",
    body: "Check-ins are written to the device first. A dead network in a 400-seat lecture hall does not stop the class.",
  },
  {
    title: "Built for low-end phones",
    body: "A small install, light pages, and no video. The app targets the Android phones students actually carry.",
  },
  {
    title: "Time-boxed check-in codes",
    body: "Codes expire when the session ends, so a code shared after class does not count.",
  },
  {
    title: "One record per student",
    body: "A student cannot check in twice for the same session. Duplicates are rejected on sync.",
  },
  {
    title: "Lecturer reports",
    body: "See attendance per session, per course, and per student, then export the sheet for departmental records.",
  },
  {
    title: "No paper sheets",
    body: "No signing a ragged sheet at the door and no transcribing names into a spreadsheet later.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-semibold tracking-tight">
            ChalkIn
          </a>
          <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
            <a href="#how-it-works" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">
              How it works
            </a>
            <a href="#features" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">
              Features
            </a>
            <a
              href={GITHUB_URL}
              className="rounded-full bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-neutral-950 text-neutral-50">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-24">
            <p className="w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Offline-first attendance
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Attendance that works when the network does not.
            </h1>
            <p className="max-w-2xl text-lg text-neutral-300">
              ChalkIn lets lecturers take class attendance without internet and
              syncs automatically when signal returns. Built for Nigerian
              universities, where classes are large and data is not always
              there.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={GITHUB_URL}
                className="rounded-full bg-emerald-400 px-5 py-3 font-medium text-neutral-950 hover:bg-emerald-300"
                target="_blank"
                rel="noreferrer"
              >
                Follow the build on GitHub
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-neutral-700 px-5 py-3 font-medium text-neutral-200 hover:border-neutral-500"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="problem-heading" className="border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 id="problem-heading" className="text-2xl font-semibold tracking-tight">
              Paper sheets and dead networks
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">
              Most attendance in Nigerian universities still runs on a sheet at
              the door. It is slow, easy to fake, and the data has to be
              re-entered by hand. Online attendance tools assume a connection
              that a packed lecture hall often does not have.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              <li className="rounded-xl border border-neutral-200 p-5">
                <h3 className="font-medium">Proxy attendance</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  A friend signs for a friend. There is no reliable way to tell
                  who was actually in the room.
                </p>
              </li>
              <li className="rounded-xl border border-neutral-200 p-5">
                <h3 className="font-medium">Lost sheets</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Sheets get misplaced or damaged, and the course record is
                  incomplete before the semester ends.
                </p>
              </li>
              <li className="rounded-xl border border-neutral-200 p-5">
                <h3 className="font-medium">Manual entry</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Someone has to type names into a spreadsheet, which costs time
                  and introduces errors.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="border-b border-neutral-200 bg-neutral-50"
        >
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-neutral-200 bg-white p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              What it is built for
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li key={feature.title} className="rounded-xl border border-neutral-200 p-5">
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="status-heading" className="border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 id="status-heading" className="text-2xl font-semibold tracking-tight">
              Early build
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">
              ChalkIn is in active development. The offline attendance flow,
              lecturer dashboard, and reports are being built in the open. The
              repository and roadmap are public.
            </p>
            <a
              href={GITHUB_URL}
              className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700"
              target="_blank"
              rel="noreferrer"
            >
              View the repository
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} ChalkIn</p>
          <p>Offline attendance for Nigerian universities.</p>
        </div>
      </footer>
    </div>
  );
}
