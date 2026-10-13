/** „Školenie nového zamestnanca“ – HR prezentácia pri prvom spustení. */
export interface TutorialSlide {
  readonly title: string;
  readonly body: readonly string[];
}

export const TUTORIAL: readonly TutorialSlide[] = [
  {
    title: 'Vitajte v Očistci, s. r. o.',
    body: [
      'Gratulujeme k povýšeniu na stredného manažéra.',
      'Vaša zmluva je na dobu neurčitú. Doslova.',
      'Toto školenie je povinné a nepreskočiteľné. (Tlačidlo „Preskočiť“ je vpravo dole.)',
    ],
  },
  {
    title: 'Snímka 2: Výroba',
    body: [
      '1–5 alebo spodná lišta = stavba. Klik na voľnú podlahu.',
      'Podateľňa → Duše · Kávovar → Káva · Kopírka: Duša → 3 Formuláre',
      'Mučiareň mení duše, formuláre a kávu na Síru – menu očistca. Odomkne sa po prvej expedícii.',
    ],
  },
  {
    title: 'Snímka 3: Ľudské zdroje',
    body: [
      'Klik na hriešnika (vo svete alebo v Personálnom), potom klik na budovu = pridelenie.',
      'Vlastnosti menia výkon: Workoholik +30 %, Prokrastinátor −40 %, Mikromanažér zrýchli kolegov…',
      'Prácou sa učia. H = nábor za 3 duše.',
      'Bez kávy vyhoria a robia na polovicu – Kávovar nie je benefit, je to infraštruktúra.',
      'Na úrovni 10: P = povýšiť na vedúceho (budova +25 %), R = dôchodok (celá výroba +5 %).',
    ],
  },
  {
    title: 'Snímka 4: Oddelenie reklamácií',
    body: [
      'Modrá platforma vpravo je služobný výťah. E = nastúpiť.',
      'ĽTM úder · PTM strela · Medzera úskok. Keď sa pod nepriateľom rozsvieti červený výsek, uskočte.',
      'Domov sa vraciate výťahom. Smrť = disciplinárne konanie a korisť prepadá.',
    ],
  },
  {
    title: 'Snímka 5: Benefity',
    body: [
      'Z reklamácií padá korisť. Farba = rarita: bežné, byrokratické, legendárne, prekliate.',
      'I = sklad a výbava. Porovnanie ▲▼ ukáže, či sa oplatí.',
      'Základňa medzitým pracuje ďalej. Aj keď hru zavriete (najviac 8 h).',
    ],
  },
  {
    title: 'Záver školenia',
    body: [
      'Postup sa ukladá automaticky. Esc = menu (export / import savu, hlasitosť).',
      'Ďakujeme za pozornosť. Podpíšte prezenčnú listinu krvou.',
    ],
  },
];
