export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
};

export const getApelStatus = (now, apelSession) => {
  if (apelSession === "ditiadakan") return "ditiadakan";
  if (apelSession && ["before", "ongoing", "ended"].includes(apelSession)) {
    return apelSession;
  }
  const h = now.getHours(), m = now.getMinutes();
  const total = h * 60 + m;
  if (total < 7 * 60) return "before";
  if (total < 8 * 60) return "ongoing";
  return "ended";
};

export const formatTime = (date) =>
  date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const formatTimeShort = (date) =>
  date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
