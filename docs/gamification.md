# Gamification System — MindMates+ User App

> Backend-driven engagement layer built alongside (and separate from) the legacy local support-score system. Points and badges are private; no leaderboards.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Layer — Types & Interfaces](#2-data-layer--types--interfaces)
3. [API Service Layer](#3-api-service-layer)
4. [Global State — AppContext](#4-global-state--appcontext)
5. [Badge Award Flow](#5-badge-award-flow)
6. [Daily Check-In Deduplication](#6-daily-check-in-deduplication)
7. [Trigger Call Sites](#7-trigger-call-sites)
8. [UI Components](#8-ui-components)
9. [Badge Catalog](#9-badge-catalog)
10. [AchievementsScreen](#10-achievementsscreen)
11. [Design Constraints Honored](#11-design-constraints-honored)
12. [File Map](#12-file-map)
13. [Known Limitations](#13-known-limitations)

---

## 1. Architecture Overview

```
User action
    │
    ▼
Screen (e.g. JournalScreen)
    │  void gamificationTriggers.onJournalSaved(count)   ← fire-and-forget
    ▼
AppContext.gamificationTriggers
    │  await triggerJournalSaved(uid, count)
    ▼
gamificationApiService  ──POST /gamification/journal-saved──▶  ML backend
                        ◀── { awarded_badges: Badge[] } ──────

    │  processBadgeResult(response)
    ▼
AppContext.pendingBadge  ──▶  <BadgeAwardToast />  (globally rendered)
                               slides in, auto-dismisses after 4 s
```

The ML backend owns all streak counting, points arithmetic, and badge award logic. The client is a thin trigger layer — it fires events and reacts to badge payloads.

---

## 2. Data Layer — Types & Interfaces

**File:** `src/services/gamificationApiService.ts`

### `Badge`
Represents a single earned badge as returned by the backend.

| Field | Type | Description |
|---|---|---|
| `badgeId` | `string` | Unique identifier matching a `BADGE_CATALOG` entry |
| `badgeName` | `string` | Human-readable display name |
| `description` | `string` | Short description of how it was earned |
| `iconName` | `string` | Key into `BADGE_ICON_MAP` (e.g. `"journal"`, `"streak"`) |
| `earnedAt` | `any` | Firestore Timestamp or ISO date; formatted with `.toDate?.()` |
| `points` | `number` | Points awarded with this badge |

### `GamificationProfile`
Snapshot of the user's progress metrics, loaded into global context on login.

| Field | Type | Description |
|---|---|---|
| `checkInStreak` | `number` | Current consecutive daily check-in count |
| `journalStreak` | `number` | Current consecutive journaling streak |
| `longestJournalStreak` | `number` | All-time best journal streak |
| `totalPoints` | `number` | Cumulative points across all activities |
| `lastCheckInDate` | `any` | Timestamp of most recent check-in (used for dedup) |
| `lastJournalDate` | `any` | Timestamp of most recent journal entry |

### `WeeklySummary`
One-week snapshot fetched once per app session for the `WeeklyReflectionCard`.

| Field | Type | Description |
|---|---|---|
| `checkInsThisWeek` | `number` | Check-ins completed this calendar week |
| `journalEntriesThisWeek` | `number` | Journal entries written this week |
| `badgesEarnedThisWeek` | `Badge[]` | Badges awarded during the current week |
| `currentJournalStreak` | `number` | Journal streak at time of fetch |
| `currentCheckInStreak` | `number` | Check-in streak at time of fetch |
| `totalPoints` | `number` | Total points at time of fetch |
| `weekMessage` | `string` | Warm affirming message from the backend |

---

## 3. API Service Layer

**File:** `src/services/gamificationApiService.ts`

All calls go to `Constants.expoConfig?.extra?.mlApiUrl` (falls back to `http://192.168.1.2:8000`). The two internal helpers `post` and `get` swallow errors and return `null` on failure — ensuring a network problem never surfaces to the user.

### Trigger Functions (POST)

| Function | Endpoint | Payload |
|---|---|---|
| `triggerJournalSaved(uid, entryCount)` | `POST /gamification/journal-saved` | `{ uid, entry_count }` |
| `triggerCheckIn(uid)` | `POST /gamification/checkin` | `{ uid }` |
| `triggerDass21Complete(uid)` | `POST /gamification/dass21-complete` | `{ uid }` |
| `triggerGroupJoined(uid)` | `POST /gamification/group-joined` | `{ uid }` |
| `triggerGoalCreated(uid)` | `POST /gamification/goal-created` | `{ uid }` |
| `triggerGoalsCompleted(uid, totalCompleted)` | `POST /gamification/goals-completed` | `{ uid, total_completed }` |
| `triggerFeedbackSubmitted(uid)` | `POST /gamification/feedback-submitted` | `{ uid }` |

Each trigger returns `{ awarded_badges: Badge[] }` on success, or `null` on failure.

### Fetch Functions (GET)

| Function | Endpoint | Returns |
|---|---|---|
| `fetchGamificationProfile(uid)` | `GET /gamification/profile/:uid` | `{ gamification: GamificationProfile, badges: Badge[] }` |
| `fetchWeeklySummary(uid)` | `GET /gamification/weekly-summary/:uid` | `WeeklySummary` |

---

## 4. Global State — AppContext

**File:** `src/context/AppContext.tsx`

### State

```typescript
const [pendingBadge, setPendingBadge] = useState<Badge | null>(null);
const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile | null>(null);
```

### Profile Load Effect

Runs once when `user.id` becomes available (i.e. on login). Fetches the full profile from the backend and populates both `gamificationProfile` (stats) and implicitly makes earned badges available via the raw response shape `{ gamification, badges }`.

```typescript
useEffect(() => {
  if (!user?.id) return;
  fetchGamificationProfile(user.id).then(data => {
    if (data) setGamificationProfile(data.gamification);
  });
}, [user?.id]);
```

### `processBadgeResult`

A `useCallback` helper that inspects any trigger response for awarded badges and sets `pendingBadge` to the first one (which activates the toast). If the backend awards multiple badges in one action, only the first is shown — subsequent ones are silently dropped (acceptable given real-world rarity of multi-badge events).

```typescript
const processBadgeResult = useCallback((result: any) => {
  if (!result) return;
  const awarded = result.awarded_badges ?? [];
  if (awarded.length > 0) {
    setPendingBadge(awarded[0]);
  }
}, []);
```

### `gamificationTriggers`

Object of async handlers exposed via context. Each handler:
1. Guards against a null `user` (returns early)
2. Awaits the API call
3. Passes the result to `processBadgeResult`
4. Optionally updates local state (e.g. `onCheckIn` updates `checkInStreak` immediately from the response without waiting for a full profile re-fetch)

```typescript
onCheckIn: async () => {
  if (!user) return;
  const r = await triggerCheckIn(user.id);
  processBadgeResult(r);
  if (r?.checkInStreak) {
    setGamificationProfile(p => p ? { ...p, checkInStreak: r.checkInStreak } : p);
  }
},
```

### Context Values Exposed

```typescript
pendingBadge          // Badge | null  — drives the global toast
clearPendingBadge     // () => void    — called by toast on dismiss
gamificationProfile   // GamificationProfile | null — streaks + points
gamificationTriggers  // { onJournalSaved, onCheckIn, ... }
```

### Global Toast Render

`<BadgeAwardToast>` is rendered once at the root of `AppContext`'s JSX, above all screens, so it appears regardless of which screen the user is on when a badge is awarded.

```tsx
<BadgeAwardToast badge={pendingBadge} onDismiss={() => setPendingBadge(null)} />
```

---

## 5. Badge Award Flow

```
1. User completes an action (save journal, submit DASS-21, etc.)
        │
2. Screen calls:  void gamificationTriggers.onXxx()
   — void ensures the await never blocks the screen's own logic
        │
3. AppContext awaits the POST to the ML backend
        │
4. Backend checks streak rules, point thresholds, event counts
   and returns: { awarded_badges: Badge[] }
        │
5. processBadgeResult() picks awarded_badges[0]
   and sets it as pendingBadge in state
        │
6. React re-renders AppContext → <BadgeAwardToast badge={pendingBadge} />
        │
7. Toast useEffect detects badge !== null
   → slides in from top (-120 → 0 px, 320 ms)
   → starts 4-second auto-dismiss timer
        │
8. After 4 s (or on × tap):
   → slides out (0 → -120 px, 260 ms)
   → calls onDismiss() → setPendingBadge(null)
```

---

## 6. Daily Check-In Deduplication

Check-ins are not backed by a time-gate on the backend from the client's perspective — deduplication is handled client-side in `HomeScreen.tsx` to avoid unnecessary API calls.

```typescript
useEffect(() => {
  if (!user?.id) return;
  const lastCheckin = gamificationProfile?.lastCheckInDate?.toDate?.();
  const today = new Date();
  const isNewDay = !lastCheckin || lastCheckin.toDateString() !== today.toDateString();
  if (isNewDay) {
    void gamificationTriggers.onCheckIn();
  }
}, [user?.id]);
```

- Runs once when `user.id` is set (app open / login).
- Compares `lastCheckInDate` (Firestore Timestamp, converted via `.toDate?.()`) against today's date string.
- If it's a new day (or no previous check-in exists), fires the trigger.
- After a successful check-in, `onCheckIn` updates `gamificationProfile.checkInStreak` and `lastCheckInDate` is updated on the backend — the next app open will see the new date and skip.

---

## 7. Trigger Call Sites

| Action | Screen | Code location | Trigger called |
|---|---|---|---|
| Journal saved | `JournalScreen` | After `await addJournalEntry(...)` | `onJournalSaved(journalEntries.length + 1)` |
| DASS-21 submitted (path A) | `QuestionnaireScreen` | `handleAnswer` — final question branch | `onDass21Complete()` |
| DASS-21 submitted (path B) | `QuestionnaireScreen` | `handleNext` — all-answered branch | `onDass21Complete()` |
| Daily check-in | `HomeScreen` | `useEffect` on mount / user.id change | `onCheckIn()` |
| Group joined | `HomeScreen` | `handleJoin` after `await joinGroup(...)` | `onGroupJoined()` |
| Feedback submitted | `FeedbackScreen` | After `await submitFeedback(...)` | `onFeedbackSubmitted()` |
| Goal created | *(not yet wired)* | Trigger ready in context | `onGoalCreated()` |
| Goals completed | *(not yet wired)* | Trigger ready in context | `onGoalsCompleted(total)` |

All call sites use `void` — the gamification call is fire-and-forget and will never throw to the caller.

---

## 8. UI Components

### `BadgeAwardToast` — `src/components/BadgeAwardToast.tsx`

Globally rendered overlay. Receives `badge: Badge | null` and `onDismiss`.

**Animation:**
- `Animated.Value` initialized at `HIDDEN_Y = -120` (off-screen above)
- On `badge` change: slides to `0` over 320 ms (`useNativeDriver: true`)
- Auto-dismiss: `setTimeout(handleDismiss, 4000)`
- On dismiss: slides back to `-120` over 260 ms, then calls `onDismiss`

**`getIcon(iconName: string): string`** — exported helper reused by `WeeklyReflectionCard` and `AchievementsScreen`:

| `iconName` | Emoji |
|---|---|
| `journal` | 📓 |
| `streak` | 🔥 |
| `questionnaire` | 📋 |
| `group` | 👥 |
| `goal` | 🎯 |
| `steps` | 👣 |
| `feedback` | 💬 |
| `return` | 👋 |
| `checkin` | ⭐ |
| *(default)* | 🏅 |

---

### `WeeklyReflectionCard` — `src/components/WeeklyReflectionCard.tsx`

Rendered at the bottom of `HomeScreen`'s `ScrollView` when `user` is present.

**Fetch strategy:**
```typescript
const fetchedRef = useRef(false);

useEffect(() => {
  if (fetchedRef.current) return;   // ← once-per-session guard
  fetchedRef.current = true;
  fetchWeeklySummary(uid).then(setSummary);
}, [uid]);
```
Fetches exactly once per app session. Returns `null` (renders nothing) until the fetch resolves or if the backend returns no data.

**Layout:**
- `weekMessage` — warm affirming text from the backend (e.g. "Great work this week!")
- `StatPill` row — Check-ins / Journal entries / Badges earned this week
- Horizontal badge pill scroll — shows icon + name for each `badgesEarnedThisWeek`

---

### Check-In Streak Chip — `HomeScreen.tsx`

Rendered right after the header, visible only when `checkInStreak > 0`:

```tsx
{checkInStreak > 0 && (
  <View style={styles.streakChip}>
    <Text style={styles.streakFire}>🔥</Text>
    <Text style={styles.streakText}>{checkInStreak} day streak</Text>
  </View>
)}
<TouchableOpacity onPress={() => navigation.navigate('Achievements')} activeOpacity={0.7}>
  <Text style={styles.achievementsLink}>View achievements →</Text>
</TouchableOpacity>
```

Language is deliberately gentle — always "N day streak", never "streak lost" or any "reset" language.

---

## 9. Badge Catalog

**File:** `src/constants/gamificationBadges.ts`

A static client-side reference list (`BadgeCatalogEntry[]`) mirroring the badges the ML backend can award. Used exclusively in `AchievementsScreen` to render the "All Badges" locked/unlocked grid. It is **not** the earned-badges list (that comes from the backend).

| `badgeId` | `badgeName` | `iconName` |
|---|---|---|
| `first_journal` | First Reflection | `journal` |
| `journal_streak_3` | Steady Pen | `streak` |
| `journal_streak_7` | Week of Reflection | `streak` |
| `checkin_streak_3` | Showing Up | `checkin` |
| `checkin_streak_7` | Steady Presence | `checkin` |
| `dass21_complete` | Self-Aware | `questionnaire` |
| `group_joined` | Community Member | `group` |
| `goal_created` | Goal Setter | `goal` |
| `goals_completed_5` | Achiever | `goal` |
| `feedback_given` | Voice Heard | `feedback` |
| `welcome_back` | Welcome Back | `return` |

> When the backend introduces a new badge type, add a matching entry here so it appears in the "All Badges" section. The `badgeId` values must match what the backend uses in its `awarded_badges` payloads.

---

## 10. AchievementsScreen

**File:** `src/screens/AchievementsScreen.tsx`
**Route:** `Achievements` (registered in `RootStackParamList`)
**Entry points:** Profile tab settings row ("Achievements") · HomeScreen "View achievements →" link

### Data Loading

Calls `fetchGamificationProfile(user.id)` directly on mount (not via context) to get the raw response including both `gamification` (stats) and `badges` (full earned list, not just this week's).

```typescript
fetchGamificationProfile(user.id).then(data => {
  if (!data) return;
  if (data.gamification) setProfile(data.gamification);
  if (Array.isArray(data.badges)) setEarnedBadges(data.badges);
});
```

### Sections

**Stats card** — indigo background (`#4338CA`), three columns:
- Total Points · Journal Streak · Check-in Streak

**Earned Badges grid** — 2-column grid of `Badge` objects:
- Icon (emoji in colored circle) · Name · Description · Earned date (`formatEarnedDate`)
- If empty: warm empty-state text ("Every step counts — your first badge is on its way.")

**All Badges grid** — 2-column grid over `BADGE_CATALOG`:
- Earned: colored card, full icon, name (no description — space is tighter)
- Locked: grey card, 🔒 icon, grey name, "LOCKED" label
- No progress bars, no "X more to unlock" text

### `formatEarnedDate` helper

Handles both Firestore Timestamps and raw date values:
```typescript
const formatEarnedDate = (earnedAt: any): string => {
  const date = earnedAt?.toDate?.() ?? (earnedAt ? new Date(earnedAt) : null);
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
```

---

## 11. Design Constraints Honored

| Constraint | Implementation |
|---|---|
| All triggers fire-and-forget | Every call site uses `void`, no `await` at the screen level |
| Badge toast renders globally | Single `<BadgeAwardToast>` at AppContext root, not per-screen |
| Points are private | No leaderboard, no comparative UI anywhere |
| Gentle streak language | "N day streak", "Keep it up" — never "streak lost" or "reset" |
| Locked badges show name + lock only | `AchievementsScreen` shows 🔒 + grey name, no distance-to-unlock |
| No progress bars | Zero `ProgressBar`/`ActivityIndicator` in badge display |
| Weekly messages are warm/affirming | `weekMessage` is backend-authored; UI displays as-is without modification |
| Separate from legacy gamification | New code in `gamificationApiService.ts`; original `gamificationService.ts`, `constants/badges.ts`, `SupportScoreCard`, and `supportDetectionService.ts` are untouched |
| TypeScript strict — no implicit `any` | All new files compile clean; `user` null-guard in every trigger handler |

---

## 12. File Map

```
src/
├── services/
│   ├── gamificationApiService.ts     ← NEW: all API types + trigger/fetch functions
│   └── gamificationService.ts        ← UNTOUCHED: legacy local support-score system
├── components/
│   ├── BadgeAwardToast.tsx            ← NEW: animated toast + getIcon() helper
│   └── WeeklyReflectionCard.tsx       ← NEW: weekly summary card (once-per-session)
├── constants/
│   ├── gamificationBadges.ts          ← NEW: BADGE_CATALOG for All Badges view
│   └── badges.ts                      ← UNTOUCHED: legacy BadgeId/BADGES/POINTS
├── context/
│   └── AppContext.tsx                  ← MODIFIED: state, triggers, profile load, toast render
├── screens/
│   ├── AchievementsScreen.tsx          ← NEW: stats card + earned grid + all-badges grid
│   ├── HomeScreen.tsx                  ← MODIFIED: check-in trigger, streak chip, link, WeeklyReflectionCard
│   ├── JournalScreen.tsx               ← MODIFIED: onJournalSaved trigger
│   ├── QuestionnaireScreen.tsx         ← MODIFIED: onDass21Complete trigger (both submit paths)
│   ├── FeedbackScreen.tsx              ← MODIFIED: onFeedbackSubmitted trigger
│   └── ProfileScreen.tsx               ← MODIFIED: Achievements settings row
└── navigation/
    └── index.tsx                       ← MODIFIED: Achievements route registered
```

---

## 13. Known Limitations

**Goal triggers not yet wired.** `onGoalCreated` and `onGoalsCompleted` are defined in `gamificationTriggers` and ready to use, but `WellnessGoalsScreen` does not currently contain goal creation or completion CRUD functionality (it shows ML insights and the support score card). Wire these triggers when that feature is built.

**Only first badge shown per action.** `processBadgeResult` takes `awarded_badges[0]`. If the backend ever awards 2+ badges in a single event, only the first toast fires. A queue could be added later if needed.

**Client-side check-in dedup only.** The `useEffect` in `HomeScreen` prevents redundant calls within a session, but the backend should also be idempotent on `/gamification/checkin` — if the app is reinstalled or the profile fetch fails on first load, a duplicate check-in could fire.

**`fetchGamificationProfile` called twice on AchievementsScreen open.** AppContext loads the profile on login (writing to `gamificationProfile`), and `AchievementsScreen` calls it again directly to get the `badges` array (which isn't stored in context). This is a second network round-trip. It could be eliminated by expanding `GamificationProfile` to include `earnedBadges: Badge[]` and storing it in context.
