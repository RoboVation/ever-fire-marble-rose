import { bearingDeg, haversineM } from "./geo.ts";
import type { Direction, Landmark, Localized, Stop, TransitRoute } from "./types.ts";

const L = (en: string, si: string, ta: string): Localized => ({ en, si, ta });

const DISCLAIMER = L(
  "Sample corridor for this preview. Stop order, geometry, speed, and headway are not an operator licence or timetable.",
  "මෙම පෙරදසුන සඳහා නියැදි මාර්ගයකි. නැවතුම් අනුපිළිවෙල, හැඩය, වේගය සහ කාල පරතරය බලපත්‍රයක් හෝ කාලසටහනක් නොවේ.",
  "இந்த முன்னோட்டத்திற்கான மாதிரி பாதை. நிறுத்த வரிசை, வடிவம், வேகம், இடைவெளி ஆகியவை உரிமமோ கால அட்டவணையோ அல்ல.",
);

const BUS_OP = L("Sample bus service", "නියැදි බස් සේවය", "மாதிரி பேருந்து சேவை");
const COAST_OP = L("Sample coast rail", "නියැදි වෙරළ දුම්රිය", "மாதிரி கடற்கரை தொடருந்து");
const KV_OP = L(
  "Sample Kelani Valley rail",
  "නියැදි කැළණිවැලි දුම්රිය",
  "மாதிரி களனி பள்ளத்தாக்கு தொடருந்து",
);

export const PATH_FACTOR = 1.15;

export const STOPS: Stop[] = [
  { id: "pettah", name: L("Pettah", "පිටකොටුව", "பேட்டை"), lat: 6.9397, lng: 79.8548, kind: "bus", accessibility: "unverified" },
  { id: "fort", name: L("Fort", "කොටුව", "கோட்டை"), lat: 6.9356, lng: 79.8524, kind: "bus", accessibility: "unverified" },
  { id: "slave-island", name: L("Kompanna Veediya", "කොම්පඤ්ඤ වීදිය", "கொம்பனித்தெரு"), lat: 6.9218, lng: 79.8506, kind: "bus", accessibility: "unverified" },
  { id: "kollupitiya", name: L("Kollupitiya", "කොල්ලුපිටිය", "கொள்ளுபிட்டி"), lat: 6.9112, lng: 79.8502, kind: "bus", accessibility: "unverified" },
  { id: "bambalapitiya", name: L("Bambalapitiya", "බම්බලපිටිය", "பம்பலப்பிட்டி"), lat: 6.8932, lng: 79.8564, kind: "bus", accessibility: "unverified" },
  { id: "wellawatta", name: L("Wellawatta", "වැල්ලවත්ත", "வெள்ளவத்தை"), lat: 6.8748, lng: 79.8606, kind: "bus", accessibility: "unverified" },
  { id: "dehiwala", name: L("Dehiwala", "දෙහිවල", "தெஹிவளை"), lat: 6.8516, lng: 79.8668, kind: "bus", accessibility: "unverified" },
  { id: "mount-lavinia", name: L("Mount Lavinia", "ගල්කිස්ස", "கல்கிசை"), lat: 6.8324, lng: 79.8636, kind: "bus", accessibility: "unverified" },
  { id: "ratmalana", name: L("Ratmalana", "රත්මලාන", "இரத்மலானை"), lat: 6.8182, lng: 79.8684, kind: "bus", accessibility: "unverified" },
  { id: "moratuwa", name: L("Moratuwa", "මොරටුව", "மொரட்டுவை"), lat: 6.7734, lng: 79.8822, kind: "bus", accessibility: "unverified" },
  { id: "panadura", name: L("Panadura", "පානදුර", "பாணந்துறை"), lat: 6.7132, lng: 79.9034, kind: "bus", accessibility: "unverified" },
  { id: "maradana", name: L("Maradana", "මරදාන", "மருதானை"), lat: 6.9296, lng: 79.8638, kind: "bus", accessibility: "unverified" },
  { id: "borella", name: L("Borella", "බොරැල්ල", "பொரளை"), lat: 6.9144, lng: 79.8776, kind: "bus", accessibility: "unverified" },
  { id: "kirulapone", name: L("Kirulapone", "කිරුළපන", "கிருலப்பனை"), lat: 6.8872, lng: 79.8812, kind: "bus", accessibility: "unverified" },
  { id: "nugegoda", name: L("Nugegoda", "නුගේගොඩ", "நுகேகொட"), lat: 6.8646, lng: 79.8994, kind: "bus", accessibility: "unverified" },
  { id: "maharagama", name: L("Maharagama", "මහරගම", "மகரகம"), lat: 6.8482, lng: 79.9262, kind: "bus", accessibility: "unverified" },
  { id: "kottawa", name: L("Kottawa", "කොට්ටාව", "கொட்டாவ"), lat: 6.8414, lng: 79.9652, kind: "bus", accessibility: "unverified" },
  { id: "homagama", name: L("Homagama", "හෝමාගම", "ஹோமாகம"), lat: 6.8436, lng: 80.0028, kind: "bus", accessibility: "unverified" },
  { id: "town-hall", name: L("Town Hall", "නගර ශාලාව", "நகர மண்டபம்"), lat: 6.9156, lng: 79.8634, kind: "bus", accessibility: "unverified" },
  { id: "rajagiriya", name: L("Rajagiriya", "රාජගිරිය", "ராஜகிரிய"), lat: 6.9092, lng: 79.8948, kind: "bus", accessibility: "unverified" },
  { id: "battaramulla", name: L("Battaramulla", "බත්තරමුල්ල", "பத்தரமுல்லை"), lat: 6.9004, lng: 79.9162, kind: "bus", accessibility: "unverified" },
  { id: "malabe", name: L("Malabe", "මාලබේ", "மாலபே"), lat: 6.9064, lng: 79.9572, kind: "bus", accessibility: "unverified" },
  { id: "kaduwela", name: L("Kaduwela", "කඩුවෙල", "கடுவெலை"), lat: 6.9354, lng: 79.9836, kind: "bus", accessibility: "unverified" },
  { id: "dematagoda", name: L("Dematagoda", "දෙමටගොඩ", "தெமட்டகொடை"), lat: 6.9394, lng: 79.8788, kind: "bus", accessibility: "unverified" },
  { id: "kelaniya", name: L("Kelaniya", "කැලණිය", "களனி"), lat: 6.9554, lng: 79.9216, kind: "bus", accessibility: "unverified" },
  { id: "kiribathgoda", name: L("Kiribathgoda", "කිරිබත්ගොඩ", "கிரிபத்த்கொடை"), lat: 6.9806, lng: 79.9294, kind: "bus", accessibility: "unverified" },
  { id: "kadawatha", name: L("Kadawatha", "කඩවත", "கடவத்தை"), lat: 7.0014, lng: 79.9532, kind: "bus", accessibility: "unverified" },
  { id: "fort-rail", name: L("Colombo Fort station", "කොළඹ කොටුව දුම්රිය ස්ථානය", "கொழும்பு கோட்டை நிலையம்"), lat: 6.9334, lng: 79.8501, kind: "rail", accessibility: "unverified" },
  { id: "bambalapitiya-rail", name: L("Bambalapitiya station", "බම්බලපිටිය දුම්රිය ස්ථානය", "பம்பலப்பிட்டி நிலையம்"), lat: 6.8914, lng: 79.8568, kind: "rail", accessibility: "unverified" },
  { id: "wellawatta-rail", name: L("Wellawatta station", "වැල්ලවත්ත දුම්රිය ස්ථානය", "வெள்ளவத்தை நிலையம்"), lat: 6.8742, lng: 79.8609, kind: "rail", accessibility: "unverified" },
  { id: "dehiwala-rail", name: L("Dehiwala station", "දෙහිවල දුම්රිය ස්ථානය", "தெஹிவளை நிலையம்"), lat: 6.851, lng: 79.8658, kind: "rail", accessibility: "unverified" },
  { id: "mount-lavinia-rail", name: L("Mount Lavinia station", "ගල්කිස්ස දුම්රිය ස්ථානය", "கல்கிசை நிலையம்"), lat: 6.8316, lng: 79.8644, kind: "rail", accessibility: "unverified" },
  { id: "moratuwa-rail", name: L("Moratuwa station", "මොරටුව දුම්රිය ස්ථානය", "மொரட்டுவை நிலையம்"), lat: 6.7748, lng: 79.8814, kind: "rail", accessibility: "unverified" },
  { id: "panadura-rail", name: L("Panadura station", "පානදුර දුම්රිය ස්ථානය", "பாணந்துறை நிலையம்"), lat: 6.7144, lng: 79.9026, kind: "rail", accessibility: "unverified" },
  { id: "maradana-rail", name: L("Maradana station", "මරදාන දුම්රිය ස්ථානය", "மருதானை நிலையம்"), lat: 6.929, lng: 79.8662, kind: "rail", accessibility: "unverified" },
  { id: "nugegoda-rail", name: L("Nugegoda station", "නුගේගොඩ දුම්රිය ස්ථානය", "நுகேகொட நிலையம்"), lat: 6.8634, lng: 79.9012, kind: "rail", accessibility: "unverified" },
  { id: "maharagama-rail", name: L("Maharagama station", "මහරගම දුම්රිය ස්ථානය", "மகரகம நிலையம்"), lat: 6.8474, lng: 79.9268, kind: "rail", accessibility: "unverified" },
  { id: "homagama-rail", name: L("Homagama station", "හෝමාගම දුම්රිය ස්ථානය", "ஹோமாகம நிலையம்"), lat: 6.8444, lng: 80.0004, kind: "rail", accessibility: "unverified" },
];

const STOP_BY_ID = new Map(STOPS.map((stop) => [stop.id, stop]));

export function stopById(id: string): Stop | undefined {
  return STOP_BY_ID.get(id);
}

function dir(
  id: string,
  routeId: string,
  headsign: Localized,
  stopIds: string[],
  speedKmh: number,
  headwayMin: number,
  firstMin: number,
  lastMin: number,
  color: string,
): Direction {
  return { id, routeId, headsign, stopIds, speedKmh, headwayMin, firstMin, lastMin, color };
}

const galleSouth = ["pettah", "fort", "slave-island", "kollupitiya", "bambalapitiya", "wellawatta", "dehiwala", "mount-lavinia", "ratmalana", "moratuwa", "panadura"];
const levelEast = ["pettah", "maradana", "borella", "kirulapone", "nugegoda", "maharagama", "kottawa", "homagama"];
const kaduEast = ["fort", "town-hall", "borella", "rajagiriya", "battaramulla", "malabe", "kaduwela"];
const kandyNorth = ["pettah", "dematagoda", "kelaniya", "kiribathgoda", "kadawatha"];
const coastSouth = ["fort-rail", "bambalapitiya-rail", "wellawatta-rail", "dehiwala-rail", "mount-lavinia-rail", "moratuwa-rail", "panadura-rail"];
const kvEast = ["maradana-rail", "nugegoda-rail", "maharagama-rail", "homagama-rail"];

export const DIRECTIONS: Direction[] = [
  dir("galle-s", "sample-galle", L("Toward Panadura", "පානදුර දෙසට", "பாணந்துறை நோக்கி"), galleSouth, 24, 8, 300, 1350, "#1e3a5f"),
  dir("galle-n", "sample-galle", L("Toward Pettah", "පිටකොටුව දෙසට", "பேட்டை நோக்கி"), [...galleSouth].reverse(), 24, 8, 300, 1350, "#1e3a5f"),
  dir("level-e", "sample-level", L("Toward Homagama", "හෝමාගම දෙසට", "ஹோமாகமம் நோக்கி"), levelEast, 22, 10, 300, 1350, "#6e3a34"),
  dir("level-w", "sample-level", L("Toward Pettah", "පිටකොටුව දෙසට", "பேட்டை நோக்கி"), [...levelEast].reverse(), 22, 10, 300, 1350, "#6e3a34"),
  dir("kadu-e", "sample-kadu", L("Toward Kaduwela", "කඩුවෙල දෙසට", "கடுவெலை நோக்கி"), kaduEast, 24, 12, 310, 1340, "#1f5c4d"),
  dir("kadu-w", "sample-kadu", L("Toward Fort", "කොටුව දෙසට", "கோட்டை நோக்கி"), [...kaduEast].reverse(), 24, 12, 310, 1340, "#1f5c4d"),
  dir("kandy-n", "sample-kandy", L("Toward Kadawatha", "කඩවත දෙසට", "கடவத்தை நோக்கி"), kandyNorth, 26, 10, 300, 1350, "#3d4f7c"),
  dir("kandy-s", "sample-kandy", L("Toward Pettah", "පිටකොටුව දෙසට", "பேட்டை நோக்கி"), [...kandyNorth].reverse(), 26, 10, 300, 1350, "#3d4f7c"),
  dir("coast-s", "sample-coast", L("Toward Panadura", "පානදුර දෙසට", "பாணந்துறை நோக்கி"), coastSouth, 48, 20, 330, 1290, "#245c6b"),
  dir("coast-n", "sample-coast", L("Toward Fort", "කොටුව දෙසට", "கோட்டை நோக்கி"), [...coastSouth].reverse(), 48, 20, 330, 1290, "#245c6b"),
  dir("kv-e", "sample-kv", L("Toward Homagama", "හෝමාගම දෙසට", "ஹோமாகமம் நோக்கி"), kvEast, 36, 30, 340, 1270, "#3f5a3a"),
  dir("kv-w", "sample-kv", L("Toward Maradana", "මරදාන දෙසට", "மருதானை நோக்கி"), [...kvEast].reverse(), 36, 30, 340, 1270, "#3f5a3a"),
];

export const ROUTES: TransitRoute[] = [
  { id: "sample-galle", code: "SAMPLE-GR", name: L("Galle Road corridor", "ගාලු පාර මාර්ගය", "காலி வீதி பாதை"), mode: "bus", operator: BUS_OP, disclaimer: DISCLAIMER, directionIds: ["galle-s", "galle-n"] },
  { id: "sample-level", code: "SAMPLE-HL", name: L("High Level Road corridor", "හයි ලෙවල් පාර මාර්ගය", "ஹை லெவல் வீதி பாதை"), mode: "bus", operator: BUS_OP, disclaimer: DISCLAIMER, directionIds: ["level-e", "level-w"] },
  { id: "sample-kadu", code: "SAMPLE-KD", name: L("Kaduwela corridor", "කඩුවෙල මාර්ගය", "கடுவெலை பாதை"), mode: "bus", operator: BUS_OP, disclaimer: DISCLAIMER, directionIds: ["kadu-e", "kadu-w"] },
  { id: "sample-kandy", code: "SAMPLE-KR", name: L("Kandy Road corridor", "මහනුවර පාර මාර්ගය", "கண்டி வீதி பாதை"), mode: "bus", operator: BUS_OP, disclaimer: DISCLAIMER, directionIds: ["kandy-n", "kandy-s"] },
  { id: "sample-coast", code: "SAMPLE-CR", name: L("Coast line sample", "වෙරළ දුම්රිය නියැදිය", "கடற்கரை தொடருந்து மாதிரி"), mode: "rail", operator: COAST_OP, disclaimer: DISCLAIMER, directionIds: ["coast-s", "coast-n"] },
  { id: "sample-kv", code: "SAMPLE-KV", name: L("Kelani Valley sample", "කැළණිවැලි නියැදිය", "களனி பள்ளத்தாக்கு மாதிரி"), mode: "rail", operator: KV_OP, disclaimer: DISCLAIMER, directionIds: ["kv-e", "kv-w"] },
];

const ROUTE_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
const DIRECTION_BY_ID = new Map(DIRECTIONS.map((direction) => [direction.id, direction]));

export function routeById(id: string) {
  return ROUTE_BY_ID.get(id);
}

export function directionById(id: string) {
  return DIRECTION_BY_ID.get(id);
}

export const LANDMARKS: Landmark[] = [
  { id: "galle-face", name: L("Galle Face Green", "ගාලු මුවදොර තණපිටිය", "காலி முகத்திடல்"), blurb: L("Open lawn on the Colombo seafront.", "කොළඹ මුහුදු වෙරළේ විවෘත තණපිටිය.", "கொழும்பு கடற்கரையின் திறந்த புல்வெளி."), lat: 6.9271, lng: 79.8416, nearestStopId: "kollupitiya" },
  { id: "viharamahadevi", name: L("Viharamahadevi Park", "විහාරමහාදේවි උද්‍යානය", "விஹாரமகாதேவி பூங்கா"), blurb: L("Central park beside Town Hall.", "නගර ශාලාව අසල මධ්‍යම උද්‍යානය.", "நகர மண்டபத்துக்கு அருகிலுள்ள பூங்கா."), lat: 6.9136, lng: 79.8612, nearestStopId: "town-hall" },
  { id: "gangaramaya", name: L("Gangaramaya", "ගංගාරාමය", "கங்காராமய"), blurb: L("Temple and lake edge at Kompanna Veediya.", "කොම්පඤ්ඤ වීදිය අසල විහාරය.", "கொம்பனித்தெருவுக்கு அருகிலுள்ள கோவில்."), lat: 6.9166, lng: 79.8566, nearestStopId: "slave-island" },
  { id: "independence", name: L("Independence Square", "නිදහස් චතුරශ්‍රය", "சுதந்திர சதுக்கம்"), blurb: L("Memorial square south of Town Hall.", "නගර ශාලාවට දකුණින් ස්මාරක චතුරශ්‍රය.", "நகர மண்டபத்துக்கு தெற்கே உள்ள நினைவுச் சதுக்கம்."), lat: 6.9036, lng: 79.8684, nearestStopId: "town-hall" },
  { id: "mount-beach", name: L("Mount Lavinia beach", "ගල්කිස්ස වෙරළ", "கல்கிசை கடற்கரை"), blurb: L("Public beach at the end of the coast sample.", "වෙරළ නියැදියේ අග බාගයේ පොදු වෙරළ.", "கடற்கரை மாதிரியின் முனையில் உள்ள கடற்கரை."), lat: 6.8308, lng: 79.8602, nearestStopId: "mount-lavinia" },
  { id: "kelaniya-temple", name: L("Kelaniya temple", "කැලණි විහාරය", "களனி விகாரை"), blurb: L("Temple beside the Kandy Road sample.", "මහනුවර පාර නියැදිය අසල විහාරය.", "கண்டி வீதி மாதிரிக்கு அருகிலுள்ள கோவில்."), lat: 6.9532, lng: 79.9184, nearestStopId: "kelaniya" },
  { id: "museum", name: L("National Museum", "ජාතික කෞතුකාගාරය", "தேசிய அருங்காட்சியகம்"), blurb: L("A short walk from Town Hall.", "නගර ශාලාවේ සිට කෙටි ඇවිදීමක්.", "நகர மண்டபத்திலிருந்து குறுகிய நடை."), lat: 6.9104, lng: 79.8614, nearestStopId: "town-hall" },
];

const prefixCache = new Map<string, number[]>();

export function prefixMeters(direction: Direction): number[] {
  const cached = prefixCache.get(direction.id);
  if (cached) return cached;
  const prefix = [0];
  for (let i = 1; i < direction.stopIds.length; i += 1) {
    const a = stopById(direction.stopIds[i - 1] ?? "");
    const b = stopById(direction.stopIds[i] ?? "");
    const segment = a && b ? haversineM(a, b) * PATH_FACTOR : 0;
    prefix.push((prefix[i - 1] ?? 0) + segment);
  }
  prefixCache.set(direction.id, prefix);
  return prefix;
}

export function alongM(direction: Direction, from: number, to: number): number {
  const prefix = prefixMeters(direction);
  return (prefix[to] ?? 0) - (prefix[from] ?? 0);
}

export function pointAlong(direction: Direction, distM: number): {
  lat: number;
  lng: number;
  bearing: number;
  nextStopId: string;
} {
  const prefix = prefixMeters(direction);
  const total = prefix[prefix.length - 1] ?? 0;
  const distance = Math.max(0, Math.min(total, distM));
  let index = 1;
  while (index < prefix.length - 1 && (prefix[index] ?? 0) < distance) index += 1;
  const a = stopById(direction.stopIds[index - 1] ?? "");
  const b = stopById(direction.stopIds[index] ?? "");
  const fallback = direction.stopIds[0] ?? "";
  if (!a || !b) {
    return { lat: 0, lng: 0, bearing: 0, nextStopId: fallback };
  }
  const span = (prefix[index] ?? 0) - (prefix[index - 1] ?? 0) || 1;
  const t = Math.min(1, Math.max(0, (distance - (prefix[index - 1] ?? 0)) / span));
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    bearing: bearingDeg(a, b),
    nextStopId: b.id,
  };
}

export function routeLines(): { routeId: string; color: string; coordinates: [number, number][] }[] {
  return ROUTES.flatMap((route) => {
    const direction = directionById(route.directionIds[0] ?? "");
    if (!direction) return [];
    const coordinates = direction.stopIds.flatMap((id) => {
      const stop = stopById(id);
      return stop ? [[stop.lng, stop.lat] as [number, number]] : [];
    });
    return [{ routeId: route.id, color: direction.color, coordinates }];
  });
}
