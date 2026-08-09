import { useEffect, useState } from "react";

import { buildPanelSrc, useTimeRange } from "@/lib/time-range";
import type { Panel } from "@/config/panels";

export function PanelCard({ panel }: { panel: Panel }) {
  const { range } = useTimeRange();
  const src = buildPanelSrc(panel.baseUrl, range);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-medium text-foreground">{panel.title}</h2>
      </header>
      <div className="relative h-[340px]">
        <iframe
          key={src}
          src={src}
          title={panel.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
        />
        {!loaded && (
          <div className="absolute inset-0 bg-card">
            <div className="shimmer h-full w-full" />
          </div>
        )}
      </div>
    </section>
  );
}
