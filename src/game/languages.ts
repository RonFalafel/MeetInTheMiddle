/**
 * Languages the game is playable in.
 *
 * Country names come from `i18n-iso-countries` at build time, so adding a
 * language is: add a row here, write its `Strings`, run `npm run graph`. The
 * package ships 76 locales, so the limit is the interface text below, not the
 * country data.
 *
 * Guess matching is deliberately not limited to the chosen language — see
 * `findByName` in graph.ts. Two people playing together can each read the game
 * in their own language and still type into the same board.
 */

export type LanguageCode = 'en' | 'he' | 'ar' | 'es' | 'fr' | 'de' | 'it' | 'nl' | 'pt' | 'ru'

export type Language = {
  readonly code: LanguageCode
  /** What speakers call it, which is what belongs in the picker. */
  readonly endonym: string
  readonly dir: 'ltr' | 'rtl'
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', endonym: 'English', dir: 'ltr' },
  { code: 'he', endonym: 'עברית', dir: 'rtl' },
  { code: 'ar', endonym: 'العربية', dir: 'rtl' },
  { code: 'es', endonym: 'Español', dir: 'ltr' },
  { code: 'fr', endonym: 'Français', dir: 'ltr' },
  { code: 'de', endonym: 'Deutsch', dir: 'ltr' },
  { code: 'it', endonym: 'Italiano', dir: 'ltr' },
  { code: 'nl', endonym: 'Nederlands', dir: 'ltr' },
  { code: 'pt', endonym: 'Português', dir: 'ltr' },
  { code: 'ru', endonym: 'Русский', dir: 'ltr' },
]

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((language) => language.code)

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode)
}

export function languageOf(code: LanguageCode): Language {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]!
}

/**
 * Interface text. Counts are shown as `label: n` rather than folded into a
 * sentence, because "3 more countries" needs different agreement in most of
 * these languages and a label sidesteps every one of those rules.
 */
export type Strings = {
  title: string
  tagline: string
  language: string

  twoPhones: string
  twoPhonesHint: string
  startGame: string
  codePlaceholder: string
  join: string
  codeError: string
  oneDevice: string
  oneDeviceHint: string
  playHere: string

  score: string
  par: string
  yourStart: string
  stillNeeded: string
  guessPlaceholder: string
  guessingAs: string
  player: string

  waiting: string
  bothHere: string
  reconnecting: string
  connecting: string
  invite: string
  copied: string
  leave: string
  back: string
  wholeWorld: string

  youMet: string
  perfect: string
  againstPar: string
  yourRoute: string
  shortestRoute: string
  newGame: string

  you: string
  partner: string
  partnerNamed: string

  rejectUnknown: string
  rejectOutOfPlay: string
  rejectWrongLandmass: string
  rejectAlreadyNamed: string
  rejectGameOver: string

  errBadRoom: string
  errRoomFull: string
  errTakenOver: string
  errGeneric: string
}

export const STRINGS: Readonly<Record<LanguageCode, Strings>> = {
  en: {
    title: 'Meet in the Middle',
    tagline:
      'You each start in a secret country. Name countries — any country, in any order — until your two sides join up. Fewer is better.',
    language: 'Language',
    twoPhones: 'Two phones',
    twoPhonesHint: 'One of you starts a game and sends the other the link.',
    startGame: 'Start a game',
    codePlaceholder: 'Or enter a code',
    join: 'Join',
    codeError: 'Room codes are four characters.',
    oneDevice: 'One device',
    oneDeviceHint: 'Pass it back and forth, or play both sides yourself.',
    playHere: 'Play here',
    score: 'Score',
    par: 'Par',
    yourStart: 'Your start',
    stillNeeded: 'Still needed',
    guessPlaceholder: 'Name any country',
    guessingAs: 'Guessing as',
    player: 'Player',
    waiting: 'Waiting for your partner',
    bothHere: 'Both here',
    reconnecting: 'Reconnecting…',
    connecting: 'Connecting…',
    invite: 'Invite',
    copied: 'Copied',
    leave: 'Leave',
    back: 'Back',
    wholeWorld: 'Whole world',
    youMet: 'You met',
    perfect: 'Perfect — nobody could have done it in fewer.',
    againstPar: 'Score {score}, par {par}.',
    yourRoute: 'Your route',
    shortestRoute: 'Shortest possible',
    newGame: 'New game',
    you: 'You',
    partner: 'Partner',
    partnerNamed: 'Partner has named',
    rejectUnknown: '"{text}" is not a country in this game.',
    rejectOutOfPlay: '{country} has no land border with anywhere.',
    rejectWrongLandmass: '{country} is on another landmass.',
    rejectAlreadyNamed: '{country} is already on the board.',
    rejectGameOver: 'You already met.',
    errBadRoom: 'That room code does not look right.',
    errRoomFull: 'That room already has two players.',
    errTakenOver: 'You opened this game somewhere else.',
    errGeneric: 'Something went wrong.',
  },

  he: {
    title: 'להיפגש באמצע',
    tagline:
      'כל אחד מכם מתחיל במדינה סודית. תנו שמות של מדינות — כל מדינה, בכל סדר — עד ששני הצדדים מתחברים. כמה שפחות, יותר טוב.',
    language: 'שפה',
    twoPhones: 'שני טלפונים',
    twoPhonesHint: 'אחד מכם פותח משחק ושולח לשני את הקישור.',
    startGame: 'פתיחת משחק',
    codePlaceholder: 'או הזינו קוד',
    join: 'הצטרפות',
    codeError: 'קוד חדר הוא ארבעה תווים.',
    oneDevice: 'מכשיר אחד',
    oneDeviceHint: 'העבירו אותו ביניכם, או שחקו את שני הצדדים.',
    playHere: 'לשחק כאן',
    score: 'ניקוד',
    par: 'מינימום',
    yourStart: 'נקודת הפתיחה שלך',
    stillNeeded: 'נותרו',
    guessPlaceholder: 'שם של מדינה',
    guessingAs: 'משחקים בתור',
    player: 'שחקן',
    waiting: 'ממתינים לשותף',
    bothHere: 'שניכם כאן',
    reconnecting: 'מתחבר מחדש…',
    connecting: 'מתחבר…',
    invite: 'הזמנה',
    copied: 'הועתק',
    leave: 'יציאה',
    back: 'חזרה',
    wholeWorld: 'כל העולם',
    youMet: 'נפגשתם',
    perfect: 'מושלם — אי אפשר היה בפחות.',
    againstPar: 'ניקוד {score}, מינימום {par}.',
    yourRoute: 'המסלול שלכם',
    shortestRoute: 'המסלול הקצר ביותר',
    newGame: 'משחק חדש',
    you: 'שלי',
    partner: 'השותף',
    partnerNamed: 'השותף ציין',
    rejectUnknown: '״{text}״ אינה מדינה במשחק הזה.',
    rejectOutOfPlay: 'ל{country} אין גבול יבשתי עם אף מדינה.',
    rejectWrongLandmass: '{country} נמצאת ביבשת אחרת.',
    rejectAlreadyNamed: '{country} כבר על הלוח.',
    rejectGameOver: 'כבר נפגשתם.',
    errBadRoom: 'קוד החדר לא נראה תקין.',
    errRoomFull: 'בחדר הזה כבר יש שני שחקנים.',
    errTakenOver: 'פתחתם את המשחק במקום אחר.',
    errGeneric: 'משהו השתבש.',
  },

  ar: {
    title: 'نلتقي في المنتصف',
    tagline:
      'يبدأ كل منكما في دولة سرية. اذكرا أسماء دول — أي دولة، بأي ترتيب — حتى يتصل الجانبان. كلما قل العدد كان أفضل.',
    language: 'اللغة',
    twoPhones: 'هاتفان',
    twoPhonesHint: 'يبدأ أحدكما اللعبة ويرسل الرابط للآخر.',
    startGame: 'بدء لعبة',
    codePlaceholder: 'أو أدخل رمزًا',
    join: 'انضمام',
    codeError: 'رمز الغرفة من أربعة أحرف.',
    oneDevice: 'جهاز واحد',
    oneDeviceHint: 'تناوبا عليه، أو العب الجانبين بنفسك.',
    playHere: 'اللعب هنا',
    score: 'النتيجة',
    par: 'الحد الأدنى',
    yourStart: 'نقطة البداية',
    stillNeeded: 'المتبقي',
    guessPlaceholder: 'اسم أي دولة',
    guessingAs: 'تلعب باسم',
    player: 'لاعب',
    waiting: 'في انتظار شريكك',
    bothHere: 'كلاكما هنا',
    reconnecting: 'إعادة الاتصال…',
    connecting: 'جارٍ الاتصال…',
    invite: 'دعوة',
    copied: 'تم النسخ',
    leave: 'خروج',
    back: 'رجوع',
    wholeWorld: 'العالم كله',
    youMet: 'التقيتما',
    perfect: 'ممتاز — لا يمكن بأقل من ذلك.',
    againstPar: 'النتيجة {score}، الحد الأدنى {par}.',
    yourRoute: 'مساركما',
    shortestRoute: 'أقصر مسار ممكن',
    newGame: 'لعبة جديدة',
    you: 'أنت',
    partner: 'الشريك',
    partnerNamed: 'ذكر الشريك',
    rejectUnknown: '«{text}» ليست دولة في هذه اللعبة.',
    rejectOutOfPlay: '{country} ليس لها حدود برية مع أي دولة.',
    rejectWrongLandmass: '{country} في كتلة يابسة أخرى.',
    rejectAlreadyNamed: '{country} موجودة بالفعل على اللوح.',
    rejectGameOver: 'لقد التقيتما بالفعل.',
    errBadRoom: 'رمز الغرفة غير صحيح.',
    errRoomFull: 'في هذه الغرفة لاعبان بالفعل.',
    errTakenOver: 'لقد فتحت اللعبة في مكان آخر.',
    errGeneric: 'حدث خطأ ما.',
  },

  es: {
    title: 'Encontrarse en el medio',
    tagline:
      'Cada uno empieza en un país secreto. Nombrad países — cualquiera, en cualquier orden — hasta que los dos lados se unan. Cuantos menos, mejor.',
    language: 'Idioma',
    twoPhones: 'Dos móviles',
    twoPhonesHint: 'Uno empieza la partida y envía el enlace al otro.',
    startGame: 'Empezar partida',
    codePlaceholder: 'O introduce un código',
    join: 'Unirse',
    codeError: 'Los códigos son de cuatro caracteres.',
    oneDevice: 'Un dispositivo',
    oneDeviceHint: 'Pasáoslo, o juega los dos lados tú mismo.',
    playHere: 'Jugar aquí',
    score: 'Puntos',
    par: 'Mínimo',
    yourStart: 'Tu inicio',
    stillNeeded: 'Faltan',
    guessPlaceholder: 'Nombra un país',
    guessingAs: 'Juegas como',
    player: 'Jugador',
    waiting: 'Esperando a tu compañero',
    bothHere: 'Los dos aquí',
    reconnecting: 'Reconectando…',
    connecting: 'Conectando…',
    invite: 'Invitar',
    copied: 'Copiado',
    leave: 'Salir',
    back: 'Volver',
    wholeWorld: 'Todo el mundo',
    youMet: 'Os habéis encontrado',
    perfect: 'Perfecto — nadie lo habría hecho con menos.',
    againstPar: 'Puntos {score}, mínimo {par}.',
    yourRoute: 'Vuestra ruta',
    shortestRoute: 'La ruta más corta',
    newGame: 'Nueva partida',
    you: 'Tú',
    partner: 'Compañero',
    partnerNamed: 'Tu compañero ha nombrado',
    rejectUnknown: '«{text}» no es un país de este juego.',
    rejectOutOfPlay: '{country} no tiene frontera terrestre con nadie.',
    rejectWrongLandmass: '{country} está en otra masa de tierra.',
    rejectAlreadyNamed: '{country} ya está en el tablero.',
    rejectGameOver: 'Ya os habéis encontrado.',
    errBadRoom: 'Ese código de sala no parece correcto.',
    errRoomFull: 'Esa sala ya tiene dos jugadores.',
    errTakenOver: 'Has abierto el juego en otro sitio.',
    errGeneric: 'Algo ha salido mal.',
  },

  fr: {
    title: 'Se retrouver au milieu',
    tagline:
      'Chacun commence dans un pays secret. Nommez des pays — n’importe lequel, dans n’importe quel ordre — jusqu’à ce que vos deux côtés se rejoignent. Le moins possible.',
    language: 'Langue',
    twoPhones: 'Deux téléphones',
    twoPhonesHint: 'L’un lance la partie et envoie le lien à l’autre.',
    startGame: 'Lancer une partie',
    codePlaceholder: 'Ou saisissez un code',
    join: 'Rejoindre',
    codeError: 'Les codes font quatre caractères.',
    oneDevice: 'Un seul appareil',
    oneDeviceHint: 'Passez-le-vous, ou jouez les deux côtés.',
    playHere: 'Jouer ici',
    score: 'Score',
    par: 'Minimum',
    yourStart: 'Votre départ',
    stillNeeded: 'Restant',
    guessPlaceholder: 'Nommez un pays',
    guessingAs: 'Vous jouez',
    player: 'Joueur',
    waiting: 'En attente de votre partenaire',
    bothHere: 'Tous les deux là',
    reconnecting: 'Reconnexion…',
    connecting: 'Connexion…',
    invite: 'Inviter',
    copied: 'Copié',
    leave: 'Quitter',
    back: 'Retour',
    wholeWorld: 'Monde entier',
    youMet: 'Vous vous êtes rejoints',
    perfect: 'Parfait — impossible de faire moins.',
    againstPar: 'Score {score}, minimum {par}.',
    yourRoute: 'Votre trajet',
    shortestRoute: 'Le plus court possible',
    newGame: 'Nouvelle partie',
    you: 'Vous',
    partner: 'Partenaire',
    partnerNamed: 'Votre partenaire a nommé',
    rejectUnknown: '« {text} » n’est pas un pays de ce jeu.',
    rejectOutOfPlay: '{country} n’a de frontière terrestre avec personne.',
    rejectWrongLandmass: '{country} est sur une autre masse continentale.',
    rejectAlreadyNamed: '{country} est déjà sur le plateau.',
    rejectGameOver: 'Vous vous êtes déjà rejoints.',
    errBadRoom: 'Ce code de salon ne semble pas correct.',
    errRoomFull: 'Ce salon a déjà deux joueurs.',
    errTakenOver: 'Vous avez ouvert le jeu ailleurs.',
    errGeneric: 'Une erreur est survenue.',
  },

  de: {
    title: 'In der Mitte treffen',
    tagline:
      'Ihr startet jeweils in einem geheimen Land. Nennt Länder — irgendeins, in beliebiger Reihenfolge — bis eure beiden Seiten sich verbinden. Je weniger, desto besser.',
    language: 'Sprache',
    twoPhones: 'Zwei Handys',
    twoPhonesHint: 'Einer startet ein Spiel und schickt dem anderen den Link.',
    startGame: 'Spiel starten',
    codePlaceholder: 'Oder Code eingeben',
    join: 'Beitreten',
    codeError: 'Raumcodes haben vier Zeichen.',
    oneDevice: 'Ein Gerät',
    oneDeviceHint: 'Reicht es herum, oder spielt beide Seiten selbst.',
    playHere: 'Hier spielen',
    score: 'Punkte',
    par: 'Minimum',
    yourStart: 'Dein Start',
    stillNeeded: 'Noch nötig',
    guessPlaceholder: 'Nenne ein Land',
    guessingAs: 'Du spielst als',
    player: 'Spieler',
    waiting: 'Warte auf deinen Partner',
    bothHere: 'Beide da',
    reconnecting: 'Neu verbinden…',
    connecting: 'Verbinde…',
    invite: 'Einladen',
    copied: 'Kopiert',
    leave: 'Verlassen',
    back: 'Zurück',
    wholeWorld: 'Ganze Welt',
    youMet: 'Ihr habt euch getroffen',
    perfect: 'Perfekt — mit weniger ging es nicht.',
    againstPar: 'Punkte {score}, Minimum {par}.',
    yourRoute: 'Euer Weg',
    shortestRoute: 'Kürzester Weg',
    newGame: 'Neues Spiel',
    you: 'Du',
    partner: 'Partner',
    partnerNamed: 'Partner nannte',
    rejectUnknown: '„{text}“ ist in diesem Spiel kein Land.',
    rejectOutOfPlay: '{country} hat keine Landgrenze zu irgendjemandem.',
    rejectWrongLandmass: '{country} liegt auf einer anderen Landmasse.',
    rejectAlreadyNamed: '{country} steht schon auf dem Brett.',
    rejectGameOver: 'Ihr habt euch schon getroffen.',
    errBadRoom: 'Dieser Raumcode sieht nicht richtig aus.',
    errRoomFull: 'In diesem Raum sind schon zwei Spieler.',
    errTakenOver: 'Du hast das Spiel woanders geöffnet.',
    errGeneric: 'Etwas ist schiefgelaufen.',
  },

  it: {
    title: 'Incontrarsi a metà strada',
    tagline:
      'Ognuno parte da un paese segreto. Nominate paesi — uno qualsiasi, in qualsiasi ordine — finché i due lati non si uniscono. Meno sono, meglio è.',
    language: 'Lingua',
    twoPhones: 'Due telefoni',
    twoPhonesHint: 'Uno di voi apre una partita e manda il link all’altro.',
    startGame: 'Inizia una partita',
    codePlaceholder: 'Oppure inserisci un codice',
    join: 'Entra',
    codeError: 'I codici sono di quattro caratteri.',
    oneDevice: 'Un dispositivo',
    oneDeviceHint: 'Passatevelo, o gioca tu entrambi i lati.',
    playHere: 'Gioca qui',
    score: 'Punti',
    par: 'Minimo',
    yourStart: 'La tua partenza',
    stillNeeded: 'Mancano',
    guessPlaceholder: 'Nomina un paese',
    guessingAs: 'Giochi come',
    player: 'Giocatore',
    waiting: 'In attesa del tuo compagno',
    bothHere: 'Ci siete entrambi',
    reconnecting: 'Riconnessione…',
    connecting: 'Connessione…',
    invite: 'Invita',
    copied: 'Copiato',
    leave: 'Esci',
    back: 'Indietro',
    wholeWorld: 'Tutto il mondo',
    youMet: 'Vi siete incontrati',
    perfect: 'Perfetto — non si poteva fare con meno.',
    againstPar: 'Punti {score}, minimo {par}.',
    yourRoute: 'Il vostro percorso',
    shortestRoute: 'Il percorso più breve',
    newGame: 'Nuova partita',
    you: 'Tu',
    partner: 'Compagno',
    partnerNamed: 'Il compagno ha nominato',
    rejectUnknown: '«{text}» non è un paese di questo gioco.',
    rejectOutOfPlay: '{country} non ha confini terrestri con nessuno.',
    rejectWrongLandmass: '{country} si trova su un’altra massa continentale.',
    rejectAlreadyNamed: '{country} è già sul tabellone.',
    rejectGameOver: 'Vi siete già incontrati.',
    errBadRoom: 'Questo codice stanza non sembra corretto.',
    errRoomFull: 'Questa stanza ha già due giocatori.',
    errTakenOver: 'Hai aperto il gioco altrove.',
    errGeneric: 'Qualcosa è andato storto.',
  },

  nl: {
    title: 'Elkaar in het midden treffen',
    tagline:
      'Jullie beginnen allebei in een geheim land. Noem landen — welk dan ook, in willekeurige volgorde — tot jullie twee kanten aan elkaar vast zitten. Hoe minder, hoe beter.',
    language: 'Taal',
    twoPhones: 'Twee telefoons',
    twoPhonesHint: 'Eén van jullie start een spel en stuurt de ander de link.',
    startGame: 'Spel starten',
    codePlaceholder: 'Of voer een code in',
    join: 'Meedoen',
    codeError: 'Kamercodes zijn vier tekens.',
    oneDevice: 'Eén apparaat',
    oneDeviceHint: 'Geef hem door, of speel zelf beide kanten.',
    playHere: 'Hier spelen',
    score: 'Score',
    par: 'Minimum',
    yourStart: 'Jouw start',
    stillNeeded: 'Nog nodig',
    guessPlaceholder: 'Noem een land',
    guessingAs: 'Je speelt als',
    player: 'Speler',
    waiting: 'Wachten op je partner',
    bothHere: 'Allebei aanwezig',
    reconnecting: 'Opnieuw verbinden…',
    connecting: 'Verbinden…',
    invite: 'Uitnodigen',
    copied: 'Gekopieerd',
    leave: 'Verlaten',
    back: 'Terug',
    wholeWorld: 'Hele wereld',
    youMet: 'Jullie hebben elkaar gevonden',
    perfect: 'Perfect — minder kon niet.',
    againstPar: 'Score {score}, minimum {par}.',
    yourRoute: 'Jullie route',
    shortestRoute: 'Kortst mogelijke route',
    newGame: 'Nieuw spel',
    you: 'Jij',
    partner: 'Partner',
    partnerNamed: 'Partner noemde',
    rejectUnknown: '“{text}” is geen land in dit spel.',
    rejectOutOfPlay: '{country} heeft met niemand een landgrens.',
    rejectWrongLandmass: '{country} ligt op een andere landmassa.',
    rejectAlreadyNamed: '{country} staat al op het bord.',
    rejectGameOver: 'Jullie hebben elkaar al gevonden.',
    errBadRoom: 'Die kamercode klopt niet.',
    errRoomFull: 'Die kamer heeft al twee spelers.',
    errTakenOver: 'Je hebt het spel ergens anders geopend.',
    errGeneric: 'Er ging iets mis.',
  },

  pt: {
    title: 'Encontrar-se no meio',
    tagline:
      'Cada um começa num país secreto. Digam nomes de países — qualquer um, em qualquer ordem — até os dois lados se juntarem. Quantos menos, melhor.',
    language: 'Idioma',
    twoPhones: 'Dois telemóveis',
    twoPhonesHint: 'Um de vocês começa um jogo e envia o link ao outro.',
    startGame: 'Começar jogo',
    codePlaceholder: 'Ou introduza um código',
    join: 'Entrar',
    codeError: 'Os códigos têm quatro caracteres.',
    oneDevice: 'Um dispositivo',
    oneDeviceHint: 'Passem-no entre vocês, ou jogue os dois lados.',
    playHere: 'Jogar aqui',
    score: 'Pontos',
    par: 'Mínimo',
    yourStart: 'O teu início',
    stillNeeded: 'Faltam',
    guessPlaceholder: 'Diga um país',
    guessingAs: 'A jogar como',
    player: 'Jogador',
    waiting: 'À espera do teu parceiro',
    bothHere: 'Os dois aqui',
    reconnecting: 'A reconectar…',
    connecting: 'A conectar…',
    invite: 'Convidar',
    copied: 'Copiado',
    leave: 'Sair',
    back: 'Voltar',
    wholeWorld: 'Mundo inteiro',
    youMet: 'Encontraram-se',
    perfect: 'Perfeito — não dava com menos.',
    againstPar: 'Pontos {score}, mínimo {par}.',
    yourRoute: 'O vosso percurso',
    shortestRoute: 'O percurso mais curto',
    newGame: 'Novo jogo',
    you: 'Tu',
    partner: 'Parceiro',
    partnerNamed: 'O parceiro disse',
    rejectUnknown: '«{text}» não é um país deste jogo.',
    rejectOutOfPlay: '{country} não tem fronteira terrestre com ninguém.',
    rejectWrongLandmass: '{country} está noutra massa de terra.',
    rejectAlreadyNamed: '{country} já está no tabuleiro.',
    rejectGameOver: 'Já se encontraram.',
    errBadRoom: 'Esse código de sala não parece correto.',
    errRoomFull: 'Essa sala já tem dois jogadores.',
    errTakenOver: 'Abriu o jogo noutro sítio.',
    errGeneric: 'Algo correu mal.',
  },

  ru: {
    title: 'Встретиться посередине',
    tagline:
      'Каждый начинает в своей секретной стране. Называйте страны — любые, в любом порядке — пока две стороны не соединятся. Чем меньше, тем лучше.',
    language: 'Язык',
    twoPhones: 'Два телефона',
    twoPhonesHint: 'Один начинает игру и отправляет другому ссылку.',
    startGame: 'Начать игру',
    codePlaceholder: 'Или введите код',
    join: 'Войти',
    codeError: 'Код комнаты — четыре символа.',
    oneDevice: 'Одно устройство',
    oneDeviceHint: 'Передавайте его друг другу или играйте за обоих.',
    playHere: 'Играть здесь',
    score: 'Счёт',
    par: 'Минимум',
    yourStart: 'Ваш старт',
    stillNeeded: 'Осталось',
    guessPlaceholder: 'Назовите страну',
    guessingAs: 'Вы играете за',
    player: 'Игрок',
    waiting: 'Ждём вашего напарника',
    bothHere: 'Оба на месте',
    reconnecting: 'Переподключение…',
    connecting: 'Подключение…',
    invite: 'Пригласить',
    copied: 'Скопировано',
    leave: 'Выйти',
    back: 'Назад',
    wholeWorld: 'Весь мир',
    youMet: 'Вы встретились',
    perfect: 'Идеально — меньше было нельзя.',
    againstPar: 'Счёт {score}, минимум {par}.',
    yourRoute: 'Ваш маршрут',
    shortestRoute: 'Кратчайший маршрут',
    newGame: 'Новая игра',
    you: 'Вы',
    partner: 'Напарник',
    partnerNamed: 'Напарник назвал',
    rejectUnknown: '«{text}» — не страна в этой игре.',
    rejectOutOfPlay: 'У страны {country} нет сухопутной границы ни с кем.',
    rejectWrongLandmass: '{country} — на другом материке.',
    rejectAlreadyNamed: '{country} уже на доске.',
    rejectGameOver: 'Вы уже встретились.',
    errBadRoom: 'Код комнаты выглядит неверно.',
    errRoomFull: 'В этой комнате уже двое.',
    errTakenOver: 'Вы открыли игру в другом месте.',
    errGeneric: 'Что-то пошло не так.',
  },
}

/** Fills `{name}` placeholders. The only formatting the interface needs. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}
