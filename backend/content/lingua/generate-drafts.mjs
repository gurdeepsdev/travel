import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = path.dirname(fileURLToPath(import.meta.url));

const languages = [
  { code: "fr", name: "French", nativeName: "Français", displayOrder: 1, countries: ["FR"] },
  { code: "es", name: "Spanish", nativeName: "Español", displayOrder: 2, countries: ["ES"] },
  { code: "en", name: "English", nativeName: "English", displayOrder: 3, countries: ["GB"] },
  { code: "it", name: "Italian", nativeName: "Italiano", displayOrder: 4, countries: ["IT"] },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", displayOrder: 5, countries: ["TR"] },
  { code: "de", name: "German", nativeName: "Deutsch", displayOrder: 6, countries: ["DE"] },
  { code: "ja", name: "Japanese", nativeName: "日本語", displayOrder: 7, countries: ["JP"] },
  { code: "th", name: "Thai", nativeName: "ไทย", displayOrder: 8, countries: ["TH"] },
  { code: "pt", name: "Portuguese", nativeName: "Português", displayOrder: 9, countries: ["PT"] },
  { code: "ar", name: "Arabic", nativeName: "العربية", displayOrder: 10, countries: ["SA"] },
];

const topicTitles = {
  GREETINGS: "Essential greetings",
  TRANSPORT: "Transport and directions",
  HOTEL: "Hotel essentials",
  FOOD: "Food and payment",
  HELP: "Getting help",
};

const phraseRows = [
  ["GREETINGS", "please", "Please", "Use this to make a request polite.", { fr: "s'il vous plaît", es: "por favor", en: "please", it: "per favore", tr: "lütfen", de: "bitte", ja: ["お願いします", "onegaishimasu"], th: ["กรุณา", "karunaa"], pt: "por favor", ar: ["من فضلك", "min faḍlik"] }],
  ["GREETINGS", "thank-you", "Thank you", "Use this to express gratitude.", { fr: "merci", es: "gracias", en: "thank you", it: "grazie", tr: "teşekkürler", de: "danke", ja: ["ありがとうございます", "arigatō gozaimasu"], th: ["ขอบคุณ", "khàwp khun"], pt: "obrigado / obrigada", ar: ["شكراً", "shukran"] }],
  ["GREETINGS", "yes", "Yes", "Use this for an affirmative response.", { fr: "oui", es: "sí", en: "yes", it: "sì", tr: "evet", de: "ja", ja: ["はい", "hai"], th: ["ใช่", "châi"], pt: "sim", ar: ["نعم", "naʿam"] }],
  ["GREETINGS", "no", "No", "Use this for a negative response.", { fr: "non", es: "no", en: "no", it: "no", tr: "hayır", de: "nein", ja: ["いいえ", "iie"], th: ["ไม่", "mâi"], pt: "não", ar: ["لا", "lā"] }],
  ["GREETINGS", "excuse-me", "Excuse me", "Use this politely before asking for attention or assistance.", { fr: "excusez-moi", es: "disculpe", en: "excuse me", it: "scusi", tr: "affedersiniz", de: "Entschuldigung", ja: ["すみません", "sumimasen"], th: ["ขอโทษ", "khǎw thôht"], pt: "com licença", ar: ["عفواً", "ʿafwan"] }],

  ["TRANSPORT", "left", "Left", "This direction means left.", { fr: "gauche", es: "izquierda", en: "left", it: "sinistra", tr: "sol", de: "links", ja: ["左", "hidari"], th: ["ซ้าย", "sáai"], pt: "esquerda", ar: ["يسار", "yasār"] }],
  ["TRANSPORT", "right", "Right", "This direction means right.", { fr: "droite", es: "derecha", en: "right", it: "destra", tr: "sağ", de: "rechts", ja: ["右", "migi"], th: ["ขวา", "khwǎa"], pt: "direita", ar: ["يمين", "yamīn"] }],
  ["TRANSPORT", "straight-ahead", "Straight ahead", "Use this direction to continue forward.", { fr: "tout droit", es: "todo recto", en: "straight ahead", it: "dritto", tr: "düz", de: "geradeaus", ja: ["まっすぐ", "massugu"], th: ["ตรงไป", "trong pai"], pt: "em frente", ar: ["على طول", "ʿalā ṭūl"] }],
  ["TRANSPORT", "taxi", "Taxi", "Use this word when looking for a taxi.", { fr: "taxi", es: "taxi", en: "taxi", it: "taxi", tr: "taksi", de: "Taxi", ja: ["タクシー", "takushī"], th: ["แท็กซี่", "thaeksîi"], pt: "táxi", ar: ["تاكسي", "tāksī"] }],
  ["TRANSPORT", "airport", "Airport", "Use this word when referring to an airport.", { fr: "aéroport", es: "aeropuerto", en: "airport", it: "aeroporto", tr: "havalimanı", de: "Flughafen", ja: ["空港", "kūkō"], th: ["สนามบิน", "sanǎam bin"], pt: "aeroporto", ar: ["مطار", "maṭār"] }],

  ["HOTEL", "reservation", "Reservation", "Use this word when referring to a booking.", { fr: "réservation", es: "reserva", en: "reservation", it: "prenotazione", tr: "rezervasyon", de: "Reservierung", ja: ["予約", "yoyaku"], th: ["การจอง", "kaan jaawng"], pt: "reserva", ar: ["حجز", "ḥajz"] }],
  ["HOTEL", "hotel", "Hotel", "Use this word when referring to a hotel.", { fr: "hôtel", es: "hotel", en: "hotel", it: "albergo", tr: "otel", de: "Hotel", ja: ["ホテル", "hoteru"], th: ["โรงแรม", "rohng raem"], pt: "hotel", ar: ["فندق", "funduq"] }],
  ["HOTEL", "passport", "Passport", "Use this word when referring to your passport.", { fr: "passeport", es: "pasaporte", en: "passport", it: "passaporto", tr: "pasaport", de: "Reisepass", ja: ["パスポート", "pasupōto"], th: ["หนังสือเดินทาง", "nǎngsʉ̌ʉ dəən thaang"], pt: "passaporte", ar: ["جواز سفر", "jawāz safar"] }],
  ["HOTEL", "toilet", "Toilet / WC", "Use this when asking about a toilet or restroom.", { fr: "toilettes", es: "baño", en: "toilet / WC", it: "bagno", tr: "tuvalet", de: "Toilette", ja: ["トイレ", "toire"], th: ["ห้องน้ำ", "hâwng náam"], pt: "casa de banho", ar: ["حمّام", "ḥammām"] }],
  ["HOTEL", "where-is", "Where is …?", "Use this pattern to ask for the location of something.", { fr: "où est … ?", es: "¿dónde está …?", en: "where is …?", it: "dov'è …?", tr: "… nerede?", de: "wo ist …?", ja: ["…はどこですか？", "… wa doko desu ka?"], th: ["…อยู่ที่ไหน", "… yùu thîi nǎi"], pt: "onde fica …?", ar: ["أين …؟", "ayna …?"] }],

  ["FOOD", "i-would-like", "I would like …", "Use this pattern to request an item politely.", { fr: "je voudrais …", es: "quisiera …", en: "I would like …", it: "vorrei …", tr: "… istiyorum", de: "ich möchte …", ja: ["…をお願いします", "… o onegaishimasu"], th: ["อยากได้ …", "yàak dâai …"], pt: "queria …", ar: ["أريد …", "urīd …"] }],
  ["FOOD", "water", "Water", "Use this word when ordering or asking for water.", { fr: "eau", es: "agua", en: "water", it: "acqua", tr: "su", de: "Wasser", ja: ["水", "mizu"], th: ["น้ำ", "náam"], pt: "água", ar: ["ماء", "māʾ"] }],
  ["FOOD", "cash", "Cash", "Use this word when asking about cash payment.", { fr: "espèces", es: "efectivo", en: "cash", it: "contanti", tr: "nakit", de: "Bargeld", ja: ["現金", "genkin"], th: ["เงินสด", "ngən sòt"], pt: "dinheiro", ar: ["نقد", "naqd"] }],
  ["FOOD", "card", "Card", "Use this word when asking about card payment.", { fr: "carte", es: "tarjeta", en: "card", it: "carta", tr: "kart", de: "Karte", ja: ["カード", "kādo"], th: ["บัตรเครดิต", "bàt kredìt"], pt: "cartão", ar: ["بطاقة", "biṭāqa"] }],
  ["FOOD", "bill", "Bill / check", "Use this when asking for the bill after a meal.", { fr: "l'addition", es: "la cuenta", en: "bill / check", it: "il conto", tr: "hesap", de: "die Rechnung", ja: ["お会計", "okaikei"], th: ["เช็คบิล", "chék bin"], pt: "a conta", ar: ["الحساب", "al-ḥisāb"] }],

  ["HELP", "help", "Help!", "Use this to call for urgent help.", { fr: "au secours !", es: "¡socorro!", en: "help!", it: "aiuto!", tr: "imdat!", de: "Hilfe!", ja: ["助けて！", "tasukete!"], th: ["ช่วยด้วย!", "chûay dûay!"], pt: "socorro!", ar: ["النجدة!", "an-najda!"] }],
  ["HELP", "doctor", "Doctor", "Use this word when you need a doctor.", { fr: "médecin", es: "médico", en: "doctor", it: "medico", tr: "doktor", de: "Arzt", ja: ["医者", "isha"], th: ["หมอ", "mǎw"], pt: "médico", ar: ["طبيب", "ṭabīb"] }],
  ["HELP", "hospital", "Hospital", "Use this word when looking for a hospital.", { fr: "hôpital", es: "hospital", en: "hospital", it: "ospedale", tr: "hastane", de: "Krankenhaus", ja: ["病院", "byōin"], th: ["โรงพยาบาล", "rohng phayaabaan"], pt: "hospital", ar: ["مستشفى", "mustashfā"] }],
  ["HELP", "ambulance", "Ambulance", "Use this word when requesting an ambulance.", { fr: "ambulance", es: "ambulancia", en: "ambulance", it: "ambulanza", tr: "ambulans", de: "Krankenwagen", ja: ["救急車", "kyūkyūsha"], th: ["รถพยาบาล", "rót phayaabaan"], pt: "ambulância", ar: ["سيارة إسعاف", "sayyārat isʿāf"] }],
  ["HELP", "police", "Police", "Use this word when you need the police.", { fr: "police", es: "policía", en: "police", it: "polizia", tr: "polis", de: "Polizei", ja: ["警察", "keisatsu"], th: ["ตำรวจ", "tamrùat"], pt: "polícia", ar: ["شرطة", "shurṭa"] }],
];

const englishPrompts = {
  please: "Which phrase makes a request polite?",
  "thank-you": "Which phrase expresses gratitude?",
  yes: "Which phrase gives an affirmative answer?",
  no: "Which phrase gives a negative answer?",
  "excuse-me": "Which phrase politely gets someone's attention?",
  left: "Which word directs someone to the left?",
  right: "Which word directs someone to the right?",
  "straight-ahead": "Which phrase tells someone to continue forward?",
  taxi: "Which word asks for a hired car?",
  airport: "Which word identifies the place where flights arrive and depart?",
  reservation: "Which word refers to a booking?",
  hotel: "Which word identifies paid travel accommodation?",
  passport: "Which word identifies an international travel document?",
  toilet: "Which phrase identifies a restroom?",
  "where-is": "Which phrase asks for the location of something?",
  "i-would-like": "Which phrase politely requests an item?",
  water: "Which word asks for drinking water?",
  cash: "Which word identifies payment using notes or coins?",
  card: "Which word identifies card payment?",
  bill: "Which phrase asks for the amount owed after a meal?",
  help: "Which phrase calls for urgent assistance?",
  doctor: "Which word identifies a medical doctor?",
  hospital: "Which word identifies a medical facility?",
  ambulance: "Which word identifies an emergency medical vehicle?",
  police: "Which word identifies law-enforcement officers?",
};

function unpack(value) {
  return Array.isArray(value)
    ? { targetText: value[0], romanization: value[1] }
    : { targetText: value };
}

function buildLesson(language, topic, lessonIndex) {
  const rows = phraseRows.filter(([rowTopic]) => rowTopic === topic);

  return {
    stableKey: topic.toLowerCase(),
    version: 1,
    title: topicTitles[topic],
    topic,
    displayOrder: lessonIndex + 1,
    phrases: rows.map(([, stableKey, meaning, explanation, translations], phraseIndex) => {
      const translated = unpack(translations[language.code]);
      const optionRows = [
        rows[phraseIndex],
        rows[(phraseIndex + 1) % rows.length],
        rows[(phraseIndex + 2) % rows.length],
      ];

      return {
        stableKey,
        targetText: translated.targetText,
        englishMeaning: meaning,
        ...(translated.romanization ? { romanization: translated.romanization } : {}),
        ...(language.code === "pt" ? { regionalVariant: "European Portuguese (pt-PT)" } : {}),
        ...(language.code === "ar" ? { regionalVariant: "Modern Standard Arabic (MSA)" } : {}),
        displayOrder: phraseIndex + 1,
        question: {
          type: language.code === "en" ? "SITUATION_TO_PHRASE" : "MEANING_RECOGNITION",
          prompt: language.code === "en"
            ? englishPrompts[stableKey]
            : `What does “${translated.targetText}” mean in English?`,
          explanation,
          explanationLanguage: "en",
          options: optionRows.map((optionRow, optionIndex) => ({
            stableKey: `option-${optionIndex + 1}`,
            text: language.code === "en"
              ? unpack(optionRow[4].en).targetText
              : optionRow[2],
            correct: optionIndex === 0,
            displayOrder: optionIndex + 1,
          })),
        },
      };
    }),
  };
}

for (const language of languages) {
  const content = {
    language: {
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      displayOrder: language.displayOrder,
      defaultCountryCodes: language.countries,
    },
    lessons: Object.keys(topicTitles).map((topic, index) =>
      buildLesson(language, topic, index)),
  };

  await fs.writeFile(
    path.join(outputDirectory, `${language.code}.json`),
    `${JSON.stringify(content, null, 2)}\n`,
    "utf8",
  );
}
