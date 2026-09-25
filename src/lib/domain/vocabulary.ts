import type { SectionKey } from "./sections";

/**
 * Seed synonym table: [name_fi (nominative singular), section, ...terms].
 * Terms cover English names and common Finnish inflections seen in recipes.
 * Editable at runtime (Settings → Synonyms); this is only the starting point.
 */
type Row = [string, SectionKey, ...string[]];

const HV: SectionKey = "hedelmat_vihannekset";
const LK: SectionKey = "liha_kala";
const MJ: SectionKey = "maito_juusto";
const K: SectionKey = "kuivatuotteet";
const L: SectionKey = "leipa";
const P: SectionKey = "pakasteet";
const J: SectionKey = "juomat";

export const SEED_SYNONYMS: Row[] = [
  // Fruit & vegetables
  ["peruna", HV, "potato", "potatoes", "perunaa", "perunoita", "perunat", "kiinteä peruna", "kiinteitä perunoita", "jauhoinen peruna", "jauhoisia perunoita"],
  ["porkkana", HV, "carrot", "carrots", "porkkanaa", "porkkanoita", "porkkanat"],
  ["sipuli", HV, "onion", "onions", "sipulia", "sipulit", "keltasipuli", "keltasipulia", "yellow onion", "yellow onions"],
  ["punasipuli", HV, "red onion", "red onions", "punasipulia"],
  ["valkosipuli", HV, "garlic", "valkosipulia", "valkosipulinkynsi", "valkosipulinkynttä", "garlic clove", "garlic cloves", "clove garlic", "cloves garlic"],
  ["purjo", HV, "leek", "leeks", "purjoa", "purjosipuli", "purjosipulia"],
  ["tomaatti", HV, "tomato", "tomatoes", "tomaattia", "tomaatteja", "tomaatit"],
  ["kirsikkatomaatti", HV, "cherry tomato", "cherry tomatoes", "kirsikkatomaatteja"],
  ["kurkku", HV, "cucumber", "kurkkua"],
  ["paprika", HV, "bell pepper", "red pepper", "red bell pepper", "paprikaa", "paprikat", "punainen paprika", "punaista paprikaa"],
  ["chili", HV, "chili", "chilli", "chilies", "chillies", "chilipippuri", "chiliä", "chilipippuria", "punainen chili", "red chili"],
  ["inkivääri", HV, "ginger", "fresh ginger", "inkivääriä", "tuore inkivääri", "tuoretta inkivääriä"],
  ["sitruuna", HV, "lemon", "lemons", "sitruunaa", "sitruunan mehu", "lemon juice", "sitruunamehu", "sitruunamehua"],
  ["limetti", HV, "lime", "limes", "limettiä", "limetin mehu", "lime juice", "limettimehua"],
  ["tilli", HV, "dill", "tilliä", "tuore tilli", "tuoretta tilliä"],
  ["persilja", HV, "parsley", "persiljaa"],
  ["korianteri", HV, "coriander", "cilantro", "korianteria", "tuore korianteri"],
  ["basilika", HV, "basil", "basilikaa", "fresh basil"],
  ["ruohosipuli", HV, "chives", "ruohosipulia"],
  ["salaatti", HV, "lettuce", "salaattia", "jäävuorisalaatti"],
  ["pinaatti", HV, "spinach", "baby spinach", "pinaattia", "babypinaatti", "babypinaattia"],
  ["kukkakaali", HV, "cauliflower", "kukkakaalia"],
  ["parsakaali", HV, "broccoli", "parsakaalia"],
  ["kesäkurpitsa", HV, "zucchini", "courgette", "kesäkurpitsaa"],
  ["bataatti", HV, "sweet potato", "sweet potatoes", "bataattia", "bataatteja"],
  ["herkkusieni", HV, "mushroom", "mushrooms", "herkkusieniä", "sieni", "sieniä", "champignon"],
  ["lanttu", HV, "swede", "rutabaga", "lanttua"],
  ["palsternakka", HV, "parsnip", "parsnips", "palsternakkaa"],
  ["kantarelli", HV, "chanterelle", "chanterelles", "kantarelleja", "keltavahvero", "keltavahveroita"],
  ["suppilovahvero", HV, "funnel chanterelle", "winter chanterelle", "suppilovahveroita", "suppis"],
  ["varhaisperuna", HV, "new potatoes", "varhaisperunoita", "uusi peruna", "uusia perunoita"],
  ["raparperi", HV, "rhubarb", "raparperia"],
  ["puolukka", HV, "lingonberry", "lingonberries", "puolukoita", "puolukkaa"],
  ["mustikka", HV, "blueberry", "blueberries", "bilberries", "mustikoita", "mustikkaa"],
  ["karpalo", HV, "cranberry", "cranberries", "karpaloita"],
  ["mansikka", HV, "strawberry", "strawberries", "mansikoita", "mansikkaa"],
  ["punajuuri", HV, "beetroot", "beet", "beets", "punajuurta", "punajuuria"],
  ["varsiselleri", HV, "celery", "varsisellerin varsi", "varsisellerin vartta", "varsiselleriä"],
  ["kaali", HV, "cabbage", "valkokaali", "valkokaalia", "kaalia"],
  ["avokado", HV, "avocado", "avocados", "avokadoa"],
  ["omena", HV, "apple", "apples", "omenaa", "omenoita"],
  ["banaani", HV, "banana", "bananas", "banaania", "banaaneja"],
  ["kevätsipuli", HV, "spring onion", "spring onions", "scallion", "scallions", "kevätsipulia", "kevätsipulin varsi", "kevätsipulin vartta"],

  // Meat & fish
  ["lohi", LK, "salmon", "salmon fillet", "lohta", "lohifilee", "lohifileetä", "lohifileet", "kirjolohi", "kirjolohta", "kirjolohifilee", "nahaton lohifilee", "nahatonta lohifileetä"],
  ["jauheliha", LK, "ground beef", "minced beef", "mince", "beef mince", "jauhelihaa", "naudan jauheliha", "naudan jauhelihaa", "sika-nauta jauheliha", "sika-nautajauheliha", "sika-nautajauhelihaa"],
  ["broilerinfilee", LK, "chicken breast", "chicken breasts", "chicken fillet", "chicken", "broilerin rintafilee", "broilerin rintafileetä", "broilerinfileetä", "kananrintafilee", "kana", "kanaa", "broileri", "broileria"],
  ["broilerin suikale", LK, "chicken strips", "broilerin suikaleita", "broilerin fileesuikale", "broilerin fileesuikaleita", "broilerin fileesuikaleet", "kanasuikale", "kanasuikaleita", "maustamaton broilerin suikale", "maustamattomia broilerin suikaleita"],
  ["kanan koipireisi", LK, "chicken thigh", "chicken thighs", "broilerin koipireisi", "kanan koipireisiä", "broilerin koipireisiä"],
  ["pekoni", LK, "bacon", "pekonia"],
  ["kinkku", LK, "ham", "kinkkua", "keittokinkku", "keittokinkkua"],
  ["makkara", LK, "sausage", "sausages", "makkaraa", "lenkkimakkara", "lenkkimakkaraa"],
  ["katkarapu", LK, "shrimp", "prawns", "prawn", "katkarapuja", "jättikatkarapu", "jättikatkarapuja"],
  ["naudanliha", LK, "beef", "naudanlihaa", "naudan paisti", "stew beef"],
  ["porsaanliha", LK, "pork", "porsaanlihaa", "possu", "possua", "porsaan kassler", "kassler"],
  ["turska", LK, "cod", "turskaa", "turskafilee", "turskafileetä"],
  ["seiti", LK, "pollock", "seitiä", "seitifilee", "seitifileetä"],

  // Dairy, eggs & cheese
  ["maito", MJ, "milk", "maitoa", "täysmaito", "kevytmaito", "rasvaton maito", "whole milk"],
  ["kerma", MJ, "cream", "kermaa"],
  ["kuohukerma", MJ, "heavy cream", "whipping cream", "double cream", "kuohukermaa", "vispikerma", "vispikermaa"],
  ["ruokakerma", MJ, "cooking cream", "single cream", "light cream", "ruokakermaa", "kaurakerma", "kaurakermaa", "kasvikerma"],
  ["kermaviili", MJ, "sour cream", "kermaviiliä"],
  ["smetana", MJ, "smetanaa"],
  ["ranskankerma", MJ, "crème fraîche", "creme fraiche", "ranskankermaa"],
  ["voi", MJ, "butter", "voita", "unsalted butter", "suolaton voi", "suolatonta voita"],
  ["juusto", MJ, "cheese", "juustoa", "raastettu juusto", "juustoraaste", "juustoraastetta", "grated cheese", "shredded cheese", "cheddar"],
  ["parmesaani", MJ, "parmesan", "parmigiano", "parmesaania", "parmesan cheese"],
  ["feta", MJ, "feta cheese", "fetaa", "fetajuusto", "fetajuustoa", "salaattijuusto", "salaattijuustoa"],
  ["mozzarella", MJ, "mozzarellaa"],
  ["tuorejuusto", MJ, "cream cheese", "tuorejuustoa"],
  ["raejuusto", MJ, "cottage cheese", "raejuustoa"],
  ["jogurtti", MJ, "yogurt", "yoghurt", "natural yogurt", "plain yogurt", "jogurttia", "maustamaton jogurtti", "maustamatonta jogurttia", "turkkilainen jogurtti", "turkkilaista jogurttia", "kreikkalainen jogurtti", "greek yogurt"],
  ["kananmuna", MJ, "egg", "eggs", "muna", "munaa", "munia", "kananmunaa", "kananmunia", "kananmunat"],

  // Dry goods, tins, spices, oils
  ["vehnäjauho", K, "flour", "all-purpose flour", "plain flour", "wheat flour", "vehnäjauhoja", "vehnäjauhot", "jauhoja", "jauho"],
  ["sokeri", K, "sugar", "sokeria", "fariinisokeri", "fariinisokeria", "brown sugar", "caster sugar"],
  ["suola", K, "salt", "suolaa", "merisuola", "merisuolaa", "sea salt", "salt and pepper"],
  ["mustapippuri", K, "black pepper", "pepper", "ground black pepper", "pippuri", "pippuria", "mustapippuria", "jauhettu mustapippuri", "jauhettua mustapippuria", "mustapippurirouhe", "mustapippurirouhetta"],
  ["rypsiöljy", K, "oil", "vegetable oil", "rapeseed oil", "canola oil", "cooking oil", "öljy", "öljyä", "rypsiöljyä", "ruokaöljy", "ruokaöljyä"],
  ["oliiviöljy", K, "olive oil", "extra virgin olive oil", "oliiviöljyä"],
  ["riisi", K, "rice", "riisiä", "jasmiiniriisi", "jasmiiniriisiä", "basmatiriisi", "basmatiriisiä", "jasmine rice", "basmati rice", "long grain rice"],
  ["pasta", K, "spaghetti", "spagetti", "spagettia", "makaroni", "makaronia", "penne", "pennepasta", "pastaa", "tagliatelle", "fusilli"],
  ["tomaattimurska", K, "crushed tomatoes", "canned tomatoes", "chopped tomatoes", "tinned tomatoes", "tomaattimurskaa", "tomaattimurskat", "paseerattu tomaatti", "paseerattua tomaattia", "passata"],
  ["tomaattipyree", K, "tomato paste", "tomato purée", "tomato puree", "tomaattipyreetä", "tomaattipyrettä"],
  ["kookosmaito", K, "coconut milk", "kookosmaitoa", "kookoskerma", "kookoskermaa", "coconut cream"],
  ["kasvisliemi", K, "vegetable stock", "vegetable broth", "kasvislientä", "kasvisliemikuutio", "kasvisliemikuutiota", "kasvisfondi", "kasvisfondia", "vegetable stock cube"],
  ["kanaliemi", K, "chicken stock", "chicken broth", "kanalientä", "kanaliemikuutio", "kanaliemikuutiota", "kanafondi", "kanafondia", "chicken stock cube"],
  ["lihaliemi", K, "beef stock", "beef broth", "lihalientä", "lihaliemikuutio", "lihaliemikuutiota", "naudanlihaliemi", "naudanlihalientä"],
  ["kalaliemi", K, "fish stock", "fish broth", "kalalientä", "kalaliemikuutio", "kalaliemikuutiota", "kalafondi", "kalafondia"],
  ["curry", K, "curry powder", "currya", "curryjauhe", "curryjauhetta"],
  ["currytahna", K, "curry paste", "red curry paste", "currytahnaa", "punainen currytahna", "punaista currytahnaa", "keltainen currytahna"],
  ["kaneli", K, "cinnamon", "kanelia", "jauhettu kaneli"],
  ["paprikajauhe", K, "paprika powder", "ground paprika", "smoked paprika", "paprikajauhetta", "savupaprika", "savupaprikaa", "savupaprikajauhe"],
  ["juustokumina", K, "cumin", "ground cumin", "juustokuminaa", "jauhettu juustokumina"],
  ["kurkuma", K, "turmeric", "kurkumaa"],
  ["garam masala", K, "garam masalaa"],
  ["laakerinlehti", K, "bay leaf", "bay leaves", "laakerinlehteä", "laakerinlehtiä"],
  ["maustepippuri", K, "allspice", "maustepippuria", "maustepippureita", "kokonainen maustepippuri", "kokonaisia maustepippureita"],
  ["oregano", K, "oreganoa", "kuivattu oregano"],
  ["timjami", K, "thyme", "timjamia"],
  ["soijakastike", K, "soy sauce", "soijaa", "soija", "soijakastiketta"],
  ["kikherne", K, "chickpeas", "chickpea", "kikherneet", "kikherneitä", "kikhernettä"],
  ["linssi", K, "lentils", "lentil", "linssejä", "punaiset linssit", "punaisia linssejä", "red lentils"],
  ["maissi", K, "corn", "sweetcorn", "maissia", "maissinjyvät", "maissinjyviä"],
  ["tonnikala", K, "tuna", "tonnikalaa", "tonnikalasäilyke"],
  ["hunaja", K, "honey", "hunajaa"],
  ["sinappi", K, "mustard", "sinappia", "dijon mustard", "dijoninsinappi", "dijoninsinappia"],
  ["perunajauho", K, "potato starch", "cornstarch", "cornflour", "perunajauhoja", "maissitärkkelys", "maissitärkkelystä", "maizena", "maizenaa"],
  ["leivinjauhe", K, "baking powder", "leivinjauhetta"],
  ["kaurahiutale", K, "oats", "rolled oats", "kaurahiutaleita", "kaurahiutaleet"],
  ["korppujauho", K, "breadcrumbs", "korppujauhoja", "korppujauhot"],
  ["valkoviinietikka", K, "white wine vinegar", "valkoviinietikkaa"],

  // Bread
  ["leipä", L, "bread", "leipää"],
  ["ruisleipä", L, "rye bread", "ruisleipää"],
  ["paahtoleipä", L, "toast bread", "sandwich bread", "paahtoleipää"],
  ["tortilla", L, "tortillas", "tortilloja", "tortillalettu", "tortillalettuja"],
  ["naanleipä", L, "naan", "naan bread", "naanleipää", "naanleipiä"],

  // Frozen
  ["herne", P, "peas", "frozen peas", "herneitä", "herneet", "pakasteherne", "pakasteherneitä"],
  ["pakastepinaatti", P, "frozen spinach", "pakastepinaattia", "pinaattipakaste"],
  ["pakastevihannes", P, "frozen vegetables", "frozen mixed vegetables", "pakastevihanneksia", "wokkivihannekset", "wokkivihanneksia"],

  // Drinks
  ["valkoviini", J, "white wine", "dry white wine", "valkoviiniä", "kuiva valkoviini", "kuivaa valkoviiniä"],
  ["punaviini", J, "red wine", "punaviiniä"],

  // Household (not food; section "muut")
  ["wc-paperi", "muut", "toilet paper", "vessapaperi", "wc-paperia", "vessapaperia"],
  ["talouspaperi", "muut", "paper towels", "kitchen roll", "talouspaperia"],
  ["astianpesuaine", "muut", "dish soap", "washing-up liquid", "astianpesuainetta"],
  ["konetiskiaine", "muut", "dishwasher tablets", "konetiskitabletit", "astianpesukonetabletit"],
  ["pyykinpesuaine", "muut", "laundry detergent", "pyykinpesuainetta"],
  ["roskapussi", "muut", "bin bags", "trash bags", "roskapusseja", "jätesäkki"],
  ["kahvi", J, "coffee", "kahvia", "suodatinkahvi"],
  ["tee", J, "tea", "teetä"],

  // Never bought
  ["vesi", "muut", "water", "vettä", "kylmää vettä", "kiehuvaa vettä", "lämmintä vettä", "cold water", "hot water", "boiling water"],
];

/** Ingredients that never go on the shopping list. */
export const NEVER_BUY = new Set(["vesi"]);

/** Staples → the list asks "have it?" instead of silently adding them. */
export const SEED_STAPLES = [
  "suola",
  "mustapippuri",
  "rypsiöljy",
  "oliiviöljy",
  "voi",
  "vehnäjauho",
  "sokeri",
  "curry",
  "kaneli",
  "paprikajauhe",
  "juustokumina",
  "kurkuma",
  "garam masala",
  "laakerinlehti",
  "maustepippuri",
  "oregano",
  "timjami",
  "kasvisliemi",
  "kanaliemi",
  "lihaliemi",
  "kalaliemi",
  "perunajauho",
];

export type SynonymEntry = { nameFi: string; category: SectionKey | null };

export function seedSynonymPairs(): Array<{ term: string; nameFi: string; category: SectionKey }> {
  const out: Array<{ term: string; nameFi: string; category: SectionKey }> = [];
  const seen = new Set<string>();
  for (const [nameFi, category, ...terms] of SEED_SYNONYMS) {
    for (const t of [nameFi, ...terms]) {
      const term = t.toLowerCase().trim();
      if (seen.has(term)) continue;
      seen.add(term);
      out.push({ term, nameFi, category });
    }
  }
  return out;
}
