import { useState } from "react";
import { REASON_OPTIONS, APEL_SESSIONS } from "../bersama/konstanta_aplikasi";

export default function PanelApel({ apelStatus, apelReason, apelReasonText, onAppealPhaseChange, onApelReasonChange, onClose }) {
  const [customText, setCustomText] = useState(apelReasonText || "");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">⏱️ Pengaturan Apel</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-slate-500 text-xs mb-4">Atur fase apel dan alasan jika ditiadakan.</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Sebelum", value: APEL_SESSIONS.BEFORE, tone: "bg-slate-800 text-slate-300 border-slate-700/60" },
            { label: "Saat Apel", value: APEL_SESSIONS.ONGOING, tone: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
            { label: "Setelah", value: APEL_SESSIONS.ENDED, tone: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
            { label: "Ditiadakan", value: APEL_SESSIONS.DITIADAKAN, tone: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
          ].map((item) => (
            <button key={item.value} onClick={() => { onAppealPhaseChange(item.value); if (item.value !== APEL_SESSIONS.DITIADAKAN) onClose(); }}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${item.tone}`}>
              {item.label}
            </button>
          ))}
        </div>

        {apelStatus === "ditiadakan" && (
          <div className="space-y-2">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-[0.18em]">Alasan</div>
            {REASON_OPTIONS.map((reason) => (
              <button key={reason.id} onClick={() => {
                if (reason.id === "lainnya") {
                  const t = window.prompt("Tulis alasan ditiadakan", customText || "");
                  if (t !== null) { setCustomText(t); onApelReasonChange("lainnya", t); }
                } else {
                  onApelReasonChange(reason.id);
                }
                onClose();
              }}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-all active:scale-[0.98] ${apelReason === reason.id ? "border-amber-500/40 bg-amber-500/15 text-amber-200" : "border-slate-700/60 bg-slate-800/70 text-slate-300 hover:bg-slate-700"}`}>
                <span className="mr-2">{reason.icon}</span>
                {reason.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
