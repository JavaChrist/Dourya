import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountNav } from "@/components/account/AccountNav";

export const metadata: Metadata = { title: { template: "%s | Mon compte", default: "Mon compte" }, robots: { index: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Mon compte</h1>
      <AccountNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
