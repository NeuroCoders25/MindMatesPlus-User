# MindMatesPlus-User — Performance Audit

Branch: `perf/optimization-audit`  
Audited: 2026-06-14  
Auditor: Claude Sonnet 4.6

---

## Phase 1 — Findings

### 1. Re-renders

#### 1.1 `gamificationTriggers` object recreated on every render — HIGH
**File:** [src/context/AppContext.tsx:620-663](src/context/AppContext.tsx#L620-L663)  
**Why it's slow:** `gamificationTriggers` is a plain object literal defined inside the component body (not inside `useMemo`). Every time any state in `AppProvider` changes (e.g., `notifications`, `peerGroups`, `earnedBadges`), a new object reference is created. Because it is passed as part of the context `value`, **every consumer of `useApp()` that reads `gamificationTriggers` re-renders on every provider update**, even if the underlying trigger functions haven't changed.  
**Proposed fix:** Wrap in `useMemo` with deps `[user?.id, processBadgeResult]` (each function only uses `user.id` and `processBadgeResult`).  
**Risk:** safe

#### 1.2 `clearListenerAcceptedNotice` and `clearPendingBadge` inline arrow functions in context value — MEDIUM
**File:** [src/context/AppContext.tsx:742,745](src/context/AppContext.tsx#L742-L745)  
**Why it's slow:** `() => setListenerAcceptedNotice(null)` and `() => setPendingBadge(null)` are fresh arrow functions on every render, contributing to context value identity churn.  
**Proposed fix:** Extract as `useCallback` with empty deps `[]`.  
**Risk:** safe

#### 1.3 `recommendedGroups` IIFE computed on every render — MEDIUM
**File:** [src/screens/HomeScreen.tsx:207-236](src/screens/HomeScreen.tsx#L207-L236)  
**Why it's slow:** The recommendation priority chain is wrapped in an IIFE `(() => { ... })()` that runs synchronously on every render, including renders triggered by unrelated state (e.g., `showNotifications`, `showAbout`). It does array `.filter()` and `.slice()` over `peerGroups` on each call.  
**Proposed fix:** Convert to `useMemo` with deps `[isAdvisorRequired, recommendationProfile, peerGroups, mlInsight]`.  
**Risk:** safe — per constraints, the branching logic must not be altered, only memoized

#### 1.4 `sourceLabel` and `categoryLabel` IIFEs computed on every render — LOW
**File:** [src/screens/HomeScreen.tsx:239-250](src/screens/HomeScreen.tsx#L239-L250)  
**Why it's slow:** Both are IIFE-computed on every render; depends on `recommendationProfile` and `mlInsight`.  
**Proposed fix:** Convert to `useMemo` with deps `[recommendationProfile, mlInsight]`.  
**Risk:** safe

#### 1.5 `renderItem` inline arrow function passed to FlatList — MEDIUM
**File:** [src/screens/ChatScreen.tsx:751](src/screens/ChatScreen.tsx#L751)  
**Why it's slow:** `renderItem={({ item: msg, index }) => { ... }}` is an inline arrow passed to FlatList. A new function reference is created on every render of ChatScreen, which prevents FlatList from bailing out of item re-renders via the `extraData` mechanism. For a chat list with 50–200 messages this adds up.  
**Proposed fix:** Wrap in `useCallback` (with all captured values as deps). Note: message heights vary so `getItemLayout` cannot be added safely without measuring.  
**Risk:** safe

#### 1.6 `recommendationProfile` subscribed twice — MEDIUM (Firestore cost + re-renders)
**File:** [src/context/AppContext.tsx:416-458](src/context/AppContext.tsx#L416-L458) and [src/screens/HomeScreen.tsx:163-170](src/screens/HomeScreen.tsx#L163-L170)  
**Why it's slow:** `AppContext` already maintains a live `listenToMentalHealthProfile` subscription for the logged-in user and stores the result globally as `recommendationProfile`. HomeScreen opens its *own* second subscription to the exact same Firestore document path and stores the result in local `recommendationProfile` state. This means two Firestore listeners on the same document, two independent state updates, and an extra local render cycle on HomeScreen.  
**Proposed fix:** Remove the HomeScreen subscription; read the global `recommendationProfile` from `useApp()` instead (already available). Thread `profileLoading` through context or derive it from the global value being non-null.  
**Risk:** needs-review (removes a local loading state; requires context type change)

#### 1.7 `groupsContentRef` / `measureGroupsContent` redefined every render — LOW
**File:** [src/screens/GroupsScreen.tsx:27-31](src/screens/GroupsScreen.tsx#L27-L31)  
**Why it's slow:** `measureGroupsContent` is a plain function inside the component, recreated on every render. Passed to `onLayout`, which means React reconciles a new function reference on each render. Low impact in practice since `onLayout` only fires on layout changes, but it is still wasteful.  
**Proposed fix:** Wrap in `useCallback` with empty deps.  
**Risk:** safe

---

### 2. Firestore Listeners

#### 2.1 All listeners properly unsubscribed — GOOD
Every `onSnapshot` subscription across `AppContext`, `HomeScreen`, `ChatScreen`, `AdvisorChatScreen`, `GroupsScreen`, `ResourceFeed`, and `ProfileScreen` stores the returned unsubscribe function and calls it in the `useEffect` cleanup. No leaks found.

#### 2.2 Duplicate `listenToMentalHealthProfile` listener — MEDIUM (see §1.6 above)
**Files:** [src/context/AppContext.tsx:416-458](src/context/AppContext.tsx#L416-L458) and [src/screens/HomeScreen.tsx:163-170](src/screens/HomeScreen.tsx#L163-L170)  
Same document (`users/{uid}/mentalHealthProfile/currentProfile`) listened to from two places simultaneously. Firestore charges per active listener.  
**Risk:** needs-review

#### 2.3 `subscribeToMlMentalHealthProfile` in HomeScreen — MEDIUM
**File:** [src/screens/HomeScreen.tsx:154-161](src/screens/HomeScreen.tsx#L154-L161)  
Subscribes to `users/{uid}/mlMentalHealthProfile` on HomeScreen mount. This data is not held in `AppContext`; only fetched once at login via `fetchJournalEntries`. The listener is correctly unsubscribed. Low risk, but adds to the listener count on HomeScreen startup.  
**Risk:** needs-review (could be pulled into AppContext if shared by other screens)

#### 2.4 `listenToUserRecommendationCategory` in ResourceFeed — MEDIUM
**File:** [src/components/ResourceFeed.tsx:40-46](src/components/ResourceFeed.tsx#L40-L46)  
`ResourceFeed` opens its own listener on the user's recommendation category, which is a subset of the data that `listenToMentalHealthProfile` (AppContext) already provides. This is a third listener on the same or overlapping Firestore path.  
**Proposed fix:** Pass the active category as a prop from the parent (`HomeScreen` already has `recommendationProfile.peerGroupRecommendationCategory`).  
**Risk:** needs-review (API surface change for `ResourceFeed`)

#### 2.5 Per-group `subscribeGroupMessageNotifications` — LOW (acceptable pattern)
**File:** [src/context/AppContext.tsx:357-374](src/context/AppContext.tsx#L357-L374)  
Opens one listener per joined group for push-notification detection. A user with 5 joined groups = 5 listeners. Each is properly unsubscribed. Not a bug, but a user who joins all groups would have a heavy listener footprint. Pagination or a server-side fan-out would help at scale.  
**Risk:** needs-review (scale concern only)

#### 2.6 Per-flagged-message `subscribePrivateThread` — LOW (acceptable pattern)
**File:** [src/screens/ChatScreen.tsx:415-426](src/screens/ChatScreen.tsx#L415-L426)  
Subscribes to a `privateThread` subcollection per flagged message sent by the current user. Listeners accumulate until the group subscription is torn down. All properly unsubscribed on unmount / group change (line 377-379).  
**Risk:** acceptable as-is

---

### 3. Lists

#### 3.1 FlatList in ChatScreen missing optimization props — MEDIUM
**File:** [src/screens/ChatScreen.tsx:707-750](src/screens/ChatScreen.tsx#L707-L750)  
- ✓ Has `keyExtractor` (line 710)
- ✗ Missing `windowSize` — defaults to 21 (10 screens each side), causes more off-screen rendering than needed
- ✗ Missing `initialNumToRender` — defaults to 10; for bottom-pinned chat, more is better to avoid blank flash
- ✗ Missing `removeClippedSubviews` — retains all off-screen views in memory
- ✗ No `getItemLayout` — message heights are variable (embeds, threads, quoted replies), so this cannot be safely added  
**Proposed fix:** Add `windowSize={8}`, `initialNumToRender={20}`, `removeClippedSubviews={true}`.  
**Risk:** safe

#### 3.2 FlatList in AdvisorChatScreen missing optimization props — MEDIUM
**File:** [src/screens/AdvisorChatScreen.tsx:373-423](src/screens/AdvisorChatScreen.tsx#L373-L423)  
Same missing props as above.  
**Proposed fix:** Add `windowSize={8}`, `initialNumToRender={20}`, `removeClippedSubviews={true}`.  
**Risk:** safe

#### 3.3 `myGroups.map(renderGroupCard)` in GroupsScreen inside ScrollView — LOW / ACCEPTABLE
**File:** [src/screens/GroupsScreen.tsx:153-155](src/screens/GroupsScreen.tsx#L153-L155)  
A user can join at most a handful of groups. The list is small (2–6 items typical), so not virtualizing is acceptable. No action needed.

#### 3.4 `recommendedGroups.map()` in HomeScreen horizontal ScrollView — ACCEPTABLE
**File:** [src/screens/HomeScreen.tsx:538-583](src/screens/HomeScreen.tsx#L538-L583)  
Max 4 items (`.slice(0, 4)` at every priority level). Acceptable as a horizontal scroll.

#### 3.5 `filteredResources.map()` in ResourceFeed — LOW
**File:** [src/components/ResourceFeed.tsx:129-133](src/components/ResourceFeed.tsx#L129-L133)  
Resources are fetched from Firestore once and rendered via `.map()` inside a plain `View`. If resource count grows (e.g., 30+ resources), this becomes a non-virtualized long list embedded in the parent `ScrollView`.  
**Proposed fix:** Convert to `FlatList` with `scrollEnabled={false}` and `nestedScrollEnabled={true}` when resource count grows. For now ≤10 items, acceptable.  
**Risk:** needs-review (layout behaviour change inside nested scroll)

---

### 4. Images

#### 4.1 Plain `<Image>` used for profile/group images throughout — MEDIUM
Expo's built-in `<Image>` does not cache network images on disk. In lists, every scroll-back triggers a network re-download.

| File | Line | Usage |
|---|---|---|
| [src/screens/ChatScreen.tsx](src/screens/ChatScreen.tsx#L47) | 47 | `MessageAvatar` — user profile image in FlatList rows |
| [src/screens/HomeScreen.tsx](src/screens/HomeScreen.tsx#L352) | 352 | User profile header avatar |
| [src/screens/HomeScreen.tsx](src/screens/HomeScreen.tsx#L548) | 548 | Group images in horizontal scroll |
| [src/screens/GroupsScreen.tsx](src/screens/GroupsScreen.tsx#L62) | 62 | Group images in group cards |
| [src/screens/AdvisorChatScreen.tsx](src/screens/AdvisorChatScreen.tsx#L289) | 289 | Advisor avatar in header |
| [src/screens/ProfileScreen.tsx](src/screens/ProfileScreen.tsx#L37,47) | 37, 47 | Profile photo; saved resource grid images |
| [src/screens/AdvisorDetailsScreen.tsx](src/screens/AdvisorDetailsScreen.tsx) | various | Advisor avatar |
| [src/screens/ConsultAdvisorScreen.tsx](src/screens/ConsultAdvisorScreen.tsx) | various | Advisor list images |

**Proposed fix:** Install `expo-image` (`npx expo install expo-image`) and replace `<Image source={{ uri: ... }}>` with `<ExpoImage source={{ uri: ... }} cachePolicy="memory-disk">`. Static bundled assets (`require('../assets/...')`) can stay as plain `<Image>`.  
**Risk:** needs-review — requires installing a new native package and rebuilding the dev client

#### 4.2 Local bundled group images — LOW / ACCEPTABLE
**File:** [src/assets/](src/assets/) — `group_image1.jpg`, `group_image3.png`, `group_image4.jpeg`, `group_image5.png`  
These are bundled with the app and served from disk. No network cost. Plain `<Image>` is fine here.

---

### 5. Render-path Cost

#### 5.1 `safeText` helper — INTENTIONAL DESIGN (do NOT change)
**File:** [src/screens/ChatScreen.tsx:143-149](src/screens/ChatScreen.tsx#L143-L149)  
`safeText` guards the decrypt-timing race: if a value is still an `EncryptedMessage` object (not yet decrypted), it returns `'[encrypted]'` instead of letting the object reach JSX and cause "Objects are not valid as a React child." This is the **interim-state pattern** described in the task constraints. It is called at render time (lines 305, 563, 1013) but the cost is two `typeof` checks — negligible. Do NOT alter.

#### 5.2 Per-message status/flag computations in `renderItem` — LOW / ACCEPTABLE
**File:** [src/screens/ChatScreen.tsx:800-810](src/screens/ChatScreen.tsx#L800-L810)  
`effectiveStatus`, `isOwn`, `isModerator`, `isRejected`, `isPending`, `advisorMsg` are computed per item in `renderItem`. For 50–100 visible messages these are O(1) boolean operations — acceptable. At 1000+ messages, memoizing individual row components with `React.memo` would help, but that's only relevant for extreme power users.

#### 5.3 `filteredResources` computed on every ResourceFeed render — LOW
**File:** [src/components/ResourceFeed.tsx:73-76](src/components/ResourceFeed.tsx#L73-L76)  
`resources.filter(...)` runs on every render whenever `activeTab` or `resources` changes. Resources are small arrays (≤20 typical). Acceptable without memoization. Could add `useMemo([resources, activeTab])` as a future micro-optimization.

#### 5.4 `new Date().toLocaleDateString(...)` in HomeScreen header — LOW
**File:** [src/screens/HomeScreen.tsx:378](src/screens/HomeScreen.tsx#L378)  
Called in render. Result doesn't change within a session day. Negligible in practice.

---

### 6. Package Dependencies

| Package | Imported in src? | Used for |
|---|---|---|
| `groq-sdk` | ✓ `src/services/geminiService.ts:1` | Groq LLM API (moderation + AI chat fallback) |
| `expo-image-picker` | ✓ `src/screens/ProfileScreen.tsx:10` | Camera/library photo picker |
| `expo-clipboard` | ✓ `src/components/ResourcePostCard.tsx:8` | Share link copy |
| `@multiavatar/multiavatar` | ✓ `ChatScreen`, `HomeScreen`, `ProfileScreen` | SVG avatar generation |
| `react-native-web` | not directly in src | Required peer dep for expo web target |
| `react-dom` | not directly in src | Required peer dep for expo web target |
| `expo-image` | **NOT in package.json** | — not installed; needed for disk image caching |

**Finding:** No packages in `package.json` appear genuinely unimported. `react-native-web` and `react-dom` are required by the expo web build target even without direct src imports.

---

### 7. Dead Code Candidates

> These are **candidates only**. Nothing has been deleted. Each is annotated with cross-repo risk per the task constraints.

#### 7.1 `isPrimary` variable — always `true`, dead branches below it
**File:** [src/screens/HomeScreen.tsx:541-555](src/screens/HomeScreen.tsx#L541-L555)  
```ts
const isPrimary = true;          // always true
...
style={[styles.groupCard, !isPrimary && styles.groupCardSecondary]}  // !isPrimary never true
...
{!isPrimary && (                 // dead branch — never renders
  <Text style={styles.groupSecondaryTag}>Also recommended</Text>
)}
```
**Evidence:** Set to `true` on line 541; no code path sets it to `false`.  
**Cross-repo risk:** None — purely UI conditional. The styles `groupCardSecondary` and `groupSecondaryTag` are only used here.  
**Verdict:** Safe to remove (variable + both conditional branches + two style entries), but confirm this feature was intentionally abandoned before deleting.

#### 7.2 `approvalMessageSeen` check in HomeScreen — duplicate of AppContext logic
**File:** [src/screens/HomeScreen.tsx:178-186](src/screens/HomeScreen.tsx#L178-L186)  
HomeScreen watches `recommendationProfile.approvalMessageSeen` and shows its own local `showApprovalModal`. `AppContext` (line 430-451) also watches the same field on its own listener and shows a *different* approval modal (the `showAdvisorApprovalModal`). Both modals can appear for the same approval event if both listeners fire.  
**Evidence:** Two separate effects checking `advisorConnectionStatus === 'approved'`, two separate modals.  
**Cross-repo risk:** The `approvalMessageSeen` Firestore field is written by the backend after the advisor approves. The flag must remain; only the duplicate UI logic is redundant.  
**Verdict:** needs-review — one of the two modals should be removed. Requires product decision on which one to keep.

#### 7.3 `continueAfterAdvisorApproval` imported and called in HomeScreen — overlaps AppContext
**File:** [src/screens/HomeScreen.tsx:26,197](src/screens/HomeScreen.tsx#L26-L197)  
HomeScreen calls `continueAfterAdvisorApproval` when the user taps "Continue" on its own approval modal. AppContext's `handleAdvisorApprovalContinue` (line 462-497) calls the same function when the user taps "Continue" on AppContext's modal.  
**Cross-repo risk:** `continueAfterAdvisorApproval` writes `approvalMessageSeen = true` to Firestore — this field is read by the advisor portal. The function must NOT be deleted, but one of the two call sites is redundant.  
**Verdict:** needs-review (tied to §7.2 above)

#### 7.4 `FALLBACK_AVATARS` in AdvisorDetailsScreen — confirmed unused
**File:** [src/screens/AdvisorDetailsScreen.tsx:34-39](src/screens/AdvisorDetailsScreen.tsx#L34-L39)  
```ts
const FALLBACK_AVATARS: Record<string, any> = { ... }
```
Grepped entire file — defined once at line 34, never referenced again. The component uses the `advisor.imageUrl` from props for avatars, not this map.  
**Cross-repo risk:** None — client-side constant only.  
**Verdict:** Safe to remove.

#### 7.5 `authorizedBadge` / `authorizedText` style entries in ChatScreen
**File:** [src/screens/ChatScreen.tsx:1378-1388](src/screens/ChatScreen.tsx#L1378-L1388)  
```ts
authorizedBadge: { alignItems: 'center', justifyContent: 'center', gap: 2 },
authorizedText:  { fontSize: 9, color: '#16A34A', ... },
```
Defined in `StyleSheet.create` but not referenced in any JSX in this file.  
**Cross-repo risk:** None — StyleSheet entries are local.  
**Verdict:** Safe to remove after confirmation.

#### 7.6 `groupsLoading` exported from AppContext but also maintained locally in HomeScreen
**File:** [src/context/AppContext.tsx:183](src/context/AppContext.tsx#L183) and [src/screens/HomeScreen.tsx:66](src/screens/HomeScreen.tsx#L66)  
HomeScreen maintains its own `profileLoading` state (line 66) and reads `groupsLoading` from context (line 50), but uses both independently. Not dead code per se, but flags that the loading state is fragmented.  
**Cross-repo risk:** None.  
**Verdict:** Informational only — not a deletion candidate.

#### 7.7 `internalTab` / `setInternalTab` in ResourceFeed — possibly dead when `hideTabs=true`
**File:** [src/components/ResourceFeed.tsx:32-35](src/components/ResourceFeed.tsx#L32-L35)  
When `hideTabs={true}` (as used in HomeScreen), the tab switcher is hidden and the parent controls `activeTab` via the `externalTab` prop. `internalTab` state is initialised but never changes in this configuration.  
**Cross-repo risk:** None.  
**Verdict:** Acceptable internal implementation detail — not worth removing.

#### 7.8 `SupportScoreCard` component — CONFIRMED USED (remove from candidate list)
**File:** [src/components/SupportScoreCard/index.tsx](src/components/SupportScoreCard/index.tsx)  
Grep confirms it is imported and rendered in [src/screens/WellnessGoalsScreen.tsx:26,136](src/screens/WellnessGoalsScreen.tsx#L26). **Not a dead code candidate.**

#### 7.9 `constants/badges.ts` — CONFIRMED USED (remove from candidate list)
**File:** [src/constants/badges.ts](src/constants/badges.ts)  
Grep confirms it is imported by `gamificationService.ts`, `SupportScoreCard/BadgeItem.tsx`, `SupportScoreCard/index.tsx`, and `supportDetectionService.ts`. **Not a dead code candidate.**

---

## Phase 1 Summary Table

| # | File | Issue | Severity | Risk |
|---|---|---|---|---|
| 1.1 | AppContext.tsx:620 | `gamificationTriggers` recreated every render | HIGH | safe |
| 1.2 | AppContext.tsx:742,745 | Inline arrow fns in context value | MEDIUM | safe |
| 1.3 | HomeScreen.tsx:207 | `recommendedGroups` IIFE not memoized | MEDIUM | safe |
| 1.4 | HomeScreen.tsx:239 | `sourceLabel`/`categoryLabel` IIFEs not memoized | LOW | safe |
| 1.5 | ChatScreen.tsx:751 | `renderItem` inline arrow on FlatList | MEDIUM | safe |
| 2.2 | AppContext+HomeScreen | Duplicate `listenToMentalHealthProfile` | MEDIUM | needs-review |
| 2.4 | ResourceFeed.tsx:40 | `listenToUserRecommendationCategory` overlaps AppContext | MEDIUM | needs-review |
| 3.1 | ChatScreen.tsx:707 | FlatList missing `windowSize`, `initialNumToRender`, `removeClippedSubviews` | MEDIUM | safe |
| 3.2 | AdvisorChatScreen.tsx:373 | Same FlatList props missing | MEDIUM | safe |
| 4.1 | Multiple screens | Plain `<Image>` — no disk cache for network URIs | MEDIUM | needs-review |
| 7.1 | HomeScreen.tsx:541 | `isPrimary` always `true`, dead branches | LOW | safe |
| 7.5 | ChatScreen.tsx:1378 | Unused `authorizedBadge`/`authorizedText` styles | LOW | safe |
| 7.8 | SupportScoreCard/ | Component possibly unused | MEDIUM | needs-review |

---

## Phase 2 — Changes Applied

Typecheck baseline confirmed: 6 pre-existing errors (AppContext.tsx:847, AdvisorChatScreen.tsx:520, HomeScreen.tsx:350 & 462, dataService.ts:599, firebaseConfig.ts:2). My changes introduced **zero new type errors**.

### ✅ P2-1: `gamificationTriggers` wrapped in `useMemo`
**File:** [src/context/AppContext.tsx:620](src/context/AppContext.tsx#L620)  
Wrapped the `gamificationTriggers` object literal in `useMemo` with deps `[user?.id, processBadgeResult]`. Each trigger only uses `user.id`, not the full user object, so the dep is correct. The object reference is now stable across all renders where the user hasn't changed — eliminating downstream re-renders in every `gamificationTriggers` consumer (HomeScreen, JournalScreen, WellnessGoalsScreen, GroupsScreen, etc.).  
Also added `useMemo` to the React import.

### ✅ P2-2: `clearListenerAcceptedNotice` and `clearPendingBadge` extracted as `useCallback`
**File:** [src/context/AppContext.tsx:620](src/context/AppContext.tsx#L620)  
Both were inline arrow functions in the context `value` prop — recreated on every render. Extracted as stable `useCallback(() => ..., [])` references so they no longer contribute to context identity churn.

### ✅ P2-3: FlatList optimization props in ChatScreen
**File:** [src/screens/ChatScreen.tsx:707](src/screens/ChatScreen.tsx#L707)  
Added `windowSize={8}` (reduces off-screen rendered pages from 21 to 8), `initialNumToRender={20}` (covers typical viewport for bottom-pinned chat), `removeClippedSubviews={true}` (unmounts off-screen views to free memory). `getItemLayout` was intentionally omitted — message heights are variable (quoted replies, private threads, flagged badges all change row height).

### ✅ P2-4: FlatList optimization props in AdvisorChatScreen
**File:** [src/screens/AdvisorChatScreen.tsx:373](src/screens/AdvisorChatScreen.tsx#L373)  
Same `windowSize={8}`, `initialNumToRender={20}`, `removeClippedSubviews={true}`.

### ⚠️ P2-5: `renderItem` useCallback in ChatScreen — intentionally skipped
The `renderItem` closure captures 15+ values from component scope (`isAI`, `firstUnreadIndex`, `unreadCount`, `user`, `group`, `deletingId`, `highlightedId`, `userProfiles`, `privateThreads`, `handleMessageAction`, `scrollToMessage`, `setReplyingTo`, `setReplyingToPrivate`, `renderQuotedPreview`, `gamificationTriggers`). Per the constraint *"never partial deps"*, a `useCallback` with this many deps risks stale closures if any are missed, and would essentially re-create on every message arrival anyway. Skipped. Benefit from P2-3 FlatList props already addresses the main scroll performance issue.

### ✅ P2-6: `recommendedGroups`, `sourceLabel`, `categoryLabel` memoized in HomeScreen
**File:** [src/screens/HomeScreen.tsx:207](src/screens/HomeScreen.tsx#L207)  
All three IIFEs converted to `useMemo` calls. The full priority chain branching logic (advisor approval → weekly ML trend → KNN → DASS baseline → raw ML → empty) is completely unchanged — only memoized. `recommendedGroups` deps: `[isAdvisorRequired, recommendationProfile, peerGroups, mlInsight]`. Label deps: `[recommendationProfile, mlInsight]`. These values now recompute only when the underlying data changes, not on every input-box keystroke or notification update.

---

## Phase 3 — Dead Code Candidates (awaiting your approval)

Nothing has been deleted. Items D and E from the original candidate list were verified as **actively used** and removed from this list.

**Please confirm which of the following items are safe to remove. Respond with the letter(s) you approve (e.g. "approve A and B") and I will remove them one at a time, running typecheck after each.**

| # | Item | File:Lines | Evidence | Cross-repo risk | My recommendation |
|---|---|---|---|---|---|
| **A** | `isPrimary = true` const + both dead branches below it + `groupCardSecondary` + `groupSecondaryTag` styles | [HomeScreen.tsx:543-558](src/screens/HomeScreen.tsx#L543-L558), styles ~L1054-1056, L1065-1068 | Always `true`; `!isPrimary` condition and its JSX block can never execute; confirmed by grep | None — purely local UI logic | **Safe to remove** |
| **B** | `authorizedBadge` + `authorizedText` style entries | [ChatScreen.tsx:1381-1391](src/screens/ChatScreen.tsx#L1381-L1391) | Defined in `StyleSheet.create` but referenced nowhere in the file's JSX; confirmed by grep | None — local styles only | **Safe to remove** |
| **C** | `FALLBACK_AVATARS` constant | [AdvisorDetailsScreen.tsx:34-39](src/screens/AdvisorDetailsScreen.tsx#L34-L39) | Defined once, never referenced again; advisor component uses `advisor.imageUrl` prop directly | None — client-side constant only | **Safe to remove** |
| **D** | Duplicate approval modal in HomeScreen + its local `showApprovalModal` state | [HomeScreen.tsx:75, 178-186, 636-667](src/screens/HomeScreen.tsx#L75-L667) | `AppContext` already handles the approval event and shows its own modal. Both can fire simultaneously for the same advisor approval. The Firestore field `approvalMessageSeen` (written by backend, read by advisor portal) must stay; only the duplicate UI can be removed | `approvalMessageSeen` field: **cross-repo** (advisor portal reads it) — the field is safe since AppContext still calls `continueAfterAdvisorApproval`; the HomeScreen duplicate call becomes redundant | **needs-review / product decision** — only approve this if you're confident the AppContext modal fully covers the approval UX |

---

*End of audit. Awaiting Phase 3 approval before making any deletions.*
