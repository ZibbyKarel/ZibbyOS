import type { CreateGoalInput } from "./goal.schema";

export type GoalPresetGroup = "pr-ci" | "maintenance" | "brain" | "directional";

/** A prepared goal offered on the goals page. Data only: never written to disk by itself. */
export type GoalPreset = CreateGoalInput & { group: GoalPresetGroup };

const off = { enabled: false, ceiling: "tier2" } as const;

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "my-prs-merge-ready",
    group: "pr-ci",
    name: "Moje PR jsou merge-ready do 15:00",
    outcome:
      "Každý můj otevřený PR má zelené CI, vyřešené komentáře a aktuální větev, takže ho stačí jen schválit a mergnout. ZIBBY opraví červené CI a konflikty na mých větvích a připraví odpovědi na komentáře. Co nezvládne, mi řekne.",
    predicate: "Všechny moje otevřené PR jsou merge-ready.",
    scope: { kind: "none" },
    cadence: { every: "weekday", hour: 9 },
    cycleHours: 6,
    ...off,
  },
  {
    id: "no-forgotten-prs",
    group: "pr-ci",
    name: "Žádné zapomenuté PR",
    outcome:
      "Žádný PR na review nečeká déle než 2 dny bez reakce. Když PR čeká déle než 2 dny, ZIBBY připraví zdvořilé připomenutí recenzentovi (nejvýš 2 zprávy na člověka za cyklus); po schválení ho pošle.",
    predicate: "Žádný otevřený PR nečeká na reakci déle než 2 dny.",
    scope: { kind: "none" },
    cadence: { every: "weekday", hour: 9 },
    ...off,
  },
  {
    id: "ci-stays-green",
    group: "pr-ci",
    name: "CI zůstává zelené",
    outcome:
      "CI na hlavní větvi každého projektu je zelené. Když spadne, ZIBBY zjistí příčinu a otevře PR s opravou. Flaky testy jen nahlásí, nemaže je.",
    predicate: "CI na hlavní větvi všech projektů je zelené.",
    scope: { kind: "all" },
    cadence: { every: "day", hour: 7 },
    ...off,
  },
  {
    id: "app-is-up-to-date",
    group: "maintenance",
    name: "Aplikace je aktuální",
    outcome:
      "Závislosti projektu jsou aktuální. Jednou týdně ZIBBY aktualizuje minor a patch verze a otevře jeden PR. Před major aktualizacemi se zeptá, sám je nedělá.",
    predicate: "Žádná závislost nezaostává o minor ani patch verzi.",
    scope: { kind: "all" },
    cadence: { every: "week", hour: 8 },
    ...off,
  },
  {
    id: "security-patches-in-7-days",
    group: "maintenance",
    name: "Bezpečnostní záplaty do 7 dní",
    outcome:
      "Žádná známá zranitelnost v závislostech nezůstane neopravená déle než 7 dní. ZIBBY denně kontroluje audit a pro každou novou zranitelnost otevře PR se záplatou.",
    predicate: "Žádná zranitelnost není starší než 7 dní.",
    scope: { kind: "all" },
    cadence: { every: "day", hour: 7 },
    ...off,
  },
  {
    id: "clean-repo",
    group: "maintenance",
    name: "Čisté repo",
    outcome:
      "Repo je uklizené: žádné mrtvé větve, zapomenuté worktrees ani zastaralé TODO. Jednou měsíčně ZIBBY sestaví seznam toho, co smazat, a nic nemaže bez mého souhlasu.",
    predicate: "V repu nejsou mrtvé větve ani zapomenuté worktrees.",
    scope: { kind: "all" },
    cadence: { every: "month", hour: 8 },
    ...off,
  },
  {
    id: "mozek-is-maintained",
    group: "brain",
    name: "Mozek je udržovaný",
    outcome:
      "Moje poznámky v mozku jsou propojené a aktuální. Jednou týdně ZIBBY najde osiřelé a duplicitní poznámky, doplní odkazy a indexy a navrhne, co sloučit nebo smazat.",
    predicate: "Žádná poznámka v mozku není osiřelá.",
    scope: { kind: "none" },
    cadence: { every: "week", hour: 18 },
    ...off,
  },
  {
    id: "no-promise-without-follow-up",
    group: "brain",
    name: "Žádný slib bez follow-upu",
    outcome:
      "Každý slib, který jsem dal v chatu, e-mailu nebo na schůzce, má termín a follow-up. ZIBBY ve všední dny projde nové zprávy, najde sliby a ke každému připraví připomínku nebo koncept odpovědi.",
    predicate: "Každý můj slib má follow-up.",
    scope: { kind: "none" },
    cadence: { every: "weekday", hour: 17 },
    ...off,
  },
  {
    id: "weekly-summary",
    group: "brain",
    name: "Týdenní shrnutí",
    outcome:
      "Každý týden dostanu jedno stručné shrnutí: co se podařilo, co visí, co čeká na mě a co ZIBBY udělal sám. Shrnutí se uloží do mozku.",
    predicate: "Za uplynulý týden existuje shrnutí.",
    scope: { kind: "none" },
    cadence: { every: "week", hour: 16 },
    ...off,
  },
  {
    id: "token-budget-watch",
    group: "brain",
    name: "Hlídání token budgetu",
    outcome:
      "Spotřeba tokenů nepřekročí měsíční rozpočet. ZIBBY denně porovná čerpání s plánem a když hrozí překročení, upozorní mě s odhadem, kdy k tomu dojde. Sám nic nezastavuje.",
    predicate: "Čerpání tokenů je v rámci měsíčního rozpočtu.",
    scope: { kind: "none" },
    cadence: { every: "day", hour: 8 },
    ceiling: "tier1",
    enabled: false,
  },
  {
    id: "keep-up-with-competition",
    group: "directional",
    name: "Drž krok s konkurencí",
    outcome:
      "Vybraný projekt nezaostává za konkurenty ve funkcích. Jednou týdně ZIBBY aktualizuje matici funkcí oproti konkurentům, které určím, a navrhne seřazený seznam toho, co doplnit. Sám zahájí nejvýš 2 věci za měsíc a jen s mým povolením (automatické rozhodování cílů). Projekt a konkurenty doplním já.",
    predicate: "Matice funkcí nemá žádnou nepokrytou mezeru oproti vybraným konkurentům.",
    scope: { kind: "none" },
    cadence: { every: "week", hour: 9 },
    directional: { maxDecisionsPerMonth: 2, checklist: [] },
    ...off,
  },
];
