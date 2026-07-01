// In-app string tables, keyed by the language codes used in the Appearance
// settings (settingsData.js: en / ur / ar / fr / de). English is the complete
// reference set; other languages translate what they can and fall back to the
// English string per-key via the t() resolver in translate.js. This keeps the
// table free of holes in the UI even when a translation is missing.
const en = {
  copy: "Copy",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  used: "Used",
  copied: "Copied",
  recents: "Recents",
  chats: "Chats",
  newChat: "New chat",
  selectChats: "Select chats",
  filterBy: "Filter by",
  searchChats: "Search chats…",
  filterAll: "All",
  filterPinned: "Pinned",
  sources: "Sources",
  regenerate: "Try again",
  webSearch: "Web Search",
  askAnything: "Ask Anything..",
  copyResponse: "Copy response",
  unknownModel: "Unknown model",
  copyMessage: "Copy message",
  editMessage: "Edit message",
  showMore: "Show more",
  showLess: "Show less",
  stop: "Stop generating",

  // --- Navigation (sidebar) ---
  navAsk: "Ask",
  navChats: "Chats",
  navDocuments: "Documents",
  navUpload: "Upload",
  retrievalIndex: "Retrieval Index",
  tagline: "Grounded answers, with sources.",
  closeNavigation: "Close navigation",
  expandSidebar: "Expand sidebar",
  collapseSidebar: "Collapse sidebar",
  searchConversations: "Search conversations",
  signIn: "Sign in",

  // --- Account menu ---
  settings: "Settings",
  language: "Language",
  lightTheme: "Light theme",
  darkTheme: "Dark theme",
  logout: "Logout",
  freePlan: "Free plan",

  // --- Settings modal: tabs & chrome ---
  settingsTitle: "Settings",
  accountTab: "Account",
  usageTab: "Usage",
  appearanceTab: "Appearance",
  closeSettings: "Close settings",

  // --- Settings: Account tab ---
  profile: "Profile",
  avatar: "Avatar",
  fullName: "Full name",
  callYou: "What should Athenæum call you?",
  preferredName: "Preferred name",
  workDescribe: "What best describes your work?",
  instructions: "Instructions for Athenæum",
  instructionsHint: "Athenæum will keep these in mind across chats.",
  instructionsPlaceholder: "e.g. keep explanations brief and to the point",

  // --- Settings: Appearance tab ---
  preferences: "Preferences",
  appearance: "Appearance",
  font: "Font",
  accentColor: "Accent color",
  appearanceSystem: "System",
  appearanceLight: "Light",
  appearanceDark: "Dark",

  // --- Settings: Usage tab ---
  usage: "Usage",
  totalTokensUsed: "Total tokens used",
  byModel: "By model",
  tokens: "tokens",

  // --- Conversation row actions (Recents) ---
  conversationActions: "Conversation actions",
  pin: "Pin",
  unpin: "Unpin",
  delete: "Delete",

  // --- Login modal ---
  accountLabel: "Account",
  signInTitle: "Sign in",
  closeLabel: "Close",
  signInDescription: "Sign in to save your conversations and access them across devices.",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  passwordLabel: "Password",
  hidePassword: "Hide password",
  showPassword: "Show password",
  signingIn: "Signing in…",
  orDivider: "or",
};

const fr = {
  copy: "Copier",
  edit: "Modifier",
  save: "Enregistrer",
  cancel: "Annuler",
  used: "Utilisé",
  copied: "Copié",
  recents: "Récents",
  chats: "Discussions",
  newChat: "Nouvelle discussion",
  selectChats: "Sélectionner",
  filterBy: "Filtrer par",
  searchChats: "Rechercher…",
  filterAll: "Tout",
  filterPinned: "Épinglés",
  sources: "Sources",
  regenerate: "Réessayer",
  webSearch: "Recherche web",
  askAnything: "Posez votre question..",
  copyResponse: "Copier la réponse",
  unknownModel: "Modèle inconnu",
  copyMessage: "Copier le message",
  editMessage: "Modifier le message",
  showMore: "Afficher plus",
  showLess: "Afficher moins",
  stop: "Arrêter",

  // --- Navigation (sidebar) ---
  navAsk: "Demander",
  navChats: "Discussions",
  navDocuments: "Documents",
  navUpload: "Importer",
  retrievalIndex: "Index de récupération",
  tagline: "Des réponses fondées, avec leurs sources.",
  closeNavigation: "Fermer la navigation",
  expandSidebar: "Développer le panneau",
  collapseSidebar: "Réduire le panneau",
  searchConversations: "Rechercher des conversations",
  signIn: "Se connecter",

  // --- Account menu ---
  settings: "Paramètres",
  language: "Langue",
  lightTheme: "Thème clair",
  darkTheme: "Thème sombre",
  logout: "Déconnexion",
  freePlan: "Forfait gratuit",

  // --- Settings modal: tabs & chrome ---
  settingsTitle: "Paramètres",
  accountTab: "Compte",
  usageTab: "Utilisation",
  appearanceTab: "Apparence",
  closeSettings: "Fermer les paramètres",

  // --- Settings: Account tab ---
  profile: "Profil",
  avatar: "Avatar",
  fullName: "Nom complet",
  callYou: "Comment Athenæum doit-il vous appeler ?",
  preferredName: "Nom préféré",
  workDescribe: "Qu'est-ce qui décrit le mieux votre travail ?",
  instructions: "Instructions pour Athenæum",
  instructionsHint: "Athenæum les gardera à l'esprit dans toutes les discussions.",
  instructionsPlaceholder: "p. ex. gardez les explications brèves et précises",

  // --- Settings: Appearance tab ---
  preferences: "Préférences",
  appearance: "Apparence",
  font: "Police",
  accentColor: "Couleur d'accent",
  appearanceSystem: "Système",
  appearanceLight: "Clair",
  appearanceDark: "Sombre",

  // --- Settings: Usage tab ---
  usage: "Utilisation",
  totalTokensUsed: "Total de jetons utilisés",
  byModel: "Par modèle",
  tokens: "jetons",

  // --- Conversation row actions (Recents) ---
  conversationActions: "Actions de conversation",
  pin: "Épingler",
  unpin: "Désépingler",
  delete: "Supprimer",

  // --- Login modal ---
  accountLabel: "Compte",
  signInTitle: "Se connecter",
  closeLabel: "Fermer",
  signInDescription: "Connectez-vous pour enregistrer vos discussions et y accéder sur tous vos appareils.",
  emailLabel: "E-mail",
  emailPlaceholder: "vous@exemple.com",
  passwordLabel: "Mot de passe",
  hidePassword: "Masquer le mot de passe",
  showPassword: "Afficher le mot de passe",
  signingIn: "Connexion…",
  orDivider: "ou",
};

const de = {
  copy: "Kopieren",
  edit: "Bearbeiten",
  save: "Speichern",
  cancel: "Abbrechen",
  used: "Verwendet",
  copied: "Kopiert",
  recents: "Zuletzt",
  chats: "Chats",
  newChat: "Neuer Chat",
  selectChats: "Chats auswählen",
  filterBy: "Filtern nach",
  searchChats: "Chats suchen…",
  filterAll: "Alle",
  filterPinned: "Angeheftet",
  sources: "Quellen",
  regenerate: "Erneut versuchen",
  webSearch: "Websuche",
  askAnything: "Frag irgendetwas..",
  copyResponse: "Antwort kopieren",
  unknownModel: "Unbekanntes Modell",
  copyMessage: "Nachricht kopieren",
  editMessage: "Nachricht bearbeiten",
  showMore: "Mehr anzeigen",
  showLess: "Weniger anzeigen",
  stop: "Generierung stoppen",

  // --- Navigation (sidebar) ---
  navAsk: "Fragen",
  navChats: "Chats",
  navDocuments: "Dokumente",
  navUpload: "Hochladen",
  retrievalIndex: "Abrufindex",
  tagline: "Fundierte Antworten, mit Quellen.",
  closeNavigation: "Navigation schließen",
  expandSidebar: "Seitenleiste ausklappen",
  collapseSidebar: "Seitenleiste einklappen",
  searchConversations: "Unterhaltungen durchsuchen",
  signIn: "Anmelden",

  // --- Account menu ---
  settings: "Einstellungen",
  language: "Sprache",
  lightTheme: "Helles Design",
  darkTheme: "Dunkles Design",
  logout: "Abmelden",
  freePlan: "Kostenloser Tarif",

  // --- Settings modal: tabs & chrome ---
  settingsTitle: "Einstellungen",
  accountTab: "Konto",
  usageTab: "Nutzung",
  appearanceTab: "Darstellung",
  closeSettings: "Einstellungen schließen",

  // --- Settings: Account tab ---
  profile: "Profil",
  avatar: "Avatar",
  fullName: "Vollständiger Name",
  callYou: "Wie soll Athenæum dich nennen?",
  preferredName: "Bevorzugter Name",
  workDescribe: "Was beschreibt deine Arbeit am besten?",
  instructions: "Anweisungen für Athenæum",
  instructionsHint: "Athenæum berücksichtigt diese in allen Chats.",
  instructionsPlaceholder: "z. B. halte Erklärungen kurz und auf den Punkt",

  // --- Settings: Appearance tab ---
  preferences: "Einstellungen",
  appearance: "Darstellung",
  font: "Schriftart",
  accentColor: "Akzentfarbe",
  appearanceSystem: "System",
  appearanceLight: "Hell",
  appearanceDark: "Dunkel",

  // --- Settings: Usage tab ---
  usage: "Nutzung",
  totalTokensUsed: "Insgesamt verwendete Tokens",
  byModel: "Nach Modell",
  tokens: "Tokens",

  // --- Conversation row actions (Recents) ---
  conversationActions: "Unterhaltungsaktionen",
  pin: "Anheften",
  unpin: "Lösen",
  delete: "Löschen",

  // --- Login modal ---
  accountLabel: "Konto",
  signInTitle: "Anmelden",
  closeLabel: "Schließen",
  signInDescription: "Melde dich an, um deine Unterhaltungen zu speichern und geräteübergreifend darauf zuzugreifen.",
  emailLabel: "E-Mail",
  emailPlaceholder: "du@beispiel.com",
  passwordLabel: "Passwort",
  hidePassword: "Passwort ausblenden",
  showPassword: "Passwort anzeigen",
  signingIn: "Anmeldung…",
  orDivider: "oder",
};

const ar = {
  copy: "نسخ",
  edit: "تعديل",
  save: "حفظ",
  cancel: "إلغاء",
  used: "مُستخدَم",
  copied: "تم النسخ",
  recents: "الأخيرة",
  chats: "المحادثات",
  newChat: "محادثة جديدة",
  selectChats: "تحديد المحادثات",
  filterBy: "تصفية حسب",
  searchChats: "بحث في المحادثات…",
  filterAll: "الكل",
  filterPinned: "المثبتة",
  sources: "المصادر",
  regenerate: "حاول مرة أخرى",
  webSearch: "بحث الويب",
  askAnything: "اسأل أي شيء..",
  copyResponse: "نسخ الرد",
  unknownModel: "نموذج غير معروف",
  copyMessage: "نسخ الرسالة",
  editMessage: "تعديل الرسالة",
  showMore: "عرض المزيد",
  showLess: "عرض أقل",
  stop: "إيقاف التوليد",

  // --- Navigation (sidebar) ---
  navAsk: "اسأل",
  navChats: "المحادثات",
  navDocuments: "المستندات",
  navUpload: "رفع",
  retrievalIndex: "فهرس الاسترجاع",
  tagline: "إجابات موثوقة مع مصادرها.",
  closeNavigation: "إغلاق التنقل",
  expandSidebar: "توسيع الشريط الجانبي",
  collapseSidebar: "طي الشريط الجانبي",
  searchConversations: "البحث في المحادثات",
  signIn: "تسجيل الدخول",

  // --- Account menu ---
  settings: "الإعدادات",
  language: "اللغة",
  lightTheme: "المظهر الفاتح",
  darkTheme: "المظهر الداكن",
  logout: "تسجيل الخروج",
  freePlan: "الخطة المجانية",

  // --- Settings modal: tabs & chrome ---
  settingsTitle: "الإعدادات",
  accountTab: "الحساب",
  usageTab: "الاستخدام",
  appearanceTab: "المظهر",
  closeSettings: "إغلاق الإعدادات",

  // --- Settings: Account tab ---
  profile: "الملف الشخصي",
  avatar: "الصورة الرمزية",
  fullName: "الاسم الكامل",
  callYou: "بماذا يجب أن يناديك Athenæum؟",
  preferredName: "الاسم المفضّل",
  workDescribe: "ما الذي يصف عملك على أفضل وجه؟",
  instructions: "تعليمات لـ Athenæum",
  instructionsHint: "سيضع Athenæum هذه التعليمات في الاعتبار عبر جميع المحادثات.",
  instructionsPlaceholder: "مثلاً: اجعل الشروحات موجزة ومباشرة",

  // --- Settings: Appearance tab ---
  preferences: "التفضيلات",
  appearance: "المظهر",
  font: "الخط",
  accentColor: "لون التمييز",
  appearanceSystem: "النظام",
  appearanceLight: "فاتح",
  appearanceDark: "داكن",

  // --- Settings: Usage tab ---
  usage: "الاستخدام",
  totalTokensUsed: "إجمالي الرموز المستخدمة",
  byModel: "حسب النموذج",
  tokens: "رمز",

  // --- Conversation row actions (Recents) ---
  conversationActions: "إجراءات المحادثة",
  pin: "تثبيت",
  unpin: "إلغاء التثبيت",
  delete: "حذف",

  // --- Login modal ---
  accountLabel: "الحساب",
  signInTitle: "تسجيل الدخول",
  closeLabel: "إغلاق",
  signInDescription: "سجّل الدخول لحفظ محادثاتك والوصول إليها عبر جميع أجهزتك.",
  emailLabel: "البريد الإلكتروني",
  emailPlaceholder: "you@example.com",
  passwordLabel: "كلمة المرور",
  hidePassword: "إخفاء كلمة المرور",
  showPassword: "إظهار كلمة المرور",
  signingIn: "جارٍ تسجيل الدخول…",
  orDivider: "أو",
};

const ur = {
  copy: "کاپی",
  edit: "ترمیم",
  save: "محفوظ کریں",
  cancel: "منسوخ کریں",
  used: "استعمال شدہ",
  copied: "کاپی ہو گیا",
  recents: "حالیہ",
  chats: "گفتگو",
  newChat: "نئی گفتگو",
  selectChats: "گفتگو منتخب کریں",
  filterBy: "فلٹر کریں",
  searchChats: "گفتگو تلاش کریں…",
  filterAll: "تمام",
  filterPinned: "پن شدہ",
  sources: "ذرائع",
  regenerate: "دوبارہ کوشش کریں",
  webSearch: "ویب تلاش",
  askAnything: "کچھ بھی پوچھیں..",
  copyResponse: "جواب کاپی کریں",
  unknownModel: "نامعلوم ماڈل",
  copyMessage: "پیغام کاپی کریں",
  editMessage: "پیغام میں ترمیم کریں",
  showMore: "مزید دکھائیں",
  showLess: "کم دکھائیں",
  stop: "بند کریں",

  // --- Navigation (sidebar) ---
  navAsk: "پوچھیں",
  navChats: "گفتگو",
  navDocuments: "دستاویزات",
  navUpload: "اپ لوڈ",
  retrievalIndex: "بازیافت اشاریہ",
  tagline: "مستند جوابات، ذرائع کے ساتھ۔",
  closeNavigation: "نیویگیشن بند کریں",
  expandSidebar: "سائیڈبار پھیلائیں",
  collapseSidebar: "سائیڈبار سمیٹیں",
  searchConversations: "گفتگو تلاش کریں",
  signIn: "سائن ان",

  // --- Account menu ---
  settings: "ترتیبات",
  language: "زبان",
  lightTheme: "روشن تھیم",
  darkTheme: "گہرا تھیم",
  logout: "لاگ آؤٹ",
  freePlan: "مفت پلان",

  // --- Settings modal: tabs & chrome ---
  settingsTitle: "ترتیبات",
  accountTab: "اکاؤنٹ",
  usageTab: "استعمال",
  appearanceTab: "ظاہری شکل",
  closeSettings: "ترتیبات بند کریں",

  // --- Settings: Account tab ---
  profile: "پروفائل",
  avatar: "اوتار",
  fullName: "پورا نام",
  callYou: "Athenæum آپ کو کس نام سے پکارے؟",
  preferredName: "پسندیدہ نام",
  workDescribe: "آپ کے کام کو بہترین طور پر کیا بیان کرتا ہے؟",
  instructions: "Athenæum کے لیے ہدایات",
  instructionsHint: "Athenæum انہیں تمام گفتگو میں مدنظر رکھے گا۔",
  instructionsPlaceholder: "مثلاً: وضاحتیں مختصر اور بامقصد رکھیں",

  // --- Settings: Appearance tab ---
  preferences: "ترجیحات",
  appearance: "ظاہری شکل",
  font: "فونٹ",
  accentColor: "ایکسنٹ رنگ",
  appearanceSystem: "سسٹم",
  appearanceLight: "روشن",
  appearanceDark: "گہرا",

  // --- Settings: Usage tab ---
  usage: "استعمال",
  totalTokensUsed: "کل استعمال شدہ ٹوکنز",
  byModel: "ماڈل کے لحاظ سے",
  tokens: "ٹوکنز",

  // --- Conversation row actions (Recents) ---
  conversationActions: "گفتگو کے اعمال",
  pin: "پن کریں",
  unpin: "پن ہٹائیں",
  delete: "حذف کریں",

  // --- Login modal ---
  accountLabel: "اکاؤنٹ",
  signInTitle: "سائن ان",
  closeLabel: "بند کریں",
  signInDescription: "اپنی گفتگو محفوظ کرنے اور تمام آلات پر رسائی کے لیے سائن ان کریں۔",
  emailLabel: "ای میل",
  emailPlaceholder: "you@example.com",
  passwordLabel: "پاس ورڈ",
  hidePassword: "پاس ورڈ چھپائیں",
  showPassword: "پاس ورڈ دکھائیں",
  signingIn: "سائن ان ہو رہا ہے…",
  orDivider: "یا",
};

// Keyed by the Appearance language codes. `en` is the fallback reference.
const LNG = { en, fr, de, ar, ur };

export default LNG;
