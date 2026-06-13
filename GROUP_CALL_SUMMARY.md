# Group Call Feature — How It Works

## Overview

Advisors start Jitsi Meet calls from the **Advisor Portal**.
Users see a banner in-app, tap it, and join the call inside a full-screen WebView —
no browser, no third-party SDK.

---

## Architecture at a Glance

```
Advisor Portal
    │
    │  writes to Firestore
    ▼
peer_groups/{groupId}/groupCalls/{callId}
    │  { status: "live" | "scheduled" | "ended", roomUrl, ... }
    │
    │  onSnapshot listener (real-time)
    ▼
groupCallService.ts
    │  subscribeGroupCalls()  /  subscribeAllGroupCalls()
    │
    ├──▶ ChatScreen.tsx  ──▶ LiveCallBanner  ──▶ GroupCallScreen (WebView)
    │
    └──▶ HomeScreen.tsx  ──▶ LiveCallBanner  ──▶ GroupCallScreen (WebView)
```

---

## File-by-File Breakdown

### 1. `src/types/groupCall.ts`
Defines the **GroupCall interface** — the shape of a Firestore document.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Firestore document ID |
| `groupId` | string | Which peer group this call belongs to |
| `advisorId / advisorName` | string | Who started the call |
| `title` | string | Display name e.g. "Weekly check-in" |
| `roomUrl` | string | `https://meet.jit.si/mindmates-{groupId}-{timestamp}` |
| `status` | `"live"` \| `"scheduled"` \| `"ended"` | Current call state |
| `scheduledAt / startedAt / endedAt` | Firestore Timestamp \| null | Lifecycle timestamps |
| `createdAt` | Firestore Timestamp | When the advisor created it |

---

### 2. `src/services/groupCallService.ts`
All Firestore logic lives here. Three exported functions:

#### `subscribeGroupCalls(groupId, callback) → unsubscribe`
- Opens a **real-time `onSnapshot` listener** on `peer_groups/{groupId}/groupCalls`
- Filters: `status IN ["live", "scheduled"]` — ended calls are ignored
- Results are **sorted client-side** by `createdAt DESC`
  (avoids the Firestore composite index requirement)
- Calls `callback(calls[])` every time Firestore pushes an update
- Returns the Firestore `unsubscribe` function for cleanup

```
Firestore snapshot fires
    │
    ▼
Filter: status IN [live, scheduled]
    │
    ▼
Map docs → GroupCall[]  (adds id: doc.id)
    │
    ▼
Sort: newest first (client-side)
    │
    ▼
callback(calls)  →  React state update  →  UI re-render
```

#### `subscribeAllGroupCalls(groupIds[], callback) → unsubscribe`
- **Fan-out**: calls `subscribeGroupCalls()` once per group the user has joined
- Merges all results into a single `Record<groupId, GroupCall[]>` object
- Calls `callback({ ...results })` whenever **any** group's listener fires
- If `groupIds` is empty → immediately calls `callback({})` and returns a no-op
- Returns one cleanup function that unsubscribes **all** listeners at once

```
joinedGroupIds = ["G1", "G2", "G3"]
    │
    ├── subscribeGroupCalls("G1")  ─┐
    ├── subscribeGroupCalls("G2")  ─┼──▶ merged results{}  ──▶ callback
    └── subscribeGroupCalls("G3")  ─┘
```

#### `formatCallTime(timestamp) → string`
Converts a Firestore Timestamp to a human-readable string.
- `"Today at 3:00 PM"` — if the call is today
- `"May 28 at 3:00 PM"` — if on another day
- Handles Firestore Timestamps (`.toDate()`), plain JS Dates, and `null`

---

### 3. `src/components/LiveCallBanner.tsx`
A smart banner component that appears in both ChatScreen and HomeScreen.

#### How it renders:

**Live call → Red banner**
```
┌─────────────────────────────────────────────────────────┐
│  ●(pulse)  Live Now · Weekly check-in        [Join Call]│
│            Started by Dr. Silva                          │
└─────────────────────────────────────────────────────────┘
```
- Pulsing animated white dot (opacity 1 → 0.3 → 1, 1200ms loop)
- Whole banner + "Join Call" button both trigger `handleJoinCall()`

**Scheduled call → Amber banner**
```
┌─────────────────────────────────────────────────────────┐
│  🕒  Upcoming · Monthly session      [Set Reminder]     │
│      Today at 4:00 PM                                   │
└─────────────────────────────────────────────────────────┘
```
- "Set Reminder" shows a native Alert (notification wiring optional)

#### What `handleJoinCall()` does:
```ts
navigation.push('GroupCall', {
  roomUrl:      call.roomUrl,       // meet.jit.si URL
  callTitle:    call.title,
  advisorName:  call.advisorName,
  userNickname: user?.nickname ?? user?.name ?? 'Student',
})
```
Navigates in-app to GroupCallScreen. **No browser is opened.**

---

### 4. `src/screens/GroupCallScreen.tsx`
The full-screen in-app call experience.

#### Screen layout:
```
┌──────────────────────────────────────────────────────┐
│  [LIVE] Weekly check-in        Dr. Silva  [Leave]    │  ← TopBar
├──────────────────────────────────────────────────────┤
│                                                      │
│          Jitsi Meet WebView                          │  ← contentArea
│          (full screen)                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### URL building — `buildJitsiUrl(baseUrl, nickname, title)`
Appends Jitsi config overrides as a **URL `#` fragment**:
```
https://meet.jit.si/mindmates-G1-1748...
  #config.startWithAudioMuted=false
  &config.prejoinPageEnabled=false      ← skips the pre-join lobby
  &config.disableDeepLinking=true       ← suppresses "open in app" prompt
  &config.toolbarButtons=[...]          ← shows only relevant buttons
  &userInfo.displayName=Victor          ← pre-fills display name
  &config.subject=Weekly+check-in       ← sets meeting title
```
Jitsi reads these on page load — no server changes needed.

#### WebView is NEVER unmounted while loading
To prevent Jitsi from restarting when the loading overlay disappears,
the WebView is always in the React tree but **hidden** during load:
```
Loading?  → WebView: { position: 'absolute', opacity: 0, width: 0, height: 0 }
           + Loading overlay shown on top

Loaded?   → WebView: { flex: 1 }  (visible)
           + Overlay removed
```

#### State machine:
```
Mount
  │
  ▼
isLoading=true, hasError=false
  │
  ├─ onLoadEnd()  ──────────────────▶  isLoading=false  →  WebView visible
  │
  └─ onError() / onHttpError()  ────▶  hasError=true   →  Error screen shown
                                           │
                                           └─ "Try again" → reload() → isLoading=true
```

#### How the call ends:
Three exit paths all go to `navigation.goBack()`:

| Trigger | How |
|---------|-----|
| User taps **Leave** button | `Alert.alert` confirmation → `navigation.goBack()` |
| Android hardware back | `BackHandler` intercepts → same `Alert.alert` |
| Jitsi posts `readyToClose` | `onMessage` handler → immediate `navigation.goBack()` |

The Android BackHandler prevents default back navigation so the user
always sees the confirmation dialog instead of instantly leaving.

#### Permissions:
- **iOS**: `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` in `app.json`
- **Android**: `CAMERA` + `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` in `app.json`
- **WebView**: `mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"`
  auto-grants for `meet.jit.si` after the first OS-level prompt; no double dialog

---

### 5. Navigation wiring (`src/navigation/index.tsx`)

`GroupCall` is registered in the **root stack navigator** (not the tab navigator),
so it sits on top of everything — tabs are hidden while in a call.

```
RootStack
  ├── Splash
  ├── Auth
  ├── Main (tabs: Home, Groups, AIChat, Journal, Profile)
  ├── GroupChat
  └── GroupCall  ←  new, slide_from_bottom, gestureEnabled=false
```

`gestureEnabled: false` means the iOS swipe-to-go-back gesture is disabled.
This prevents accidentally leaving the call mid-session.

`animation: 'slide_from_bottom'` makes it feel like a modal sheet.

---

### 6. Where banners appear

#### `ChatScreen.tsx` — group chat screen
```
┌──────────────┐
│   Header     │
├──────────────┤
│ [LIVE banner]│  ← appears here (live call)
│ [Scheduled..]│  ← and here (scheduled calls)
├──────────────┤
│  Messages    │
│  ...         │
└──────────────┘
```
- `subscribeGroupCalls(groupId, setActiveCalls)` runs while this group's chat is open
- Cleans up on unmount / group change

#### `HomeScreen.tsx` — main home tab
```
┌───────────────────┐
│  Header / Greeting│
├───────────────────┤
│  Daily Card       │
├───────────────────┤
│ [LIVE banner]     │  ← all live calls across all joined groups
│ [LIVE banner]     │
│  Upcoming calls   │  ← all scheduled calls
├───────────────────┤
│  Recommended      │
│  Groups           │
└───────────────────┘
```
- `subscribeAllGroupCalls(joinedGroupIds, setCallsByGroup)` fans out across all groups
- Re-subscribes automatically when user joins or leaves a group

---

## Data flow — end to end

```
1. Advisor creates call in portal
        │
        ▼
   Firestore: peer_groups/G1/groupCalls/C1
   { status: "live", roomUrl: "https://meet.jit.si/...", ... }
        │
        ▼
2. onSnapshot fires on user's device (< 1 second)
        │
        ▼
3. subscribeGroupCalls callback → setActiveCalls([call])
        │
        ▼
4. React re-renders → LiveCallBanner appears
        │
        ▼
5. User taps "Join Call"
        │
        ▼
6. navigation.push('GroupCall', { roomUrl, callTitle, ... })
        │
        ▼
7. GroupCallScreen mounts
   buildJitsiUrl() → URL with config fragments
        │
        ▼
8. WebView loads meet.jit.si  →  Jitsi UI appears in-app
        │
        ▼
9. User finishes / taps Leave  →  navigation.goBack()
        │
        ▼
10. GroupCallScreen unmounts → back to ChatScreen or HomeScreen
```

---

## Key design decisions

| Decision | Reason |
|----------|--------|
| WebView instead of `@jitsi/react-native-sdk` | SDK is incompatible with React Native New Architecture (Expo SDK 54+) |
| Client-side sort instead of Firestore `orderBy` | Avoids composite index requirement for `where("in") + orderBy` |
| WebView always mounted, hidden via `width:0 opacity:0` | Prevents Jitsi from restarting when loading overlay hides |
| `navigation.push` instead of `navigate` | Allows stacking multiple calls if navigated from different screens |
| `gestureEnabled: false` | Prevents accidental swipe-back mid-call |
| `mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"` | Auto-grants for meet.jit.si, no duplicate OS permission dialog |
| `config.prejoinPageEnabled=false` in URL fragment | Skips the Jitsi lobby — users join immediately |
| `config.disableDeepLinking=true` | Suppresses Jitsi's "open in Jitsi app" banner inside WebView |

---

## Composite Index (future)

The current query uses `where("status", "in", [...])` only.
When call volume grows, restore server-side ordering by:

1. Deploy `firestore.indexes.json` (already created at project root):
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. After the index builds (~1–2 min), in `groupCallService.ts`:
   - Add `orderBy('createdAt', 'desc')` back to the query
   - Remove the `.sort(byCreatedAtDesc)` client-side call
