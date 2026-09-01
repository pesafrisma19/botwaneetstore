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
  ab:   'arena-breakout',
  bs:   'blood-strike',
  bp:   'boss-party',
  coa:  'crystal-of-atlan',
  eggy: 'eggy-party',
  fcm:  'fc-mobile',
  hgi:  'higgs-game-island',
  hsr:  'honkai-star-rail',
  kc:   'kings-choice',
  msa:  'metal-slug-awakening',
  rd:   'royal-dream',
  sm:   'sausage-man',
  tft:  'teamfight-tactics-mobile',
  tb:   'tomb-busters',
  ww:   'wuthering-waves',
  zzz:  'zenless-zone-zero',

  // ---------------- PLN ----------------
  pln:  'pln',

  // ---------------- PULSA ----------------
  tsel: 'telkomsel',
  axis: 'axis',
  byu:  'by.u',
  xl:   'xl',

  // ---------------- E-WALLET ----------------
  gopay: 'go-pay',
};


