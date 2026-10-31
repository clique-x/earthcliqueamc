import { Building2, Cctv, ClipboardList, MapPin, Monitor, Network, Phone, Zap } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
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
        <div className="flex items-center gap-2.5 font-bold text-deep-teal">
          <BrandMark size={36} />
          <span className="hidden whitespace-nowrap sm:inline">EarthClique AMC</span>
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
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary">
            <Zap className="size-4" /> Engineers dispatched in minutes
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            IT down at your office? <span className="text-primary">A verified engineer is on the way.</span>
          </h1>
          <span aria-hidden className="accent-bar mt-5 w-16" />
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Report the problem, and the nearest qualified engineer gets an alert, accepts, and heads to you. Track them live, share a start code when they arrive, and close the job with proof.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="cta">
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
              <span className="flex size-11 items-center justify-center rounded-lg bg-tint">
                <Icon className="size-6 text-primary" />
              </span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <section className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary">
              <ClipboardList className="size-4" /> Project quotations
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Planning something bigger? Get quotes from verified vendors across India.</h2>
            <p className="mt-3 text-muted-foreground">
              70 CCTV cameras, a 40-PC server setup, a new data centre — post the requirement once. EarthClique checks it, sends it to verified vendors
              who do that kind of work in your state, and you compare itemised quotes side by side before awarding.
            </p>
            <Button asChild className="mt-6">
              <Link href="/signup">Post a requirement</Link>
            </Button>
          </div>
          <div className="rounded-xl bg-tint p-6">
            <div className="flex items-center gap-2 font-bold">
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

      {/* Contact band: deep teal with a thin coral top line (Brand Book p.17). Details as listed on p.21. */}
      <footer className="border-t-2 border-coral bg-deep-teal text-sm text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="tel:+918755572898" className="inline-flex items-center gap-2 font-bold hover:text-coral-light">
              <Phone className="size-4" /> +91 87555 72898
            </a>
            <span className="inline-flex items-center gap-2 text-mist">
              <MapPin className="size-4" /> Shop 209, Deep Ganga Complex, SIDCUL, Haridwar
            </span>
          </div>
          <Link href="/admin/login" className="text-mist hover:text-white">
            Ops console
          </Link>
        </div>
      </footer>
    </div>
  );
}
