// ============================================================
// MAPPING ALIAS KODE COMMAND — RESOLVED DINAMIS DARI V1 API
// ------------------------------------------------------------
// Shortcut -> Target Selector ('brandSlug' atau 'brandSlug|regionTarget')
// Seluruh metadata (ID, Brand, Region, Category, Level, Price) 100% dari V1.
// ============================================================

export const BRAND_ALIASES: Record<string, string> = {
  // ---------------- MOBILE LEGENDS ----------------
  ml:   'mobile-legends|Indonesia+null', // Eksplisit Indonesia OR null (58 + 24 = 82 produk)
  mlg:  'mobile-legends|Global',
  mlbr: 'mobile-legends|Brazil',
  mlph: 'mobile-legends|Filipina',       // Sesuai DB real 'Filipina'
  mlsg: 'mobile-legends|Singapore',
  mltr: 'mobile-legends|Turkey',
  mlru: 'mobile-legends|Russia',
  mlvn: 'mobile-legends|Vietnam',

  // ---------------- FREE FIRE ----------------
  ff:   'free-fire',
  ffm:  'free-fire-max',

  // ---------------- GAME LAIN ----------------
  gi:   'genshin-impact',
  hok:  'honor-of-kings',
  mc:   'magic-chess',
  ss:   'super-sus',
  pm:   'pubg-mobile',

  // ---------------- PULSA ----------------
  tsel: 'telkomsel',
};


