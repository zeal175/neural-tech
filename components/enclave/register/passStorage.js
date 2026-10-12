// The visitor's entry is kept on their device so returning visits can greet them by name:
// { entry: "solo" | "team", teamName, passes: [their pass, their teammate's] }, each pass
// { passId, name, dept, section, year }.
const KEY = "enclave-pass";

const valid = (p) => p && p.passId && p.name;

export function loadPass() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && Array.isArray(v.passes) && v.passes.length && v.passes.every(valid)) return v;
    // saved before teams existed: a single pass
    return valid(v) ? { entry: "solo", teamName: "", passes: [v] } : null;
  } catch {
    return null;
  }
}

export function savePass(entry) {
  try {
    const { returning, ...keep } = entry;
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    /* private mode: the pass still shows for this visit */
  }
}

export function clearPass() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
