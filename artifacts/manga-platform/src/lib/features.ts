/** Features switched off for now (kept in code for a later phase). Turn on at build time with VITE_FEATURE_* = "true". */
export const FEATURES = {
  store: import.meta.env.VITE_FEATURE_STORE === "true",
  contests: import.meta.env.VITE_FEATURE_CONTESTS === "true",
};
