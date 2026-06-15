import orgData from "../data/organization.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { calcAttendanceStats } from "../fitur/absensi/logika_absensi";

export default function PanelLaporan({ people, attendance, stats, now, onBack }) {
  const bidangStats = orgData.bidang
    .filter((b) => b.id !== "pimpinan")
    .map((b) => {
      const members = people.filter((p) => p.bidang === b.nama);
      let hadir = 0, tanpaKet = 0, izin = 0, sakit = 0, dinasD = 0, dinasL = 0;
      for (const p of members) {
        const att = attendance[p.id];
        if (!att?.status) continue;
        if (att.status === "Hadir") hadir++;
        else if (att.status === "Tanpa Keterangan") tanpaKet++;
        else if (att.status === "Izin") izin++;
        else if (att.status === "Sakit") sakit++;
        else if (att.status === "Dinas Dalam") dinasD++;
        else if (att.status === "Dinas Luar") dinasL++;
      }
      return { ...b, total: members.length, hadir, tanpaKet, izin, sakit, dinasD, dinasL };
    })
    .filter((b) => b.total > 0);

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-black text-white mb-1">Laporan Harian</h2>
        <p className="text-slate-500 text-xs mb-5">
          {now.toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>

        <Card className="p-4 mb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-slate-500 text-xs">Total</div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">{stats.hadir}</div>
              <div className="text-slate-500 text-xs">Hadir</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400">{`${stats.persen}%`}</div>
              <div className="text-slate-500 text-xs">Persentase</div>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          {bidangStats.map((b) => (
            <Card key={b.id} className="p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white text-sm font-semibold">{b.nama}</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {b.total > 0 ? Math.round((b.hadir / b.total) * 100) : 0}%
                </div>
              </div>
              <div className="flex gap-3 text-xs text-slate-400 flex-wrap gap-y-1">
                <span>✅ {b.hadir}</span>
                <span>🚫 {b.tanpaKet}</span>
                <span>🏢 {b.dinasD}</span>
                <span>🚗 {b.dinasL}</span>
                <span>📄 {b.izin}</span>
                <span>🤒 {b.sakit}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
