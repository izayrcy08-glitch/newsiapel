import { useEffect, useState } from "react";
import pegawaiData from "../data/pegawai.json";
import orgData from "../data/organization.json";
import { REASON_OPTIONS } from "../constants/reasons";
import { LAST_MONTH_DISCIPLINE, RANK_MEDALS } from "../constants/ranking";
import { PENGJUAN_STATUS_DATA } from "../constants/statusChanges";
import StatisticsGrid from "../features/attendance/components/StatisticsGrid";
import AttentionEmployees from "../features/employees/components/AttentionEmployees";
import StatusChangeCard from "../features/statusChanges/components/StatusChangeCard";
import ExecutiveHeader from "../shared/components/ExecutiveHeader";
import BackButton from "../shared/ui/BackButton";
import Card from "../shared/ui/Card";
import {
  calcAttendanceStats,
  getAttendanceStatItems,
  getBidangPerformanceStatus,
  isApelDitiadakan,
} from "../shared/utils/attendance";
import { formatDateIndonesia, formatTimeWIB } from "../shared/utils/time";

const perhatianList = [
  {
    pegawaiId: "demo-1",
    totalTanpaKeterangan: 5,
    pegawai: { nama: "Bon Bendi", nip: "197903122008011001", bidang: "Sekretariat" },
  },
  {
    pegawaiId: "demo-2",
    totalTanpaKeterangan: 4,
    pegawai: { nama: "Abdul Rohman", nip: "197903122008011002", bidang: "Sumber Daya Air" },
  },
  {
    pegawaiId: "demo-3",
    totalTanpaKeterangan: 3,
    pegawai: { nama: "Roby Cahyadi, S.T.", nip: "197903122008011003", bidang: "Bina Marga" },
  },
  {
    pegawaiId: "demo-4",
    totalTanpaKeterangan: 2,
    pegawai: { nama: "Ahmad Fauzi", nip: "197903122008011004", bidang: "Bidang Umum" },
  },
  {
    pegawaiId: "demo-5",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Eko Prasetyo", nip: "197903122008011005", bidang: "UPT Pelayanan A" },
  },
  {
    pegawaiId: "demo-6",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Siti Nurhayati", nip: "197903122008011006", bidang: "Sekretariat" },
  },
  {
    pegawaiId: "demo-7",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Dedi Kurniawan", nip: "197903122008011007", bidang: "Sumber Daya Air" },
  },
  {
    pegawaiId: "demo-8",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Maya Lestari", nip: "197903122008011008", bidang: "Bina Marga" },
  },
  {
    pegawaiId: "demo-9",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Rizal Maulana", nip: "197903122008011009", bidang: "Cipta Karya" },
  },
  {
    pegawaiId: "demo-10",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Dian Puspita", nip: "197903122008011010", bidang: "UPT Pelayanan B" },
  },
  {
    pegawaiId: "demo-11",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Fajar Nugroho", nip: "197903122008011011", bidang: "Tata Ruang" },
  },
  {
    pegawaiId: "demo-12",
    totalTanpaKeterangan: 1,
    pegawai: { nama: "Rina Marlina", nip: "197903122008011012", bidang: "UPT Pelayanan A" },
  },
];

export default function ExecutiveDashboard({ attendance, apelStatus, apelReason, apelReasonText, onBack }) {
  const [showAllBidangToday, setShowAllBidangToday] = useState(false);
  const [showAllLastMonth, setShowAllLastMonth] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isDitiadakan = isApelDitiadakan(apelStatus);
  const stats = calcAttendanceStats(attendance, apelStatus);
  const unaccountedItem = getAttendanceStatItems(apelStatus)[1];

  useEffect(() => {
    const tick = () => setCurrentTime(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find((item) => item.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };

  const getBidangStats = (bidangNama) => {
    const members = pegawaiData.filter((pegawai) => pegawai.bidang === bidangNama);
    return calcAttendanceStats(attendance, apelStatus, members);
  };

  const bidangList = orgData.bidang.filter((bidang) => bidang.id !== "pimpinan");
  const bidangAnalytics = bidangList
    .map((bidang) => ({ ...bidang, stats: getBidangStats(bidang.nama) }))
    .filter((bidang) => bidang.stats.total > 0);
  const todayRanking = [...bidangAnalytics].sort(
    (a, b) => b.stats.persen - a.stats.persen || b.stats.hadir - a.stats.hadir || a.nama.localeCompare(b.nama),
  );
  const visibleTodayRanking = showAllBidangToday ? todayRanking : todayRanking.slice(0, 3);
  const lastMonthRanking = bidangList
    .map((bidang) => ({ ...bidang, persen: LAST_MONTH_DISCIPLINE[bidang.id] ?? 80 }))
    .sort((a, b) => b.persen - a.persen || a.nama.localeCompare(b.nama));
  const visibleLastMonthRanking = showAllLastMonth ? lastMonthRanking : lastMonthRanking.slice(0, 3);

  if (selectedBidang) {
    const bidangStats = getBidangStats(selectedBidang.nama);
    const bidangStatus = getBidangPerformanceStatus(bidangStats.persen);
    const detailRows = [
      { label: "Hadir", value: bidangStats.hadir, color: "text-emerald-400" },
      { label: unaccountedItem.label, value: bidangStats[unaccountedItem.key], color: unaccountedItem.color },
      { label: "Dinas Dalam", value: bidangStats.dinasD, color: "text-blue-400" },
      { label: "Dinas Luar", value: bidangStats.dinasL, color: "text-violet-400" },
      { label: "Izin", value: bidangStats.izin, color: "text-amber-400" },
      { label: "Sakit", value: bidangStats.sakit, color: "text-orange-400" },
    ];

    return (
      <div className="min-h-screen bg-[#070b13] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setSelectedBidang(null)} />

          <Card className="p-5 mb-4 border-slate-600/40 bg-slate-950/70 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-50 uppercase leading-tight">{selectedBidang.nama}</h2>
                <p className="text-slate-400 text-xs mt-1">{selectedBidang.kepala}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-amber-200">{bidangStats.persen}%</div>
                <div className="text-slate-500 text-[10px] uppercase tracking-wider">Hadir</div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-amber-200/10 pb-3 mb-3">
              <span className="text-slate-400 text-sm">Total Pegawai</span>
              <span className="text-white text-lg font-black">{bidangStats.total}</span>
            </div>

            <div className="space-y-2">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{row.label}</span>
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-amber-200/10 pt-4">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-[0.18em] mb-2">Status Bidang</div>
              <div className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-black ${bidangStatus.bg} ${bidangStatus.border} ${bidangStatus.color}`}>
                {bidangStats.persen < 80 ? "⚠ " : ""}
                {bidangStatus.label}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b13] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.08),transparent_32%)]" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-300/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        <ExecutiveHeader
          currentTime={currentTime}
          leader={orgData.kepala_dinas}
          organizationName={orgData.dinas}
          formatDate={formatDateIndonesia}
          formatTime={formatTimeWIB}
        />

        {isDitiadakan && (
          <Card className="p-4 mb-4 border-amber-500/30 bg-amber-500/10">
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

        {!isDitiadakan && <StatisticsGrid apelStatus={apelStatus} stats={stats} />}

        <AttentionEmployees items={perhatianList} />

        <div className="mb-2">
          <Card className="p-4 border-amber-200/15 bg-slate-950/65 shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
            <div className="mb-4 border-b border-amber-200/10 pb-3">
              <div className="text-amber-100/90 text-xs font-semibold uppercase tracking-[0.18em]">Kehadiran Per Bidang</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Analitik performa bidang hari ini dan bulan lalu</div>
            </div>

            {!isDitiadakan && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-slate-50 text-sm font-black">🏆 Peringkat Hari Ini</div>
                    <div className="text-slate-500 text-[11px]">Berdasarkan data absensi realtime</div>
                  </div>
                  <button
                    onClick={() => setShowAllBidangToday((prev) => !prev)}
                    className="text-xs text-slate-300 font-bold rounded-lg bg-slate-950/80 border border-slate-700/70 px-2.5 py-1.5 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
                  >
                    {showAllBidangToday ? "Tutup" : "Lihat Semua"}
                  </button>
                </div>

                <div className="space-y-2">
                  {visibleTodayRanking.map((bidang, index) => {
                    const status = getBidangPerformanceStatus(bidang.stats.persen);
                    return (
                      <button
                        key={bidang.id}
                        onClick={() => setSelectedBidang(bidang)}
                        className="w-full rounded-xl border border-slate-700/55 bg-slate-950/55 p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-slate-900/70"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-bold truncate">{bidang.nama}</div>
                            <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-lg font-black ${bidang.stats.persen >= 80 ? "text-emerald-400" : bidang.stats.persen >= 60 ? "text-amber-400" : "text-red-400"}`}>
                              {bidang.stats.persen}%
                            </div>
                            <div className="text-slate-600 text-[10px]">
                              {bidang.stats.hadir}/{bidang.stats.total}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏅 Disiplin Bulan Lalu</div>
                  <div className="text-slate-500 text-[11px]">Data dummy untuk tahap prototipe</div>
                </div>
                <button
                  onClick={() => setShowAllLastMonth((prev) => !prev)}
                  className="text-xs text-slate-300 font-bold rounded-lg bg-slate-950/80 border border-slate-700/70 px-2.5 py-1.5 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
                >
                  {showAllLastMonth ? "Tutup" : "Lihat Semua"}
                </button>
              </div>

              <div className="space-y-2">
                {visibleLastMonthRanking.map((bidang, index) => {
                  const status = getBidangPerformanceStatus(bidang.persen);
                  return (
                    <button
                      key={bidang.id}
                      onClick={() => setSelectedBidang(bidang)}
                      className="w-full rounded-xl border border-slate-700/55 bg-slate-950/55 p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-bold truncate">{bidang.nama}</div>
                          <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                        </div>
                        <div className="text-lg font-black text-blue-300 shrink-0">{bidang.persen}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {!isDitiadakan && <StatusChangeCard items={PENGJUAN_STATUS_DATA} />}
        </div>
      </div>
    </div>
  );
}
