"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { ServiceStrip } from "@/components/service-strip";
import * as session from "@/lib/demo-session";
import consoleDesign from "@/designs/console.json";
import pocketDesign from "@/designs/pocketscan.json";

type DesignProps = { startView?: string; startRoute?: string; checkout?: string | null; demo: typeof session & { navigate: (href: string) => void } };

/** Render the original, trusted design export using this app's React instance. */
export function DesignScreen({ screen, checkout }: { screen: "console" | "pocketscan"; checkout?: string }) {
  const router = useRouter();
  const [View, setView] = useState<ComponentType<DesignProps> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    import("@/vendor/design-runtime").then(({ createDesignComponent }) => {
      const component = createDesignComponent(screen, screen === "console" ? consoleDesign : pocketDesign);
      if (active) setView(() => component);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [screen]);
  if (error) return <main className="design-loading">The preview could not load. <button onClick={() => window.location.reload()}>Reload</button></main>;
  if (!View) return <main className="design-loading" role="status">Loading {screen === "console" ? "Afterlife" : "PocketScan"}…</main>;
  return <><ServiceStrip console={screen === "console"} /><div className="design-export"><View startView="portfolio" startRoute={checkout ? "app" : "landing"} checkout={checkout} demo={{ ...session, navigate: href => router.push(href === "/checkout" ? "/demo/checkout/" : href === "/" ? "/demo/pocketscan/" : href) }} /></div></>;
}
