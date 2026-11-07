/** Languages for Surituk series — English, Hinglish and India's 22 scheduled languages. `value` is what's saved. */
export type Lang = { value: string; label: string };

/** Most-read languages in India (by number of speakers), English and Hinglish included. Shown first. */
export const POPULAR_LANGUAGES: Lang[] = [
  { value: "Hindi", label: "Hindi · हिन्दी" },
  { value: "English", label: "English" },
  { value: "Hinglish", label: "Hinglish (Hindi + English)" },
  { value: "Bengali", label: "Bengali · বাংলা" },
  { value: "Marathi", label: "Marathi · मराठी" },
  { value: "Telugu", label: "Telugu · తెలుగు" },
  { value: "Tamil", label: "Tamil · தமிழ்" },
  { value: "Gujarati", label: "Gujarati · ગુજરાતી" },
  { value: "Urdu", label: "Urdu · اردو" },
  { value: "Kannada", label: "Kannada · ಕನ್ನಡ" },
  { value: "Odia", label: "Odia · ଓଡ଼ିଆ" },
  { value: "Malayalam", label: "Malayalam · മലയാളം" },
  { value: "Punjabi", label: "Punjabi · ਪੰਜਾਬੀ" },
];

/** Other scheduled languages, also by number of speakers. */
export const MORE_LANGUAGES: Lang[] = [
  { value: "Assamese", label: "Assamese · অসমীয়া" },
  { value: "Maithili", label: "Maithili · मैथिली" },
  { value: "Santali", label: "Santali · ᱥᱟᱱᱛᱟᱲᱤ" },
  { value: "Kashmiri", label: "Kashmiri · کٲشُر" },
  { value: "Nepali", label: "Nepali · नेपाली" },
  { value: "Sindhi", label: "Sindhi · سنڌي" },
  { value: "Dogri", label: "Dogri · डोगरी" },
  { value: "Konkani", label: "Konkani · कोंकणी" },
  { value: "Manipuri", label: "Manipuri · ꯃꯤꯇꯩꯂꯣꯟ" },
  { value: "Bodo", label: "Bodo · बड़ो" },
  { value: "Sanskrit", label: "Sanskrit · संस्कृतम्" },
  { value: "Silent", label: "No text (silent comic)" },
  { value: "Other", label: "Other" },
];

export const LANGUAGES: Lang[] = [...POPULAR_LANGUAGES, ...MORE_LANGUAGES];

export const DEFAULT_LANGUAGE = "Hindi";
