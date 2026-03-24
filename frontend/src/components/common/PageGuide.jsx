import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

/**
 * Collapsible "How It Works" guide for any page.
 *
 * Props:
 *   title    - section heading (default: "How It Works")
 *   steps    - array of { icon: LucideIcon, title: string, desc: string }
 *   tips     - array of strings (optional quick tips)
 *   defaultOpen - start expanded (default: false)
 */
export default function PageGuide({ title = 'How It Works', steps = [], tips = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (steps.length === 0 && tips.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden animate-fade-in">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <HelpCircle size={14} className="text-primary-light" />
          </div>
          <span className="text-sm font-semibold text-zinc-300">{title}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-zinc-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Steps */}
          {steps.length > 0 && (
            <div className="space-y-3">
              {steps.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
                      <span className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center text-2xs font-bold text-zinc-500">
                        {i + 1}
                      </span>
                      {StepIcon && (
                        <div className="w-7 h-7 rounded-lg bg-zinc-800/60 flex items-center justify-center">
                          <StepIcon size={13} className="text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300 leading-snug">{step.title}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <div className="border-t border-zinc-800/40 pt-3">
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Quick Tips</p>
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary-light mt-1.5 shrink-0" />
                    <span className="text-xs text-zinc-500 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
