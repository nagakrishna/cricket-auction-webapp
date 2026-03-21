import { cn } from "@/lib/utils";

type PanelProps = {
  title?: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
};

export function Panel({ title, eyebrow, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur",
        className,
      )}
    >
      {(title || eyebrow) && (
        <div className="mb-4">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-xl font-semibold text-ink">{title}</h2>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
