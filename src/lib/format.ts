export const money = (n: number) => `Rs ${n.toLocaleString("en-US")}`;
export const todayPK = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
export const addDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h) % 12 || 12}:${m}`;
};
export const normPhone = (v: string) => {
  let p = v.replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("92")) p = "0" + p.slice(2);
  return p;
};
export const fmtDate = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
export const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return { start: `${ym}-01`, end: new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10) };
};
export const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
