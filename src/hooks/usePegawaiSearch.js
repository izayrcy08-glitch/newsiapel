import { useMemo } from "react";
import {
  PEGAWAI_GROUP_ORDER,
  getUnitLabel,
  getPegawaiGroupKey,
  getPegawaiGroupLabel,
} from "../bersama/util_unit_dan_scope";

/**
 * Generic search + filter + group untuk data pegawai.
 * Menggantikan duplikasi pola search di PegawaiLogin, DeveloperConsole, DashboardAdmin.
 *
 * @param {Array} people — daftar pegawai
 * @param {string} query — input pencarian
 * @param {object} options
 * @param {string[]} [options.searchFields] — field yang dicari (default: nama, nip, jabatan, bidang, unit, role)
 * @param {function} [options.customFilter] — filter tambahan (optional, dijalankan setelah search)
 * @returns {{ filtered: Array, grouped: Array<[string, Array]>, totalCount: number, filteredCount: number }}
 */
export function usePegawaiSearch(people, query = "", options = {}) {
  const {
    searchFields = ["nama", "nip", "jabatan", "bidang", "unit", "role"],
    customFilter,
  } = options;

  return useMemo(() => {
    const totalCount = people?.length || 0;
    if (!people) return { filtered: [], grouped: [], totalCount: 0, filteredCount: 0 };

    const normalizedQuery = query.trim().toLowerCase();

    // Step 1: Filter by search query
    let filtered = people;
    if (normalizedQuery) {
      filtered = people.filter((p) => {
        const searchable = searchFields
          .map((field) => p[field] || "")
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      });
    }

    // Step 2: Custom filter (opsional)
    if (customFilter) {
      filtered = filtered.filter(customFilter);
    }

    // Step 3: Group by unit
    const grouped = filtered.reduce((acc, pegawai) => {
      const key = getPegawaiGroupKey(pegawai);
      if (!acc[key]) acc[key] = [];
      acc[key].push(pegawai);
      return acc;
    }, {});

    // Step 4: Sort groups sesuai PEGAWAI_GROUP_ORDER
    const groupedEntries = Object.entries(grouped).sort((a, b) => {
      const indexA = PEGAWAI_GROUP_ORDER.indexOf(a[0]);
      const indexB = PEGAWAI_GROUP_ORDER.indexOf(b[0]);
      if (indexA !== -1 || indexB !== -1) {
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      }
      return getPegawaiGroupLabel(a[0]).localeCompare(getPegawaiGroupLabel(b[0]));
    });

    return {
      filtered,
      grouped: groupedEntries,
      totalCount,
      filteredCount: filtered.length,
    };
  }, [people, query, searchFields, customFilter]);
}
