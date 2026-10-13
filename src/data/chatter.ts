import type { EnemyKind } from '@/data/enemies';
import type { BuildingType } from '@/data/buildings';
import type { SinnerKind } from '@/data/sinnerKinds';
import type { TraitId } from '@/data/traits';

/** Repliky hriešnikov a manažéra na základni. Čisté dáta – výber robí `systems/staff/chatter.ts`. */

export const CHATTER_WORKING: readonly string[] = [
  'Ďalší formulár. Juhú.',
  'Kto vymyslel tlačivo C-14b?',
  'Toto som už pečiatkoval. Včera. A predvčerom.',
  'Večnosť je dlhá, ale táto zmena je dlhšia.',
  'Mám pocit, že sa niekto pozerá.',
  'Kedy je výplata? Aha. Nikdy.',
  'Tento týždeň už siedmy pondelok.',
  'Robím to len kvôli kariére. Večnej.',
  'Dúfam, že toto niekto číta. Nie, nečíta.',
  'Pracujem tu iba 400 rokov.',
];

export const CHATTER_BUILDING: Readonly<Partial<Record<BuildingType, readonly string[]>>> = {
  intake: ['Meno? Hriech? Podpis krvou, prosím.', 'Číslo poradia 666… zase vy?', 'Reklamácie duší neprijímame.'],
  coffee: ['Mlieko? Len ovsené. A prekliate.', 'Káva je jediný dôvod, prečo tu ešte som.', 'Kto nechal prázdnu kanvicu? KTO?'],
  copier: ['PC LOAD LETTER?! Čo to znamená?!', 'Zasekol sa papier. Zase. Naveky.', 'Obojstranne… nie, jednostranne… AAA.'],
  torture: ['Open space. Žiadne steny, žiadna nádej.', 'Kto pustil klimatizáciu na +60?', 'Teambuilding každý deň. Povinný.'],
  training: ['Snímka 1 z 4 000.', 'Toto školenie je o školeniach.', 'Kedy je prestávka? Bola v roku 1987.'],
};

export const CHATTER_IDLE: readonly string[] = [
  'Čakám na pridelenie. Už storočie.',
  'Aspoň tu je pohovka. Prekliata, ale pohovka.',
  'Nevie niekto, kde je mikrovlnka?',
  'Počul si, že vraj robia audit?',
  'Ja len čakám na výťah.',
  'Môžem ísť domov? Aha, toto je domov.',
  'Keď nič nerobím, nemôžem nič pokaziť.',
];

export const CHATTER_TIRED: readonly string[] = [
  'Káávu… potrebujem kávu…',
  'Zzz… áno, šéfe, už to robím… zzz',
  'Ešte jeden formulár a odídem. Do pekla. Ups.',
  'Vidím farby. Je to normálne?',
  'Bez kávy pracujem na polovicu. Aj tak to nikto nevidí.',
];

export const CHATTER_COFFEE: readonly string[] = ['Ahh. Káva.', 'Kofeín, môj jediný priateľ.', 'Päť minút pauza. Päť.', 'Táto je ešte teplá!'];

export const CHATTER_LEAD: readonly string[] = [
  'Synergia, ľudia! SYNERGIA!',
  'Dajme si k tomu call.',
  'Kto to delegoval na mňa? Delegujem ďalej.',
  'Toto je skvelá príležitosť na rast.',
  'Budem to eskalovať.',
];

export const CHATTER_MAX_LEVEL: readonly string[] = [
  'Mám level 10. Kedy povýšenie?',
  'Penzijné pripoistenie by bolo fajn.',
  'Už som tu všetko videl. Dvakrát.',
];

export const CHATTER_LEVEL_UP: readonly string[] = ['Povýšenie! Plat rovnaký.', 'Nová úroveň, starý stôl.', 'Konečne uznanie! Teda… nie.'];

export const CHATTER_TRAIT: Readonly<Partial<Record<TraitId, readonly string[]>>> = {
  workaholic: ['Ešte jeden formulár! A ešte jeden!', 'Víkend? Čo je to?'],
  procrastinator: ['Zajtra. Určite zajtra.', 'Najprv si upracem stôl. Potom kávu. Potom…'],
  micromanager: ['Nie tak. Ukážem ti to. Zase.', 'Máš tú pečiatku o 2 mm vedľa.'],
  reply_all: ['Odpoveď všetkým: OK.', 'Pridávam do kópie celé peklo.'],
  bureaucrat: ['Bez pečiatky to neexistuje.', 'Toto chce formulár na formulár.'],
  introvert: ['…', 'Mohli by ste hovoriť potichu? Ďakujem.'],
  caffeine: ['Ešte jedno espresso. Dvojité. Trojité.', 'Moje srdce bije v rytme kávovaru.'],
  vegan: ['Spomínal som, že som vegán?', 'Toto je síra z voľného chovu?'],
};

export const CHATTER_KIND: Readonly<Partial<Record<SinnerKind, readonly string[]>>> = {
  intern: ['Je to platená stáž? Aha.', 'Robím to pre skúsenosti. Večné.'],
  barista: ['Pre koho je to latte? Napíšem meno… zle.', 'Mám certifikát z latte-artu. Pentagram.'],
  accountant: ['Čísla nesedia. Duše tiež nie.', 'Odpisy, odpisy, odpisy.'],
  lawyer: ['Bez môjho advokáta nehovorím. Ja som advokát.', 'Toto je v zmluve. Malým písmom.'],
};

export const CHATTER_MANAGER: readonly string[] = [
  'Mal by som delegovať.',
  'Kde mám tú tabuľku s KPI?',
  'Ešte jeden mítink a zbláznim sa.',
  'Možno by som mal ísť na expedíciu. Alebo na obed.',
  'Ticho… až príliš ticho. Pracuje vôbec niekto?',
];

/** Náhodné kancelárske udalosti (kozmetické). `who` = repliky zúčastnených hriešnikov. */
export interface OfficeEvent {
  readonly id: string;
  readonly notice: string;
  readonly who: readonly string[];
  /** Vyžaduje postavenú budovu tohto typu. */
  readonly needs?: BuildingType;
}

export const OFFICE_EVENTS: readonly OfficeEvent[] = [
  { id: 'jam', needs: 'copier', notice: 'Kopírka sa zasekla. Opäť. Technik príde o 300 rokov.', who: ['PC LOAD LETTER?!', 'Kopnite do nej!', 'Ja som ju nepokazil!'] },
  { id: 'fire', notice: 'Požiarne cvičenie! V pekle. Vedenie sa smeje.', who: ['Zase?!', 'Kde je núdzový východ? Aha, žiadny.', 'Horí! A… to je normálne.'] },
  { id: 'email', notice: 'Nový e-mail od vedenia: „Re: Re: Fw: Úspora papiera“ (príloha 400 strán).', who: ['Kto to vytlačil?!', 'Odpoveď všetkým…', 'Nečítam. Archivujem.'] },
  { id: 'birthday', notice: 'Kolega má narodeniny! Torta je z prekliateho piškótu.', who: ['Všetko najlepšie!', 'Ďalší rok v pekle!', 'Je tam aj vegánska?'] },
  { id: 'monday', notice: 'Je pondelok. Ako vždy. Navždy.', who: ['Nie…', 'Už zase?', 'Kalendár je zaseknutý.'] },
  { id: 'coffee_out', needs: 'coffee', notice: 'Došli filtre do kávovaru. Panika v open-space.', who: ['NIE!', 'Ako mám teraz žiť?', 'Pijem kávu priamo z balíka.'] },
  { id: 'audit', notice: 'Šepká sa o audite. Všetci predstierajú, že pracujú.', who: ['Ja som tu vždy pracoval!', 'Skryte tie formuláre!', 'Audit? Aký audit?'] },
  { id: 'teambuilding', notice: 'Povinný teambuilding: pád dôvery. Nikto nechytil.', who: ['Au.', 'Dôverujem vám. Už nie.', 'Bolo to super. (nebolo)'] },
];

// ---------------------------------------------------------------- expedícia

/** Čo povie nepriateľ, keď si manažéra všimne. */
export const ENEMY_BARKS: Readonly<Partial<Record<EnemyKind, readonly string[]>>> = {
  auditor: ['Máte doklady?', 'Toto bude nález.', 'Zastavte! Kontrola!', 'Kde je pokladničný blok?'],
  compliance: ['Porušujete smernicu 4.2!', 'Toto nie je v súlade!', 'Vyplňte tlačivo o vyplnení tlačiva!'],
  slime: ['*blub*', '*mľask*', '*lepkavé zvuky*'],
  slimelet: ['*blubík*'],
  counsel: ['Uvidíme sa na súde!', 'Námietka!', 'Bez komentára. Teda, s komentárom: predvolanie!'],
  ceo: ['Kto vás sem pustil? Bez mítingu?', 'Ste prepustený. Teda, budete.', 'Toto je nepriateľské prevzatie!'],
};

/** Manažér pri vstupe do miestnosti (prvýkrát na poschodí). */
export const ROOM_COMMENTS: Readonly<Record<string, readonly string[]>> = {
  archive: ['Archív. Tu umierajú sťažnosti.', 'Šanóny až do stropu. Do pekelného stropu.'],
  meeting: ['Zasadačka. Porada, ktorá mohla byť e-mail.', 'Niekto tu nechal flipchart s pentagramom.'],
  storage: ['Sklad. Vraj tu niečo zabudli.', 'Krabice. Možno je v nich benefit.'],
  exit: ['Schodisko dolu. Samozrejme, že dolu.', 'Odtiaľto je to len horšie.'],
  normal: ['Open space. Nikto tu nepracuje, ale všetci sú zaneprázdnení.', 'Ďalšia kancelária. Rovnaké kvetiny.'],
};

export const MANAGER_BARKS = {
  lowHp: ['Potrebujem dovolenku!', 'Toto nie je v popise práce!', 'Kde je lekárnička? Aha, zrušili ju.'],
  cleared: ['Poschodie vybavené. Kde je môj bonus?', 'Hotovo. Teraz už len výkaz.', 'Všetko vybavené. Mimo pracovnej doby.'],
  legendary: ['Konečne nejaký benefit!', 'Toto si nechám. Účtovníctvo nemusí vedieť.'],
} as const;
