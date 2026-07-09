/* ==========================================================================
   HYROX Tracker — vanilla JS PWA + Firebase (individuele login + gedeelde data)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 1. DATA (statisch trainingsschema — identiek voor iedereen)
   * ------------------------------------------------------------------ */

  var DEFAULT_START = "2026-07-07";
  var DEFAULT_RACE = "2026-12-20";

  var PHASE_META = [
    { id: 1, name: "Fase 1 — Base & Cut" },
    { id: 2, name: "Fase 2 — Build" },
    { id: 3, name: "Fase 3 — HYROX-specifiek" },
    { id: 4, name: "Fase 4 — Peak" },
    { id: 5, name: "Fase 5 — Taper" }
  ];
  // Verhouding in dagen, gebaseerd op het originele schema (7 jul – 20 dec 2026 = 167 dagen).
  // Wordt proportioneel herschaald naar elke gekozen start-/wedstrijddatum.
  var PHASE_RATIOS = [41, 42, 42, 28, 14];

  var DOW_KEYS = ["zon", "maa", "din", "woe", "don", "vri", "zat"]; // getDay() 0-6
  var DOW_LABELS = {
    zon: "Zondag", maa: "Maandag", din: "Dinsdag", woe: "Woensdag",
    don: "Donderdag", vri: "Vrijdag", zat: "Zaterdag"
  };

  var WEEKPLANS = {
    1: {
      maa: { title: "Kracht bovenlichaam (hypertrofie/techniek, RPE 7-8)", extra: "Zone 2 – 20 min rustig" },
      din: { title: "Looptraining – Zone 2 duurloop, 20-25 min", extra: "" },
      woe: { title: "Kracht benen (hypertrofie/techniek, RPE 7-8)", extra: "" },
      don: { title: "Rust – mobiliteit 15-20 min + minstens 8.000 stappen", extra: "" },
      vri: { title: "Full body kracht (RPE 7-8)", extra: "Korte intervalprikkel, licht" },
      zat: { title: "HYROX-introductiecircuit (1x/2 weken) of lange duurloop 25-30 min", extra: "" },
      zon: { title: "Actief herstel – wandelen, licht mobiliteitswerk", extra: "" }
    },
    2: {
      maa: { title: "Kracht bovenlichaam (kracht, RPE 7-9, 5x5-schema)", extra: "Zone 2 – 25-30 min" },
      din: { title: "Looptraining – intervallen", extra: "" },
      woe: { title: "Kracht benen (kracht, RPE 7-9)", extra: "" },
      don: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      vri: { title: "Full body kracht + intervals", extra: "Korte tempo-intervallen na kracht" },
      zat: { title: "HYROX-circuit (fase 2-opbouw) of lange duurloop 35-40 min", extra: "" },
      zon: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    3: {
      maa: { title: "Kracht bovenlichaam (functioneel/circuit, RPE 7-8)", extra: "Zone 2 – 25-30 min" },
      din: { title: "Looptraining – intervallen/tempo", extra: "" },
      woe: { title: "Kracht benen (functioneel/circuit, RPE 7-8)", extra: "" },
      don: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      vri: { title: "Full body kracht + intervals (brick-run na kracht)", extra: "Brick-run 15-20 min" },
      zat: { title: "HYROX-circuit of halve simulatie", extra: "" },
      zon: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    4: {
      maa: { title: "Kracht bovenlichaam (onderhoud, verlaagd volume, RPE 7)", extra: "Zone 2 – 20-25 min" },
      din: { title: "Looptraining – korte scherpe intervallen", extra: "" },
      woe: { title: "Kracht benen (onderhoud, verlaagd volume, RPE 7)", extra: "" },
      don: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      vri: { title: "Full body kracht (licht) + korte intervals", extra: "Brick-run 15 min" },
      zat: { title: "(Bijna) volledige HYROX-simulatie (om de 2 weken)", extra: "" },
      zon: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    5: {
      maa: { title: "Kracht full body – licht onderhoud (RPE 6)", extra: "Zone 2 – 15-20 min" },
      din: { title: "Korte technische intervallen (laag volume)", extra: "" },
      woe: { title: "Mobiliteit + lichte activatie (geen zware kracht)", extra: "" },
      don: { title: "Rust – wandelen, minstens 8.000 stappen", extra: "" },
      vri: { title: "Zeer lichte activatie / volledige rust", extra: "" },
      zat: { title: "Rust of korte jog 10-15 min", extra: "" },
      zon: { title: "Rust / mogelijke wedstrijddag", extra: "" }
    }
  };

  var STRENGTH_MAP = {
    1: { maa: "UPPER", woe: "LEGS", vri: "FULLBODY" },
    2: { maa: "UPPER", woe: "LEGS", vri: "FULLBODY" },
    3: { maa: "UPPER", woe: "LEGS", vri: "FULLBODY" },
    4: { maa: "UPPER", woe: "LEGS", vri: "FULLBODY" },
    5: { maa: "FULLBODY" }
  };

  var UPPER_EX = [
    ["Bench press", "MAIN"], ["Incline dumbbell press", "ACC"],
    ["Lat pulldown of pull-up", "MAIN2"], ["Seated cable row", "ACC"],
    ["Shoulder press", "ACC"], ["Lateral raises", "ACC"],
    ["Triceps pushdown", "ACC"], ["Biceps curl", "ACC"], ["Plank", "CORE"]
  ];
  var LEGS_EX = [
    ["Back squat of leg press", "MAIN"], ["Romanian deadlift", "MAIN2"],
    ["Bulgarian split squat", "ACC"], ["Walking lunges", "ACC"],
    ["Leg curl", "ACC"], ["Calf raises", "ACC"],
    ["Core (weighted plank / hanging knee raise)", "CORE"]
  ];
  var FULLBODY_EX = [
    ["Deadlift of trap bar deadlift", "MAIN"], ["Front squat of goblet squat", "MAIN2"],
    ["Push press", "ACC"], ["Pull-ups/lat pulldown", "ACC"],
    ["Dumbbell row", "ACC"], ["Farmers carry", "CARRY"], ["Wall balls", "COND"]
  ];
  var EX_LISTS = { UPPER: UPPER_EX, LEGS: LEGS_EX, FULLBODY: FULLBODY_EX };

  var EXERCISE_INFO = {
    "Bench press": "Voeten plat op de grond, schouderbladen samengetrokken, stang raakt de borst ter hoogte van de tepels, duw explosief omhoog.",
    "Incline dumbbell press": "Bank op 30-45°, dumbbells starten op schouderhoogte, duw omhoog zonder de onderrug hol te trekken.",
    "Lat pulldown of pull-up": "Trek met de ellebogen, niet met de handen; stang/kin richting borst, schouders laag houden.",
    "Seated cable row": "Rechte rug, trek de ellebogen naar achter langs het lichaam, knijp de schouderbladen samen.",
    "Shoulder press": "Core aangespannen, druk recht omhoog zonder overmatig hol te hangen in de onderrug.",
    "Lateral raises": "Lichte buiging in de ellebogen, til tot schouderhoogte, geen swing/momentum gebruiken.",
    "Triceps pushdown": "Ellebogen dicht tegen het lichaam, enkel de onderarm beweegt.",
    "Biceps curl": "Ellebogen stil houden naast het lichaam, volledige bewegingsuitslag.",
    "Plank": "Rechte lijn van hoofd tot hakken, buik en billen aangespannen, niet doorzakken in de onderrug.",
    "Back squat of leg press": "Knieën in lijn met de tenen, borst hoog, zak tot minstens heuphoogte parallel.",
    "Romanian deadlift": "Lichte buiging in de knieën, zak via de heupen (hip hinge), stang/gewicht dicht bij de benen.",
    "Bulgarian split squat": "Achterste voet verhoogd, zak recht naar beneden, voorste knie niet ver voorbij de teen.",
    "Walking lunges": "Grote stap, achterste knie bijna de grond raken, rechtop blijven staan.",
    "Leg curl": "Gecontroleerde beweging, geen momentum, volledige bewegingsuitslag.",
    "Calf raises": "Volledige bewegingsuitslag, korte pauze boven aan de beweging.",
    "Core (weighted plank / hanging knee raise)": "Rustig tempo, vermijd zwaaien; ademhaling blijft gelijkmatig.",
    "Deadlift of trap bar deadlift": "Rug recht, stang/handvaten dicht bij het lichaam, duw de vloer weg met de benen.",
    "Front squat of goblet squat": "Ellebogen hoog (front squat) of gewicht dicht tegen de borst (goblet), rechtop blijven.",
    "Push press": "Kleine dip met de benen, gebruik het beenwerk om het gewicht boven het hoofd te duwen.",
    "Pull-ups/lat pulldown": "Trek met de rug/ellebogen, volledige uithanging boven, kin over de stang.",
    "Dumbbell row": "Rechte rug, trek de elleboog naar achter, knijp het schouderblad samen boven.",
    "Farmers carry": "Rechtop blijven, schouders naar achter, stevige grip, korte gecontroleerde passen.",
    "Wall balls": "Volledige squat, werp de bal met de beenkracht, vang en herhaal in één vloeiende beweging."
  };

  var RPE_INFO_TEXT = "RPE = ervaren inspanning. 6 = comfortabel (~4 reps reserve), 7 = behapbaar (~3 reps), 8 = zwaar (~2 reps), 9 = zeer zwaar (~1 rep). Techniek gaat altijd vóór gewicht.";
  var DELOAD_INFO_TEXT = "Deload-week: volume met ongeveer 20% verlaagd om herstel te bevorderen en overbelasting te voorkomen — een normale, ingeplande stap in de opbouw, geen terugval.";

  var STARTW = {
    MAIN: "Bepalen via opwarmprotocol – doel-RPE zoals vermeld.",
    MAIN2: "Bepalen via opwarmprotocol – doel-RPE zoals vermeld.",
    ACC: "Bepalen via opwarmprotocol – doel-RPE zoals vermeld.",
    CORE: "Lichaamsgewicht; voeg extern gewicht toe als RPE te laag is.",
    CARRY: "Kies kettlebells/dumbbells zodat de afstand haalbaar is op doel-RPE.",
    COND: "Kies wall ball zodat reps haalbaar zijn op doel-RPE (richtwaarde 4-6 kg dames / 6-9 kg heren)."
  };

  var PHASE_SCHEME = {
    1: {
      MAIN: ["4x8", "7-8", "120 sec", "+2,5 kg (bovenlichaam) / +2,5-5 kg (onderlichaam) zodra alle sets lukken op doel-RPE."],
      MAIN2: ["4x8", "7-8", "120 sec", "+2,5 kg zodra alle sets lukken op doel-RPE, techniek perfect."],
      ACC: ["3x10-12", "7-8", "75 sec", "+1-2 kg of +1 rep/set zodra RPE onder doel blijft op alle sets."],
      CORE: ["3x30-45 sec", "7", "60 sec", "+5-10 sec per set zodra houding perfect blijft."],
      CARRY: ["3x30-40 m", "7", "90 sec", "+5 m of +2,5 kg per kettlebell zodra RPE onder doel blijft."],
      COND: ["3x15 reps", "7", "60 sec", "+2-3 reps per set of verklein rust met 10 sec."],
      note: "Focus: techniek aanleren, hypertrofie behouden tijdens calorietekort. Deload in week 4: 1 set minder per oefening, RPE -1."
    },
    2: {
      MAIN: ["5x5", "7-9", "150 sec", "+2,5-5 kg zodra alle 5x5 lukt op RPE ≤ 8, twee sessies op rij."],
      MAIN2: ["4x6", "7-8", "120 sec", "+2,5 kg zodra alle sets lukken op doel-RPE."],
      ACC: ["3x8-10", "8", "75 sec", "+1-2 kg of +1 rep/set zodra RPE onder doel blijft."],
      CORE: ["3x45-60 sec", "7-8", "60 sec", "+10-15 sec per set of voeg extern gewicht toe."],
      CARRY: ["4x40 m", "8", "90 sec", "+5 m of +2,5 kg per kettlebell zodra techniek stabiel blijft."],
      COND: ["4x15-20 reps", "7-8", "60 sec", "+2-5 reps per set of verklein rust met 10 sec."],
      note: "Focus: zwaardere compound-kracht opbouwen. Deload in week 8: -20% volume."
    },
    3: {
      MAIN: ["4x6", "7-8", "90 sec", "Gewicht +2,5 kg enkel als techniek en RPE dit toelaten; prioriteit op dichtheid."],
      MAIN2: ["4x6", "7-8", "90 sec", "Idem MAIN — focus op minder rust i.p.v. meer gewicht."],
      ACC: ["3x12-15 (superset)", "7", "45-60 sec", "Verklein rust met 10 sec vóór je gewicht verhoogt."],
      CORE: ["3x45-60 sec", "7", "45 sec", "+10 sec per set of voeg beweging toe."],
      CARRY: ["4x50 m (zwaarder)", "8", "75 sec", "+afstand of +gewicht richting wedstrijdbelasting."],
      COND: ["3x20 reps", "7-8", "45 sec", "Opbouwen richting wedstrijdvolume van 100 reps in 1 set."],
      note: "Focus: functionele kracht/spieruithouding, minder rust. Deload in week 16: -20% volume."
    },
    4: {
      MAIN: ["3x5", "7", "120 sec", "Gewicht behouden — geen PR-pogingen. Prioriteit: frisheid voor simulaties."],
      MAIN2: ["3x5", "7", "120 sec", "Gewicht behouden, techniek scherp houden."],
      ACC: ["2x10", "7", "60 sec", "Volume bewust laag houden, geen progressiedruk."],
      CORE: ["2x45 sec", "6-7", "45 sec", "Onderhoud, geen opbouw."],
      CARRY: ["3x50 m", "7", "90 sec", "Onderhoud richting wedstrijdgewicht/afstand."],
      COND: ["2x15 reps", "7", "60 sec", "Onderhoud, techniek boven volume."],
      note: "Focus: volume -20 à -30% t.o.v. fase 3. Vierde taperweek extra licht (ingebouwde deload)."
    },
    5: {
      MAIN: ["2x8", "6", "90 sec", "Geen progressie meer — enkel doorbloeding en techniek."],
      MAIN2: ["2x8", "6", "90 sec", "Geen progressie meer — enkel doorbloeding en techniek."],
      ACC: ["1x10 (optioneel, licht)", "6", "60 sec", "Enkel indien het lichaam vraagt om te bewegen — nooit verplicht."],
      CORE: ["2x30 sec", "5-6", "45 sec", "Onderhoud."],
      CARRY: ["2x30 m", "6", "60 sec", "Licht, enkel bewegingspatroon activeren."],
      COND: ["2x10 reps", "6", "60 sec", "Licht, enkel bewegingspatroon activeren."],
      note: "Focus: maximale frisheid. Laatste krachtsessie uiterlijk 5 dagen voor de wedstrijd."
    }
  };

  // Loopschema per relatieve programmamaand (1e, 2e, 3e... maand van het traject),
  // onafhankelijk van de kalendermaand — zo blijft dit correct bij elke startdatum.
  var RUN_STAGES = [
    { zone2: "2x 20-25 min Z2", interval: "Nog geen (gewenning)", tempo: "Geen", brick: "1x 10 min, laag tempo", long: "Za: 25-30 min Z2", volume: "≈60-70 min/week — gewoonte opbouwen" },
    { zone2: "2x 25-30 min Z2", interval: "6x 1 min Z4 / 2 min Z1", tempo: "Geen", brick: "1x 10-15 min", long: "Za: 35-40 min Z2", volume: "≈90-100 min/week — doel: 5 km comfortabel" },
    { zone2: "2x 30 min Z2", interval: "5x 3 min Z4 / 2 min Z1", tempo: "1x 10 min Z3", brick: "1x 15-20 min", long: "Za: 45-50 min Z2", volume: "≈8 km totaalvolume/week" },
    { zone2: "2x 30-35 min Z2", interval: "6x 800 m Z4 / 90 sec rust", tempo: "1x 15-20 min Z3", brick: "1x 20 min direct na kracht", long: "Halve HYROX-simulatie", volume: "Opbouw richting simulatie" },
    { zone2: "2x 30 min Z2", interval: "8x 400 m Z4-Z5 / korte rust", tempo: "1x 20-25 min Z3", brick: "Meerdere korte runs tussen stations", long: "(Bijna) volledige simulatie", volume: "Piekvolume" },
    { zone2: "2x 25-30 min Z2", interval: "4x 400 m Z4 (onderhoud)", tempo: "1x 10-15 min Z3", brick: "1x 15 min", long: "Laatste volledige simulatie", volume: "Afbouw richting taper" }
  ];

  var HR_ZONES = [
    ["Z1", "Herstel", "98-118 bpm"],
    ["Z2", "Basis / vetverbranding", "118-137 bpm"],
    ["Z3", "Tempo / aeroob", "137-157 bpm"],
    ["Z4", "Drempel", "157-176 bpm"],
    ["Z5", "Maximaal", "176-196 bpm"]
  ];

  var HYROX_CIRCUITS = {
    1: [{ label: "Introductiecircuit", rounds: 2, rest: "Rust 3 min tussen de ronden", items: [
      "500 m run", "15 walking lunges per been (licht)", "10 burpees", "500 m row of ski-erg", "100 m farmers carry (licht)"
    ] }],
    2: [{ label: "Opbouwcircuit", rounds: 3, rest: "Rust 3 min tussen de ronden", items: [
      "800 m run", "500 m row", "20 walking lunges", "20 wall balls", "100 m farmers carry"
    ] }],
    3: [
      { label: "Halve simulatie A", rounds: 1, rest: "", items: [
        "1 km run", "1000 m SkiErg", "1 km run", "Sled Push (halve afstand)", "1 km run", "Sled Pull (halve afstand)", "1 km run", "80 m Burpee Broad Jump"
      ] },
      { label: "Halve simulatie B", rounds: 1, rest: "", items: [
        "1 km run", "1000 m Row", "1 km run", "200 m Farmers Carry", "1 km run", "100 m Sandbag Lunges", "1 km run", "100 Wall Balls"
      ] }
    ],
    4: [{ label: "(Bijna) volledige simulatie — om de 2 weken", rounds: 1, rest: "", items: [
      "1 km run", "1000 m SkiErg", "1 km run", "Sled Push", "1 km run", "Sled Pull", "1 km run",
      "80 m Burpee Broad Jump", "1 km run", "1000 m Row", "1 km run", "200 m Farmers Carry",
      "1 km run", "100 m Sandbag Lunges", "1 km run", "100 Wall Balls"
    ] }],
    5: [{ label: "Taper-activatie (licht)", rounds: 1, rest: "", items: [
      "SkiErg – kort", "Sled Push – kort", "Sled Pull – kort", "Burpee Broad Jump – kort",
      "Row – kort", "Farmers Carry – kort", "Sandbag Lunges – kort", "Wall Balls – kort"
    ] }]
  };

  var RPE_TABLE = [
    ["6", "±4", "Comfortabel, opwarmgewicht"],
    ["7", "±3", "Behapbaar, techniek blijft perfect"],
    ["8", "±2", "Zwaar, laatste 2 reps vragen focus"],
    ["9", "±1", "Zeer zwaar, net geen falen"],
    ["10", "0", "Volledig falen – vermijden"]
  ];

  var PERSON_LABELS = { sean: "Sean", vriendin: "Vriendin" };
  var PERSON_COLORS = { sean: "#D62828", vriendin: "#2563EB" };
  var PERSON_EMAILS = {
    sean: "sean@hyrox-gent-2026-tracker.local",
    vriendin: "vriendin@hyrox-gent-2026-tracker.local"
  };

  /* ------------------------------------------------------------------ *
   * 2. DATUM-HELPERS + DYNAMISCH SCHEMA (start-/wedstrijddatum instelbaar)
   * ------------------------------------------------------------------ */

  var MS_DAY = 86400000;

  function parseISO(s) {
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function toISO(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function midnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function clampDate(d, min, max) {
    if (d < min) return min;
    if (d > max) return max;
    return d;
  }
  function getMonday(d) {
    var r = midnight(d);
    var dow = r.getDay();
    var diff = dow === 0 ? -6 : 1 - dow;
    return addDays(r, diff);
  }
  function formatNLLong(d) {
    return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function formatNLShort(d) {
    return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  }

  function computePhases(startISO, raceISO) {
    var start = parseISO(startISO), race = parseISO(raceISO);
    var totalDays = Math.round((race.getTime() - start.getTime()) / MS_DAY) + 1;
    if (totalDays < 5) totalDays = 5;

    var ratioSum = PHASE_RATIOS.reduce(function (a, b) { return a + b; }, 0);
    var raw = PHASE_RATIOS.map(function (r) { return totalDays * (r / ratioSum); });
    var days = raw.map(function (v) { return Math.max(1, Math.floor(v)); });
    var used = days.reduce(function (a, b) { return a + b; }, 0);
    var remainder = totalDays - used;
    var order = raw.map(function (v, i) { return { i: i, frac: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.frac - a.frac; });
    var k = 0;
    while (remainder > 0 && order.length) {
      days[order[k % order.length].i]++;
      remainder--;
      k++;
    }

    var phases = [];
    var cursor = new Date(start);
    for (var i = 0; i < PHASE_META.length; i++) {
      var s = new Date(cursor);
      var e = addDays(s, days[i] - 1);
      phases.push({ id: PHASE_META[i].id, name: PHASE_META[i].name, start: toISO(s), end: toISO(e) });
      cursor = addDays(e, 1);
    }
    phases[phases.length - 1].end = toISO(race);
    return phases;
  }

  var PROGRAM_START, PROGRAM_END, START_DATE, END_DATE, FIRST_MONDAY, LAST_MONDAY, PHASES;

  function applyScheduleSettings(startISO, raceISO) {
    PROGRAM_START = startISO;
    PROGRAM_END = raceISO;
    START_DATE = parseISO(startISO);
    END_DATE = parseISO(raceISO);
    FIRST_MONDAY = getMonday(START_DATE);
    LAST_MONDAY = getMonday(END_DATE);
    PHASES = computePhases(startISO, raceISO);
  }
  applyScheduleSettings(DEFAULT_START, DEFAULT_RACE);

  function getPhase(date) {
    var t = midnight(date).getTime();
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      if (t >= parseISO(p.start).getTime() && t <= parseISO(p.end).getTime()) return p;
    }
    return t < START_DATE.getTime() ? PHASES[0] : PHASES[PHASES.length - 1];
  }
  function inProgram(date) {
    var t = midnight(date).getTime();
    return t >= START_DATE.getTime() && t <= END_DATE.getTime();
  }
  function programWeekNum(date) {
    var diff = Math.floor((midnight(date).getTime() - START_DATE.getTime()) / (7 * MS_DAY));
    return diff + 1;
  }
  function totalProgramWeeks() {
    return Math.max(1, Math.ceil((END_DATE.getTime() - START_DATE.getTime()) / MS_DAY / 7));
  }
  function isDeloadWeek(date) {
    var w = programWeekNum(date);
    var total = totalProgramWeeks();
    return w > 0 && w < total && w % 4 === 0;
  }
  function dowKey(date) {
    return DOW_KEYS[date.getDay()];
  }
  function monthRunInfo(date) {
    var idx = Math.floor((midnight(date).getTime() - START_DATE.getTime()) / MS_DAY / 30.44);
    if (idx < 0) idx = 0;
    if (idx >= RUN_STAGES.length) idx = RUN_STAGES.length - 1;
    var stage = RUN_STAGES[idx];
    var out = { label: date.toLocaleDateString("nl-BE", { month: "long" }) };
    for (var key in stage) out[key] = stage[key];
    return out;
  }
  function getTaperSchedule() {
    var phase5 = PHASES[PHASES.length - 1];
    var start = parseISO(phase5.start);
    var race = END_DATE;
    var quality = clampDate(addDays(race, -5), start, race);
    var lightStart = clampDate(addDays(race, -4), start, race);
    var rest = clampDate(addDays(race, -1), start, race);
    var rows = [];
    if (quality.getTime() > start.getTime()) {
      rows.push([formatNLShort(start) + " – " + formatNLShort(addDays(quality, -1)), "Zone 2-lopen + 1x korte intervallen, volume duidelijk lager dan fase 4"]);
    }
    rows.push([formatNLShort(quality), "Laatste kwaliteitssessie: 20 min Z2 + korte scherpe intervallen"]);
    if (rest.getTime() > lightStart.getTime()) {
      rows.push([formatNLShort(lightStart) + " – " + formatNLShort(addDays(rest, -1)), "Enkel lichte jogs 10-15 min Z1-Z2, of volledige rust"]);
    }
    rows.push([formatNLShort(rest), "Volledige rust of 'flush-run' 10 min zeer rustig Z1"]);
    rows.push([formatNLShort(race), "WEDSTRIJDDAG"]);
    return rows;
  }

  /* ------------------------------------------------------------------ *
   * 3. PROFIEL (lokaal per toestel: "wie ben jij")
   * ------------------------------------------------------------------ */

  function getProfile() {
    return localStorage.getItem("hyrox_profile");
  }
  function setProfile(p) {
    localStorage.setItem("hyrox_profile", p);
  }
  function clearProfile() {
    localStorage.removeItem("hyrox_profile");
  }
  function otherProfile() {
    var p = getProfile();
    return p === "sean" ? "vriendin" : "sean";
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  /* ------------------------------------------------------------------ *
   * 4. FIREBASE — auth (individuele codes) + gedeelde data (Firestore + Storage)
   * ------------------------------------------------------------------ */

  var fbApp = null, auth = null, db = null, storage = null;
  var AUTH_READY = false;
  var CURRENT_USER = null;
  var LOGIN_ERROR = "";
  var PASSWORD_MSG = "";
  var CACHE = { daily: {}, ex: {}, run: {}, circuit: {}, progress: [] };
  var listeners = [];
  var rerenderTimer = null;
  var authTimedOut = false;

  function firebaseConfigured() {
    return typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey.indexOf("VUL_HIER_IN") === -1;
  }
  function storageConfigured() {
    return firebaseConfigured() && !!FIREBASE_CONFIG.storageBucket;
  }

  function initFirebase() {
    if (!firebaseConfigured()) return;
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    if (storageConfigured() && firebase.storage) {
      try { storage = firebase.storage(); } catch (e) { storage = null; }
    }
    try {
      db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* offline-cache niet kritiek */ });
    } catch (e) { /* niet ondersteund, geen probleem */ }

    auth.onAuthStateChanged(function (user) {
      AUTH_READY = true;
      CURRENT_USER = user;
      if (user) {
        attachListeners();
      } else {
        detachListeners();
        CACHE = { daily: {}, ex: {}, run: {}, circuit: {}, progress: [] };
      }
      render();
    });

    setTimeout(function () {
      if (!AUTH_READY) { authTimedOut = true; render(); }
    }, 8000);
  }

  function scheduleRerender() {
    if (rerenderTimer) return;
    rerenderTimer = setTimeout(function () {
      rerenderTimer = null;
      render();
    }, 350);
  }

  function detachListeners() {
    listeners.forEach(function (u) { u(); });
    listeners = [];
  }

  function attachListeners() {
    detachListeners();

    listeners.push(db.collection("daily").onSnapshot(function (snap) {
      var dirty = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data();
        if (ch.type === "removed") {
          if (CACHE.daily[d.person]) delete CACHE.daily[d.person][d.date];
        } else {
          CACHE.daily[d.person] = CACHE.daily[d.person] || {};
          CACHE.daily[d.person][d.date] = d;
        }
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty) scheduleRerender();
    }, function (err) { console.error("daily listener", err); }));

    listeners.push(db.collection("exercises").onSnapshot(function (snap) {
      var dirty = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data();
        CACHE.ex[d.person] = CACHE.ex[d.person] || {};
        CACHE.ex[d.person][d.date] = CACHE.ex[d.person][d.date] || {};
        if (ch.type === "removed") {
          delete CACHE.ex[d.person][d.date][d.exercise];
        } else {
          CACHE.ex[d.person][d.date][d.exercise] = d;
        }
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty) scheduleRerender();
    }, function (err) { console.error("exercises listener", err); }));

    listeners.push(db.collection("runs").onSnapshot(function (snap) {
      var dirty = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data();
        if (ch.type === "removed") {
          if (CACHE.run[d.person]) delete CACHE.run[d.person][d.date];
        } else {
          CACHE.run[d.person] = CACHE.run[d.person] || {};
          CACHE.run[d.person][d.date] = d;
        }
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty) scheduleRerender();
    }, function (err) { console.error("runs listener", err); }));

    listeners.push(db.collection("circuits").onSnapshot(function (snap) {
      var dirty = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data();
        CACHE.circuit[d.person] = CACHE.circuit[d.person] || {};
        CACHE.circuit[d.person][d.date] = CACHE.circuit[d.person][d.date] || {};
        if (ch.type === "removed") {
          delete CACHE.circuit[d.person][d.date][d.circuit];
        } else {
          CACHE.circuit[d.person][d.date][d.circuit] = d.checked || [];
        }
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty) scheduleRerender();
    }, function (err) { console.error("circuits listener", err); }));

    listeners.push(db.collection("progress").onSnapshot(function (snap) {
      var arr = [];
      var dirty = false;
      snap.forEach(function (doc) {
        var d = doc.data();
        d.id = doc.id;
        arr.push(d);
      });
      CACHE.progress = arr;
      snap.docChanges().forEach(function (ch) {
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty || snap.metadata.fromCache === false) scheduleRerender();
    }, function (err) { console.error("progress listener", err); }));

    listeners.push(db.collection("settings").doc("program").onSnapshot(function (snap) {
      if (snap.exists) {
        var d = snap.data();
        if (d.startDate && d.raceDate) {
          applyScheduleSettings(d.startDate, d.raceDate);
        }
      }
      if (!snap.metadata.hasPendingWrites) scheduleRerender();
    }, function (err) { console.error("settings listener", err); }));
  }

  /* ---- schrijffuncties (optimistisch lokaal + Firestore) ---- */

  function saveDaily(iso, field, value) {
    var person = getProfile();
    CACHE.daily[person] = CACHE.daily[person] || {};
    CACHE.daily[person][iso] = CACHE.daily[person][iso] || { person: person, date: iso };
    CACHE.daily[person][iso][field] = value;
    var payload = { person: person, date: iso, updatedAt: Date.now() };
    payload[field] = value;
    db.collection("daily").doc(person + "_" + iso).set(payload, { merge: true })
      .catch(function (e) { console.error("saveDaily", e); });
  }

  function saveEx(iso, exName, field, value) {
    var person = getProfile();
    CACHE.ex[person] = CACHE.ex[person] || {};
    CACHE.ex[person][iso] = CACHE.ex[person][iso] || {};
    CACHE.ex[person][iso][exName] = CACHE.ex[person][iso][exName] || {};
    CACHE.ex[person][iso][exName][field] = value;
    var payload = { person: person, date: iso, exercise: exName };
    payload[field] = value;
    db.collection("exercises").doc(person + "_" + iso + "_" + slug(exName)).set(payload, { merge: true })
      .catch(function (e) { console.error("saveEx", e); });
  }

  function saveRun(iso, field, value) {
    var person = getProfile();
    CACHE.run[person] = CACHE.run[person] || {};
    CACHE.run[person][iso] = CACHE.run[person][iso] || {};
    CACHE.run[person][iso][field] = value;
    var payload = { person: person, date: iso };
    payload[field] = value;
    db.collection("runs").doc(person + "_" + iso).set(payload, { merge: true })
      .catch(function (e) { console.error("saveRun", e); });
  }

  function saveCircuit(iso, circuitLabel, idx, checked) {
    var person = getProfile();
    CACHE.circuit[person] = CACHE.circuit[person] || {};
    CACHE.circuit[person][iso] = CACHE.circuit[person][iso] || {};
    var arr = CACHE.circuit[person][iso][circuitLabel] || [];
    arr[idx] = checked;
    CACHE.circuit[person][iso][circuitLabel] = arr;
    db.collection("circuits").doc(person + "_" + iso + "_" + slug(circuitLabel)).set(
      { person: person, date: iso, circuit: circuitLabel, checked: arr }, { merge: true }
    ).catch(function (e) { console.error("saveCircuit", e); });
  }

  function addProgressEntry(entry) {
    entry.person = getProfile();
    entry.createdAt = Date.now();
    db.collection("progress").add(entry).catch(function (e) { console.error("addProgress", e); });
  }
  function deleteProgressEntry(id) {
    db.collection("progress").doc(id).delete().catch(function (e) { console.error("deleteProgress", e); });
  }

  function saveProgramSettings(startISO, raceISO) {
    applyScheduleSettings(startISO, raceISO);
    db.collection("settings").doc("program").set(
      { startDate: startISO, raceDate: raceISO, updatedAt: Date.now() }, { merge: true }
    ).catch(function (e) { console.error("saveProgramSettings", e); });
    render();
  }

  function hasDailyData(iso) {
    var person = getProfile();
    return !!(CACHE.daily[person] && CACHE.daily[person][iso]);
  }

  /* ---- foto's (Firebase Storage) ---- */

  function uploadDailyPhoto(iso, file) {
    if (!storage) { alert("Foto-opslag is niet beschikbaar. Controleer of Firebase Storage is ingesteld (zie INSTRUCTIES.md)."); return; }
    var person = getProfile();
    var path = "photos/" + person + "/" + iso + ".jpg";
    storage.ref().child(path).put(file).then(function (snap) {
      return snap.ref.getDownloadURL();
    }).then(function (url) {
      saveDaily(iso, "photoURL", url);
      render();
    }).catch(function (e) {
      console.error("uploadDailyPhoto", e);
      alert("Uploaden van de foto is mislukt. Probeer opnieuw.");
    });
  }
  function deleteDailyPhoto(iso) {
    if (!confirm("Deze foto verwijderen?")) return;
    var person = getProfile();
    var path = "photos/" + person + "/" + iso + ".jpg";
    if (storage) storage.ref().child(path).delete().catch(function () { /* mogelijk al weg */ });
    saveDaily(iso, "photoURL", "");
    render();
  }
  function collectPhotos() {
    var items = [];
    ["sean", "vriendin"].forEach(function (person) {
      var daily = CACHE.daily[person] || {};
      Object.keys(daily).forEach(function (iso) {
        if (daily[iso].photoURL) items.push({ person: person, date: iso, url: daily[iso].photoURL });
      });
    });
    items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return items;
  }

  /* ---- login (individuele toegangscode per profiel) ---- */

  function attemptLogin(profile, code) {
    LOGIN_ERROR = "";
    var email = PERSON_EMAILS[profile];
    return db.collection("meta").doc("setup").get().then(function (snap) {
      var data = snap.exists ? snap.data() : {};
      if (data[profile]) {
        return auth.signInWithEmailAndPassword(email, code);
      }
      return auth.createUserWithEmailAndPassword(email, code).then(function () {
        var update = {};
        update[profile] = true;
        return db.collection("meta").doc("setup").set(update, { merge: true });
      });
    });
  }

  function changePassword(oldCode, newCode) {
    var user = auth.currentUser;
    if (!user) return Promise.reject(new Error("Niet ingelogd."));
    var cred = firebase.auth.EmailAuthProvider.credential(user.email, oldCode);
    return user.reauthenticateWithCredential(cred).then(function () {
      return user.updatePassword(newCode);
    });
  }

  function switchProfile() {
    clearProfile();
    if (auth) auth.signOut();
    render();
  }

  /* ------------------------------------------------------------------ *
   * 5. HTML HELPERS
   * ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Tik-om-uit-te-klappen infopopup — werkt op tik (iPhone) én klik (desktop);
  // pure :hover heeft geen zin op een toestel zonder muis.
  function infoPop(label, text) {
    return "<details class=\"info-pop\"><summary>" + esc(label) +
      " <span class=\"info-icon\">i</span></summary>" +
      "<div class=\"info-body\">" + esc(text) + "</div></details>";
  }

  function tableHTML(headers, rows) {
    var h = "<div class=\"table-wrap\"><table><thead><tr>";
    headers.forEach(function (x) { h += "<th>" + esc(x) + "</th>"; });
    h += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr>";
      r.forEach(function (c) { h += "<td>" + c + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody></table></div>";
    return h;
  }

  /* ------------------------------------------------------------------ *
   * 6. RENDER: SETUP / PROFIEL / LOGIN-GATE
   * ------------------------------------------------------------------ */

  function renderSetupNeeded() {
    return "<div class=\"gate-wrap\"><div class=\"card gate-card\">" +
      "<div class=\"big-icon\">🔧</div>" +
      "<h1 class=\"page-title\">Firebase nog niet ingesteld</h1>" +
      "<p class=\"muted\">Vul <code>firebase-config.js</code> in met je eigen Firebase-projectgegevens. " +
      "Zie INSTRUCTIES.md voor de stappen.</p>" +
      "</div></div>";
  }

  function renderProfilePicker() {
    return "<div class=\"gate-wrap\"><div class=\"card gate-card\">" +
      "<div class=\"big-icon\">👋</div>" +
      "<h1 class=\"page-title\">Wie ben jij?</h1>" +
      "<p class=\"muted\">Elk heeft een eigen toegangscode. Kies eerst wie je bent.</p>" +
      "<button class=\"btn btn-primary btn-block\" data-pick-profile=\"sean\">Sean</button>" +
      "<button class=\"btn btn-outline btn-block\" data-pick-profile=\"vriendin\">Vriendin</button>" +
      "</div></div>";
  }

  function renderLogin() {
    var profile = getProfile();
    return "<div class=\"gate-wrap\"><div class=\"card gate-card\">" +
      "<div class=\"big-icon\">🔒</div>" +
      "<h1 class=\"page-title\">Inloggen als " + esc(PERSON_LABELS[profile]) + "</h1>" +
      "<p class=\"muted\">Voer je eigen toegangscode in (min. 6 tekens). De eerste keer dat jij inlogt, wordt dit meteen jouw persoonlijke code.</p>" +
      (LOGIN_ERROR ? "<div class=\"warnbox\">" + esc(LOGIN_ERROR) + "</div>" : "") +
      "<form id=\"login-form\">" +
      "<label class=\"field\">Toegangscode<input type=\"password\" name=\"code\" autocomplete=\"current-password\" required minlength=\"6\"></label>" +
      "<button type=\"submit\" class=\"btn btn-primary btn-block\">Inloggen</button>" +
      "</form>" +
      "<button class=\"btn btn-outline btn-block\" id=\"back-to-picker\">Niet " + esc(PERSON_LABELS[profile]) + "? Kies opnieuw</button>" +
      "</div></div>";
  }

  function bindLoginForm() {
    var form = document.getElementById("login-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = new FormData(form).get("code");
        var btn = form.querySelector("button");
        btn.disabled = true; btn.textContent = "Bezig…";
        attemptLogin(getProfile(), code).catch(function (err) {
          LOGIN_ERROR = err && err.code === "auth/weak-password"
            ? "Kies een code van minstens 6 tekens."
            : "Foute toegangscode. Probeer opnieuw.";
          render();
        });
      });
    }
    var back = document.getElementById("back-to-picker");
    if (back) back.addEventListener("click", function () { clearProfile(); render(); });
  }

  function bindProfilePicker() {
    document.querySelectorAll("[data-pick-profile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setProfile(btn.getAttribute("data-pick-profile"));
        render();
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. RENDER: DASHBOARD
   * ------------------------------------------------------------------ */

  function phaseBadge(phase) {
    return "<span class=\"badge\">" + esc(phase.name) + "</span>";
  }

  function deloadBadgeHTML() {
    return "<span class=\"badge outline info-badge\">" + infoPop("Deload-week", DELOAD_INFO_TEXT) + "</span>";
  }

  function photoFieldHTML(iso, d) {
    var html = "<label class=\"field\">Foto van vandaag (optioneel)</label>";
    if (d.photoURL) {
      html += "<div class=\"photo-preview\">" +
        "<img src=\"" + esc(d.photoURL) + "\" alt=\"Foto van vandaag\">" +
        "<button type=\"button\" class=\"btn btn-outline btn-sm\" data-photo-delete=\"" + iso + "\">Verwijder foto</button>" +
        "</div>";
    } else {
      html += "<input type=\"file\" accept=\"image/*\" data-photo-upload=\"" + iso + "\">";
    }
    return html;
  }

  function dailyChecklistHTML(iso) {
    var person = getProfile();
    var d = (CACHE.daily[person] && CACHE.daily[person][iso]) || {};
    var html = "";
    html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"training\" " + (d.training ? "checked" : "") + "> Training gedaan</label>";
    html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"protein\" " + (d.protein ? "checked" : "") + "> Eiwitdoel gehaald (190-200 g)</label>";
    html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"cheatDay\" " + (d.cheatDay ? "checked" : "") + "> Cheat day</label>";
    html += "<label class=\"field\">Stappen<input type=\"number\" inputmode=\"numeric\" placeholder=\"bv. 9500\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"steps\" value=\"" + (d.steps || "") + "\"></label>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Gewicht (kg)<input type=\"number\" step=\"0.1\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"weight\" value=\"" + (d.weight || "") + "\"></label>";
    html += "<label class=\"field\">Slaap (uren)<input type=\"number\" step=\"0.25\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"sleep\" value=\"" + (d.sleep || "") + "\"></label>";
    html += "</div>";
    html += "<label class=\"field\">Water (liter)<input type=\"number\" step=\"0.1\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"water\" value=\"" + (d.water || "") + "\"></label>";
    html += photoFieldHTML(iso, d);
    return html;
  }

  function partnerTodayCardHTML(iso) {
    var partner = otherProfile();
    var d = (CACHE.daily[partner] && CACHE.daily[partner][iso]) || {};
    var html = "<div class=\"card\"><h3 class=\"card-title\">Partner (" + esc(PERSON_LABELS[partner]) + ") vandaag</h3>";
    if (Object.keys(d).length === 0) {
      html += "<p class=\"muted\">Nog niets ingevuld voor vandaag.</p>";
    } else {
      html += "<div class=\"partner-row\"><span>Training gedaan</span><span>" + (d.training ? "✅" : "—") + "</span></div>";
      if (d.steps) html += "<div class=\"partner-row\"><span>Stappen</span><span>" + esc(d.steps) + "</span></div>";
      html += "<div class=\"partner-row\"><span>Eiwitdoel gehaald</span><span>" + (d.protein ? "✅" : "—") + "</span></div>";
      if (d.cheatDay) html += "<div class=\"partner-row\"><span>Cheat day</span><span>🍕</span></div>";
    }
    html += "</div>";
    return html;
  }

  function renderDashboard() {
    var today = midnight(new Date());

    if (today.getTime() < START_DATE.getTime()) {
      var daysLeft = Math.round((START_DATE - today) / MS_DAY);
      return "<div class=\"empty-state\"><div class=\"big\">⏳</div>" +
        "<p><b>Het programma start over " + daysLeft + " dag(en)</b><br>" +
        "Startdatum: " + esc(formatNLLong(START_DATE)) + ".</p>" +
        "<a class=\"btn btn-outline btn-block\" href=\"#/week\">Bekijk het volledige schema</a></div>";
    }
    if (today.getTime() > END_DATE.getTime()) {
      return "<div class=\"empty-state\"><div class=\"big\">🏁</div>" +
        "<p><b>Het programma en de wedstrijd zitten erop.</b><br>" +
        "Proficiat met de wedstrijd!</p>" +
        "<a class=\"btn btn-outline btn-block\" href=\"#/voortgang\">Bekijk je voortgang</a></div>";
    }

    var iso = toISO(today);
    var phase = getPhase(today);
    var dow = dowKey(today);
    var wp = WEEKPLANS[phase.id][dow];
    var wk = programWeekNum(today);
    var deload = isDeloadWeek(today);
    var isRaceDay = iso === PROGRAM_END;

    var html = "";
    html += "<h1 class=\"page-title\">Vandaag — " + esc(PERSON_LABELS[getProfile()]) + "</h1>";
    html += "<div class=\"card\">";
    html += "<div>" + phaseBadge(phase) + (deload ? deloadBadgeHTML() : "") + (isRaceDay ? "<span class=\"badge red\">🏁 Wedstrijddag</span>" : "") + "</div>";
    html += "<h3 class=\"card-title\" style=\"margin-top:8px;\">" + esc(formatNLLong(today)) + "</h3>";
    html += "<p class=\"muted\">Programmaweek " + wk + " van ±" + totalProgramWeeks() + "</p>";
    html += "</div>";

    html += "<div class=\"card\">";
    html += "<h3 class=\"card-title\">" + esc(DOW_LABELS[dow]) + " — sessie</h3>";
    html += "<p>" + esc(wp.title) + "</p>";
    if (wp.extra) html += "<p class=\"muted\">Extra: " + esc(wp.extra) + "</p>";
    html += "<a class=\"btn btn-primary btn-block\" href=\"#/dag/" + iso + "\">Bekijk volledige sessie &amp; log</a>";
    html += "</div>";

    html += "<h2 class=\"section-title\">Dagelijkse checklist</h2>";
    html += "<div class=\"card\">" + dailyChecklistHTML(iso) + "</div>";

    html += partnerTodayCardHTML(iso);

    html += "<div class=\"btn-row\">";
    html += "<a class=\"btn btn-outline\" href=\"#/week\">📅 Deze week</a>";
    html += "<a class=\"btn btn-outline\" href=\"#/voortgang\">📈 Voortgang</a>";
    html += "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 8. RENDER: WEEK
   * ------------------------------------------------------------------ */

  function weekOffsetForToday() {
    var t = clampDate(midnight(new Date()), START_DATE, END_DATE);
    return Math.round((getMonday(t) - FIRST_MONDAY) / (7 * MS_DAY));
  }
  function maxWeekOffset() {
    return Math.round((LAST_MONDAY - FIRST_MONDAY) / (7 * MS_DAY));
  }

  function renderWeek(offsetParam) {
    var maxOff = maxWeekOffset();
    var offset = offsetParam === undefined || offsetParam === null || isNaN(offsetParam) ? weekOffsetForToday() : parseInt(offsetParam, 10);
    if (offset < 0) offset = 0;
    if (offset > maxOff) offset = maxOff;

    var monday = addDays(FIRST_MONDAY, offset * 7);
    var sunday = addDays(monday, 6);
    var todayISO = toISO(midnight(new Date()));

    var html = "<h1 class=\"page-title\">Weekplanning</h1>";

    html += "<div class=\"week-nav\">";
    html += "<a class=\"btn btn-outline btn-sm\" href=\"#/week/" + Math.max(0, offset - 1) + "\"" + (offset <= 0 ? " style=\"visibility:hidden\"" : "") + ">← Vorige</a>";
    html += "<div class=\"label\">" + esc(formatNLShort(monday)) + " – " + esc(formatNLShort(sunday)) + "</div>";
    html += "<a class=\"btn btn-outline btn-sm\" href=\"#/week/" + Math.min(maxOff, offset + 1) + "\"" + (offset >= maxOff ? " style=\"visibility:hidden\"" : "") + ">Volgende →</a>";
    html += "</div>";

    for (var i = 0; i < 7; i++) {
      var date = addDays(monday, i);
      var iso = toISO(date);
      var dow = dowKey(date);
      var isToday = iso === todayISO;
      var within = inProgram(date);

      if (!within) {
        html += "<div class=\"day-card disabled\">";
        html += "<div class=\"dow\">" + esc(DOW_LABELS[dow]) + "<div class=\"date-sub\">" + esc(formatNLShort(date)) + "</div></div>";
        html += "<div class=\"session\">Buiten trainingsperiode</div>";
        html += "</div>";
        continue;
      }

      var phase = getPhase(date);
      var wp = WEEKPLANS[phase.id][dow];
      var filled = hasDailyData(iso);
      var sessionTitle = wp.title + (iso === PROGRAM_END ? " — 🏁 WEDSTRIJDDAG" : "");

      html += "<a class=\"day-card" + (isToday ? " today" : "") + "\" href=\"#/dag/" + iso + "\">";
      html += "<div class=\"dow\">" + esc(DOW_LABELS[dow]) + "<div class=\"date-sub\">" + esc(formatNLShort(date)) + "</div></div>";
      html += "<div class=\"session\">" + esc(sessionTitle) + "</div>";
      html += "<div class=\"dot" + (filled ? " filled" : "") + "\"></div>";
      html += "<div class=\"chev\">›</div>";
      html += "</a>";
    }

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 9. RENDER: DAG-DETAIL
   * ------------------------------------------------------------------ */

  function strengthTableHTML(iso, phaseId, category) {
    var scheme = PHASE_SCHEME[phaseId];
    var exList = EX_LISTS[category];
    var person = getProfile();
    var exData = (CACHE.ex[person] && CACHE.ex[person][iso]) || {};
    var html = "";
    exList.forEach(function (pair) {
      var name = pair[0], cat = pair[1];
      var s = scheme[cat];
      var setsReps = s[0], rpe = s[1], rest = s[2], prog = s[3];
      var saved = exData[name] || {};
      var nameHTML = EXERCISE_INFO[name] ? infoPop(name, EXERCISE_INFO[name]) : esc(name);
      html += "<div class=\"ex-row\">";
      html += "<div class=\"ex-name\">" + nameHTML + "</div>";
      html += "<div class=\"ex-presc\">" + esc(setsReps) + " · " + infoPop("RPE " + rpe, RPE_INFO_TEXT) + " · rust " + esc(rest) + "</div>";
      html += "<div class=\"ex-note\">" + esc(prog) + "</div>";
      html += "<div class=\"ex-inputs\">";
      html += "<label>Gewicht (kg)<input type=\"number\" step=\"0.5\" inputmode=\"decimal\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"weight\" value=\"" + (saved.weight || "") + "\"></label>";
      html += "<label>Reps behaald<input type=\"number\" step=\"1\" inputmode=\"numeric\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"reps\" value=\"" + (saved.reps || "") + "\"></label>";
      html += "</div></div>";
    });
    html += "<p class=\"small\">Startgewicht-richtlijn: " + esc(STARTW.MAIN) + " Techniek gaat altijd vóór gewicht.</p>";
    return html;
  }

  function selectHTML(options, current, store, date, field) {
    var h = "<select data-store=\"" + store + "\" data-date=\"" + date + "\" data-field=\"" + field + "\">";
    options.forEach(function (o) {
      var val = o, label = o === "" ? "–" : o;
      h += "<option value=\"" + esc(val) + "\"" + (current === val ? " selected" : "") + ">" + esc(label) + "</option>";
    });
    h += "</select>";
    return h;
  }

  function runLogFormHTML(iso, date, phase) {
    var person = getProfile();
    var r = (CACHE.run[person] && CACHE.run[person][iso]) || {};
    var html = "<div class=\"card\"><h3 class=\"card-title\">Loopsessie – richtlijn</h3>";

    if (phase.id === 5) {
      html += "<div class=\"table-wrap\"><table><thead><tr><th>Periode</th><th>Sessie</th></tr></thead><tbody>";
      getTaperSchedule().forEach(function (row) {
        html += "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1]) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    } else {
      var m = monthRunInfo(date);
      html += "<p class=\"muted\">" + esc(m.label) + " — weekvolume-richtlijn: " + esc(m.volume) + "</p>";
      html += tableHTML(["Type", "Richtlijn"], [
        ["Zone 2", esc(m.zone2)],
        ["Intervallen", esc(m.interval)],
        ["Tempoblok", esc(m.tempo)],
        ["Brick-run", esc(m.brick)],
        ["Lange duurloop", esc(m.long)]
      ]);
    }

    html += "<hr class=\"sep\"><h3 class=\"card-title\">Jouw loopsessie – log</h3>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Afstand (km)<input type=\"number\" step=\"0.1\" inputmode=\"decimal\" data-store=\"run\" data-date=\"" + iso + "\" data-field=\"distance\" value=\"" + (r.distance || "") + "\"></label>";
    html += "<label class=\"field\">Tempo (min/km)<input type=\"text\" placeholder=\"bv. 6:15\" data-store=\"run\" data-date=\"" + iso + "\" data-field=\"pace\" value=\"" + esc(r.pace || "") + "\"></label>";
    html += "</div>";
    var hrInfoText = HR_ZONES.map(function (z) { return z[0] + " " + z[1] + " (" + z[2] + ")"; }).join(" · ");
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">" + infoPop("Hartslagzone", hrInfoText) + selectHTML(["", "Z1", "Z2", "Z3", "Z4", "Z5"], r.hrzone, "run", iso, "hrzone") + "</label>";
    html += "<label class=\"field\">Gevoel" + selectHTML(["", "1 - zeer zwaar", "2 - zwaar", "3 - matig", "4 - goed", "5 - fantastisch"], r.feel, "run", iso, "feel") + "</label>";
    html += "</div>";
    html += "</div>";
    return html;
  }

  function hyroxCircuitsHTML(iso, phaseId) {
    var circuits = HYROX_CIRCUITS[phaseId];
    if (!circuits) return "";
    var person = getProfile();
    var saved = (CACHE.circuit[person] && CACHE.circuit[person][iso]) || {};
    var html = "";
    circuits.forEach(function (c) {
      html += "<div class=\"card\"><h3 class=\"card-title\">" + esc(c.label) + "</h3>";
      if (c.rest) html += "<p class=\"muted\">" + esc(c.rest) + "</p>";
      var checkedArr = saved[c.label] || [];
      var idx = 0;
      for (var r = 1; r <= c.rounds; r++) {
        if (c.rounds > 1) html += "<p class=\"small\"><b>Ronde " + r + "</b></p>";
        c.items.forEach(function (item) {
          var checked = checkedArr[idx] ? "checked" : "";
          html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"circuit\" data-date=\"" + iso + "\" data-circuit=\"" + esc(c.label) + "\" data-idx=\"" + idx + "\" " + checked + "> " + esc(item) + "</label>";
          idx++;
        });
      }
      html += "</div>";
    });
    return html;
  }

  function renderDay(iso) {
    if (!iso) return "<div class=\"empty-state\">Geen datum opgegeven.</div>";
    var date = parseISO(iso);
    var back = "<a class=\"btn btn-outline btn-sm\" href=\"#/week\">← Terug naar week</a>";

    if (!inProgram(date)) {
      return back + "<div class=\"empty-state\" style=\"margin-top:20px;\"><div class=\"big\">📆</div>" +
        "<p>" + esc(formatNLLong(date)) + " valt buiten de trainingsperiode<br>(" +
        esc(formatNLShort(START_DATE)) + " – " + esc(formatNLShort(END_DATE)) + ").</p></div>";
    }

    var phase = getPhase(date);
    var dow = dowKey(date);
    var wp = WEEKPLANS[phase.id][dow];
    var deload = isDeloadWeek(date);
    var isRaceDay = iso === PROGRAM_END;

    var html = back;
    html += "<h1 class=\"page-title\" style=\"margin-top:10px;\">" + esc(formatNLLong(date)) + "</h1>";
    html += "<div style=\"margin-bottom:12px;\">" + phaseBadge(phase) + (deload ? deloadBadgeHTML() : "") + (isRaceDay ? "<span class=\"badge red\">🏁 Wedstrijddag</span>" : "") + "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">" + esc(DOW_LABELS[dow]) + " — sessie</h3>";
    html += "<p>" + esc(wp.title) + "</p>";
    if (wp.extra) html += "<p class=\"muted\">Extra: " + esc(wp.extra) + "</p>";
    html += "</div>";

    var strengthCat = STRENGTH_MAP[phase.id] ? STRENGTH_MAP[phase.id][dow] : null;
    if (strengthCat) {
      html += "<h2 class=\"section-title\">Krachttraining</h2>";
      html += strengthTableHTML(iso, phase.id, strengthCat);
    }

    if (dow === "din" || dow === "zat") {
      html += runLogFormHTML(iso, date, phase);
    }

    if (dow === "zat") {
      html += hyroxCircuitsHTML(iso, phase.id);
    }

    html += "<h2 class=\"section-title\">Dagelijkse checklist</h2>";
    html += "<div class=\"card\">" + dailyChecklistHTML(iso) + "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 10. RENDER: VOORTGANG
   * ------------------------------------------------------------------ */

  function collectWeightSeries(person) {
    var map = {};
    var daily = CACHE.daily[person] || {};
    Object.keys(daily).forEach(function (iso) {
      if (daily[iso].weight) map[iso] = parseFloat(daily[iso].weight);
    });
    CACHE.progress.forEach(function (e) {
      if (e.person === person && e.date && e.weight) map[e.date] = parseFloat(e.weight);
    });
    var dates = Object.keys(map).sort();
    return dates.map(function (d) { return { date: d, value: map[d] }; });
  }

  function drawMultiSparkline(canvas, series) {
    var allPoints = [];
    series.forEach(function (s) { allPoints = allPoints.concat(s.points); });
    if (!allPoints.length) return;

    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var values = allPoints.map(function (p) { return p.value; });
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (min === max) { min -= 1; max += 1; }

    var times = allPoints.map(function (p) { return parseISO(p.date).getTime(); });
    var tMin = Math.min.apply(null, times), tMax = Math.max.apply(null, times);
    if (tMin === tMax) { tMin -= MS_DAY; tMax += MS_DAY; }

    var padL = 34, padR = 10, padT = 10, padB = 18;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    function x(t) { return padL + ((t - tMin) / (tMax - tMin)) * plotW; }
    function y(v) { return padT + plotH - ((v - min) / (max - min)) * plotH; }

    var isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.strokeStyle = isDark ? "#3A3E47" : "#E3E5E9";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

    series.forEach(function (s) {
      if (!s.points.length) return;
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.beginPath();
      s.points.forEach(function (p, i) {
        var px = x(parseISO(p.date).getTime()), py = y(p.value);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.fillStyle = s.color;
      s.points.forEach(function (p) {
        var px = x(parseISO(p.date).getTime()), py = y(p.value);
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
      });
    });

    ctx.fillStyle = isDark ? "#9AA0AC" : "#6B7280";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(max.toFixed(1) + " kg", 2, padT + 8);
    ctx.fillText(min.toFixed(1) + " kg", 2, padT + plotH);
    ctx.textAlign = "left";
    ctx.fillText(formatNLShort(new Date(tMin)), padL, h - 4);
    ctx.textAlign = "right";
    ctx.fillText(formatNLShort(new Date(tMax)), padL + plotW, h - 4);
  }

  function renderVoortgang() {
    var me = getProfile(), partner = otherProfile();
    var html = "<h1 class=\"page-title\">Voortgang</h1>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Gewicht per week</h3>";
    html += "<div class=\"legend\">" +
      "<span><span class=\"dot-inline\" style=\"background:" + PERSON_COLORS[me] + "\"></span>Jij (" + esc(PERSON_LABELS[me]) + ")</span>" +
      "<span><span class=\"dot-inline\" style=\"background:" + PERSON_COLORS[partner] + "\"></span>" + esc(PERSON_LABELS[partner]) + "</span>" +
      "</div>";
    var mySeries = collectWeightSeries(me);
    var partnerSeries = collectWeightSeries(partner);
    if (mySeries.length || partnerSeries.length) {
      html += "<canvas class=\"sparkline\" id=\"weight-chart\"></canvas>";
    } else {
      html += "<p class=\"muted\">Nog geen gewicht ingevuld. Vul dit in via de dagelijkse checklist.</p>";
    }
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Voortgangsfoto's</h3>";
    var photos = collectPhotos();
    if (photos.length) {
      html += "<div class=\"photo-strip\">";
      photos.forEach(function (p) {
        html += "<a class=\"photo-thumb\" href=\"" + esc(p.url) + "\" target=\"_blank\" rel=\"noopener\">" +
          "<img src=\"" + esc(p.url) + "\" alt=\"\">" +
          "<span>" + esc(PERSON_LABELS[p.person]) + " · " + esc(formatNLShort(parseISO(p.date))) + "</span></a>";
      });
      html += "</div>";
    } else {
      html += "<p class=\"muted\">Nog geen foto's toegevoegd. Voeg er een toe via de dagelijkse checklist.</p>";
    }
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Nieuwe meting toevoegen</h3>";
    html += "<form id=\"progress-form\">";
    html += "<label class=\"field\">Datum<input type=\"date\" name=\"date\" required value=\"" + toISO(midnight(new Date())) + "\"></label>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Gewicht (kg)<input type=\"number\" step=\"0.1\" name=\"weight\"></label>";
    html += "<label class=\"field\">Tailleomtrek (cm)<input type=\"number\" step=\"0.5\" name=\"waist\"></label>";
    html += "</div>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">5 km-tijd<input type=\"text\" name=\"time5k\" placeholder=\"mm:ss\"></label>";
    html += "<label class=\"field\">1 km-tijd<input type=\"text\" name=\"time1k\" placeholder=\"mm:ss\"></label>";
    html += "</div>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Farmers carry (kg/kb)<input type=\"number\" step=\"0.5\" name=\"farmers\"></label>";
    html += "<label class=\"field\">Wall balls (max reps)<input type=\"number\" step=\"1\" name=\"wallballs\"></label>";
    html += "</div>";
    html += "<button type=\"submit\" class=\"btn btn-primary btn-block\">Toevoegen</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Testresultaten — beiden</h3>";
    if (CACHE.progress.length) {
      CACHE.progress.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (e) {
        var parts = [];
        if (e.weight) parts.push(e.weight + " kg");
        if (e.waist) parts.push("taille " + e.waist + " cm");
        if (e.time5k) parts.push("5km " + e.time5k);
        if (e.time1k) parts.push("1km " + e.time1k);
        if (e.farmers) parts.push("FC " + e.farmers + " kg");
        if (e.wallballs) parts.push("WB " + e.wallballs + " reps");
        html += "<div class=\"progress-row\"><span><span class=\"badge\" style=\"background:" + PERSON_COLORS[e.person] + "\">" + esc(PERSON_LABELS[e.person] || e.person) + "</span> " +
          "<b>" + esc(formatNLShort(parseISO(e.date))) + "</b> — " + esc(parts.join(" · ") || "geen data") + "</span>" +
          "<button class=\"del\" data-del-id=\"" + e.id + "\" title=\"Verwijderen\">×</button></div>";
      });
    } else {
      html += "<p class=\"muted\">Nog geen testresultaten toegevoegd.</p>";
    }
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Exporteer naar CSV</h3>";
    html += "<p class=\"small\">Export bevat de data van jullie beiden.</p>";
    html += "<button class=\"btn btn-outline btn-block\" id=\"export-daily\">Dagelijkse data + loopsessies</button>";
    html += "<button class=\"btn btn-outline btn-block\" id=\"export-ex\">Krachttraining-logs</button>";
    html += "<button class=\"btn btn-outline btn-block\" id=\"export-progress\">Testresultaten</button>";
    html += "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 11. RENDER: INFO
   * ------------------------------------------------------------------ */

  function renderInfo() {
    var html = "<h1 class=\"page-title\">Info &amp; referentie</h1>";

    html += "<div class=\"warnbox\"><b>Geen medisch advies.</b> Dit is een persoonlijk trainingshulpmiddel, geen "
      + "medisch advies. Pas de training aan of raadpleeg een arts/specialist bij pijn, duizeligheid of "
      + "blessureklachten.</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Account</h3>";
    html += "<p class=\"muted\">Ingelogd als: <b>" + esc(PERSON_LABELS[getProfile()] || "-") + "</b></p>";
    html += "<button class=\"btn btn-outline btn-block\" id=\"switch-profile\">Wissel gebruiker / log uit</button>";
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Wijzig mijn toegangscode</h3>";
    html += (PASSWORD_MSG ? "<p class=\"small\">" + esc(PASSWORD_MSG) + "</p>" : "");
    html += "<form id=\"password-form\">";
    html += "<label class=\"field\">Huidige code<input type=\"password\" name=\"oldCode\" autocomplete=\"current-password\" required></label>";
    html += "<label class=\"field\">Nieuwe code (min. 6 tekens)<input type=\"password\" name=\"newCode\" autocomplete=\"new-password\" required minlength=\"6\"></label>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Code wijzigen</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Programma-instellingen</h3>";
    html += "<p class=\"small\">Startdatum en wedstrijddag zijn gedeeld — een wijziging herberekent automatisch alle fases en herplant voor jullie beiden.</p>";
    html += "<form id=\"schedule-form\">";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Startdatum<input type=\"date\" name=\"startDate\" value=\"" + PROGRAM_START + "\" required></label>";
    html += "<label class=\"field\">Wedstrijddag<input type=\"date\" name=\"raceDate\" value=\"" + PROGRAM_END + "\" required></label>";
    html += "</div>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Opslaan &amp; herberekenen</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">RPE / RIR</h3>";
    html += tableHTML(["RPE", "RIR", "Gevoel"], RPE_TABLE.map(function (r) { return [esc(r[0]), esc(r[1]), esc(r[2])]; }));
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Hartslagzones (schatting, HRmax 196)</h3>";
    html += tableHTML(["Zone", "Naam", "Bereik"], HR_ZONES.map(function (r) { return [esc(r[0]), esc(r[1]), esc(r[2])]; }));
    html += "<p class=\"small\">Gebaseerd op 220 - 24 jaar. Verfijn dit met de automatische zone-detectie van je Garmin Forerunner 965.</p>";
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Voedingsdoelen</h3>";
    html += tableHTML(["Doel", "Waarde"], [
      ["Trainingsdag", "2200 kcal"], ["Rustdag", "2100 kcal"],
      ["Eiwit", "190-200 g/dag"], ["Vet", "60-70 g/dag"],
      ["Stappen", "min. 8.000, richtwaarde 10.000-12.000"]
    ]);
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Fasedata</h3>";
    html += tableHTML(["Fase", "Periode"], PHASES.map(function (p) {
      return [esc(p.name), esc(formatNLShort(parseISO(p.start)) + " – " + formatNLShort(parseISO(p.end)))];
    }));
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Over deze app</h3>";
    html += "<p class=\"small\">HYROX Tracker — jullie data wordt gesynchroniseerd via een gedeelde cloud-database "
      + "(Firebase). Elk logt in met een eigen toegangscode. Maak regelmatig een CSV-export als back-up.</p>";
    html += "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 12. CSV EXPORT
   * ------------------------------------------------------------------ */

  function csvEscape(v) {
    v = String(v === undefined || v === null ? "" : v);
    if (/[;"\n]/.test(v)) return "\"" + v.replace(/"/g, "\"\"") + "\"";
    return v;
  }
  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) { return r.map(csvEscape).join(";"); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportDaily() {
    var rows = [["Persoon", "Datum", "TrainingGedaan", "Stappen", "Gewicht(kg)", "Slaap(u)", "EiwitdoelGehaald", "CheatDay", "Water(L)", "FotoURL", "LoopAfstand(km)", "LoopTempo", "Hartslagzone", "Gevoel"]];
    ["sean", "vriendin"].forEach(function (person) {
      var dates = {};
      Object.keys(CACHE.daily[person] || {}).forEach(function (d) { dates[d] = true; });
      Object.keys(CACHE.run[person] || {}).forEach(function (d) { dates[d] = true; });
      Object.keys(dates).sort().forEach(function (date) {
        var d = (CACHE.daily[person] || {})[date] || {};
        var r = (CACHE.run[person] || {})[date] || {};
        rows.push([PERSON_LABELS[person], date, d.training ? "Ja" : "Nee", d.steps || "", d.weight || "", d.sleep || "", d.protein ? "Ja" : "Nee", d.cheatDay ? "Ja" : "Nee", d.water || "", d.photoURL || "", r.distance || "", r.pace || "", r.hrzone || "", r.feel || ""]);
      });
    });
    downloadCSV("hyrox_dagelijkse_data.csv", rows);
  }
  function exportEx() {
    var rows = [["Persoon", "Datum", "Oefening", "Gewicht(kg)", "Reps"]];
    ["sean", "vriendin"].forEach(function (person) {
      var byDate = CACHE.ex[person] || {};
      Object.keys(byDate).sort().forEach(function (date) {
        Object.keys(byDate[date]).forEach(function (exName) {
          var v = byDate[date][exName];
          rows.push([PERSON_LABELS[person], date, exName, v.weight || "", v.reps || ""]);
        });
      });
    });
    downloadCSV("hyrox_krachttraining_logs.csv", rows);
  }
  function exportProgress() {
    var rows = [["Persoon", "Datum", "Gewicht(kg)", "Tailleomtrek(cm)", "5kmTijd", "1kmTijd", "FarmersCarry(kg)", "WallBalls(reps)"]];
    CACHE.progress.slice().sort(function (a, b) { return a.date > b.date ? 1 : -1; }).forEach(function (e) {
      rows.push([PERSON_LABELS[e.person] || e.person, e.date, e.weight || "", e.waist || "", e.time5k || "", e.time1k || "", e.farmers || "", e.wallballs || ""]);
    });
    downloadCSV("hyrox_testresultaten.csv", rows);
  }

  /* ------------------------------------------------------------------ *
   * 13. ROUTER
   * ------------------------------------------------------------------ */

  var viewEl, subEl, tabbarEl;

  function currentRoute() {
    var hash = location.hash || "#/";
    var parts = hash.replace(/^#\//, "").split("/");
    return { route: parts[0] || "dashboard", param: parts[1] };
  }

  function setActiveTab(route) {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (t) {
      var r = t.getAttribute("data-route");
      var match = r === route || (r === "dashboard" && (route === "" || route === "dag"));
      if (r === "week" && route === "dag") match = false;
      t.classList.toggle("active", match);
    });
  }

  function render() {
    if (!firebaseConfigured()) {
      viewEl.innerHTML = renderSetupNeeded();
      tabbarEl.classList.add("hidden");
      subEl.textContent = "Setup";
      return;
    }
    if (!AUTH_READY) {
      if (authTimedOut) {
        viewEl.innerHTML = "<div class=\"empty-state\"><div class=\"big\">📡</div>" +
          "<p><b>Kan geen verbinding maken.</b><br>Controleer je internetverbinding en probeer opnieuw.</p>" +
          "<button class=\"btn btn-outline btn-block\" id=\"retry-conn\">Opnieuw proberen</button></div>";
        tabbarEl.classList.add("hidden");
        var retryBtn = document.getElementById("retry-conn");
        if (retryBtn) retryBtn.addEventListener("click", function () { location.reload(); });
      } else {
        viewEl.innerHTML = "<div class=\"empty-state\">Laden…</div>";
        tabbarEl.classList.add("hidden");
      }
      return;
    }
    if (!getProfile()) {
      viewEl.innerHTML = renderProfilePicker();
      tabbarEl.classList.add("hidden");
      subEl.textContent = "Profiel";
      bindProfilePicker();
      return;
    }
    if (!CURRENT_USER) {
      viewEl.innerHTML = renderLogin();
      tabbarEl.classList.add("hidden");
      subEl.textContent = "Inloggen";
      bindLoginForm();
      return;
    }

    tabbarEl.classList.remove("hidden");

    var r = currentRoute();
    var html = "";
    var subtitle = PERSON_LABELS[getProfile()];

    if (r.route === "dashboard" || r.route === "") {
      html = renderDashboard();
    } else if (r.route === "week") {
      html = renderWeek(r.param);
    } else if (r.route === "dag") {
      html = renderDay(r.param);
    } else if (r.route === "voortgang") {
      html = renderVoortgang();
    } else if (r.route === "info") {
      html = renderInfo();
    } else {
      html = renderDashboard();
    }

    viewEl.innerHTML = html;
    subEl.textContent = subtitle;
    setActiveTab(r.route === "" ? "dashboard" : r.route);
    window.scrollTo(0, 0);

    if (r.route === "voortgang") {
      var canvas = document.getElementById("weight-chart");
      if (canvas) {
        drawMultiSparkline(canvas, [
          { color: PERSON_COLORS[getProfile()], points: collectWeightSeries(getProfile()) },
          { color: PERSON_COLORS[otherProfile()], points: collectWeightSeries(otherProfile()) }
        ]);
      }
      bindProgressView();
    }
    if (r.route === "info") {
      bindInfoActions();
    }
  }

  /* ------------------------------------------------------------------ *
   * 14. EVENTS
   * ------------------------------------------------------------------ */

  function handleFieldChange(e) {
    var t = e.target;
    if (t.type === "file" && t.dataset && t.dataset.photoUpload) {
      var file = t.files && t.files[0];
      if (file) uploadDailyPhoto(t.dataset.photoUpload, file);
      return;
    }
    var store = t.dataset ? t.dataset.store : null;
    if (!store) return;
    var date = t.dataset.date;

    if (store === "daily") {
      saveDaily(date, t.dataset.field, t.type === "checkbox" ? t.checked : t.value);
    } else if (store === "ex") {
      saveEx(date, t.dataset.ex, t.dataset.field, t.value);
    } else if (store === "run") {
      saveRun(date, t.dataset.field, t.value);
    } else if (store === "circuit") {
      saveCircuit(date, t.dataset.circuit, parseInt(t.dataset.idx, 10), t.checked);
    }
  }

  function handleViewClick(e) {
    var delPhotoBtn = e.target.closest && e.target.closest("[data-photo-delete]");
    if (delPhotoBtn) {
      deleteDailyPhoto(delPhotoBtn.getAttribute("data-photo-delete"));
    }
  }

  function bindProgressView() {
    var form = document.getElementById("progress-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var entry = { date: fd.get("date") };
        ["weight", "waist", "time5k", "time1k", "farmers", "wallballs"].forEach(function (f) {
          var v = fd.get(f);
          if (v) entry[f] = v;
        });
        if (!entry.date) return;
        addProgressEntry(entry);
        form.reset();
      });
    }

    viewEl.querySelectorAll("[data-del-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteProgressEntry(btn.getAttribute("data-del-id"));
      });
    });

    var exportDailyBtn = document.getElementById("export-daily");
    if (exportDailyBtn) exportDailyBtn.addEventListener("click", exportDaily);
    var exportExBtn = document.getElementById("export-ex");
    if (exportExBtn) exportExBtn.addEventListener("click", exportEx);
    var exportProgressBtn = document.getElementById("export-progress");
    if (exportProgressBtn) exportProgressBtn.addEventListener("click", exportProgress);
  }

  function bindInfoActions() {
    var switchBtn = document.getElementById("switch-profile");
    if (switchBtn) {
      switchBtn.addEventListener("click", function () { switchProfile(); });
    }

    var pwForm = document.getElementById("password-form");
    if (pwForm) {
      pwForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(pwForm);
        var oldCode = fd.get("oldCode"), newCode = fd.get("newCode");
        var btn = pwForm.querySelector("button");
        btn.disabled = true; btn.textContent = "Bezig…";
        changePassword(oldCode, newCode).then(function () {
          PASSWORD_MSG = "Toegangscode gewijzigd.";
          render();
        }).catch(function (err) {
          PASSWORD_MSG = err && err.code === "auth/wrong-password"
            ? "Huidige code klopt niet."
            : "Wijzigen mislukt. Probeer opnieuw.";
          render();
        });
      });
    }

    var schedForm = document.getElementById("schedule-form");
    if (schedForm) {
      schedForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(schedForm);
        var startDate = fd.get("startDate"), raceDate = fd.get("raceDate");
        if (!startDate || !raceDate) return;
        if (parseISO(raceDate).getTime() <= parseISO(startDate).getTime()) {
          alert("De wedstrijddag moet na de startdatum liggen.");
          return;
        }
        saveProgramSettings(startDate, raceDate);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 15. INIT
   * ------------------------------------------------------------------ */

  function init() {
    viewEl = document.getElementById("view");
    subEl = document.getElementById("topbar-sub");
    tabbarEl = document.getElementById("tabbar");

    viewEl.addEventListener("input", handleFieldChange);
    viewEl.addEventListener("change", handleFieldChange);
    viewEl.addEventListener("click", handleViewClick);

    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/";

    initFirebase();
    render();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () { /* offline-cache niet kritiek */ });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
