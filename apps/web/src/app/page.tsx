import { Building2, Cctv, ClipboardList, Monitor, Network, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const SERVICES = [
  { icon: Monitor, title: "Windows & PCs", text: "Boot failures, crashes, slow machines, printers, OS installs." },
  { icon: Network, title: "Networks", text: "Internet down, Wi-Fi, routers, switches and LAN cabling." },
  { icon: Cctv, title: "CCTV", text: "Offline cameras, DVR/NVR recording, mobile viewing." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">EC</span>
          Earthclique AMC
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Register your company</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 sm:py-24">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Zap className="size-4" /> Engineers dispatched in minutes
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">IT down at your office? A verified engineer is on the way.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Report the problem, and the nearest qualified engineer gets an alert, accepts, and heads to you. Track them live, share a start code when they arrive, and close the job with proof.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border p-5">
              <Icon className="size-6 text-primary" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <section className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1 text-sm font-medium text-info">
              <ClipboardList className="size-4" /> Project quotations
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Planning something bigger? Get quotes from verified vendors across India.</h2>
            <p className="mt-3 text-muted-foreground">
              70 CCTV cameras, a 40-PC server setup, a new data centre — post the requirement once. Earthclique checks it, sends it to verified vendors
              who do that kind of work in your state, and you compare itemised quotes side by side before awarding.
            </p>
            <Button asChild className="mt-6">
              <Link href="/signup">Post a requirement</Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-muted/40 p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Building2 className="size-5 text-primary" /> For IT vendors and integrators
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Subscribe to receive matching project requirements in the states you serve, ask questions, and quote with line items. Companies see
              your rating and certifications, never other vendors&apos; prices.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/vendor/signup">Register as a vendor</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/vendor/login">Vendor sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <Link href="/admin/login" className="hover:text-foreground">
          Ops console
        </Link>
      </footer>
    </div>
  );
}
