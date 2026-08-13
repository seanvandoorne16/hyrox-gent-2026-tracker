/* ==========================================================================
   HYROX Tracker — vanilla JS PWA + Firebase
   Individuele login, gedeelde data, per-persoon weekindeling, samen trainen.
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
  var PHASE_RATIOS = [41, 42, 42, 28, 14];

  var DOW_KEYS = ["zon", "maa", "din", "woe", "don", "vri", "zat"]; // getDay() 0-6
  var ORDERED_DOW = ["maa", "din", "woe", "don", "vri", "zat", "zon"];
  var DOW_LABELS = {
    zon: "Zondag", maa: "Maandag", din: "Dinsdag", woe: "Woensdag",
    don: "Donderdag", vri: "Vrijdag", zat: "Zaterdag"
  };

  var ROLES = ["upper", "legs", "fullbody", "run", "rest", "hyrox", "recovery"];
  var ROLE_LABELS = {
    upper: "Kracht bovenlichaam",
    legs: "Kracht benen",
    fullbody: "Full body kracht",
    run: "Looptraining",
    rest: "Rust / mobiliteit",
    hyrox: "HYROX-circuit",
    recovery: "Herstel"
  };

  // Content per fase, per ROL (niet per weekdag — welke weekdag welke rol krijgt
  // is instelbaar per persoon, zie DEFAULT_ROLE_MAP + PERSONAL[person].weekmap).
  var ROLE_CONTENT = {
    1: {
      upper: { title: "Kracht bovenlichaam (hypertrofie/techniek, RPE 7-8)", extra: "Zone 2 – 20 min rustig" },
      run: { title: "Looptraining – Zone 2 duurloop, 20-25 min", extra: "" },
      legs: { title: "Kracht benen (hypertrofie/techniek, RPE 7-8)", extra: "" },
      rest: { title: "Rust – mobiliteit 15-20 min + minstens 8.000 stappen", extra: "" },
      fullbody: { title: "Full body kracht (RPE 7-8)", extra: "Korte intervalprikkel, licht" },
      hyrox: { title: "HYROX-introductiecircuit (1x/2 weken) of lange duurloop 25-30 min", extra: "" },
      recovery: { title: "Actief herstel – wandelen, licht mobiliteitswerk", extra: "" }
    },
    2: {
      upper: { title: "Kracht bovenlichaam (kracht, RPE 7-9, 5x5-schema)", extra: "Zone 2 – 25-30 min" },
      run: { title: "Looptraining – intervallen", extra: "" },
      legs: { title: "Kracht benen (kracht, RPE 7-9)", extra: "" },
      rest: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      fullbody: { title: "Full body kracht + intervals", extra: "Korte tempo-intervallen na kracht" },
      hyrox: { title: "HYROX-circuit (fase 2-opbouw) of lange duurloop 35-40 min", extra: "" },
      recovery: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    3: {
      upper: { title: "Kracht bovenlichaam (functioneel/circuit, RPE 7-8)", extra: "Zone 2 – 25-30 min" },
      run: { title: "Looptraining – intervallen/tempo", extra: "" },
      legs: { title: "Kracht benen (functioneel/circuit, RPE 7-8)", extra: "" },
      rest: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      fullbody: { title: "Full body kracht + intervals (brick-run na kracht)", extra: "Brick-run 15-20 min" },
      hyrox: { title: "HYROX-circuit of halve simulatie", extra: "" },
      recovery: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    4: {
      upper: { title: "Kracht bovenlichaam (onderhoud, verlaagd volume, RPE 7)", extra: "Zone 2 – 20-25 min" },
      run: { title: "Looptraining – korte scherpe intervallen", extra: "" },
      legs: { title: "Kracht benen (onderhoud, verlaagd volume, RPE 7)", extra: "" },
      rest: { title: "Rust – mobiliteit + minstens 8.000 stappen", extra: "" },
      fullbody: { title: "Full body kracht (licht) + korte intervals", extra: "Brick-run 15 min" },
      hyrox: { title: "(Bijna) volledige HYROX-simulatie (om de 2 weken)", extra: "" },
      recovery: { title: "Actief herstel – wandelen, mobiliteit", extra: "" }
    },
    5: {
      upper: { title: "Lichte activatie bovenlichaam (optioneel, RPE 6)", extra: "" },
      legs: { title: "Mobiliteit + lichte activatie onderlichaam (geen zware kracht)", extra: "" },
      fullbody: { title: "Kracht full body – licht onderhoud (RPE 6)", extra: "Zone 2 – 15-20 min" },
      run: { title: "Korte technische intervallen (laag volume) of rustige jog", extra: "" },
      rest: { title: "Rust – wandelen, minstens 8.000 stappen", extra: "" },
      hyrox: { title: "Taper-activatie (licht) of volledige rust", extra: "" },
      recovery: { title: "Rust / mogelijke wedstrijddag", extra: "" }
    }
  };

  function defaultRoleMap(phaseId) {
    if (phaseId === 5) return { maa: "fullbody", din: "run", woe: "legs", don: "rest", vri: "upper", zat: "hyrox", zon: "recovery" };
    return { maa: "upper", din: "run", woe: "legs", don: "rest", vri: "fullbody", zat: "hyrox", zon: "recovery" };
  }

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
  var EX_LISTS = { upper: UPPER_EX, legs: LEGS_EX, fullbody: FULLBODY_EX };

  var EXERCISE_ALTERNATIVES = {
    "Bench press": [
      { label: "Smith Machine Bench", sets: "4x8", rpe: "7", rest: "90 sec" },
      { label: "Dumbbel Bench", sets: "4x10", rpe: "7", rest: "75 sec" },
      { label: "Push-up variatie", sets: "3x15", rpe: "8", rest: "60 sec" }
    ],
    "Incline dumbbell press": [
      { label: "Machine Chest Press", sets: "3x12", rpe: "7", rest: "75 sec" },
      { label: "Cable Press", sets: "4x10", rpe: "8", rest: "75 sec" }
    ],
    "Lat pulldown of pull-up": [
      { label: "Seated Cable Row", sets: "4x10", rpe: "7", rest: "75 sec" },
      { label: "Assisted Pull-up", sets: "4x8", rpe: "8", rest: "90 sec" }
    ],
    "Seated cable row": [
      { label: "Chest Supported Row", sets: "4x10", rpe: "7", rest: "75 sec" },
      { label: "Single-Arm Cable Row", sets: "4x12", rpe: "7", rest: "60 sec" }
    ],
    "Back squat of leg press": [
      { label: "Goblet Squat", sets: "4x12", rpe: "7", rest: "75 sec" },
      { label: "Hack Squat", sets: "4x8", rpe: "8", rest: "90 sec" }
    ],
    "Romanian deadlift": [
      { label: "Hip Thrust", sets: "4x10", rpe: "7", rest: "90 sec" },
      { label: "Single-leg Romanian Deadlift", sets: "4x12", rpe: "8", rest: "60 sec" }
    ],
    "Bulgarian split squat": [
      { label: "Walking Lunges", sets: "4x16", rpe: "8", rest: "60 sec" },
      { label: "Reverse Lunge", sets: "4x10", rpe: "7", rest: "75 sec" }
    ],
    "Walking lunges": [
      { label: "Step-up", sets: "4x12", rpe: "7", rest: "60 sec" },
      { label: "Split Squat", sets: "4x10", rpe: "8", rest: "75 sec" }
    ],
    "Deadlift of trap bar deadlift": [
      { label: "Trap Bar Deadlift", sets: "5x5", rpe: "8", rest: "120 sec" },
      { label: "RDL variant", sets: "4x8", rpe: "7", rest: "90 sec" }
    ],
    "Front squat of goblet squat": [
      { label: "Goblet Squat", sets: "4x12", rpe: "7", rest: "60 sec" },
      { label: "Leg Press", sets: "4x10", rpe: "7", rest: "75 sec" }
    ]
  };

  // Alle oefeningnamen (uit UPPER_EX/LEGS_EX/FULLBODY_EX), gededupliceerd, in vaste volgorde.
  function getAllExerciseNames() {
    var seen = {}, names = [];
    [UPPER_EX, LEGS_EX, FULLBODY_EX].forEach(function (list) {
      list.forEach(function (pair) { if (!seen[pair[0]]) { seen[pair[0]] = true; names.push(pair[0]); } });
    });
    return names;
  }

  // Voorgestelde alternatieven voor een oefening: vaste lijst (EXERCISE_ALTERNATIVES) minus wat de
  // gebruiker zelf verwijderde (PERSONAL[person].hiddenAlternatives), plus eigen toegevoegde machines
  // (PERSONAL[person].customAlternatives) — zie "Ik"-tab, kaart "Machines & alternatieven".
  function getAlternativesFor(name, person) {
    var built = EXERCISE_ALTERNATIVES[name] || [];
    var hidden = (PERSONAL[person] && PERSONAL[person].hiddenAlternatives && PERSONAL[person].hiddenAlternatives[name]) || [];
    var visible = built.filter(function (a) { return hidden.indexOf(a.label) === -1; });
    var custom = (PERSONAL[person] && PERSONAL[person].customAlternatives && PERSONAL[person].customAlternatives[name]) || [];
    return visible.concat(custom);
  }

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
      note: "Focus: techniek aanleren, hypertrofie behouden tijdens calorietekort. Op een deload-week (badge bovenaan): 1 set minder per oefening, RPE -1."
    },
    2: {
      MAIN: ["5x5", "7-9", "150 sec", "+2,5-5 kg zodra alle 5x5 lukt op RPE ≤ 8, twee sessies op rij."],
      MAIN2: ["4x6", "7-8", "120 sec", "+2,5 kg zodra alle sets lukken op doel-RPE."],
      ACC: ["3x8-10", "8", "75 sec", "+1-2 kg of +1 rep/set zodra RPE onder doel blijft."],
      CORE: ["3x45-60 sec", "7-8", "60 sec", "+10-15 sec per set of voeg extern gewicht toe."],
      CARRY: ["4x40 m", "8", "90 sec", "+5 m of +2,5 kg per kettlebell zodra techniek stabiel blijft."],
      COND: ["4x15-20 reps", "7-8", "60 sec", "+2-5 reps per set of verklein rust met 10 sec."],
      note: "Focus: zwaardere compound-kracht opbouwen. Op een deload-week: -20% volume."
    },
    3: {
      MAIN: ["4x6", "7-8", "90 sec", "Gewicht +2,5 kg enkel als techniek en RPE dit toelaten; prioriteit op dichtheid."],
      MAIN2: ["4x6", "7-8", "90 sec", "Idem MAIN — focus op minder rust i.p.v. meer gewicht."],
      ACC: ["3x12-15 (superset)", "7", "45-60 sec", "Verklein rust met 10 sec vóór je gewicht verhoogt."],
      CORE: ["3x45-60 sec", "7", "45 sec", "+10 sec per set of voeg beweging toe."],
      CARRY: ["4x50 m (zwaarder)", "8", "75 sec", "+afstand of +gewicht richting wedstrijdbelasting."],
      COND: ["3x20 reps", "7-8", "45 sec", "Opbouwen richting wedstrijdvolume van 100 reps in 1 set."],
      note: "Focus: functionele kracht/spieruithouding, minder rust. Op een deload-week: -20% volume."
    },
    4: {
      MAIN: ["3x5", "7", "120 sec", "Gewicht behouden — geen PR-pogingen. Prioriteit: frisheid voor simulaties."],
      MAIN2: ["3x5", "7", "120 sec", "Gewicht behouden, techniek scherp houden."],
      ACC: ["2x10", "7", "60 sec", "Volume bewust laag houden, geen progressiedruk."],
      CORE: ["2x45 sec", "6-7", "45 sec", "Onderhoud, geen opbouw."],
      CARRY: ["3x50 m", "7", "90 sec", "Onderhoud richting wedstrijdgewicht/afstand."],
      COND: ["2x15 reps", "7", "60 sec", "Onderhoud, techniek boven volume."],
      note: "Focus: volume -20 à -30% t.o.v. fase 3. Laatste week van deze fase extra licht (ingebouwde deload)."
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

  // Loopschema per relatieve programmamaand, onafhankelijk van kalendermaand.
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

  var TRACK_FIELDS = [
    { key: "steps", label: "Stappen" },
    { key: "weight", label: "Gewicht" },
    { key: "sleep", label: "Slaap" },
    { key: "protein", label: "Eiwitdoel" },
    { key: "water", label: "Water" },
    { key: "cheatDay", label: "Cheat day" },
    { key: "photo", label: "Foto" }
  ];

  var PERSON_LABELS = { sean: "Sean", vriendin: "Vriendin" };
  var PERSON_COLORS = { sean: "#D62828", vriendin: "#2563EB" };
  // Niet als letterlijke "naam@domein.tld"-tekst geschreven — dit bestand staat in een
  // publieke GitHub-repo en dit ontwijkt simpele e-mail-scraping/regex-bots. Geen echte
  // beveiliging (iedereen die de code leest, kan dit herleiden), enkel ruis tegen scrapers.
  function mkEmail(local, domain) { return local + "@" + domain; }
  var PERSON_EMAILS = {
    sean: mkEmail("sean.vandoorne", "gmail.com"),
    vriendin: mkEmail("femkedobbelaere", "hotmail.com")
  };
  var ADMIN_EMAILS = [
    mkEmail("sean.werk", "gmail.com")
  ];

  function isAdminUser() {
    var user = auth && auth.currentUser ? auth.currentUser : null;
    var email = user && user.email ? String(user.email).trim().toLowerCase() : "";
    return !!email && ADMIN_EMAILS.some(function (adminEmail) {
      return String(adminEmail).trim().toLowerCase() === email;
    });
  }

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
   * 4. PERSOONLIJKE INSTELLINGEN (startgewicht, tracking-voorkeuren, weekindeling)
   * ------------------------------------------------------------------ */

  var PERSONAL = { sean: {}, vriendin: {} };

  function getRoleForDate(date, person) {
    var iso = toISO(date);
    var t = CACHE.together[iso];
    if (t && t.confirmed && t.role) return t.role;
    var phase = getPhase(date);
    var dow = dowKey(date);
    var custom = PERSONAL[person] && PERSONAL[person].weekmap && PERSONAL[person].weekmap[dow];
    return custom || defaultRoleMap(phase.id)[dow];
  }
  function isTracked(key) {
    var person = getProfile();
    var t = PERSONAL[person] && PERSONAL[person].tracking;
    return !(t && t[key] === false);
  }
  function isPaused(date, person) {
    var iso = toISO(date);
    var pauses = (PERSONAL[person] && PERSONAL[person].pauses) || [];
    for (var i = 0; i < pauses.length; i++) {
      if (iso >= pauses[i].start && iso <= pauses[i].end) return pauses[i];
    }
    return null;
  }

  // Hulpindeling per gekozen aantal trainingsdagen/week (kracht/loop/HYROX = "actief").
  var DAYCOUNT_TEMPLATES = {
    2: { maa: "fullbody", din: "rest", woe: "rest", don: "rest", vri: "run", zat: "rest", zon: "recovery" },
    3: { maa: "fullbody", din: "rest", woe: "run", don: "rest", vri: "legs", zat: "rest", zon: "recovery" },
    4: { maa: "upper", din: "run", woe: "legs", don: "rest", vri: "fullbody", zat: "rest", zon: "recovery" },
    5: { maa: "upper", din: "run", woe: "legs", don: "rest", vri: "fullbody", zat: "hyrox", zon: "recovery" },
    6: { maa: "upper", din: "run", woe: "legs", don: "run", vri: "fullbody", zat: "hyrox", zon: "recovery" },
    7: { maa: "upper", din: "run", woe: "legs", don: "run", vri: "fullbody", zat: "hyrox", zon: "upper" }
  };

  // Volledig herschikkingsvoorstel: dagen die de gebruiker net wijzigde blijven vast (anker),
  // de rol die daardoor "verdwijnt" wordt herverdeeld over de overige open dagen, in de
  // oorspronkelijke relatieve volgorde (zo blijft de spreiding — bv. rust na een zware dag — behouden).
  function suggestWeekmap(userMap, previousMap) {
    var order = {};
    ORDERED_DOW.forEach(function (d, i) { order[d] = i; });

    var changed = ORDERED_DOW.filter(function (d) { return userMap[d] !== previousMap[d]; });
    var anchors = {};
    changed.forEach(function (d) { anchors[d] = userMap[d]; });

    var usedRoles = {};
    changed.forEach(function (d) { usedRoles[userMap[d]] = true; });
    var defaultOrderIdx = {};
    ORDERED_DOW.forEach(function (d) { defaultOrderIdx[previousMap[d]] = order[d]; });
    var missingRoles = ROLES.filter(function (r) { return !usedRoles[r]; })
      .sort(function (a, b) { return (defaultOrderIdx[a] || 0) - (defaultOrderIdx[b] || 0); });

    var openDays = ORDERED_DOW.filter(function (d) { return !anchors[d]; });

    var suggestion = {};
    ORDERED_DOW.forEach(function (d) { if (anchors[d]) suggestion[d] = anchors[d]; });
    openDays.forEach(function (d, i) { suggestion[d] = missingRoles[i] || previousMap[d]; });
    return suggestion;
  }
  function isPermutation(map) {
    var seen = {};
    ORDERED_DOW.forEach(function (d) { seen[map[d]] = true; });
    return Object.keys(seen).length === ROLES.length;
  }
  function weekmapEqual(a, b) {
    return ORDERED_DOW.every(function (d) { return a[d] === b[d]; });
  }
  function weekmapSummaryHTML(map) {
    var h = "<ul class=\"weekmap-summary\">";
    ORDERED_DOW.forEach(function (d) {
      h += "<li><b>" + esc(DOW_LABELS[d]) + "</b> — " + esc(ROLE_LABELS[map[d]]) + "</li>";
    });
    h += "</ul>";
    return h;
  }

  /* ------------------------------------------------------------------ *
   * 5. FIREBASE — auth (individuele codes) + gedeelde data (Firestore + Storage)
   * ------------------------------------------------------------------ */

  var fbApp = null, auth = null, db = null, storage = null;
  var AUTH_READY = false;
  var CURRENT_USER = null;
  var LOGIN_ERROR = "";
  var LOGIN_FORGOT_PASSWORD_VISIBLE = false;
  var PASSWORD_MSG = "";
  var ADMIN_PANEL_DISMISSED = false;
  var WEEKMAP_SUGGESTION = null;
  var ALTMGR_SELECTED = null;
  var EDITING_PROGRESS_ID = null;
  var CACHE = { daily: {}, ex: {}, run: {}, circuit: {}, progress: [], together: {} };
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
        CACHE = { daily: {}, ex: {}, run: {}, circuit: {}, progress: [], together: {} };
        ADMIN_PANEL_DISMISSED = false;
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
          CACHE.circuit[d.person][d.date][d.circuit] = { checked: d.checked || [], times: d.times || [] };
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

    var togetherFirstSnapshot = true;
    listeners.push(db.collection("together").onSnapshot(function (snap) {
      var dirty = false;
      var isInitial = togetherFirstSnapshot;
      togetherFirstSnapshot = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data();
        if (ch.type === "removed") {
          delete CACHE.together[d.date];
        } else {
          CACHE.together[d.date] = d;
          if (!isInitial && !ch.doc.metadata.hasPendingWrites) notifyTogetherChange(d);
        }
        if (!ch.doc.metadata.hasPendingWrites) dirty = true;
      });
      if (dirty) scheduleRerender();
    }, function (err) { console.error("together listener", err); }));

    listeners.push(db.collection("settings").doc("program").onSnapshot(function (snap) {
      if (snap.exists) {
        var d = snap.data();
        if (d.startDate && d.raceDate) applyScheduleSettings(d.startDate, d.raceDate);
      }
      if (!snap.metadata.hasPendingWrites) scheduleRerender();
    }, function (err) { console.error("settings/program listener", err); }));

    listeners.push(db.collection("settings").doc("personal").onSnapshot(function (snap) {
      if (snap.exists) {
        var d = snap.data() || {};
        PERSONAL.sean = d.sean || PERSONAL.sean || {};
        PERSONAL.vriendin = d.vriendin || PERSONAL.vriendin || {};
      }
      if (!snap.metadata.hasPendingWrites) scheduleRerender();
    }, function (err) { console.error("settings/personal listener", err); }));
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
      .catch(function (e) { console.error("saveDaily", e); showSyncError(); });
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
      .catch(function (e) { console.error("saveEx", e); showSyncError(); });
  }

  function addCustomExercise(iso) {
    var person = getProfile();
    var label = prompt("Naam van de aanvullende oefening", "Bijv. TRX row of dumbbell carry");
    if (!label || !String(label).trim()) return;
    var exName = String(label).trim();
    if (!exName) return;
    saveEx(iso, exName, "custom", true);
    saveEx(iso, exName, "weight", "");
    saveEx(iso, exName, "reps", "");
    saveEx(iso, exName, "status", "planned");
    saveEx(iso, exName, "alternative", "");
  }

  function deleteExercise(iso, exName) {
    var person = getProfile();
    if (!db) return;
    var key = person + "_" + iso + "_" + slug(exName);
    if (CACHE.ex[person] && CACHE.ex[person][iso] && CACHE.ex[person][iso][exName]) {
      delete CACHE.ex[person][iso][exName];
    }
    db.collection("exercises").doc(key).delete().catch(function (e) { console.error("deleteExercise", e); showSyncError(); });
  }

  function saveRun(iso, field, value) {
    var person = getProfile();
    CACHE.run[person] = CACHE.run[person] || {};
    CACHE.run[person][iso] = CACHE.run[person][iso] || {};
    CACHE.run[person][iso][field] = value;
    var payload = { person: person, date: iso };
    payload[field] = value;
    db.collection("runs").doc(person + "_" + iso).set(payload, { merge: true })
      .catch(function (e) { console.error("saveRun", e); showSyncError(); });
  }

  function saveCircuit(iso, circuitLabel, idx, field, value) {
    var person = getProfile();
    CACHE.circuit[person] = CACHE.circuit[person] || {};
    CACHE.circuit[person][iso] = CACHE.circuit[person][iso] || {};
    var entry = CACHE.circuit[person][iso][circuitLabel] || { checked: [], times: [] };
    var arr = (field === "time" ? entry.times : entry.checked).slice();
    arr[idx] = value;
    if (field === "time") entry.times = arr; else entry.checked = arr;
    CACHE.circuit[person][iso][circuitLabel] = entry;
    db.collection("circuits").doc(person + "_" + iso + "_" + slug(circuitLabel)).set(
      { person: person, date: iso, circuit: circuitLabel, checked: entry.checked, times: entry.times }, { merge: true }
    ).catch(function (e) { console.error("saveCircuit", e); showSyncError(); });
  }

  function addProgressEntry(entry) {
    entry.person = getProfile();
    entry.createdAt = Date.now();
    db.collection("progress").add(entry).catch(function (e) { console.error("addProgress", e); showSyncError(); });
  }
  function editProgressEntry(id, patch) {
    patch.updatedAt = Date.now();
    db.collection("progress").doc(id).update(patch).catch(function (e) { console.error("editProgress", e); showSyncError(); });
  }
  function deleteProgressEntry(id) {
    if (String(EDITING_PROGRESS_ID) === String(id)) EDITING_PROGRESS_ID = null;
    db.collection("progress").doc(id).delete().catch(function (e) { console.error("deleteProgress", e); showSyncError(); });
  }

  function saveProgramSettings(startISO, raceISO) {
    applyScheduleSettings(startISO, raceISO);
    db.collection("settings").doc("program").set(
      { startDate: startISO, raceDate: raceISO, updatedAt: Date.now() }, { merge: true }
    ).catch(function (e) { console.error("saveProgramSettings", e); showSyncError(); });
    render();
  }

  // Voegt patch recursief samen in target (nested objecten mergen i.p.v. overschrijven; arrays vervangen als geheel).
  function deepMergeInto(target, patch) {
    for (var k in patch) {
      var pv = patch[k];
      if (pv && typeof pv === "object" && !Array.isArray(pv)) {
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        deepMergeInto(target[k], pv);
      } else {
        target[k] = pv;
      }
    }
  }
  function savePersonalPatch(patch) {
    var person = getProfile();
    PERSONAL[person] = PERSONAL[person] || {};
    deepMergeInto(PERSONAL[person], patch);
    var update = {};
    update[person] = patch;
    db.collection("settings").doc("personal").set(update, { merge: true })
      .catch(function (e) { console.error("savePersonalPatch", e); showSyncError(); });
  }
  function saveStartWeight(value) {
    savePersonalPatch({ startWeight: value });
  }
  function saveTracking(key, value) {
    var patch = { tracking: {} };
    patch.tracking[key] = value;
    savePersonalPatch(patch);
  }
  function saveWeekmap(map) {
    savePersonalPatch({ weekmap: map });
  }

  function saveCustomAlternative(exName, alt) {
    var person = getProfile();
    var existing = (PERSONAL[person] && PERSONAL[person].customAlternatives && PERSONAL[person].customAlternatives[exName]) || [];
    var patch = { customAlternatives: {} };
    patch.customAlternatives[exName] = existing.concat([alt]);
    savePersonalPatch(patch);
  }
  function removeCustomAlternative(exName, label) {
    var person = getProfile();
    var existing = (PERSONAL[person] && PERSONAL[person].customAlternatives && PERSONAL[person].customAlternatives[exName]) || [];
    var patch = { customAlternatives: {} };
    patch.customAlternatives[exName] = existing.filter(function (a) { return a.label !== label; });
    savePersonalPatch(patch);
  }
  function hideBuiltinAlternative(exName, label) {
    var person = getProfile();
    var existing = (PERSONAL[person] && PERSONAL[person].hiddenAlternatives && PERSONAL[person].hiddenAlternatives[exName]) || [];
    if (existing.indexOf(label) !== -1) return;
    var patch = { hiddenAlternatives: {} };
    patch.hiddenAlternatives[exName] = existing.concat([label]);
    savePersonalPatch(patch);
  }
  function restoreBuiltinAlternative(exName, label) {
    var person = getProfile();
    var existing = (PERSONAL[person] && PERSONAL[person].hiddenAlternatives && PERSONAL[person].hiddenAlternatives[exName]) || [];
    var patch = { hiddenAlternatives: {} };
    patch.hiddenAlternatives[exName] = existing.filter(function (l) { return l !== label; });
    savePersonalPatch(patch);
  }

  function savePause(start, end, reason) {
    var person = getProfile();
    var pauses = ((PERSONAL[person] && PERSONAL[person].pauses) || []).slice();
    pauses.push({ id: Date.now(), start: start, end: end, reason: reason });
    savePersonalPatch({ pauses: pauses });
  }
  function deletePause(id) {
    var person = getProfile();
    var pauses = ((PERSONAL[person] && PERSONAL[person].pauses) || []).filter(function (p) { return String(p.id) !== String(id); });
    savePersonalPatch({ pauses: pauses });
  }

  function hasDailyData(iso) {
    var person = getProfile();
    if (CACHE.daily[person] && CACHE.daily[person][iso]) return true;
    if (CACHE.run[person] && CACHE.run[person][iso]) return true;
    if (CACHE.ex[person] && CACHE.ex[person][iso] && Object.keys(CACHE.ex[person][iso]).length) return true;
    if (CACHE.circuit[person] && CACHE.circuit[person][iso] && Object.keys(CACHE.circuit[person][iso]).length) return true;
    return false;
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

  /* ---- samen trainen ---- */

  function saveTogether(iso, time) {
    var person = getProfile();
    var existing = CACHE.together[iso];
    var payload;
    if (existing && !existing.confirmed && existing.proposedBy && existing.proposedBy !== person) {
      // partner bevestigt: rol van die dag wordt voor BEIDEN gelijkgetrokken (zie getRoleForDate)
      payload = { date: iso, proposedBy: existing.proposedBy, time: existing.time, role: existing.role, confirmed: true, confirmedBy: person };
    } else {
      var myRole = getRoleForDate(parseISO(iso), person);
      payload = { date: iso, proposedBy: person, time: time || (existing ? existing.time : "10:00"), role: myRole, confirmed: false, confirmedBy: null };
    }
    CACHE.together[iso] = payload;
    db.collection("together").doc(iso).set(payload).catch(function (e) { console.error("saveTogether", e); showSyncError(); });
    render();
  }
  function clearTogether(iso) {
    delete CACHE.together[iso];
    db.collection("together").doc(iso).delete().catch(function (e) { console.error("clearTogether", e); showSyncError(); });
    render();
  }
  function downloadICS(iso, time) {
    var t = (time || "10:00").split(":");
    var hh = t[0].padStart ? t[0].padStart(2, "0") : ("0" + t[0]).slice(-2);
    var mm = t[1] ? (t[1].padStart ? t[1].padStart(2, "0") : ("0" + t[1]).slice(-2)) : "00";
    var dtStart = iso.replace(/-/g, "") + "T" + hh + mm + "00";
    var endHour = (parseInt(hh, 10) + 1) % 24;
    var endHourStr = endHour < 10 ? "0" + endHour : String(endHour);
    var dtEnd = iso.replace(/-/g, "") + "T" + endHourStr + mm + "00";
    var uid = "hyrox-" + iso + "-" + Date.now() + "@hyrox-tracker";
    var ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HYROX Tracker//NL\r\nBEGIN:VEVENT\r\nUID:" + uid +
      "\r\nDTSTAMP:" + dtStart + "\r\nDTSTART:" + dtStart + "\r\nDTEND:" + dtEnd +
      "\r\nSUMMARY:Samen trainen – HYROX Tracker\r\nDESCRIPTION:HYROX-trainingssessie samen met je partner.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "samen-trainen-" + iso + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---- login (gebruikersnaam/e-mail + wachtwoord) ---- */

  function attemptLogin(profile, password, emailOverride) {
    LOGIN_ERROR = "";
    var email = (emailOverride || PERSON_EMAILS[profile] || "").trim();
    if (!email || email.indexOf("@") === -1 || email.length < 4) {
      return Promise.reject({ code: "auth/config-error", message: "Gebruik een geldig e-mailadres om in te loggen." });
    }
    var normalizedPassword = String(password || "").trim();
    if (!normalizedPassword) {
      return Promise.reject({ code: "auth/wrong-password", message: "Vul je wachtwoord in." });
    }
    if (!auth || !auth.signInWithEmailAndPassword) {
      return Promise.reject({ code: "auth/config-error", message: "Firebase Auth is nog niet klaar." });
    }
    return auth.signInWithEmailAndPassword(email, normalizedPassword);
  }

  function attemptCreateAccount(profile, email, password) {
    LOGIN_ERROR = "";
    var normalizedEmail = String(email || "").trim().toLowerCase();
    var normalizedPassword = String(password || "").trim();
    if (!normalizedEmail || normalizedEmail.indexOf("@") === -1 || normalizedEmail.length < 4) {
      return Promise.reject({ code: "auth/invalid-email", message: "Vul een geldig e-mailadres in." });
    }
    var knownEmails = Object.keys(PERSON_EMAILS).map(function (p) { return PERSON_EMAILS[p].toLowerCase(); })
      .concat(ADMIN_EMAILS.map(function (a) { return a.toLowerCase(); }));
    if (knownEmails.indexOf(normalizedEmail) === -1) {
      return Promise.reject({ code: "auth/config-error", message: "Dit e-mailadres is niet gekend voor deze app — enkel Sean en zijn vriendin kunnen hier een account aanmaken." });
    }
    if (normalizedPassword.length < 6) {
      return Promise.reject({ code: "auth/weak-password", message: "Kies een wachtwoord van minstens 6 tekens." });
    }
    if (!auth || !auth.createUserWithEmailAndPassword) {
      return Promise.reject({ code: "auth/config-error", message: "Firebase Auth is nog niet klaar." });
    }
    return auth.createUserWithEmailAndPassword(normalizedEmail, normalizedPassword).then(function () {
      // Register een first-time setup marker so this profile becomes recognized in the app.
      var update = {};
      update[profile] = true;
      return db.collection("meta").doc("setup").set(update, { merge: true });
    });
  }

  function requestPasswordReset(email) {
    if (!auth || !auth.sendPasswordResetEmail) {
      return Promise.reject({ code: "auth/config-error", message: "Firebase Auth is nog niet klaar." });
    }
    if (!email || !String(email).trim() || String(email).indexOf("@") === -1) {
      return Promise.reject({ code: "auth/invalid-email", message: "Vul eerst een geldig e-mailadres in." });
    }
    return auth.sendPasswordResetEmail(String(email).trim());
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
    WEEKMAP_SUGGESTION = null;
    ADMIN_PANEL_DISMISSED = false;
    if (auth) auth.signOut();
    render();
  }

  /* ------------------------------------------------------------------ *
   * 6. HTML HELPERS
   * ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  // Tik-om-uit-te-klappen infopopup — werkt op tik (iPhone) én klik (desktop);
  // pure :hover heeft geen zin op een toestel zonder muis.
  function infoPop(label, text) {
    return "<details class=\"info-pop\"><summary>" + esc(label) +
      " <span class=\"info-icon\">i</span></summary>" +
      "<div class=\"info-body\">" + esc(text) + "</div></details>";
  }

  /* ---- toasts: zichtbare feedback bij mislukte sync (schrijffouten Firestore) ---- */
  var toastContainerEl = null;
  function showToast(message, type) {
    if (!toastContainerEl) {
      toastContainerEl = document.createElement("div");
      toastContainerEl.className = "toast-container";
      document.body.appendChild(toastContainerEl);
    }
    var el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    toastContainerEl.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 250);
    }, 4500);
  }
  function showSyncError() {
    showToast("Opslaan mislukt — controleer je internetverbinding. Probeer het later opnieuw.", "error");
  }

  // Melding (toast + evt. browser-notificatie) bij een nieuw "samen trainen"-voorstel/bevestiging van de partner.
  // Werkt enkel zolang de app open of op de achtergrond staat (Notifications API), niet wanneer volledig gesloten
  // — dat vereist server-side push (Firebase Cloud Messaging + Cloud Function), wat niet lokaal opzetbaar is.
  function showTogetherNotification(title, body) {
    showToast(body, "success");
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, { body: body, icon: "icon-192.png", badge: "icon-192.png" });
      }).catch(function () { try { new Notification(title, { body: body }); } catch (e) { /* niet ondersteund */ } });
    } else {
      try { new Notification(title, { body: body }); } catch (e) { /* niet ondersteund */ }
    }
  }
  function notifyTogetherChange(d) {
    var me = getProfile();
    if (!d || !d.date || !d.time) return;
    if (!d.confirmed && d.proposedBy && d.proposedBy !== me) {
      showTogetherNotification("Voorstel: samen trainen",
        (PERSON_LABELS[d.proposedBy] || d.proposedBy) + " stelt voor om samen te trainen op " + formatNLShort(parseISO(d.date)) + " om " + d.time + ".");
    } else if (d.confirmed && d.proposedBy === me && d.confirmedBy && d.confirmedBy !== me) {
      showTogetherNotification("Samen trainen bevestigd",
        (PERSON_LABELS[d.confirmedBy] || d.confirmedBy) + " bevestigde jullie sessie op " + formatNLShort(parseISO(d.date)) + " om " + d.time + ".");
    }
  }

  /* ------------------------------------------------------------------ *
   * 7. RENDER: SETUP / PROFIEL / LOGIN-GATE
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

  function renderAdmin() {
    return "<div class=\"gate-wrap\"><div class=\"card gate-card\">" +
      "<div class=\"big-icon\">👑</div>" +
      "<h1 class=\"page-title\">Admin beheer</h1>" +
      "<p class=\"muted\">Je bent ingelogd als admin. Je kunt wachtwoord-reset links verzenden, maar gebruikers verwijderen moet via Firebase Console.</p>" +
      (LOGIN_ERROR ? "<div class=\"warnbox\">" + esc(LOGIN_ERROR) + "</div>" : "") +
      "<form id=\"admin-reset-form\">" +
      "<label class=\"field\">Gebruikers-e-mail om wachtwoord reset te sturen<input type=\"email\" name=\"admin-email\" autocomplete=\"username\" required></label>" +
      "<button type=\"submit\" class=\"btn btn-primary btn-block\">Reset wachtwoord versturen</button>" +
      "</form>" +
      "<button class=\"btn btn-outline btn-block\" id=\"admin-go-dashboard\">Ga naar dashboard</button>" +
      "</div></div>";
  }

  function renderLogin() {
    var profile = getProfile();
    var forgotPasswordButton = LOGIN_FORGOT_PASSWORD_VISIBLE
      ? "<button type=\"button\" class=\"btn btn-outline btn-block\" id=\"forgot-password\">Wachtwoord vergeten?</button>"
      : "";
    return "<div class=\"gate-wrap\"><div class=\"card gate-card\">" +
      "<div class=\"big-icon\">🔒</div>" +
      "<h1 class=\"page-title\">Inloggen als " + esc(PERSON_LABELS[profile]) + "</h1>" +
      "<p class=\"muted\">Log in met je gebruikersnaam (e-mail) en wachtwoord. Je krijgt daarna toegang tot je eigen data.</p>" +
      (LOGIN_ERROR ? "<div class=\"warnbox\">" + esc(LOGIN_ERROR) + "</div>" : "") +
      "<form id=\"login-form\">" +
      "<label class=\"field\">Gebruikersnaam (e-mail)<input type=\"email\" name=\"email\" autocomplete=\"username\" required value=\"" + esc(PERSON_EMAILS[profile] || "") + "\"></label>" +
      "<label class=\"field\">Wachtwoord<input type=\"password\" name=\"code\" autocomplete=\"current-password\" required minlength=\"6\"></label>" +
      "<button type=\"submit\" class=\"btn btn-primary btn-block\">Inloggen</button>" +
      forgotPasswordButton +
      "<button type=\"button\" class=\"btn btn-outline btn-block\" id=\"create-account\">Account aanmaken</button>" +
      "</form>" +
      "<button class=\"btn btn-outline btn-block\" id=\"back-to-picker\">Niet " + esc(PERSON_LABELS[profile]) + "? Kies opnieuw</button>" +
      "</div></div>";
  }

  function bindLoginForm() {
    var form = document.getElementById("login-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = new FormData(form);
        var email = String(data.get("email") || "").trim();
        var password = String(data.get("code") || "").trim();
        var btn = form.querySelector("button[type='submit']");
        btn.disabled = true; btn.textContent = "Bezig…";
        attemptLogin(getProfile(), password, email).catch(function (err) {
          if (err && err.code === "auth/weak-password") {
            LOGIN_ERROR = "Kies een code van minstens 6 tekens.";
          } else if (err && err.code === "auth/user-not-found") {
            LOGIN_ERROR = "Dit e-mailadres is nog niet bekend in Firebase Auth. Klik op 'Account aanmaken' bij eerste gebruik.";
          } else if (err && err.code === "auth/invalid-login-credentials") {
            LOGIN_ERROR = "Deze inloggegevens zijn niet correct. Controleer e-mail en wachtwoord.";
          } else if (err && err.code === "auth/invalid-email") {
            LOGIN_ERROR = "Vul een geldig e-mailadres in.";
          } else if (err && err.code === "auth/config-error") {
            LOGIN_ERROR = err.message;
          } else if (err && err.code === "auth/wrong-password") {
            LOGIN_ERROR = "Wachtwoord klopt niet. Gebruik 'Wachtwoord vergeten?' om een reset-link te krijgen.";
            LOGIN_FORGOT_PASSWORD_VISIBLE = true;
          } else if (err && err.message) {
            LOGIN_ERROR = err.message;
          } else {
            LOGIN_ERROR = "Fout bij inloggen. Probeer opnieuw.";
          }
          render();
        });
      });
    }
    var createAccount = document.getElementById("create-account");
    if (createAccount) {
      createAccount.addEventListener("click", function () {
        var form = document.getElementById("login-form");
        if (!form) return;
        var data = new FormData(form);
        var email = String(data.get("email") || "").trim();
        var password = String(data.get("code") || "").trim();
        var profile = getProfile() || "sean";
        var btn = createAccount;
        btn.disabled = true;
        btn.textContent = "Aanmaken…";
        attemptCreateAccount(profile, email, password).then(function () {
          LOGIN_ERROR = "Account aangemaakt. Je kunt nu inloggen.";
          render();
        }).catch(function (err) {
          if (err && err.code === "auth/email-already-in-use") {
            LOGIN_ERROR = "Dit e-mailadres bestaat al. Gebruik 'Wachtwoord vergeten?' als je je wachtwoord niet meer weet.";
          } else if (err && err.code === "auth/weak-password") {
            LOGIN_ERROR = "Kies een wachtwoord van minstens 6 tekens.";
          } else if (err && err.message) {
            LOGIN_ERROR = err.message;
          } else {
            LOGIN_ERROR = "Account aanmaken is mislukt.";
          }
          render();
        });
      });
    }
    var forgot = document.getElementById("forgot-password");
    if (forgot) {
      forgot.addEventListener("click", function () {
        var form = document.getElementById("login-form");
        var data = form ? new FormData(form) : null;
        var email = data ? String(data.get("email") || "").trim() : "";
        requestPasswordReset(email).then(function () {
          LOGIN_ERROR = "Een reset-link is verzonden naar jouw e-mailadres.";
          LOGIN_FORGOT_PASSWORD_VISIBLE = false;
          render();
        }).catch(function (err) {
          LOGIN_ERROR = err && err.message ? err.message : "Reset-link kon niet worden verzonden.";
          render();
        });
      });
    }
    var back = document.getElementById("back-to-picker");
    if (back) back.addEventListener("click", function () { clearProfile(); render(); });
  }

  function bindAdminPanel() {
    var form = document.getElementById("admin-reset-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = new FormData(form);
        var email = String(data.get("admin-email") || "").trim();
        requestPasswordReset(email).then(function () {
          LOGIN_ERROR = "Reset-link is naar " + email + " gestuurd.";
          render();
        }).catch(function (err) {
          LOGIN_ERROR = err && err.message ? err.message : "Reset-link kon niet worden verzonden.";
          render();
        });
      });
    }
    var dashboard = document.getElementById("admin-go-dashboard");
    if (dashboard) {
      dashboard.addEventListener("click", function () {
        LOGIN_ERROR = "";
        ADMIN_PANEL_DISMISSED = true;
        tabbarEl.classList.remove("hidden");
        render();
      });
    }
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
   * 8. RENDER: DASHBOARD
   * ------------------------------------------------------------------ */

  function phaseBadge(phase) {
    return "<span class=\"badge\">" + esc(phase.name) + "</span>";
  }

  function deloadBadgeHTML() {
    return "<span class=\"badge outline info-badge\">" + infoPop("Deload-week", DELOAD_INFO_TEXT) + "</span>";
  }

  function pauseCardHTML(pause) {
    return "<div class=\"card pause-card\"><h3 class=\"card-title\">⏸️ Pauze — " + esc(pause.reason) + "</h3>" +
      "<p class=\"muted\">Van " + esc(formatNLShort(parseISO(pause.start))) + " tot " + esc(formatNLShort(parseISO(pause.end))) + ". Geniet van het herstel!</p></div>";
  }

  function photoFieldHTML(iso, d) {
    if (!isTracked("photo")) return "";
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
    if (isTracked("protein")) html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"protein\" " + (d.protein ? "checked" : "") + "> Eiwitdoel gehaald (190-200 g)</label>";
    if (isTracked("cheatDay")) html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"cheatDay\" " + (d.cheatDay ? "checked" : "") + "> Cheat day</label>";
    if (isTracked("steps")) html += "<label class=\"field\">Stappen<input type=\"number\" inputmode=\"numeric\" placeholder=\"bv. 9500\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"steps\" value=\"" + (d.steps || "") + "\"></label>";
    if (isTracked("weight") || isTracked("sleep")) {
      html += "<div class=\"input-grid\">";
      if (isTracked("weight")) html += "<label class=\"field\">Gewicht (kg)<input type=\"number\" step=\"0.1\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"weight\" value=\"" + (d.weight || "") + "\"></label>";
      if (isTracked("sleep")) html += "<label class=\"field\">Slaap (uren)<input type=\"number\" step=\"0.25\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"sleep\" value=\"" + (d.sleep || "") + "\"></label>";
      html += "</div>";
    }
    if (isTracked("water")) html += "<label class=\"field\">Water (liter)<input type=\"number\" step=\"0.1\" inputmode=\"decimal\" data-store=\"daily\" data-date=\"" + iso + "\" data-field=\"water\" value=\"" + (d.water || "") + "\"></label>";
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

  // Aantal opeenvolgende dagen (t.e.m. gisteren, of vandaag als "Training gedaan" al is aangevinkt)
  // waarop "Training gedaan" is aangevinkt. Pauzeperiodes onderbreken de streak niet.
  function computeStreak(person) {
    var daily = CACHE.daily[person] || {};
    var day = midnight(new Date());
    if (!(daily[toISO(day)] && daily[toISO(day)].training)) day = addDays(day, -1);
    var count = 0;
    while (day.getTime() >= START_DATE.getTime()) {
      if (isPaused(day, person)) { day = addDays(day, -1); continue; }
      var iso2 = toISO(day);
      if (daily[iso2] && daily[iso2].training) {
        count++;
        day = addDays(day, -1);
      } else {
        break;
      }
    }
    return count;
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
    var role = getRoleForDate(today, getProfile());
    var wp = ROLE_CONTENT[phase.id][role];
    var wk = programWeekNum(today);
    var deload = isDeloadWeek(today);
    var isRaceDay = iso === PROGRAM_END;
    var pause = isPaused(today, getProfile());

    var streak = computeStreak(getProfile());

    var html = "";
    html += "<h1 class=\"page-title\">Vandaag — " + esc(PERSON_LABELS[getProfile()]) + "</h1>";
    html += "<div class=\"card\">";
    html += "<div>" + phaseBadge(phase) + (deload ? deloadBadgeHTML() : "") + (isRaceDay ? "<span class=\"badge red\">🏁 Wedstrijddag</span>" : "") +
      (streak >= 2 ? "<span class=\"badge outline\">🔥 " + streak + " dagen op rij</span>" : "") + "</div>";
    html += "<h3 class=\"card-title\" style=\"margin-top:8px;\">" + esc(formatNLLong(today)) + "</h3>";
    html += "<p class=\"muted\">Programmaweek " + wk + " van ±" + totalProgramWeeks() + "</p>";
    html += "</div>";

    if (pause) {
      html += pauseCardHTML(pause);
    } else {
      html += "<div class=\"card\">";
      html += "<h3 class=\"card-title\">" + esc(DOW_LABELS[dowKey(today)]) + " — sessie</h3>";
      html += "<p>" + esc(wp.title) + "</p>";
      if (wp.extra) html += "<p class=\"muted\">Extra: " + esc(wp.extra) + "</p>";
      html += "<a class=\"btn btn-primary btn-block\" href=\"#/dag/" + iso + "\">Bekijk volledige sessie &amp; log</a>";
      html += "</div>";
    }

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
   * 9. RENDER: WEEK
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
    var person = getProfile();

    var html = "<h1 class=\"page-title\">Weekplanning</h1>";

    html += "<div class=\"week-nav\">";
    html += "<a class=\"btn btn-outline btn-sm\" href=\"#/week/" + Math.max(0, offset - 1) + "\"" + (offset <= 0 ? " style=\"visibility:hidden\"" : "") + ">← Vorige</a>";
    html += "<div class=\"label\">" + esc(formatNLShort(monday)) + " – " + esc(formatNLShort(sunday)) + "</div>";
    html += "<a class=\"btn btn-outline btn-sm\" href=\"#/week/" + Math.min(maxOff, offset + 1) + "\"" + (offset >= maxOff ? " style=\"visibility:hidden\"" : "") + ">Volgende →</a>";
    html += "</div>";
    html += "<div class=\"week-jump\"><label class=\"field\">Spring naar datum<input type=\"date\" id=\"week-date-jump\" min=\"" + PROGRAM_START + "\" max=\"" + PROGRAM_END + "\" value=\"" + toISO(monday) + "\"></label></div>";

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
      var role = getRoleForDate(date, person);
      var wp = ROLE_CONTENT[phase.id][role];
      var filled = hasDailyData(iso);
      var pauseHere = isPaused(date, person);
      var togetherHint = (!pauseHere && (role === "run" || role === "hyrox")) ? " 👥" : "";
      var sessionTitle = pauseHere ? "⏸️ Pauze (" + pauseHere.reason + ")" : wp.title + (iso === PROGRAM_END ? " — 🏁 WEDSTRIJDDAG" : "");

      html += "<a class=\"day-card" + (isToday ? " today" : "") + "\" href=\"#/dag/" + iso + "\">";
      html += "<div class=\"dow\">" + esc(DOW_LABELS[dow]) + "<div class=\"date-sub\">" + esc(formatNLShort(date)) + "</div></div>";
      html += "<div class=\"session\">" + esc(sessionTitle) + togetherHint + "</div>";
      html += "<div class=\"dot" + (filled ? " filled" : "") + "\"></div>";
      html += "<div class=\"chev\">›</div>";
      html += "</a>";
    }

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 10. RENDER: DAG-DETAIL
   * ------------------------------------------------------------------ */

  // Haalt het bovenste getal uit een sets x reps-tekst ("4x8" -> 8, "3x10-12" -> 12).
  function parseTargetReps(setsReps) {
    var m = String(setsReps).match(/x\s*(\d+)(?:-(\d+))?/i);
    if (!m) return null;
    return m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10);
  }

  // Eenvoudige, op loggeschiedenis gebaseerde progressie-hint: als de laatste 2 gelogde sessies
  // op hetzelfde gewicht allebei het doelaantal reps haalden, stel voor om het gewicht te verhogen.
  function progressionHint(name, person, iso, setsReps) {
    var target = parseTargetReps(setsReps);
    if (!target) return "";
    var history = CACHE.ex[person] || {};
    var entries = [];
    Object.keys(history).forEach(function (date) {
      if (date >= iso) return;
      var e = history[date] && history[date][name];
      if (e && e.weight !== undefined && e.weight !== "" && e.reps !== undefined && e.reps !== "") {
        entries.push({ date: date, weight: parseFloat(e.weight), reps: parseFloat(e.reps) });
      }
    });
    entries.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var lastTwo = entries.slice(-2);
    if (lastTwo.length < 2) return "";
    var sameWeight = lastTwo[0].weight === lastTwo[1].weight && !isNaN(lastTwo[0].weight);
    var bothAtTarget = lastTwo.every(function (e) { return e.reps >= target; });
    if (sameWeight && bothAtTarget) {
      return "💡 Laatste 2 sessies op " + lastTwo[1].weight + " kg: telkens alle reps gehaald — overweeg extra gewicht.";
    }
    return "";
  }

  function strengthTableHTML(iso, phaseId, role) {
    var scheme = PHASE_SCHEME[phaseId];
    var exList = EX_LISTS[role];
    var person = getProfile();
    var exData = (CACHE.ex[person] && CACHE.ex[person][iso]) || {};
    var html = "";
    exList.forEach(function (pair) {
      var name = pair[0], cat = pair[1];
      var s = scheme[cat];
      var setsReps = s[0], rpe = s[1], rest = s[2], prog = s[3];
      var saved = exData[name] || {};
      var nameHTML = EXERCISE_INFO[name] ? infoPop(name, EXERCISE_INFO[name]) : esc(name);
      var status = saved.status || "planned";
      var alt = saved.alternative || "";
      var altOptions = getAlternativesFor(name, person);
      var altPlan = null;
      if (alt && altOptions.length) {
        altPlan = altOptions.find(function (a) { return String(a.label) === String(alt); }) || null;
      }
      if (altPlan) {
        setsReps = altPlan.sets;
        rpe = altPlan.rpe;
        rest = altPlan.rest || rest;
        prog = altPlan.label || prog;
      }
      html += "<div class=\"ex-row\">";
      html += "<div class=\"ex-name\">" + nameHTML + "</div>";
      html += "<div class=\"ex-presc\">" + esc(setsReps) + " · " + infoPop("RPE " + rpe, RPE_INFO_TEXT) + " · rust " + esc(rest) + "</div>";
      html += "<div class=\"ex-note\">" + esc(prog) + "</div>";
      if (!altPlan) {
        var hint = progressionHint(name, person, iso, setsReps);
        if (hint) html += "<div class=\"ex-hint\">" + esc(hint) + "</div>";
      }
      html += "<div class=\"ex-inputs\">";
      html += "<label>Gewicht (kg)<input type=\"number\" step=\"0.5\" inputmode=\"decimal\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"weight\" value=\"" + esc(saved.weight || "") + "\"></label>";
      html += "<label>Reps behaald<input type=\"number\" step=\"1\" inputmode=\"numeric\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"reps\" value=\"" + esc(saved.reps || "") + "\"></label>";
      html += "<label>Status" + selectHTML(["planned", "machine niet aanwezig", "alternatief"], status, "ex", iso, "status", name) + "</label>";
      html += "<label>Alternatief" + selectHTML([""].concat(altOptions.map(function (a) { return a.label; })), alt, "ex", iso, "alternative", name) + "</label>";
      html += "</div></div>";
    });
    var customRows = Object.keys(exData || {}).filter(function (name) {
      return !(exList.some(function (pair) { return pair[0] === name; }));
    });
    customRows.forEach(function (name) {
      var saved = exData[name] || {};
      if (saved.custom !== true) return;
      html += "<div class=\"ex-row custom-row\">";
      html += "<div class=\"ex-name\">" + esc(name) + "</div>";
      html += "<div class=\"ex-presc\">Aangepaste oefening</div>";
      html += "<div class=\"ex-note\">" + esc(saved.alternative || "") + "</div>";
      html += "<div class=\"ex-inputs\">";
      html += "<label>Gewicht (kg)<input type=\"number\" step=\"0.5\" inputmode=\"decimal\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"weight\" value=\"" + esc(saved.weight || "") + "\"></label>";
      html += "<label>Reps behaald<input type=\"number\" step=\"1\" inputmode=\"numeric\" data-store=\"ex\" data-date=\"" + iso + "\" data-ex=\"" + esc(name) + "\" data-field=\"reps\" value=\"" + esc(saved.reps || "") + "\"></label>";
      html += "<label>Status" + selectHTML(["planned", "machine niet aanwezig", "alternatief"], saved.status || "planned", "ex", iso, "status", name) + "</label>";
      var customAltOptions = getAlternativesFor(name, person);
      html += "<label>Alternatief" + selectHTML([""].concat(customAltOptions.map(function (a) { return a.label; })), saved.alternative || "", "ex", iso, "alternative", name) + "</label>";
      html += "<button type=\"button\" class=\"btn btn-danger btn-sm\" data-delete-exercise=\"" + esc(name) + "\" data-date=\"" + iso + "\">Verwijderen</button>";
      html += "</div></div>";
    });
    html += "<div class=\"row-spacer\"></div>";
    html += "<button type=\"button\" class=\"btn btn-outline btn-block\" data-add-custom-exercise=\"" + iso + "\">+ Oefening toevoegen</button>";
    html += "<p class=\"small\">Startgewicht-richtlijn: " + esc(STARTW.MAIN) + " Techniek gaat altijd vóór gewicht.</p>";
    return html;
  }

  function selectHTML(options, current, store, date, field, exName) {
    var h = "<select data-store=\"" + store + "\" data-date=\"" + date + "\"";
    if (exName) h += " data-ex=\"" + esc(exName) + "\"";
    h += " data-field=\"" + field + "\">";
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
      var checkedArr = (saved[c.label] && saved[c.label].checked) || [];
      var timesArr = (saved[c.label] && saved[c.label].times) || [];
      var idx = 0;
      for (var r = 1; r <= c.rounds; r++) {
        if (c.rounds > 1) html += "<p class=\"small\"><b>Ronde " + r + "</b></p>";
        c.items.forEach(function (item) {
          var checked = checkedArr[idx] ? "checked" : "";
          html += "<label class=\"checklist-item\">" +
            "<input type=\"checkbox\" data-store=\"circuit\" data-date=\"" + iso + "\" data-circuit=\"" + esc(c.label) + "\" data-idx=\"" + idx + "\" data-field=\"checked\" " + checked + ">" +
            "<span class=\"item-label\">" + esc(item) + "</span>" +
            "<input type=\"text\" class=\"circuit-time\" placeholder=\"tijd m:ss\" data-store=\"circuit\" data-date=\"" + iso + "\" data-circuit=\"" + esc(c.label) + "\" data-idx=\"" + idx + "\" data-field=\"time\" value=\"" + esc(timesArr[idx] || "") + "\">" +
            "</label>";
          idx++;
        });
      }
      html += "</div>";
    });
    return html;
  }

  function togetherCardHTML(iso, role) {
    if (role !== "run" && role !== "hyrox") return "";
    var t = CACHE.together[iso];
    var me = getProfile(), partner = otherProfile();
    var html = "<div class=\"card\"><h3 class=\"card-title\">👥 Samen trainen</h3>";
    if (!t) {
      html += "<p class=\"muted\">Deze sessie leent zich goed om samen te doen.</p>";
      html += "<label class=\"field\">Tijdstip<input type=\"time\" id=\"together-time-input\" value=\"10:00\"></label>";
      html += "<button type=\"button\" class=\"btn btn-outline btn-block\" data-together-propose=\"" + iso + "\">Stel voor om samen te trainen</button>";
    } else if (!t.confirmed) {
      if (t.proposedBy === me) {
        html += "<p class=\"muted\">Jij stelde <b>" + esc(t.time) + "</b> voor. Wachten op bevestiging van " + esc(PERSON_LABELS[partner]) + ".</p>";
        html += "<button type=\"button\" class=\"btn btn-outline btn-sm\" data-together-cancel=\"" + iso + "\">Annuleren</button>";
      } else {
        html += "<p class=\"muted\">" + esc(PERSON_LABELS[t.proposedBy]) + " stelt voor: <b>" + esc(t.time) + "</b></p>";
        html += "<div class=\"btn-row\">";
        html += "<button type=\"button\" class=\"btn btn-primary\" data-together-confirm=\"" + iso + "\">Bevestigen</button>";
        html += "<button type=\"button\" class=\"btn btn-outline\" data-together-cancel=\"" + iso + "\">Niet akkoord</button>";
        html += "</div>";
      }
    } else {
      html += "<p><b>✅ Samen om " + esc(t.time) + "</b></p>";
      html += "<button type=\"button\" class=\"btn btn-outline btn-block\" data-together-ics=\"" + iso + "\" data-together-time=\"" + esc(t.time) + "\">📅 Download in Agenda (.ics)</button>";
      html += "<button type=\"button\" class=\"btn btn-outline btn-sm\" data-together-cancel=\"" + iso + "\">Verwijderen</button>";
    }
    html += "</div>";
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
    var role = getRoleForDate(date, getProfile());
    var wp = ROLE_CONTENT[phase.id][role];
    var deload = isDeloadWeek(date);
    var isRaceDay = iso === PROGRAM_END;
    var pause = isPaused(date, getProfile());

    var html = back;
    html += "<h1 class=\"page-title\" style=\"margin-top:10px;\">" + esc(formatNLLong(date)) + "</h1>";
    html += "<div style=\"margin-bottom:12px;\">" + phaseBadge(phase) + (deload ? deloadBadgeHTML() : "") + (isRaceDay ? "<span class=\"badge red\">🏁 Wedstrijddag</span>" : "") + "</div>";

    if (pause) {
      html += pauseCardHTML(pause);
    } else {
      html += "<div class=\"card\"><h3 class=\"card-title\">" + esc(DOW_LABELS[dowKey(date)]) + " — sessie</h3>";
      html += "<p>" + esc(wp.title) + "</p>";
      if (wp.extra) html += "<p class=\"muted\">Extra: " + esc(wp.extra) + "</p>";
      html += "</div>";

      if (role === "upper" || role === "legs" || role === "fullbody") {
        html += "<h2 class=\"section-title\">Krachttraining</h2>";
        html += strengthTableHTML(iso, phase.id, role);
      }

      if (role === "run" || role === "hyrox") {
        html += runLogFormHTML(iso, date, phase);
      }
      if (role === "hyrox") {
        html += hyroxCircuitsHTML(iso, phase.id);
      }
      html += togetherCardHTML(iso, role);
    }

    html += "<h2 class=\"section-title\">Dagelijkse checklist</h2>";
    html += "<div class=\"card\">" + dailyChecklistHTML(iso) + "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 11. RENDER: VOORTGANG
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

  // Generieke reeks uit de testresultaten (progress-collectie) voor een numeriek veld.
  function collectProgressNumericSeries(person, field) {
    var map = {};
    CACHE.progress.forEach(function (e) {
      if (e.person === person && e.date && e[field]) map[e.date] = parseFloat(e[field]);
    });
    var dates = Object.keys(map).sort();
    return dates.map(function (d) { return { date: d, value: map[d] }; });
  }
  function parseMinSec(s) {
    var m = String(s || "").trim().match(/^(\d+):([0-5]?\d)$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  function formatMinSec(totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    var mm = Math.floor(s / 60), ss = s % 60;
    return mm + ":" + (ss < 10 ? "0" : "") + ss;
  }
  // Zelfde als collectProgressNumericSeries, maar voor mm:ss-tijden (5km/1km) → seconden.
  function collectProgressTimeSeries(person, field) {
    var map = {};
    CACHE.progress.forEach(function (e) {
      if (e.person === person && e.date && e[field]) {
        var sec = parseMinSec(e[field]);
        if (sec != null) map[e.date] = sec;
      }
    });
    var dates = Object.keys(map).sort();
    return dates.map(function (d) { return { date: d, value: map[d] }; });
  }

  // Configuratie van de extra grafiekjes op Voortgang (naast gewicht), o.b.v. de testresultaten-metingen.
  var EXTRA_METRIC_CHARTS = [
    { key: "waist", label: "Tailleomtrek", unit: "cm", type: "num" },
    { key: "time5k", label: "5 km-tijd", type: "time" },
    { key: "time1k", label: "1 km-tijd", type: "time" },
    { key: "farmers", label: "Farmers carry", unit: "kg", type: "num" },
    { key: "wallballs", label: "Wall balls", unit: "reps", type: "num" }
  ];
  function metricSeries(metric, person) {
    return metric.type === "time" ? collectProgressTimeSeries(person, metric.key) : collectProgressNumericSeries(person, metric.key);
  }

  function drawMultiSparkline(canvas, series, opts) {
    opts = opts || {};
    var formatValue = opts.formatValue || function (v) { return v.toFixed(1) + (opts.unit ? " " + opts.unit : ""); };
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
    ctx.fillText(formatValue(max), 2, padT + 8);
    ctx.fillText(formatValue(min), 2, padT + plotH);
    ctx.textAlign = "left";
    ctx.fillText(formatNLShort(new Date(tMin)), padL, h - 4);
    ctx.textAlign = "right";
    ctx.fillText(formatNLShort(new Date(tMax)), padL + plotW, h - 4);
  }

  function startWeightDeltaHTML(person) {
    var prof = PERSONAL[person] || {};
    if (!prof.startWeight) return "";
    var series = collectWeightSeries(person);
    if (!series.length) return "";
    var latest = series[series.length - 1].value;
    var delta = latest - parseFloat(prof.startWeight);
    var sign = delta > 0 ? "+" : "";
    return "<p class=\"small\">" + esc(PERSON_LABELS[person]) + ": " + sign + delta.toFixed(1) + " kg sinds start (" + prof.startWeight + " kg → " + latest.toFixed(1) + " kg)</p>";
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
    html += startWeightDeltaHTML(me);
    html += startWeightDeltaHTML(partner);
    html += "</div>";

    EXTRA_METRIC_CHARTS.forEach(function (m) {
      var mySeries2 = metricSeries(m, me);
      var partnerSeries2 = metricSeries(m, partner);
      if (!mySeries2.length && !partnerSeries2.length) return;
      html += "<div class=\"card\"><h3 class=\"card-title\">" + esc(m.label) + "</h3>";
      html += "<div class=\"legend\">" +
        "<span><span class=\"dot-inline\" style=\"background:" + PERSON_COLORS[me] + "\"></span>Jij (" + esc(PERSON_LABELS[me]) + ")</span>" +
        "<span><span class=\"dot-inline\" style=\"background:" + PERSON_COLORS[partner] + "\"></span>" + esc(PERSON_LABELS[partner]) + "</span>" +
        "</div>";
      html += "<canvas class=\"sparkline\" id=\"chart-" + m.key + "\"></canvas>";
      html += "</div>";
    });

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

    var editingEntry = EDITING_PROGRESS_ID ? CACHE.progress.find(function (e) { return String(e.id) === String(EDITING_PROGRESS_ID); }) : null;
    if (EDITING_PROGRESS_ID && !editingEntry) EDITING_PROGRESS_ID = null;

    html += "<div class=\"card\"><h3 class=\"card-title\">" + (editingEntry ? "Meting bewerken" : "Nieuwe meting toevoegen") + "</h3>";
    html += "<form id=\"progress-form\">";
    html += "<label class=\"field\">Datum<input type=\"date\" name=\"date\" required value=\"" + esc(editingEntry ? editingEntry.date : toISO(midnight(new Date()))) + "\"></label>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Gewicht (kg)<input type=\"number\" step=\"0.1\" name=\"weight\" value=\"" + esc(editingEntry && editingEntry.weight || "") + "\"></label>";
    html += "<label class=\"field\">Tailleomtrek (cm)<input type=\"number\" step=\"0.5\" name=\"waist\" value=\"" + esc(editingEntry && editingEntry.waist || "") + "\"></label>";
    html += "</div>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">5 km-tijd<input type=\"text\" name=\"time5k\" placeholder=\"mm:ss\" value=\"" + esc(editingEntry && editingEntry.time5k || "") + "\"></label>";
    html += "<label class=\"field\">1 km-tijd<input type=\"text\" name=\"time1k\" placeholder=\"mm:ss\" value=\"" + esc(editingEntry && editingEntry.time1k || "") + "\"></label>";
    html += "</div>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Farmers carry (kg/kb)<input type=\"number\" step=\"0.5\" name=\"farmers\" value=\"" + esc(editingEntry && editingEntry.farmers || "") + "\"></label>";
    html += "<label class=\"field\">Wall balls (max reps)<input type=\"number\" step=\"1\" name=\"wallballs\" value=\"" + esc(editingEntry && editingEntry.wallballs || "") + "\"></label>";
    html += "</div>";
    html += "<label class=\"field\">Notities / extra resultaten<textarea name=\"notes\" rows=\"2\" placeholder=\"bv. extra reps, hoe het voelde, ...\">" + esc(editingEntry && editingEntry.notes || "") + "</textarea></label>";
    html += "<button type=\"submit\" class=\"btn btn-primary btn-block\">" + (editingEntry ? "Wijzigingen opslaan" : "Toevoegen") + "</button>";
    if (editingEntry) html += "<button type=\"button\" class=\"btn btn-outline btn-block\" id=\"progress-cancel-edit\">Annuleer bewerken</button>";
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
          "<b>" + esc(formatNLShort(parseISO(e.date))) + "</b> — " + esc(parts.join(" · ") || "geen data") +
          (e.notes ? "<br><span class=\"muted\">" + esc(e.notes) + "</span>" : "") + "</span><span>" +
          (e.person === getProfile() ? "<button class=\"del\" data-edit-id=\"" + e.id + "\" title=\"Bewerken\">✎</button>" : "") +
          "<button class=\"del\" data-del-id=\"" + e.id + "\" title=\"Verwijderen\">×</button></span></div>";
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

    html += "<div class=\"card\"><h3 class=\"card-title\">Back-up testresultaten terugzetten</h3>";
    html += "<p class=\"small\">Importeer een eerder geëxporteerd \"Testresultaten\"-CSV-bestand (van deze app). Reeds bestaande metingen blijven staan; geïmporteerde rijen worden toegevoegd.</p>";
    html += "<label class=\"btn btn-outline btn-block\" style=\"text-align:center;\">Kies CSV-bestand<input type=\"file\" accept=\".csv,text/csv\" id=\"import-progress-file\" style=\"display:none;\"></label>";
    html += "</div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 12. RENDER: IK (personaliseer)
   * ------------------------------------------------------------------ */

  function altManagerListHTML(exName, person) {
    if (!exName) return "<p class=\"muted\">Geen oefeningen beschikbaar.</p>";
    var built = EXERCISE_ALTERNATIVES[exName] || [];
    var hidden = (PERSONAL[person] && PERSONAL[person].hiddenAlternatives && PERSONAL[person].hiddenAlternatives[exName]) || [];
    var custom = (PERSONAL[person] && PERSONAL[person].customAlternatives && PERSONAL[person].customAlternatives[exName]) || [];
    var html = "";
    var any = false;
    built.forEach(function (a) {
      any = true;
      var isHidden = hidden.indexOf(a.label) !== -1;
      html += "<div class=\"progress-row\"" + (isHidden ? " style=\"opacity:.5;\"" : "") + "><span>" + esc(a.label) +
        " <span class=\"muted\">(" + esc(a.sets) + " · RPE " + esc(a.rpe) + " · rust " + esc(a.rest) + ")</span></span>";
      if (isHidden) {
        html += "<button type=\"button\" class=\"btn btn-outline btn-sm\" data-altmgr-restore=\"" + esc(exName) + "\" data-altmgr-label=\"" + esc(a.label) + "\">Herstellen</button>";
      } else {
        html += "<button type=\"button\" class=\"del\" data-altmgr-hide=\"" + esc(exName) + "\" data-altmgr-label=\"" + esc(a.label) + "\" title=\"Verwijderen\">×</button>";
      }
      html += "</div>";
    });
    custom.forEach(function (a) {
      any = true;
      html += "<div class=\"progress-row\"><span>" + esc(a.label) +
        " <span class=\"muted\">(eigen" + (a.sets ? " · " + esc(a.sets) : "") + (a.rpe ? " · RPE " + esc(a.rpe) : "") + (a.rest ? " · rust " + esc(a.rest) : "") + ")</span></span>" +
        "<button type=\"button\" class=\"del\" data-altmgr-remove=\"" + esc(exName) + "\" data-altmgr-label=\"" + esc(a.label) + "\" title=\"Verwijderen\">×</button></div>";
    });
    if (!any) html += "<p class=\"muted\">Nog geen alternatieven voor deze oefening.</p>";
    return html;
  }

  function renderIk() {
    var person = getProfile();
    var prof = PERSONAL[person] || {};
    var html = "<h1 class=\"page-title\">Ik — " + esc(PERSON_LABELS[person]) + "</h1>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Account</h3>";
    html += "<button class=\"btn btn-outline btn-block\" id=\"switch-profile\">Wissel gebruiker / log uit</button>";
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Meldingen — samen trainen</h3>";
    if (typeof Notification === "undefined") {
      html += "<p class=\"small muted\">Meldingen worden niet ondersteund op dit toestel/deze browser.</p>";
    } else if (Notification.permission === "granted") {
      html += "<p class=\"small\">✅ Ingeschakeld — je krijgt een melding bij een nieuw voorstel of bevestiging, zolang de app open of op de achtergrond staat.</p>";
    } else if (Notification.permission === "denied") {
      html += "<p class=\"small muted\">🔕 Geblokkeerd. Zet dit aan via de meldingen-instellingen van je browser/toestel voor deze site, indien gewenst.</p>";
    } else {
      html += "<p class=\"small\">Krijg een melding wanneer je partner voorstelt om samen te trainen, of je voorstel bevestigt. Werkt enkel zolang de app ergens open/op de achtergrond staat — niet wanneer hij volledig gesloten is.</p>";
      html += "<button type=\"button\" class=\"btn btn-outline btn-block\" id=\"enable-notifications\">🔔 Meldingen inschakelen</button>";
    }
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Wijzig mijn toegangscode</h3>";
    html += (PASSWORD_MSG ? "<p class=\"small\">" + esc(PASSWORD_MSG) + "</p>" : "");
    html += "<form id=\"password-form\">";
    html += "<label class=\"field\">Huidige code<input type=\"password\" name=\"oldCode\" autocomplete=\"current-password\" required></label>";
    html += "<label class=\"field\">Nieuwe code (min. 6 tekens)<input type=\"password\" name=\"newCode\" autocomplete=\"new-password\" required minlength=\"6\"></label>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Code wijzigen</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Startgewicht</h3>";
    html += "<p class=\"small\">Gebruikt om je voortgang t.o.v. je startpunt te tonen op de Voortgang-pagina.</p>";
    html += "<form id=\"startweight-form\">";
    html += "<label class=\"field\">Startgewicht (kg)<input type=\"number\" step=\"0.1\" name=\"startWeight\" value=\"" + (prof.startWeight || "") + "\"></label>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Opslaan</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Wat wil je bijhouden?</h3>";
    html += "<p class=\"small\">Uitgevinkte velden verdwijnen uit jouw dagelijkse checklist (\"Training gedaan\" blijft altijd zichtbaar).</p>";
    TRACK_FIELDS.forEach(function (f) {
      var checked = isTracked(f.key) ? "checked" : "";
      html += "<label class=\"checklist-item\"><input type=\"checkbox\" data-track-toggle=\"" + f.key + "\" " + checked + "> " + esc(f.label) + "</label>";
    });
    html += "</div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Mijn weekindeling</h3>";
    html += "<p class=\"small\">Kies zelf welke dag welk type sessie is — bv. jij loopt liever op maandag i.p.v. dinsdag. Geldt voor jou, op elke fase.</p>";

    html += "<label class=\"field\">Snel starten — dagen per week actief trainen (kracht/loop/HYROX)" +
      "<select id=\"daycount-select\">" +
      [2, 3, 4, 5, 6, 7].map(function (n) { return "<option value=\"" + n + "\"" + (n === 5 ? " selected" : "") + ">" + n + " dagen</option>"; }).join("") +
      "</select></label>";
    html += "<button type=\"button\" class=\"btn btn-outline btn-block\" id=\"apply-daycount-btn\">Vul indeling hieronder in</button>";
    html += "<p class=\"small\" id=\"daycount-warning\"></p>";

    if (WEEKMAP_SUGGESTION) {
      html += "<hr class=\"sep\"><p class=\"small\"><b>Jouw combinatie laat een dag onbenut of dubbel gebruikt — hier is een herschikkingsvoorstel:</b></p>";
      html += "<p class=\"small\"><b>Jouw keuze</b></p>" + weekmapSummaryHTML(WEEKMAP_SUGGESTION.mine);
      html += "<p class=\"small\"><b>Voorstel (betere spreiding)</b></p>" + weekmapSummaryHTML(WEEKMAP_SUGGESTION.suggested);
      html += "<div class=\"btn-row\">";
      html += "<button type=\"button\" class=\"btn btn-outline\" data-weekmap-choice=\"mine\">Gebruik mijn keuze</button>";
      html += "<button type=\"button\" class=\"btn btn-primary\" data-weekmap-choice=\"suggested\">Gebruik voorstel</button>";
      html += "</div><hr class=\"sep\">";
    }

    html += "<form id=\"weekmap-form\">";
    ORDERED_DOW.forEach(function (dow) {
      var current = (prof.weekmap && prof.weekmap[dow]) || defaultRoleMap(getPhase(new Date()).id)[dow];
      html += "<label class=\"field\">" + esc(DOW_LABELS[dow]) +
        "<select name=\"" + dow + "\">" +
        ROLES.map(function (r) { return "<option value=\"" + r + "\"" + (r === current ? " selected" : "") + ">" + esc(ROLE_LABELS[r]) + "</option>"; }).join("") +
        "</select></label>";
    });
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Weekindeling opslaan</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Machines &amp; alternatieven</h3>";
    html += "<p class=\"small\">Niet elke gym heeft dezelfde toestellen. Kies hieronder een oefening en beheer welke alternatieve machine/oefening de app je voorstelt wanneer je \"machine niet aanwezig\" aanvinkt bij een sessie — verwijder wat je niet hebt, voeg toe wat je wél hebt.</p>";
    var allExNames = getAllExerciseNames();
    var altmgrSelected = ALTMGR_SELECTED && allExNames.indexOf(ALTMGR_SELECTED) !== -1 ? ALTMGR_SELECTED : allExNames[0];
    html += "<label class=\"field\">Oefening<select id=\"altmgr-exercise-select\">" +
      allExNames.map(function (n) { return "<option value=\"" + esc(n) + "\"" + (n === altmgrSelected ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") +
      "</select></label>";
    html += "<div id=\"altmgr-list\">" + altManagerListHTML(altmgrSelected, person) + "</div>";
    html += "<hr class=\"sep\">";
    html += "<form id=\"altmgr-add-form\">";
    html += "<label class=\"field\">Naam machine/oefening<input type=\"text\" name=\"label\" required placeholder=\"bv. Hack Squat Machine\"></label>";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Sets x reps<input type=\"text\" name=\"sets\" placeholder=\"bv. 4x10\"></label>";
    html += "<label class=\"field\">RPE<input type=\"text\" name=\"rpe\" placeholder=\"bv. 7\"></label>";
    html += "</div>";
    html += "<label class=\"field\">Rust<input type=\"text\" name=\"rest\" placeholder=\"bv. 75 sec\"></label>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">+ Alternatief toevoegen</button>";
    html += "</form></div>";

    html += "<div class=\"card\"><h3 class=\"card-title\">Pauzeperiode (blessure/vakantie)</h3>";
    html += "<p class=\"small\">Tijdens een pauzeperiode toont je schema \"Pauze\" i.p.v. een trainingssessie.</p>";
    var pauses = prof.pauses || [];
    if (pauses.length) {
      pauses.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (p) {
        html += "<div class=\"progress-row\"><span>" + esc(formatNLShort(parseISO(p.start))) + " – " + esc(formatNLShort(parseISO(p.end))) + " · " + esc(p.reason) + "</span>" +
          "<button class=\"del\" data-del-pause=\"" + p.id + "\" title=\"Verwijderen\">×</button></div>";
      });
    } else {
      html += "<p class=\"muted\">Geen pauzeperiodes ingesteld.</p>";
    }
    html += "<form id=\"pause-form\">";
    html += "<div class=\"input-grid\">";
    html += "<label class=\"field\">Van<input type=\"date\" name=\"start\" required></label>";
    html += "<label class=\"field\">Tot<input type=\"date\" name=\"end\" required></label>";
    html += "</div>";
    html += "<label class=\"field\">Reden<select name=\"reason\"><option value=\"Blessure\">Blessure</option><option value=\"Vakantie\">Vakantie</option><option value=\"Andere\">Andere</option></select></label>";
    html += "<button type=\"submit\" class=\"btn btn-outline btn-block\">Pauze toevoegen</button>";
    html += "</form></div>";

    return html;
  }

  /* ------------------------------------------------------------------ *
   * 13. RENDER: INFO
   * ------------------------------------------------------------------ */

  function renderInfo() {
    var html = "<h1 class=\"page-title\">Info &amp; referentie</h1>";

    html += "<div class=\"warnbox\"><b>Geen medisch advies.</b> Dit is een persoonlijk trainingshulpmiddel, geen "
      + "medisch advies. Pas de training aan of raadpleeg een arts/specialist bij pijn, duizeligheid of "
      + "blessureklachten.</div>";

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
   * 14. CSV EXPORT
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
    var rows = [["Persoon", "Datum", "Gewicht(kg)", "Tailleomtrek(cm)", "5kmTijd", "1kmTijd", "FarmersCarry(kg)", "WallBalls(reps)", "Notities"]];
    CACHE.progress.slice().sort(function (a, b) { return a.date > b.date ? 1 : -1; }).forEach(function (e) {
      rows.push([PERSON_LABELS[e.person] || e.person, e.date, e.weight || "", e.waist || "", e.time5k || "", e.time1k || "", e.farmers || "", e.wallballs || "", e.notes || ""]);
    });
    downloadCSV("hyrox_testresultaten.csv", rows);
  }

  /* ---- CSV-import (herstel van een testresultaten-back-up) ---- */

  function parseCSV(text) {
    text = String(text || "").replace(/^﻿/, "");
    var rows = [], field = "", row = [], inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === "\"") {
          if (text[i + 1] === "\"") { field += "\""; i++; } else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === "\"") {
        inQuotes = true;
      } else if (c === ";") {
        row.push(field); field = "";
      } else if (c === "\r") {
        // negeren
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return !(r.length === 1 && r[0] === ""); });
  }

  function importProgressCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) { showToast("Leeg of ongeldig CSV-bestand.", "error"); return; }
    var idx = {};
    rows[0].forEach(function (h, i) { idx[h.trim()] = i; });
    if (idx.Persoon === undefined || idx.Datum === undefined) {
      showToast("CSV-formaat niet herkend — gebruik een export van deze app (\"Testresultaten\").", "error");
      return;
    }
    var labelToPerson = {};
    Object.keys(PERSON_LABELS).forEach(function (p) { labelToPerson[PERSON_LABELS[p].trim().toLowerCase()] = p; });
    var colMap = { "Gewicht(kg)": "weight", "Tailleomtrek(cm)": "waist", "5kmTijd": "time5k", "1kmTijd": "time1k", "FarmersCarry(kg)": "farmers", "WallBalls(reps)": "wallballs", "Notities": "notes" };
    var count = 0;
    rows.slice(1).forEach(function (r) {
      if (!r.length || (r.length === 1 && !r[0])) return;
      var personRaw = String(r[idx.Persoon] || "").trim();
      var person = labelToPerson[personRaw.toLowerCase()] || (PERSON_LABELS[personRaw] ? personRaw : null);
      var date = String(r[idx.Datum] || "").trim();
      if (!person || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      var entry = { person: person, date: date, createdAt: Date.now(), imported: true };
      Object.keys(colMap).forEach(function (col) {
        if (idx[col] === undefined) return;
        var v = String(r[idx[col]] || "").trim();
        if (v) entry[colMap[col]] = v;
      });
      db.collection("progress").add(entry).catch(function (e) { console.error("importProgress", e); showSyncError(); });
      count++;
    });
    showToast(count ? count + " testresultaat/resultaten geïmporteerd." : "Geen bruikbare rijen gevonden in dit bestand.", count ? "success" : "error");
  }

  /* ------------------------------------------------------------------ *
   * 15. ROUTER
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
    if (isAdminUser() && !ADMIN_PANEL_DISMISSED) {
      viewEl.innerHTML = renderAdmin();
      tabbarEl.classList.add("hidden");
      subEl.textContent = "Admin";
      bindAdminPanel();
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
    } else if (r.route === "ik") {
      html = renderIk();
    } else if (r.route === "info") {
      html = renderInfo();
    } else {
      html = renderDashboard();
    }

    viewEl.innerHTML = html;
    subEl.textContent = subtitle;
    setActiveTab(r.route === "" ? "dashboard" : r.route);
    window.scrollTo(0, 0);

    if (r.route === "week") {
      var jumpInput = document.getElementById("week-date-jump");
      if (jumpInput) {
        jumpInput.addEventListener("change", function () {
          if (!jumpInput.value) return;
          var picked = clampDate(parseISO(jumpInput.value), START_DATE, END_DATE);
          var newOffset = Math.round((getMonday(picked) - FIRST_MONDAY) / (7 * MS_DAY));
          location.hash = "#/week/" + newOffset;
        });
      }
    }
    if (r.route === "voortgang") {
      var canvas = document.getElementById("weight-chart");
      if (canvas) {
        drawMultiSparkline(canvas, [
          { color: PERSON_COLORS[getProfile()], points: collectWeightSeries(getProfile()) },
          { color: PERSON_COLORS[otherProfile()], points: collectWeightSeries(otherProfile()) }
        ], { unit: "kg" });
      }
      EXTRA_METRIC_CHARTS.forEach(function (m) {
        var canvas2 = document.getElementById("chart-" + m.key);
        if (!canvas2) return;
        drawMultiSparkline(canvas2, [
          { color: PERSON_COLORS[getProfile()], points: metricSeries(m, getProfile()) },
          { color: PERSON_COLORS[otherProfile()], points: metricSeries(m, otherProfile()) }
        ], m.type === "time" ? { formatValue: formatMinSec } : { unit: m.unit });
      });
      bindProgressView();
    }
    if (r.route === "ik") {
      bindIkActions();
    }
    if (r.route === "info") {
      bindInfoActions();
    }
  }

  /* ------------------------------------------------------------------ *
   * 16. EVENTS
   * ------------------------------------------------------------------ */

  function handleFieldChange(e) {
    var t = e.target;
    if (t.type === "file" && t.dataset && t.dataset.photoUpload) {
      var file = t.files && t.files[0];
      if (file) uploadDailyPhoto(t.dataset.photoUpload, file);
      return;
    }
    if (t.dataset && t.dataset.trackToggle) {
      saveTracking(t.dataset.trackToggle, t.checked);
      return;
    }
    var store = t.dataset ? t.dataset.store : null;
    if (!store) return;
    var date = t.dataset.date;

    if (store === "daily") {
      saveDaily(date, t.dataset.field, t.type === "checkbox" ? t.checked : t.value);
    } else if (store === "ex") {
      saveEx(date, t.dataset.ex, t.dataset.field, t.value);
      if (t.dataset.field === "alternative") {
        scheduleRerender();
      }
    } else if (store === "run") {
      saveRun(date, t.dataset.field, t.value);
    } else if (store === "circuit") {
      saveCircuit(date, t.dataset.circuit, parseInt(t.dataset.idx, 10), t.dataset.field, t.dataset.field === "checked" ? t.checked : t.value);
    }
  }

  function handleViewClick(e) {
    var delPhotoBtn = e.target.closest && e.target.closest("[data-photo-delete]");
    if (delPhotoBtn) { deleteDailyPhoto(delPhotoBtn.getAttribute("data-photo-delete")); return; }

    var proposeBtn = e.target.closest && e.target.closest("[data-together-propose]");
    if (proposeBtn) {
      var iso1 = proposeBtn.getAttribute("data-together-propose");
      var timeInput = document.getElementById("together-time-input");
      saveTogether(iso1, timeInput ? timeInput.value : "10:00");
      return;
    }
    var confirmBtn = e.target.closest && e.target.closest("[data-together-confirm]");
    if (confirmBtn) { saveTogether(confirmBtn.getAttribute("data-together-confirm")); return; }

    var cancelBtn = e.target.closest && e.target.closest("[data-together-cancel]");
    if (cancelBtn) { clearTogether(cancelBtn.getAttribute("data-together-cancel")); return; }

    var icsBtn = e.target.closest && e.target.closest("[data-together-ics]");
    if (icsBtn) { downloadICS(icsBtn.getAttribute("data-together-ics"), icsBtn.getAttribute("data-together-time")); return; }

    var addCustom = e.target.closest && e.target.closest("[data-add-custom-exercise]");
    if (addCustom) { addCustomExercise(addCustom.getAttribute("data-add-custom-exercise")); render(); return; }

    var deleteExBtn = e.target.closest && e.target.closest("[data-delete-exercise]");
    if (deleteExBtn) {
      var iso = deleteExBtn.getAttribute("data-date");
      var exName = deleteExBtn.getAttribute("data-delete-exercise");
      if (confirm("Deze oefening verwijderen?")) {
        deleteExercise(iso, exName);
        render();
      }
      return;
    }
  }

  function bindProgressView() {
    var form = document.getElementById("progress-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var date = fd.get("date");
        if (!date) return;
        if (EDITING_PROGRESS_ID) {
          var patch = { date: date };
          ["weight", "waist", "time5k", "time1k", "farmers", "wallballs", "notes"].forEach(function (f) {
            patch[f] = String(fd.get(f) || "");
          });
          editProgressEntry(EDITING_PROGRESS_ID, patch);
          EDITING_PROGRESS_ID = null;
        } else {
          var entry = { date: date };
          ["weight", "waist", "time5k", "time1k", "farmers", "wallballs", "notes"].forEach(function (f) {
            var v = fd.get(f);
            if (v) entry[f] = v;
          });
          addProgressEntry(entry);
        }
        form.reset();
        render();
      });
    }

    var cancelEditBtn = document.getElementById("progress-cancel-edit");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", function () {
        EDITING_PROGRESS_ID = null;
        render();
      });
    }

    viewEl.querySelectorAll("[data-edit-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        EDITING_PROGRESS_ID = btn.getAttribute("data-edit-id");
        render();
        var form2 = document.getElementById("progress-form");
        if (form2) form2.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

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

    var importFile = document.getElementById("import-progress-file");
    if (importFile) {
      importFile.addEventListener("change", function () {
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () { importProgressCSV(String(reader.result || "")); };
        reader.onerror = function () { showToast("Bestand kon niet gelezen worden.", "error"); };
        reader.readAsText(file, "utf-8");
        importFile.value = "";
      });
    }
  }

  function bindIkActions() {
    var switchBtn = document.getElementById("switch-profile");
    if (switchBtn) switchBtn.addEventListener("click", function () { switchProfile(); });

    var enableNotifBtn = document.getElementById("enable-notifications");
    if (enableNotifBtn) {
      enableNotifBtn.addEventListener("click", function () {
        if (typeof Notification === "undefined") return;
        Notification.requestPermission().then(function () { render(); });
      });
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

    var swForm = document.getElementById("startweight-form");
    if (swForm) {
      swForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = new FormData(swForm).get("startWeight");
        if (v) saveStartWeight(v);
      });
    }

    var applyDaycountBtn = document.getElementById("apply-daycount-btn");
    if (applyDaycountBtn) {
      applyDaycountBtn.addEventListener("click", function () {
        var n = parseInt(document.getElementById("daycount-select").value, 10);
        var tmpl = DAYCOUNT_TEMPLATES[n];
        var wmForm2 = document.getElementById("weekmap-form");
        ORDERED_DOW.forEach(function (dow) {
          var sel = wmForm2 ? wmForm2.querySelector("select[name='" + dow + "']") : null;
          if (sel) sel.value = tmpl[dow];
        });
        var warn = document.getElementById("daycount-warning");
        if (warn) warn.textContent = n >= 6 ? "Let op: weinig tot geen rustdagen bij " + n + " dagen/week — zorg voor voldoende hersteltijd." : "";
      });
    }

    var wmForm = document.getElementById("weekmap-form");
    if (wmForm) {
      wmForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(wmForm);
        var map = {};
        ORDERED_DOW.forEach(function (dow) { map[dow] = fd.get(dow); });
        var person = getProfile();
        var prof = PERSONAL[person] || {};
        var previousMap = {};
        ORDERED_DOW.forEach(function (dow) { previousMap[dow] = (prof.weekmap && prof.weekmap[dow]) || defaultRoleMap(getPhase(new Date()).id)[dow]; });

        if (isPermutation(map) || weekmapEqual(map, previousMap)) {
          WEEKMAP_SUGGESTION = null;
          saveWeekmap(map);
        } else {
          WEEKMAP_SUGGESTION = { mine: map, suggested: suggestWeekmap(map, previousMap) };
          render();
        }
      });
    }

    document.querySelectorAll("[data-weekmap-choice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-weekmap-choice");
        var map = WEEKMAP_SUGGESTION && WEEKMAP_SUGGESTION[choice];
        WEEKMAP_SUGGESTION = null;
        if (map) saveWeekmap(map);
        else render();
      });
    });

    var altmgrSelect = document.getElementById("altmgr-exercise-select");
    if (altmgrSelect) {
      altmgrSelect.addEventListener("change", function () {
        ALTMGR_SELECTED = altmgrSelect.value;
        var list = document.getElementById("altmgr-list");
        if (list) list.innerHTML = altManagerListHTML(ALTMGR_SELECTED, getProfile());
      });
    }
    var altmgrForm = document.getElementById("altmgr-add-form");
    if (altmgrForm) {
      altmgrForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var exName = altmgrSelect ? altmgrSelect.value : (getAllExerciseNames()[0] || "");
        if (!exName) return;
        var fd = new FormData(altmgrForm);
        var label = String(fd.get("label") || "").trim();
        if (!label) return;
        ALTMGR_SELECTED = exName;
        saveCustomAlternative(exName, {
          label: label,
          sets: String(fd.get("sets") || "").trim(),
          rpe: String(fd.get("rpe") || "").trim(),
          rest: String(fd.get("rest") || "").trim()
        });
        render();
      });
    }
    viewEl.querySelectorAll("[data-altmgr-hide]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ALTMGR_SELECTED = btn.getAttribute("data-altmgr-hide");
        hideBuiltinAlternative(ALTMGR_SELECTED, btn.getAttribute("data-altmgr-label"));
        render();
      });
    });
    viewEl.querySelectorAll("[data-altmgr-restore]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ALTMGR_SELECTED = btn.getAttribute("data-altmgr-restore");
        restoreBuiltinAlternative(ALTMGR_SELECTED, btn.getAttribute("data-altmgr-label"));
        render();
      });
    });
    viewEl.querySelectorAll("[data-altmgr-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ALTMGR_SELECTED = btn.getAttribute("data-altmgr-remove");
        removeCustomAlternative(ALTMGR_SELECTED, btn.getAttribute("data-altmgr-label"));
        render();
      });
    });

    var pauseForm = document.getElementById("pause-form");
    if (pauseForm) {
      pauseForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(pauseForm);
        var start = fd.get("start"), end = fd.get("end"), reason = fd.get("reason");
        if (!start || !end) return;
        if (parseISO(end).getTime() < parseISO(start).getTime()) {
          alert("De einddatum moet na de startdatum liggen.");
          return;
        }
        savePause(start, end, reason);
        pauseForm.reset();
      });
    }
    viewEl.querySelectorAll("[data-del-pause]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deletePause(btn.getAttribute("data-del-pause"));
      });
    });
  }

  function bindInfoActions() {
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
   * 17. INIT
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
