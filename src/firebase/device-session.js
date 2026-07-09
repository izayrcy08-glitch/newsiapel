export const SESSION_ID_KEY = "siapel_session_id";
export const generateUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = (b) => b.toString(16).padStart(2, "0");
    return `${hex(buf[0])}${hex(buf[1])}${hex(buf[2])}${hex(buf[3])}-${hex(buf[4])}${hex(buf[5])}-${hex(buf[6])}${hex(buf[7])}-${hex(buf[8])}${hex(buf[9])}-${hex(buf[10])}${hex(buf[11])}${hex(buf[12])}${hex(buf[13])}${hex(buf[14])}${hex(buf[15])}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const getDeviceId = () => {
  try {
    let id = window.localStorage.getItem("siapel_device_id");
    if (!id) {
      id = generateUUID();
      window.localStorage.setItem("siapel_device_id", id);
    }
    return id;
  } catch {
    return generateUUID();
  }
};

export const getOrCreateSessionId = () => {
  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = generateUUID();
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return generateUUID();
  }
};
