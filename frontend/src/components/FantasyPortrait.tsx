/**
 * Portraits illustrés sur-mesure « Disney × Game of Thrones » (Dark Fantasy Expressif).
 * Remplace les icônes robots génériques par de véritables personnages de conte médiéval-fantastique
 * aux visages expressifs (style animation Disney) et costumes nobles/sombres (style Westeros).
 */

export interface IdentiteVisuelleConvive {
  surnomMaison: string;
  devise: string;
  couleurBlason: string;
  accentHex: string;
}

export function obtenirIdentiteVisuelle(
  nomAffiche: string,
  estHumain: boolean
): IdentiteVisuelleConvive {
  const nom = nomAffiche.toLowerCase();
  if (estHumain) {
    return {
      surnomMaison: 'Maison de la Lanterne d’Or',
      devise: '« La Flamme perce les Ténèbres »',
      couleurBlason: 'from-amber-500 via-yellow-600 to-red-900',
      accentHex: '#f59e0b',
    };
  }
  if (nom.includes('gérard') || nom.includes('gerard')) {
    return {
      surnomMaison: 'Garde du Mur d’Airain',
      devise: '« Grognon mais Inflexible »',
      couleurBlason: 'from-orange-700 via-red-900 to-stone-950',
      accentHex: '#ea580c',
    };
  }
  if (nom.includes('elena')) {
    return {
      surnomMaison: 'Archonte de Port-Carmin',
      devise: '« Tout Mensonge a un Prix »',
      couleurBlason: 'from-rose-700 via-red-950 to-slate-950',
      accentHex: '#e11d48',
    };
  }
  if (nom.includes('bob')) {
    return {
      surnomMaison: 'Troubadour de Hautjardin',
      devise: '« Rire avant le Coup de Grâce »',
      couleurBlason: 'from-emerald-600 via-teal-900 to-stone-950',
      accentHex: '#10b981',
    };
  }
  if (nom.includes('béatrice') || nom.includes('beatrice')) {
    return {
      surnomMaison: 'Oracle d’Asshaï-les-Ombres',
      devise: '« La Nuit est pleine de Présages »',
      couleurBlason: 'from-purple-600 via-indigo-950 to-black',
      accentHex: '#a855f7',
    };
  }
  if (nom.includes('lucas')) {
    return {
      surnomMaison: 'Scribe de la Citadelle Grise',
      devise: '« Ils nous observent tous ! »',
      couleurBlason: 'from-sky-600 via-slate-900 to-black',
      accentHex: '#38bdf8',
    };
  }
  return {
    surnomMaison: 'Convive de la Taverne',
    devise: '« Nul ne connaît son cœur »',
    couleurBlason: 'from-amber-700 via-stone-900 to-black',
    accentHex: '#d97706',
  };
}

interface FantasyPortraitProps {
  nomAffiche: string;
  estHumain: boolean;
  estVivant: boolean;
  className?: string;
}

export function FantasyPortrait({
  nomAffiche,
  estHumain,
  estVivant,
  className = 'w-full h-full',
}: FantasyPortraitProps) {
  const nom = nomAffiche.toLowerCase();

  let clePersonnage: 'humain' | 'gerard' | 'elena' | 'bob' | 'beatrice' | 'lucas' =
    'humain';
  if (!estHumain) {
    if (nom.includes('gérard') || nom.includes('gerard')) clePersonnage = 'gerard';
    else if (nom.includes('elena')) clePersonnage = 'elena';
    else if (nom.includes('bob')) clePersonnage = 'bob';
    else if (nom.includes('béatrice') || nom.includes('beatrice'))
      clePersonnage = 'beatrice';
    else if (nom.includes('lucas')) clePersonnage = 'lucas';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-full select-none ${className} ${
        !estVivant ? 'grayscale contrast-125 brightness-50' : ''
      }`}
    >
      {clePersonnage === 'humain' && <PortraitSeigneurHumain />}
      {clePersonnage === 'gerard' && <PortraitGerardLeRaleur />}
      {clePersonnage === 'elena' && <PortraitElenaLaStratege />}
      {clePersonnage === 'bob' && <PortraitBobLeRigolo />}
      {clePersonnage === 'beatrice' && <PortraitSoeurBeatrice />}
      {clePersonnage === 'lucas' && <PortraitLucasLeParanoiaque />}

      {/* Vignette dramatique et rim-light doré façon peinture Disney / HBO */}
      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_18px_rgba(0,0,0,0.85)] pointer-events-none" />
    </div>
  );
}

/** 1. SEIGNEUR / DAME HUMAIN(E) — Noble Héros Couronné (Disney Royal × Maison Royale Westeros) */
function PortraitSeigneurHumain() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-humain" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="55%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#1c0a05" />
        </radialGradient>
        <linearGradient id="skin-humain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="100%" stopColor="#f5b888" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-humain)" />
      {/* Halo de lanterne royal */}
      <circle cx="60" cy="48" r="42" fill="#fde68a" opacity="0.22" />
      {/* Cape de velours cramoisi et col d'hermine (Game of Thrones) */}
      <path d="M12 120 C16 86, 40 78, 60 78 C80 78, 104 86, 108 120 Z" fill="#7f1d1d" stroke="#f59e0b" strokeWidth="2" />
      <path d="M24 96 Q60 112 96 96 L92 84 Q60 96 28 84 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
      {/* Taches d'hermine */}
      <circle cx="42" cy="92" r="1.6" fill="#1c1917" />
      <circle cx="60" cy="96" r="1.6" fill="#1c1917" />
      <circle cx="78" cy="92" r="1.6" fill="#1c1917" />
      {/* Médaillon doré */}
      <circle cx="60" cy="105" r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
      <circle cx="60" cy="105" r="3" fill="#ef4444" />
      {/* Chevelure arrière */}
      <path d="M32 52 C26 72, 34 86, 40 88 L80 88 C86 86, 94 72, 88 52 Z" fill="#451a03" />
      {/* Cou & Visage expressif Disney */}
      <rect x="52" y="68" width="16" height="16" rx="6" fill="#e8a574" />
      <path d="M36 46 C36 28, 84 28, 84 46 C84 68, 72 78, 60 78 C48 78, 36 68, 36 46 Z" fill="url(#skin-humain)" />
      {/* Grands yeux expressifs lumineux style Disney */}
      <ellipse cx="49" cy="51" rx="6.2" ry="5.5" fill="#ffffff" />
      <ellipse cx="71" cy="51" rx="6.2" ry="5.5" fill="#ffffff" />
      <circle cx="50" cy="51" r="4" fill="#1d4ed8" />
      <circle cx="70" cy="51" r="4" fill="#1d4ed8" />
      <circle cx="50" cy="51" r="2" fill="#0f172a" />
      <circle cx="70" cy="51" r="2" fill="#0f172a" />
      {/* Reflets d'yeux Disney */}
      <circle cx="48.5" cy="49.2" r="1.4" fill="#ffffff" />
      <circle cx="68.5" cy="49.2" r="1.4" fill="#ffffff" />
      {/* Sourcils déterminés */}
      <path d="M41 43 Q49 40 55 43" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M65 43 Q71 40 79 43" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* Nez et sourire héroïque confiant */}
      <path d="M60 51 L58 59 L62 60" stroke="#c27849" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M51 66 Q60 72 69 65" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Cheveux avant */}
      <path d="M34 46 C36 30, 54 28, 60 36 C68 28, 84 30, 86 46 C82 36, 70 35, 60 40 C50 35, 38 36, 34 46 Z" fill="#5c2406" />
      {/* Couronne en fer forgé et or (Game of Thrones) */}
      <path d="M35 33 L42 18 L51 28 L60 13 L69 28 L78 18 L85 33 Z" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
      <circle cx="60" cy="24" r="3" fill="#dc2626" />
      <circle cx="46" cy="27" r="2" fill="#f59e0b" />
      <circle cx="74" cy="27" r="2" fill="#f59e0b" />
    </svg>
  );
}

/** 2. GÉRARD LE RÂLEUR — Guerrier Balafré du Nord (Garde de Nuit × Seigneur Grincheux Disney) */
function PortraitGerardLeRaleur() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-gerard" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="60%" stopColor="#431407" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-gerard)" />
      {/* Lueur de braise */}
      <circle cx="60" cy="55" r="44" fill="#ea580c" opacity="0.2" />
      {/* Lourde cape de fourrure de loup du Nord (Game of Thrones) */}
      <path d="M8 120 C12 80, 36 74, 60 74 C84 74, 108 80, 112 120 Z" fill="#1c1917" stroke="#57534e" strokeWidth="2" />
      <path d="M16 96 C26 78, 44 82, 60 86 C76 82, 94 78, 104 96 C96 112, 24 112, 16 96 Z" fill="#44403c" stroke="#292524" strokeWidth="2" />
      {/* Épaulières cloutées */}
      <circle cx="32" cy="96" r="3" fill="#d6d3d1" />
      <circle cx="88" cy="96" r="3" fill="#d6d3d1" />
      {/* Visage massif et carré */}
      <path d="M35 42 C35 24, 85 24, 85 42 C87 68, 76 82, 60 82 C44 82, 33 68, 35 42 Z" fill="#f1b086" />
      {/* Balafre de bataille sur l'oeil gauche */}
      <path d="M68 34 L74 62" stroke="#991b1b" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
      {/* Grosse barbe rousse/grisonnante ébouriffée */}
      <path d="M32 56 C30 82, 46 98, 60 98 C74 98, 90 82, 88 56 C82 64, 72 66, 60 66 C48 66, 38 64, 32 56 Z" fill="#9a3412" stroke="#431407" strokeWidth="2" />
      {/* Moustache froncée */}
      <path d="M40 68 Q60 58 80 68 Q70 75 60 70 Q50 75 40 68 Z" fill="#c2410c" />
      {/* Bouche qui râle */}
      <path d="M51 74 Q60 69 69 74" stroke="#450a0a" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Yeux plissés ultra-expressifs et sourcils froncés en V (Disney Grumpy) */}
      <ellipse cx="48" cy="49" rx="5.5" ry="4.5" fill="#ffffff" />
      <ellipse cx="72" cy="49" rx="5.5" ry="4.5" fill="#ffffff" />
      <circle cx="49" cy="49" r="3.2" fill="#78350f" />
      <circle cx="71" cy="49" r="3.2" fill="#78350f" />
      <circle cx="48" cy="47.8" r="1.2" fill="#ffffff" />
      <circle cx="70" cy="47.8" r="1.2" fill="#ffffff" />
      {/* Gros sourcils broussailleux froncés */}
      <path d="M37 40 L57 46" stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
      <path d="M83 40 L63 46" stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
      {/* Gros nez rougi par l'hydromel */}
      <ellipse cx="60" cy="56" rx="6" ry="4.8" fill="#e07a5f" />
      {/* Casque en fer cabossé */}
      <path d="M33 38 C35 18, 85 18, 87 38 Z" fill="#57534e" stroke="#292524" strokeWidth="2.5" />
      <path d="M60 18 L60 44" stroke="#a8a29e" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** 3. ELENA LA STRATÈGE — Noble Calculatrice de Port-Réal (Cersei/Margaery × Reine Disney) */
function PortraitElenaLaStratege() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-elena" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#be123c" />
          <stop offset="55%" stopColor="#4c0519" />
          <stop offset="100%" stopColor="#090408" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-elena)" />
      {/* Chevelure sombre ondulée */}
      <path d="M26 42 C20 75, 28 105, 38 115 L82 115 C92 105, 100 75, 94 42 Z" fill="#1e1b4b" />
      {/* Robe de cour à col montant brodé d'or (Game of Thrones) */}
      <path d="M18 120 C22 86, 42 80, 60 80 C78 80, 98 86, 102 120 Z" fill="#881337" stroke="#fbbf24" strokeWidth="2" />
      <path d="M34 80 L48 120 L72 120 L86 80 Q60 92 34 80 Z" fill="#4c0519" stroke="#f59e0b" strokeWidth="1.5" />
      {/* Collier d'émeraude de stratège */}
      <circle cx="60" cy="92" r="5" fill="#10b981" stroke="#fbbf24" strokeWidth="2" />
      {/* Cou gracieux et visage sculpté */}
      <rect x="54" y="68" width="12" height="16" rx="5" fill="#fbd3b4" />
      <path d="M38 44 C38 26, 82 26, 82 44 C82 65, 70 76, 60 76 C50 76, 38 65, 38 44 Z" fill="#fde2cc" />
      {/* Yeux en amande d'émeraude au regard perçant */}
      <path d="M42 50 Q49 44 56 50 Q49 54 42 50 Z" fill="#ffffff" stroke="#1e1b4b" strokeWidth="1.5" />
      <path d="M64 50 Q71 44 78 50 Q71 54 64 50 Z" fill="#ffffff" stroke="#1e1b4b" strokeWidth="1.5" />
      <circle cx="49" cy="49.5" r="3.3" fill="#059669" />
      <circle cx="71" cy="49.5" r="3.3" fill="#059669" />
      <circle cx="49" cy="49.5" r="1.6" fill="#064e3b" />
      <circle cx="71" cy="49.5" r="1.6" fill="#064e3b" />
      <circle cx="47.8" cy="48.2" r="1.1" fill="#ffffff" />
      <circle cx="69.8" cy="48.2" r="1.1" fill="#ffffff" />
      {/* Un sourcil arqué calculateur */}
      <path d="M41 44 Q49 38 56 43" stroke="#1e1b4b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M64 43 Q72 41 79 44" stroke="#1e1b4b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* Sourire en coin carmin subtil */}
      <path d="M58 52 L60 59 L57 60" stroke="#d49976" strokeWidth="1.8" fill="none" />
      <path d="M52 66 Q60 69 69 64" stroke="#be123c" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      {/* Coiffe et diadème d'or filigrané */}
      <path d="M36 42 C40 24, 80 24, 84 42 C76 32, 65 34, 60 39 C55 34, 44 32, 36 42 Z" fill="#1e1b4b" />
      <path d="M39 32 Q60 20 81 32 L76 23 L60 16 L44 23 Z" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
      <circle cx="60" cy="24" r="3" fill="#10b981" stroke="#fbbf24" strokeWidth="1.2" />
    </svg>
  );
}

/** 4. BOB LE RIGOLO — Barde Bouffon Malicieux (Flynn Rider Disney × Troubadour de Taverne) */
function PortraitBobLeRigolo() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-bob" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="55%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#041f18" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-bob)" />
      {/* Pourpoint de barde vert émeraude & col à clochettes d'or */}
      <path d="M16 120 C22 86, 40 78, 60 78 C80 78, 98 86, 104 120 Z" fill="#065f46" stroke="#f59e0b" strokeWidth="2" />
      <path d="M26 86 L40 98 L54 86 L66 86 L80 98 L94 86" fill="#b45309" stroke="#fcd34d" strokeWidth="1.5" />
      <circle cx="40" cy="99" r="2.5" fill="#fbbf24" />
      <circle cx="80" cy="99" r="2.5" fill="#fbbf24" />
      {/* Cou & Visage jovial expressif */}
      <rect x="52" y="68" width="16" height="15" rx="6" fill="#eab38c" />
      <path d="M36 46 C36 28, 84 28, 84 46 C84 68, 74 79, 60 79 C46 79, 36 68, 36 46 Z" fill="#fcd5b5" />
      {/* Yeux pétillants malicieux (clin d'oeil / regard farceur) */}
      <ellipse cx="48" cy="50" rx="6" ry="6" fill="#ffffff" />
      <ellipse cx="72" cy="50" rx="6" ry="5" fill="#ffffff" />
      <circle cx="49" cy="50" r="3.6" fill="#d97706" />
      <circle cx="71" cy="50" r="3.6" fill="#d97706" />
      <circle cx="49" cy="50" r="1.8" fill="#1c1917" />
      <circle cx="71" cy="50" r="1.8" fill="#1c1917" />
      <circle cx="47.5" cy="48.2" r="1.4" fill="#ffffff" />
      <circle cx="69.5" cy="48.2" r="1.4" fill="#ffffff" />
      {/* Sourcils asymétriques très Disney ("Smolder") */}
      <path d="M40 41 Q48 36 56 42" stroke="#78350f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M64 44 Q72 41 80 43" stroke="#78350f" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Grand sourire espiègle et bouc de mousquetaire/barde */}
      <path d="M47 63 Q60 74 73 61 Z" fill="#ffffff" stroke="#9a3412" strokeWidth="2" />
      <path d="M55 74 L60 81 L65 74 Z" fill="#78350f" />
      {/* Chapeau de trouvère à grande plume dorée */}
      <path d="M22 38 Q60 22 96 34 Q78 14 42 20 Z" fill="#047857" stroke="#fbbf24" strokeWidth="2" />
      <path d="M72 24 C86 8, 106 8, 108 22 C96 20, 84 24, 72 24 Z" fill="#fbbf24" />
    </svg>
  );
}

/** 5. SŒUR BÉATRICE LA MYSTIQUE — Prêtresse des Ombres (Melisandre × Enchanteresse Disney) */
function PortraitSoeurBeatrice() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-beatrice" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="55%" stopColor="#3b0764" />
          <stop offset="100%" stopColor="#090214" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-beatrice)" />
      {/* Aura mystique astrale */}
      <circle cx="60" cy="52" r="46" fill="#c084fc" opacity="0.18" />
      {/* Grande capuche liturgique pourpre et or */}
      <path d="M14 120 C16 62, 30 16, 60 14 C90 16, 104 62, 106 120 Z" fill="#3b0764" stroke="#f59e0b" strokeWidth="2.2" />
      <path d="M28 120 C30 72, 38 28, 60 26 C82 28, 90 72, 92 120 Z" fill="#1e0536" />
      {/* Visage pâle éthéré */}
      <path d="M40 48 C40 32, 80 32, 80 48 C80 68, 70 78, 60 78 C50 78, 40 68, 40 48 Z" fill="#f5e1da" />
      {/* Symbole solaire/lunaire sur le front */}
      <path d="M60 33 L63 39 L60 43 L57 39 Z" fill="#fbbf24" />
      {/* Yeux lumineux d'améthyste (visionnaire) */}
      <ellipse cx="49" cy="52" rx="6" ry="5" fill="#f3e8ff" />
      <ellipse cx="71" cy="52" rx="6" ry="5" fill="#f3e8ff" />
      <circle cx="49" cy="52" r="3.8" fill="#a855f7" />
      <circle cx="71" cy="52" r="3.8" fill="#a855f7" />
      <circle cx="49" cy="52" r="1.6" fill="#ffffff" />
      <circle cx="71" cy="52" r="1.6" fill="#ffffff" />
      {/* Sourcils sereins et mystérieux */}
      <path d="M42 45 Q49 42 55 45" stroke="#4c1d95" strokeWidth="2" fill="none" />
      <path d="M65 45 Q71 42 78 45" stroke="#4c1d95" strokeWidth="2" fill="none" />
      {/* Sourire énigmatique */}
      <path d="M53 66 Q60 70 67 66" stroke="#7e22ce" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* Choker rubis/améthyste façon Prêtresse Rouge de R'hllor */}
      <path d="M46 82 Q60 88 74 82" stroke="#fbbf24" strokeWidth="3" fill="none" />
      <polygon points="60,80 65,86 60,92 55,86" fill="#ec4899" stroke="#fde047" strokeWidth="1.2" />
    </svg>
  );
}

/** 6. LUCAS LE PARANOÏAQUE — Alchimiste/Scribe Nerveux (Mestre Citadelle × Personnage Inquiet Disney) */
function PortraitLucasLeParanoiaque() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <defs>
        <radialGradient id="bg-lucas" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg-lucas)" />
      {/* Manteau d'érudit de la Citadelle avec chaînes de Mestre */}
      <path d="M16 120 C20 86, 38 78, 60 78 C82 78, 100 86, 104 120 Z" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <path d="M38 82 Q60 104 82 82" stroke="#94a3b8" strokeWidth="4" strokeDasharray="4 2" fill="none" />
      {/* Cou fin et visage nerveux */}
      <rect x="54" y="68" width="12" height="14" rx="5" fill="#f3d2b8" />
      <path d="M38 46 C38 28, 82 28, 82 46 C80 68, 70 78, 60 78 C50 78, 40 68, 38 46 Z" fill="#fae3d0" />
      {/* Lunettes d'alchimiste en cuivre relevées sur le front */}
      <path d="M36 35 L84 35" stroke="#78350f" strokeWidth="3" />
      <circle cx="49" cy="34" r="8" fill="#38bdf8" fillOpacity="0.45" stroke="#f59e0b" strokeWidth="2.8" />
      <circle cx="71" cy="34" r="8" fill="#38bdf8" fillOpacity="0.45" stroke="#f59e0b" strokeWidth="2.8" />
      {/* Très grands yeux écarquillés paranoïaques (style Disney expressif) */}
      <circle cx="48" cy="52" r="7.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
      <circle cx="72" cy="52" r="7.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
      {/* Petites pupilles qui regardent sur le côté avec inquiétude */}
      <circle cx="50" cy="52" r="2.8" fill="#0284c7" />
      <circle cx="74" cy="52" r="2.8" fill="#0284c7" />
      <circle cx="50" cy="52" r="1.4" fill="#0f172a" />
      <circle cx="74" cy="52" r="1.4" fill="#0f172a" />
      <circle cx="49" cy="50.8" r="1" fill="#ffffff" />
      <circle cx="73" cy="50.8" r="1" fill="#ffffff" />
      {/* Sourcils relevés d'inquiétude */}
      <path d="M40 44 Q48 41 55 46" stroke="#334155" strokeWidth="2.2" fill="none" />
      <path d="M65 46 Q72 41 80 44" stroke="#334155" strokeWidth="2.2" fill="none" />
      {/* Bouche tremblante en vaguelette */}
      <path d="M51 67 Q55 64 60 67 Q65 70 69 66" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Mèches ébouriffées */}
      <path d="M35 32 L42 18 L50 26 L60 15 L70 26 L79 19 L85 32 Z" fill="#334155" />
      {/* Goutte de sueur d'anxiété */}
      <path d="M83 48 C81 52, 85 55, 83 55 C81 55, 85 52, 83 48 Z" fill="#38bdf8" />
    </svg>
  );
}
