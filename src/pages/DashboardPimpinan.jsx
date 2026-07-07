import { useState } from "react";
import { LogOut } from "lucide-react";
import pegawaiData from "../data/pegawai_master.json";
import orgData from "../data/organization.json";
import { Card } from "../components/Card";
import { ProgressRing } from "../components/ProgressRing";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { REASON_OPTIONS } from "../bersama/konstanta_aplikasi";
import { getStatusIcon } from "../bersama/util_status_dan_warna";
import { getUnitLabel, getScopedPeople } from "../bersama/util_unit_dan_scope";
import { getAttendanceStatItems, calcAttendanceStats, calcMonthlyTanpaKeterangan, calcMonthlyBidangStats } from "../fitur/absensi/logika_absensi";
import { getBidangPerformanceStatus, RANK_MEDALS } from "../bersama/util_dashboard_ringkasan";
import { useClock } from "../hooks/useClock";
import { useAttendanceStats } from "../hooks/useAttendanceStats";
import { useShowMore } from "../hooks/useShowMore";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PIMPINAN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPimpinan = ({ people = pegawaiData, attendance, monthlyAttendance, apelMeta, monthKey, dayKey, pengajuan = [], apelStatus, apelSession, apelReason, apelReasonText, selectedPimpinan, onLogout }) => {
  const { now, greeting, dateStr, timeWIB } = useClock();
  const [showDetailPengajuan, setShowDetailPengajuan] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isDitiadakan = apelStatus === "ditiadakan";
  const displayPimpinan = selectedPimpinan || {
    name: orgData.kepala_dinas.nama,
    nip: orgData.kepala_dinas.nip,
    jabatan: orgData.kepala_dinas.jabatan,
    unit: "PIMPINAN",
    scope: "ALL",
    group: "EXECUTIVE",
    description: "Kepala Dinas",
  };

  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find(r => r.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };

  const scopePeople = getScopedPeople(people, displayPimpinan, displayPimpinan.scope);
  const { stats, statItems } = useAttendanceStats(attendance, apelStatus, scopePeople);
  const unaccountedItem = getAttendanceStatItems(apelStatus)[1];
  const showOperationalStats = true;

  const getBidangStats = (bidangNama) => {
    const members = people.filter(p => p.bidang === bidangNama);
    return calcAttendanceStats(attendance, apelStatus, members, { includeMissingAsUnrecorded: true });
  };

  const monthlyTK = calcMonthlyTanpaKeterangan(monthlyAttendance, apelMeta, people, {
    todayMonthKey: monthKey,
    todayDayKey: dayKey,
    apelStatus,
  });
  const perhatianList = Object.entries(monthlyTK)
    .filter(([, count]) => count > 0)
    .map(([pegawaiId, totalTanpaKeterangan]) => ({
      pegawaiId,
      pegawai: people.find((p) => String(p.id) === String(pegawaiId)),
      totalTanpaKeterangan,
    }))
    .filter((r) => r.pegawai)
    .sort((a, b) => b.totalTanpaKeterangan - a.totalTanpaKeterangan || a.pegawai.nama.localeCompare(b.pegawai.nama));
  const { showAll: showAllPerhatian, toggle: togglePerhatian, visibleItems: visiblePerhatianList } = useShowMore(perhatianList, 3);

  const bidangList = orgData.bidang.filter(b => b.id !== "pimpinan");
  const bidangAnalytics = bidangList
    .map(b => ({ ...b, stats: getBidangStats(b.nama) }))
    .filter(b => b.stats.total > 0);
  const todayRanking = [...bidangAnalytics].sort((a, b) => b.stats.persen - a.stats.persen || b.stats.hadir - a.stats.hadir || a.nama.localeCompare(b.nama));
  const { showAll: showAllBidangToday, toggle: toggleBidangToday, visibleItems: visibleTodayRanking } = useShowMore(todayRanking, 3);
  const monthlyBidangStats = calcMonthlyBidangStats(
    monthlyAttendance,
    apelMeta,
    bidangList,
    people,
    { todayMonthKey: monthKey, todayDayKey: dayKey, apelStatus }
  );
  const monthlyRanking = [...monthlyBidangStats]
    .filter((b) => b.daysCounted > 0)
    .sort((a, b) => b.persen - a.persen || a.nama.localeCompare(b.nama));
  const { showAll: showAllLastMonth, toggle: toggleLastMonth, visibleItems: visibleLastMonthRanking } = useShowMore(monthlyRanking, 3);

  if (selectedBidang) {
    const b = selectedBidang;
    const bStats = getBidangStats(b.nama);
    const unaccountedLabel = unaccountedItem.label;
    const bidangStatus = getBidangPerformanceStatus(bStats.persen);
    const detailRows = [
      { label: "Hadir", value: bStats.hadir, color: "text-emerald-400" },
      { label: unaccountedLabel, value: bStats[unaccountedItem.key], color: unaccountedItem.color },
      { label: "Dinas Dalam", value: bStats.dinasD, color: "text-blue-400" },
      { label: "Dinas Luar", value: bStats.dinasL, color: "text-violet-400" },
      { label: "Izin", value: bStats.izin, color: "text-amber-400" },
      { label: "Sakit", value: bStats.sakit, color: "text-orange-400" },
    ];
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-slate-950 px-4 py-6">
        {/* Bidang detail — background decoration */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-sm mx-auto">
          <button onClick={() => setSelectedBidang(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </button>
          <Card className="p-5 mb-4 border-blue-700/20 bg-black/40 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-50 uppercase leading-tight">{b.nama}</h2>
                <p className="text-slate-400 text-xs mt-1">{b.kepala}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-amber-200">{bStats.persen}%</div>
                <div className="text-slate-500 text-[10px] uppercase tracking-wider">Hadir</div>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-amber-200/10 pb-3 mb-3">
              <span className="text-slate-400 text-sm">Total Pegawai</span>
              <span className="text-white text-lg font-black">{bStats.total}</span>
            </div>
            <div className="space-y-2">
              {detailRows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{row.label}</span>
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-amber-200/10 pt-4">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-[0.18em] mb-2">Status Bidang</div>
              <div className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-black ${bidangStatus.bg} ${bidangStatus.border} ${bidangStatus.color}`}>
                {bStats.persen < 80 ? "⚠ " : ""}{bidangStatus.label}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-slate-950 px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_32%)]" />
        <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-300/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-700/8 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        {/* Logout — pojok kanan atas */}
        <div className="flex justify-end mb-4">
          <button onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 backdrop-blur-md border border-blue-700/20 hover:border-red-400/50 hover:bg-red-950/20 group transition-all duration-200 active:scale-[0.95] text-xs">
            <LogOut className="w-3.5 h-3.5 text-blue-400 group-hover:text-red-400 transition-colors" />
            <span className="text-slate-400 group-hover:text-red-300 transition-colors">Keluar</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-6 backdrop-blur-xl bg-black/20 px-4 py-4 rounded-2xl border border-blue-700/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-amber-200/80 text-sm font-medium">{greeting},</p>
              <ProfileLines
                name={displayPimpinan.name}
                nip={displayPimpinan.nip}
                jabatan={displayPimpinan.jabatan}
                nameClassName="text-xl font-black text-slate-50 leading-tight"
                metaClassName="text-slate-400 text-xs mt-0.5"
              />
              <p className="text-slate-400 text-xs mt-1">{displayPimpinan.group} · {displayPimpinan.scope === "ALL" ? "Scope ALL" : `Scope ${getUnitLabel(displayPimpinan.unit)}`} · {orgData.dinas}</p>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
              <div className="text-amber-200/90 text-xs font-medium leading-tight">{dateStr}</div>
              <div className="text-white text-lg font-bold font-mono tracking-wide mt-1">{timeWIB} <span className="text-amber-200/60 text-xs font-normal">WIB</span></div>
            </div>
          </div>
          <div className="sm:hidden mt-3 pt-3 border-t border-amber-200/10 flex items-center justify-between">
            <span className="text-amber-200/80 text-xs">{dateStr}</span>
            <span className="text-white text-sm font-bold font-mono">{timeWIB} <span className="text-amber-200/60 text-xs font-normal">WIB</span></span>
          </div>
        </div>

        {/* Banner Apel Ditiadakan */}
        {isDitiadakan && (
          <Card className="p-4 mb-4 border-amber-500/30 bg-black/40 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">{getReasonDisplay()}</div>
              </div>
            </div>
            <div className="text-slate-400 text-xs">Statistik kehadiran normal tidak ditampilkan karena apel ditiadakan.</div>
          </Card>
        )}

        {/* Main Stats + Ring */}
        {!isDitiadakan && (
          <>
            <Card className="p-5 mb-4 border-blue-700/20 bg-black/40 backdrop-blur-xl shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-5">
                <ProgressRing pct={stats.persen} size={100} stroke={9} color="#f59e0b" label="Kehadiran" />
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Total Pegawai", val: stats.total, color: "text-white" },
                    { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
                    { label: unaccountedItem.label, val: stats[unaccountedItem.key], color: unaccountedItem.color },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">{s.label}</span>
                      <span className={`font-bold text-sm ${s.color}`}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {statItems.map(s => (
                <Card key={s.label} className="p-3 text-center border-blue-700/20 bg-black/40 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                  <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Perlu Perhatian */}
        <Card className="p-4 mb-4 border-blue-700/20 bg-black/40 backdrop-blur-xl shadow-[0_14px_42px_rgba(0,0,0,0.24)]">
          <div className="mb-3 border-b border-slate-700/50 pb-3">
            <div className="text-slate-50 font-bold text-sm">Pegawai Perlu Perhatian</div>
            <div className="text-slate-500 text-xs mt-0.5">Top 3 berdasarkan sanksi bulan ini</div>
          </div>
          {visiblePerhatianList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-blue-700/20 bg-black/20 px-4 py-5 text-center">
              <div className="text-slate-300 text-sm font-semibold">Belum ada data operasional</div>
              <div className="text-slate-500 text-xs mt-1">Daftar ini akan terisi setelah data sanksi nyata tersedia.</div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visiblePerhatianList.map(r => {
                  const tanpaKeterangan = r.totalTanpaKeterangan;
                  const sanctionText =
                    tanpaKeterangan >= 5 ? "Pemotongan TPP 10%" :
                      tanpaKeterangan === 4 ? "SP2" :
                        tanpaKeterangan === 3 ? "SP1" :
                          "Belum Ada Sanksi";
                  const indicatorClass =
                    tanpaKeterangan >= 5 ? "bg-red-500" :
                      tanpaKeterangan === 4 ? "bg-orange-500" :
                        tanpaKeterangan >= 2 ? "bg-yellow-400" :
                          "bg-slate-200";
                  return (
                    <div key={r.pegawaiId} className="rounded-xl border border-blue-700/20 bg-black/30 backdrop-blur-md p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${indicatorClass}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-semibold truncate">{r.pegawai.nama}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5 truncate">NIP {r.pegawai.nip}</div>
                          <div className="text-slate-400 text-xs mt-1 truncate">Bidang/UPT: {r.pegawai.bidang}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-amber-200/10">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-xs">Tanpa Keterangan</span>
                          <span className="text-red-400 text-sm font-black">{tanpaKeterangan}x</span>
                        </div>
                        <div className="mt-1 text-sm font-black text-white">{sanctionText}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={togglePerhatian}
                className="mt-3 w-full py-2.5 rounded-xl bg-blue-900/30 backdrop-blur-md text-slate-300 text-xs font-bold border border-blue-700/30 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
              >
                {showAllPerhatian ? "Tutup Detail" : "Lihat Semua"}
              </button>
            </>
          )}
        </Card>

        {/* Kehadiran per Bidang */}
        <div className="mb-2">
          <Card className="p-4 border-blue-700/20 bg-black/40 backdrop-blur-xl shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
            <div className="mb-4 border-b border-amber-200/10 pb-3">
              <div className="text-amber-100/90 text-xs font-semibold uppercase tracking-[0.18em]">Kehadiran Per Bidang</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Analitik performa bidang hari ini dan bulan ini</div>
            </div>

            <div className="rounded-xl border border-blue-700/20 bg-black/30 backdrop-blur-md p-3.5 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏆 Peringkat Hari Ini</div>
                  <div className="text-slate-500 text-[11px]">
                    {showOperationalStats && !isDitiadakan ? "Berdasarkan data absensi realtime" : "Menunggu data pilot"}
                  </div>
                </div>
                <button
                  onClick={() => showOperationalStats && toggleBidangToday()}
                  disabled={!showOperationalStats || isDitiadakan}
                  className="text-xs font-bold rounded-lg px-2.5 py-1.5 transition-all active:scale-[0.98] border border-blue-700/30 bg-blue-900/30 text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 hover:border-amber-200/25 hover:text-amber-100"
                >
                  {showOperationalStats ? (showAllBidangToday ? "Tutup" : "Lihat Semua") : "—"}
                </button>
              </div>

              {showOperationalStats && !isDitiadakan ? (
                <div className="space-y-2">
                  {visibleTodayRanking.map((b, index) => {
                    const status = getBidangPerformanceStatus(b.stats.persen);
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBidang(b)}
                        className="w-full rounded-xl border border-blue-700/20 bg-black/30 backdrop-blur-md p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-black/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-bold truncate">{b.nama}</div>
                            <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-lg font-black ${b.stats.persen >= 80 ? "text-emerald-400" : b.stats.persen >= 60 ? "text-amber-400" : "text-red-400"}`}>{b.stats.persen}%</div>
                            <div className="text-slate-600 text-[10px]">{b.stats.hadir}/{b.stats.total}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="w-full rounded-xl border border-dashed border-blue-700/20 bg-black/20 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center text-slate-500">—</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-300 text-sm font-bold truncate">Menunggu data pilot</div>
                          <div className="text-slate-500 text-[11px]">Peringkat hari ini belum tersedia</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-slate-500">—</div>
                          <div className="text-slate-600 text-[10px]">—/—</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-blue-700/20 bg-black/30 backdrop-blur-md p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏅 Rata-rata Kehadiran Harian Bidang/UPT Bulan Ini</div>
                  <div className="text-slate-500 text-[11px]">Rata-rata persen kehadiran harian (hanya status Hadir)</div>
                </div>
                <button
                  onClick={() => showOperationalStats && toggleLastMonth()}
                  disabled={!showOperationalStats}
                  className="text-xs font-bold rounded-lg px-2.5 py-1.5 transition-all active:scale-[0.98] border border-blue-700/30 bg-blue-900/30 text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 hover:border-amber-200/25 hover:text-amber-100"
                >
                  {showOperationalStats ? (showAllLastMonth ? "Tutup" : "Lihat Semua") : "—"}
                </button>
              </div>

              {visibleLastMonthRanking.length > 0 ? (
                <div className="space-y-2">
                  {visibleLastMonthRanking.map((b, index) => {
                    const status = getBidangPerformanceStatus(b.persen);
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBidang(b)}
                        className="w-full rounded-xl border border-blue-700/20 bg-black/30 backdrop-blur-md p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-black/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-bold truncate">{b.nama}</div>
                            <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                          </div>
                          <div className="text-lg font-black text-blue-300 shrink-0">{b.persen}%</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-blue-700/20 bg-black/20 px-4 py-5 text-center">
                  <div className="text-slate-300 text-sm font-semibold">Belum ada data bulan ini</div>
                  <div className="text-slate-500 text-xs mt-1">Data akan muncul setelah hari apel selesai dihitung.</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ─── PERUBAHAN STATUS HARI INI - PIMPINAN (RINGKASAN) ─── */}
        <Card className="p-4 mb-4 border-blue-700/20 bg-black/40 backdrop-blur-xl">
          <div className="mb-3 border-b border-slate-700/50 pb-3">
            <div className="text-slate-50 font-bold text-sm">📋 Perubahan Status Hari Ini</div>
            <div className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</div>
          </div>

          {showOperationalStats && !isDitiadakan ? (
            (() => {
              const pendingStatus = pengajuan.filter(p => p.statusVerifikasi === "menunggu");
              if (pendingStatus.length === 0) {
                return (
                  <div className="text-slate-500 text-xs text-center py-4">
                    Belum ada perubahan status hari ini
                  </div>
                );
              }
              return (
                <>
                  <div className="text-center mb-4">
                    <div className="text-2xl font-black text-white mb-1">{pendingStatus.length}</div>
                    <div className="text-slate-500 text-xs">Perubahan Status</div>
                  </div>
                  <div className="flex justify-center gap-6 mb-4">
                    {[
                      { status: "Dinas Luar", icon: "🚗" },
                      { status: "Izin", icon: "📝" },
                      { status: "Sakit", icon: "🤒" },
                    ].map(item => {
                      const count = pendingStatus.filter(p => p.statusBaru === item.status).length;
                      if (count === 0) return null;
                      return (
                        <div key={item.status} className="text-center">
                          <div className="text-xl mb-0.5">{item.icon}</div>
                          <div className="text-white text-sm font-bold">{count}</div>
                          <div className="text-slate-600 text-[10px]">{item.status}</div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setShowDetailPengajuan(true)}
                    className="w-full py-2.5 rounded-xl bg-blue-900/30 backdrop-blur-md hover:bg-blue-800/40 text-slate-300 text-sm font-semibold transition-colors border border-blue-700/30"
                  >
                    Lihat Detail
                  </button>
                </>
              );
            })()
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed border-blue-700/20 bg-black/20 p-4 text-center">
                <div className="text-slate-300 text-sm font-semibold">Menunggu data pilot</div>
                <div className="text-slate-500 text-xs mt-1">Panel perubahan status akan terisi saat pilot project berjalan.</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Dinas Luar", "Izin", "Sakit"].map((label) => (
                  <div key={label} className="rounded-xl border border-dashed border-blue-700/20 bg-black/20 p-3 text-center">
                    <div className="text-lg mb-1">—</div>
                    <div className="text-slate-400 text-xs font-semibold">{label}</div>
                    <div className="text-slate-500 text-sm font-black mt-1">—</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* DETAIL PENGAJUAN MODAL */}
        {showDetailPengajuan && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <div className="bg-black/40 backdrop-blur-xl border border-blue-700/20 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold">📋 Perubahan Status Hari Ini</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</p>
                </div>
                <button onClick={() => setShowDetailPengajuan(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                {pengajuan.filter(p => p.statusVerifikasi === "menunggu").map((p) => (
                  <div key={p.id} className="border-t border-slate-800/60 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-400">🔄</span>
                      <span className="text-white text-sm font-semibold">{p.nama}</span>
                    </div>
                    <div className="text-slate-600 text-[10px] mb-2 ml-6">NIP: {p.nip}</div>
                    <div className="bg-slate-800/60 rounded-xl p-3 mb-2 ml-6">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs">{p.statusLama}</span>
                        <span className="text-slate-600">↓</span>
                        {getStatusIcon(p.statusBaru) ? (
                          <><span className="text-sm">{getStatusIcon(p.statusBaru).icon}</span><span className="text-blue-300 text-xs">{getStatusIcon(p.statusBaru).label}</span></>
                        ) : (
                          <span className="text-blue-300 text-xs">{p.statusBaru}</span>
                        )}
                      </div>
                    </div>
                    {p.keterangan && <div className="text-slate-400 text-xs mb-2 ml-6 italic">"{p.keterangan}"</div>}
                    <div className="flex items-center gap-4 text-slate-500 text-xs ml-6 mb-2">
                      <span>📄 {p.dokumen || "—"}</span>
                      <span>🕘 {p.waktu || "—"} WIB</span>
                    </div>
                    <div className="ml-6">
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-500/20 text-amber-400">🟡 Menunggu Verifikasi</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowDetailPengajuan(false)} className="w-full mt-4 py-3 rounded-xl bg-blue-900/30 backdrop-blur-md hover:bg-blue-800/40 text-slate-300 text-sm font-semibold transition-colors border border-blue-700/30">
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* ─── KONFIRMASI LOGOUT ─── */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-black/50 backdrop-blur-xl border border-blue-700/20 rounded-2xl p-6 w-full max-w-xs text-center shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-white font-bold text-lg mb-2">Yakin keluar?</div>
              <div className="text-slate-400 text-xs mb-6">Anda akan kembali ke halaman login</div>
              <div className="flex gap-3">
                <button onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-900/30 backdrop-blur-md hover:bg-blue-800/40 text-slate-300 text-sm font-semibold transition-all border border-blue-700/30 active:scale-[0.97]">
                  Batal
                </button>
                <button onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm font-semibold transition-all border border-red-500/30 active:scale-[0.97]">
                  Keluar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { DashboardPimpinan };
export default DashboardPimpinan;
