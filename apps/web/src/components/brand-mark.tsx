import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The EarthClique mark as supplied (app-icon version). Never recolour or redraw it (Brand Book p.12). */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/earthclique-app-icon.png"
      alt="EarthClique"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 rounded-[22%]", className)}
    />
  );
}

/** Centred layout for sign-in and sign-up screens: mark and product name above the card, on a light teal tint. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-tint/60 p-4">
      <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-deep-teal">
        <BrandMark size={40} />
        EarthClique AMC
      </Link>
      {children}
    </div>
  );
}
