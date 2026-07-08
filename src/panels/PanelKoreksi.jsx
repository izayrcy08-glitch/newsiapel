import { useState, useMemo } from "react";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { StatusBadge } from "../components/StatusBadge";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";
import { getStatusIcon } from "../bersama/util_status_dan_warna";
import { excludeSystemAccounts } from "../bersama/util_unit_dan_scope";
import { getEffectiveAttendanceStatus } from "../fitur/absensi/logika_absensi";

export default function PanelKoreksi({
  people, attendance, apelStatus, onKoreksi, onBack,
  pengajuan = [], onPengajuanVerifikasi, readOnly = false,
}) {
  const [tab, setTab] = useState("koreksi");
  const [search, setSearch] = useState("");
  const [bidangFilter, setBidangFilter] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [alasanTolak, setAlasanTolak] = useState("");

  const attendancePeople = useMemo(() => excludeSystemAccounts(people), [people]);

  // Daftar bidang unik (untuk filter) — tanpa akun sistem
  const bidangList = useMemo(
    () => [...new Set(attendancePeople.map((p) => p.bidang).filter(Boolean))].sort(),
    [attendancePeople]
  );

  // ── Tab: Koreksi Manual ── (semua pegawai bisa dicari & di-set status apa pun)
  const { filtered: filteredKoreksi } = usePegawaiSearch(attendancePeople, search, {
    searchFields: ["nama", "nip", "bidang", "jabatan"],
  });

  // Perlu ada pencarian atau filter bidang dulu — hindari render 300+ kartu sekaligus
  const koreksiActive = search.trim().length > 0 || Boolean(bidangFilter);
  const displayKoreksi = !koreksiActive
    ? []
    : (bidangFilter
        ? filteredKoreksi.filter((p) => p.bidang === bidangFilter)
        : filteredKoreksi
      ).slice(0, 50);

  const KOREKSI_STATUS_OPTIONS = ["Hadir", "Izin", "Sakit", "Dinas Dalam", "Dinas Luar", "Tanpa Keterangan"];

  // ── Tab: Pengajuan ──
  const pendingPengajuan = useMemo(
    () => pengajuan.filter((p) => p.statusVerifikasi === "menunggu"),
    [pengajuan]
  );

  // Enrich pengajuan dengan bidang dari data pegawai
  const enrichedPengajuan = useMemo(
    () =>
      pendingPengajuan.map((p) => ({
        ...p,
        bidang:
          attendancePeople.find(
            (peg) => String(peg.id) === String(p.pegawaiId)
          )?.bidang || "",
      })),
    [pendingPengajuan, attendancePeople]
  );

  const { filtered: filteredPengajuan } = usePegawaiSearch(enrichedPengajuan, search, {
    searchFields: ["nama", "nip"],
  });

  const displayPengajuan = bidangFilter
    ? filteredPengajuan.filter((p) => p.bidang === bidangFilter)
    : filteredPengajuan;

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-black text-white mb-1">✏️ Koreksi Absensi</h2>
        <p className="text-slate-500 text-xs mb-5">
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIP..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800 transition-all"
          />
        </div>

        {/* Bidang filter */}
        {bidangList.length > 0 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setBidangFilter("")}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                !bidangFilter
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600"
              }`}
            >
              Semua
            </button>
            {bidangList.map((b) => (
              <button
                key={b}
                onClick={() => setBidangFilter(b)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  bidangFilter === b
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-800/60 rounded-xl p-1">
          <button
            onClick={() => setTab("koreksi")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              tab === "koreksi"
                ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            ✏️ Koreksi Manual
          </button>
          <button
            onClick={() => setTab("pengajuan")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all relative ${
              tab === "pengajuan"
                ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            📥 Pengajuan
            {pendingPengajuan.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold bg-orange-500 text-white rounded-full">
                {pendingPengajuan.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: Koreksi Manual ── */}
        {tab === "koreksi" && (
          <>
            {!koreksiActive ? (
              <Card className="p-6 text-center">
                <div className="text-4xl mb-2">🔎</div>
                <div className="text-slate-400 text-sm">Cari pegawai untuk dikoreksi</div>
                <div className="text-slate-500 text-xs mt-1">
                  Ketik nama/NIP atau pilih bidang di atas untuk menampilkan daftar
                </div>
              </Card>
            ) : displayKoreksi.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="text-4xl mb-2">🤷</div>
                <div className="text-slate-400 text-sm">Pegawai tidak ditemukan</div>
                <div className="text-slate-500 text-xs mt-1">
                  Coba kata kunci atau bidang yang lain
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayKoreksi.map((p) => {
                  const effectiveStatus = getEffectiveAttendanceStatus(attendance[p.id], apelStatus);
                  return (
                    <Card key={p.id} className="p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                          <div className="text-slate-500 text-xs">{p.bidang}</div>
                        </div>
                        {effectiveStatus ? (
                          <StatusBadge status={effectiveStatus} />
                        ) : (
                          <span className="shrink-0 text-[10px] text-slate-500 border border-slate-700/60 rounded-full px-2 py-1">
                            —
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {KOREKSI_STATUS_OPTIONS.map((s) => {
                          const isActive = effectiveStatus === s;
                          return (
                            <button
                              key={s}
                              onClick={() => !readOnly && !isActive && onKoreksi(p.id, s)}
                              disabled={readOnly || isActive}
                              className={`text-xs py-1.5 px-2 rounded-lg border transition-all active:scale-[0.97] ${
                                isActive
                                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 cursor-default"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              }`}
                            >
                              {isActive ? "✓ " : "→ "}{s}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Pengajuan ── */}
        {tab === "pengajuan" && (
          <>
            {displayPengajuan.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-slate-400 text-sm">Belum ada pengajuan</div>
                <div className="text-slate-500 text-xs mt-1">
                  Pengajuan perubahan status dari pegawai akan muncul di sini
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayPengajuan.map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-400 shrink-0">👤</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                        <div className="text-slate-500 text-[10px]">NIP: {p.nip}</div>
                      </div>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 mb-2">
                      <div className="text-slate-500 text-[10px] mb-1.5 font-semibold tracking-wide">
                        STATUS SAAT INI → PENGAJUAN
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.statusLama ? (
                          <StatusBadge status={p.statusLama} />
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                        <span className="text-slate-600 text-xs">→</span>
                        {getStatusIcon(p.statusBaru) ? (
                          <span className="text-blue-300 text-xs font-medium">
                            {getStatusIcon(p.statusBaru).icon} {getStatusIcon(p.statusBaru).label}
                          </span>
                        ) : (
                          <span className="text-blue-300 text-xs font-medium">{p.statusBaru}</span>
                        )}
                      </div>
                    </div>

                    {p.keterangan && (
                      <div className="text-slate-400 text-xs mb-2 ml-1 italic leading-relaxed">
                        "{p.keterangan}"
                      </div>
                    )}

                    {p.dokumen && p.dokumen.startsWith("http") && (
                      <div className="flex items-center gap-2 text-xs mb-2 ml-1">
                        <span className="text-slate-500">📄</span>
                        <a
                          href={p.dokumen} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate max-w-[200px]"
                        >
                          Lihat Lampiran ↗
                        </a>
                      </div>
                    )}

                    <div className="text-slate-500 text-xs mb-3 ml-1">🕘 {p.waktu || "—"} WIB</div>

                    {rejectingId === p.id ? (
                      <div className="space-y-2 mb-2">
                        <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide">
                          Alasan penolakan <span className="text-red-400">*</span>
                        </div>
                        <textarea
                          value={alasanTolak}
                          onChange={(e) => setAlasanTolak(e.target.value)}
                          placeholder="Contoh: Surat tugas belum diserahkan ke TU..."
                          rows={2}
                          disabled={readOnly}
                          className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-red-500/50 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!alasanTolak.trim()) return;
                              onPengajuanVerifikasi?.(p.id, "ditolak", alasanTolak.trim());
                              setRejectingId(null);
                              setAlasanTolak("");
                            }}
                            disabled={readOnly || !alasanTolak.trim()}
                            className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Konfirmasi Tolak
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setAlasanTolak(""); }}
                            className="py-2 px-3 rounded-lg bg-slate-800 text-slate-400 text-xs border border-slate-700/50"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onPengajuanVerifikasi?.(p.id, "disetujui")}
                        disabled={readOnly}
                        className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-all border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                      >
                        ✅ Setujui
                      </button>
                      <button
                        onClick={() => { setRejectingId(p.id); setAlasanTolak(""); }}
                        disabled={readOnly}
                        className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                      >
                        ❌ Tolak
                      </button>
                    </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
