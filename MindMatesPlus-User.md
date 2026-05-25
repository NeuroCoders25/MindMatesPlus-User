# MindMates+ User App — Complete System Architecture

> **Purpose:** This document is the authoritative reference for any AI or developer working on `MindMatesPlus-User`. It covers every file, every Firebase collection/field, every ML pipeline, and every screen in sufficient detail that no additional code reading is required to understand the system.  
> **Branch:** `AI_Moderation` | **Updated:** 2026-05-23  
> **Stack:** React Native (Expo SDK 54) · TypeScript · Firebase 12 · FastAPI ML backend · Groq LLaMA-3.3-70b · BERT

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Directory Structure](#3-directory-structure)
4. [Firebase Firestore Database — Complete Schema](#4-firebase-firestore-database--complete-schema)
5. [TypeScript Types Reference](#5-typescript-types-reference)
6. [Services Layer](#6-services-layer)
7. [Context & Global State (AppContext)](#7-context--global-state-appcontext)
8. [Navigation Architecture](#8-navigation-architecture)
9. [Screens — Complete Reference](#9-screens--complete-reference)
10. [UI Components](#10-ui-components)
11. [DASS-21 Assessment Engine](#11-dass-21-assessment-engine)
12. [ML Pipelines](#12-ml-pipelines)
13. [Content Moderation Pipeline](#13-content-moderation-pipeline)
14. [KNN Recommendation Pipeline](#14-knn-recommendation-pipeline)
15. [Advisor System](#15-advisor-system)
16. [Wellness Score System](#16-wellness-score-system)
17. [Peer Group Chat System](#17-peer-group-chat-system)
18. [Recommendation Category System](#18-recommendation-category-system)
19. [Authentication & Security](#19-authentication--security)
20. [Color System & Design Tokens](#20-color-system--design-tokens)
21. [Appendix A: Static Peer Groups](#appendix-a-static-peer-groups)
22. [Appendix B: Complete Function Export Index](#appendix-b-complete-function-export-index)

---

## 1. Project Overview

**MindMates+** is a React Native mobile application for mental health support. It provides:

- **DASS-21 psychometric assessment** to baseline users into support categories
- **AI chat companion** ("Mindy") powered by Groq LLaMA for post-assessment support
- **Peer group chats** with real-time messaging, flagging, and advisor moderation
- **Journal** with per-entry BERT emotion analysis (depression / anxiety / normal)
- **Content moderation** (two-layer: Groq LLaMA primary → offline regex fallback)
- **KNN group recommender** — a FastAPI ML backend that maps clinical scores + emotion signals to peer groups
- **Advisor consultation** — request, connect, and chat with human mental health advisors
- **Wellness score** — a 0–100 dynamic score adjusted by ML predictions and keyword analysis
- **Resource feed** — categorized text/image resources served from Firestore

**Firebase project:** `mindmatesplus`  
**FastAPI ML backend:** `http://10.0.2.2:8000` (Android emulator → host machine)  
**AI model:** `llama-3.3-70b-versatile` via Groq SDK  
**BERT model:** Hosted on FastAPI at `/predict` endpoint

---

## 2. Tech Stack & Dependencies

### Runtime Versions

| Package | Version |
|---|---|
| React | 19.1.0 |
| React Native | 0.81.5 |
| Expo SDK | ~54.0.33 |
| TypeScript | ~5.9.2 |
| Firebase SDK | ^12.12.1 |

### Key Dependencies

| Package | Purpose |
|---|---|
| `expo` | Managed workflow, asset bundling, Metro bundler |
| `firebase` | Firestore real-time DB + Authentication |
| `groq-sdk` | Groq LLaMA API (AI chat + moderation) |
| `@google/generative-ai` | Installed but superseded by Groq SDK |
| `nativewind` + `tailwindcss` | Tailwind CSS utility classes for React Native |
| `react-native-reanimated` | Smooth animations (progress bars, transitions) |
| `react-native-gesture-handler` | Gesture support (ScrollView, swipe) |
| `@react-navigation/native-stack` | Stack navigator (15 routes) |
| `@react-navigation/bottom-tabs` | Tab navigator (5 tabs) |
| `crypto-js` | Installed; not used in active code paths |
| `@expo/vector-icons` | Ionicons, Feather icon sets |
| `react-native-svg` | SVG graphics |
| `@react-native-async-storage/async-storage` | Firebase Auth session persistence |
| `lucide-react-native` | Additional icon set |

### Environment Variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GROQ_API_KEY` | Groq API key for LLaMA access |

---

## 3. Directory Structure

```
MindMatesPlus-User/
├── index.ts                      Entry point
├── App.tsx                       Root component (AppProvider + Navigation)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── .env                          Contains EXPO_PUBLIC_GROQ_API_KEY
├── src/
│   ├── assets/                   Images: logo.png, group_image1.jpg, group_image3.png,
│   │                               group_image4.jpeg, group_image5.png
│   ├── components/
│   │   └── UI.tsx                Button, Card, Input shared components
│   ├── context/
│   │   └── AppContext.tsx        Global state (AppProvider + useApp hook)
│   ├── navigation/
│   │   ├── index.tsx             RootStack + MainTabs + Crisis Modal
│   │   └── navigationRef.ts     NavigationContainerRef for imperative navigation
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── AuthScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   ├── RecoverPasswordScreen.tsx
│   │   ├── QuestionnaireScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── GroupsScreen.tsx
│   │   ├── ChatScreen.tsx        Dual-mode: AI chat + group chat
│   │   ├── JournalScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── ConsultAdvisorScreen.tsx
│   │   ├── AdvisorScreen.tsx
│   │   ├── AdvisorDetailsScreen.tsx
│   │   ├── AdvisorChatScreen.tsx
│   │   ├── FeedbackScreen.tsx
│   │   └── WellnessGoalsScreen.tsx
│   ├── services/
│   │   ├── firebaseConfig.ts     Firebase init; exports auth + db
│   │   ├── dataService.ts        ~2,574 lines — complete Firestore engine
│   │   ├── geminiService.ts      Groq AI client (AI chat, moderation, DASS Q helper)
│   │   ├── mlApiService.ts       HTTP client for FastAPI ML backend
│   │   └── wordFilter.ts         Offline regex content filter (fallback)
│   ├── types.ts                  All TypeScript interfaces
│   └── utils/
│       └── encryption.ts         btoa/atob name obfuscation
```

---

## 4. Firebase Firestore Database — Complete Schema

### Top-Level Collections Overview

```
Firestore (project: mindmatesplus)
├── users/                    One document per user (uid as doc ID)
│   └── {uid}/
│       ├── journal_entries/     Journal entries subcollection
│       ├── mentalHealthProfile/
│       │   └── currentProfile   Single profile doc (not a collection)
│       ├── mlAnalysisHistory/   Per-event BERT prediction log
│       ├── wellnessScoreHistory/ Audit trail for wellness score changes
│       ├── questionnaireResponses/ DASS-21 response history
│       ├── ml_analysis/         Legacy ML subcollection (inactive)
│       ├── aiChatMessages/      User's AI chat message log
│       ├── group_memberships/   Mirror of groupMembers (by groupId)
│       ├── feedback/            User feedback submissions
│       └── mentalHealth/
│           └── recommendationState  KNN pipeline state (rate-limited)
├── peer_groups/              One document per group
│   └── {groupId}/
│       └── chatMessages/        Group chat messages
│           └── {msgId}/
│               └── privateThread/ Advisor-user private thread messages
├── groupMembers/             Flat join table (doc ID: "{groupId}_{userId}")
├── advisorConnections/       Connection requests between users and advisors
│   └── {connectionId}/
│       └── messages/           Direct chat messages
├── advisors/                 Advisor profiles (admin-managed)
└── resources/                Resource content (advisor/admin-managed)
```

---

### 4.1 `users/{uid}` — User Document

**Written by:** `AuthScreen.register()`, `AppContext`, `dataService` ML pipeline  
**Read by:** `AppContext.onAuthStateChanged`, `HomeScreen`, `WellnessGoalsScreen`

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Base64-encoded name: `btoa(encodeURIComponent(fullName))` |
| `nickname` | `string` | Plain-text display nickname |
| `email` | `string` | User's email address |
| `gender` | `string` | `'Male'` \| `'Female'` \| `'Prefer not to say'` |
| `age` | `number` | Calculated from DOB at registration time |
| `dob` | `string` | ISO date string `"YYYY-MM-DD"` |
| `createdAt` | `Timestamp` | Registration timestamp (serverTimestamp) |
| `mlMentalHealthProfile` | `map` | Embedded ML profile (see sub-fields below) |

#### Embedded `mlMentalHealthProfile` map (on user document)

| Field | Type | Description |
|---|---|---|
| `latestPrediction` | `string` | `'depression'` \| `'anxiety'` \| `'normal'` |
| `latestConfidence` | `number` | 0–1 confidence from BERT |
| `dominantCategory` | `string` | Most frequent prediction across 10 recent journal entries |
| `depressionCount` | `number` | Count of depression predictions |
| `anxietyCount` | `number` | Count of anxiety predictions |
| `normalCount` | `number` | Count of normal predictions |
| `lastUpdated` | `Timestamp` | Last recalculation time |

**Written by:** `updateMlMentalHealthProfile()` after every journal save.

---

### 4.2 `users/{uid}/journal_entries/{entryId}`

**Written by:** `saveJournalEntry()` ← `AppContext.addJournalEntry()`  
**Read by:** `fetchJournalEntries()` (ordered by `date` desc), `fetchUserJournalTexts()` (last 5 for ML)

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Entry title |
| `content` | `string` | Entry body text |
| `mood_tag` | `string` | User-selected mood label |
| `date` | `Timestamp` | Entry creation timestamp |
| `analysis` | `map \| null` | Rule-based sentiment analysis (legacy, still stored) |
| `ml_analysis` | `map \| null` | BERT prediction result |

#### `analysis` sub-map

| Field | Type |
|---|---|
| `sentiment` | `string` |
| `emotion` | `string` |
| `risk` | `'Low' \| 'Moderate' \| 'High'` |
| `score` | `number` |

#### `ml_analysis` sub-map

| Field | Type |
|---|---|
| `prediction` | `string` (`'depression' \| 'anxiety' \| 'normal'`) |
| `confidence` | `number` (0–1) |
| `probabilities` | `{ depression: number, anxiety: number, normal: number }` |

---

### 4.3 `users/{uid}/mentalHealthProfile/currentProfile`

**This is a single Firestore document** (the collection `mentalHealthProfile` always has exactly one doc: `currentProfile`).

The central state machine for all recommendation logic. Written and read by many parts of the system.

**Written by:** `updateQuestionnaireBaseline()`, `updateQuestionnaireProfile()`, `updateMentalHealthProfileFromMl()`, `updateWellnessScoreGradually()`, `callKnnAndWriteResult()`, `updatePeerGroupRecommendationFromWeeklyTrend()`, `continueAfterAdvisorApproval()`, `applyLowWellnessRestriction()`, `connectToAdvisor()`, advisor portal.

**Real-time read by:** `listenToMentalHealthProfile()` → updates `recommendationProfile` in AppContext.

| Field | Type | Set By | Description |
|---|---|---|---|
| `initialQuestionnaireScore` | `map` | Questionnaire (one-time) | DASS-21 baseline — never overwritten once set |
| `latestMlEmotionScore` | `map \| null` | BERT pipeline | Most recent ML prediction details |
| `baselineRecommendationCategory` | `GroupCategory` | Questionnaire | Immutable initial category |
| `activeRecommendationCategory` | `GroupCategory` | ML stability rules | Moves with 3-repeat ML rule |
| `recommendationSource` | `string` | Various | `'questionnaire' \| 'ml_analysis' \| 'advisor_approval' \| 'safety_restriction'` |
| `userStatus` | `string` | Various | `'normal' \| 'under_review' \| 'restricted'` |
| `mlStabilityCounter` | `map \| null` | ML pipeline | Tracks consecutive matching predictions |
| `resourceRecommendationCategory` | `GroupCategory` | Every ML event | Real-time resource feed category (fast-moving) |
| `peerGroupRecommendationCategory` | `GroupCategory` | Weekly trend | Stable peer group category (7-day moving avg) |
| `wellnessScore` | `number` | Wellness pipeline | Dynamic 0–100 score |
| `wellnessScoreUpdatedAt` | `Timestamp` | Wellness pipeline | Last wellness update time |
| `weeklyTrendSummary` | `map` | Weekly trend | Full 7-day trend calculation result |
| `dashboardCategory` | `GroupCategory` | Weekly trend | Mirrors `peerGroupRecommendationCategory` |
| `knnRecommendedGroup` | `string` | KNN pipeline | E.g., `'G4_Anxiety_Management'` or `'FALLBACK_QUESTIONNAIRE'` |
| `knnMappedCategory` | `GroupCategory` | KNN pipeline | GroupCategory from KNN group ID |
| `knnProbabilities` | `map` | KNN pipeline | Probability per KNN group ID |
| `knnLastUpdatedAt` | `Timestamp` | KNN pipeline | Last time KNN ran |
| `knnSafetyFlag` | `boolean` | KNN pipeline | `true` when G1 (crisis) predicted |
| `knnFallbackReason` | `string` | KNN fallback | `'backend_unreachable'` if FastAPI was down |
| `connectedAdvisorId` | `string` | `connectToAdvisor()` | ID of connected advisor |
| `advisorConnectionId` | `string` | `connectToAdvisor()` | ID of the `advisorConnections` doc |
| `advisorConnectionStatus` | `string` | Advisor portal | `'pending' \| 'accepted' \| 'approved'` |
| `approvedCategory` | `GroupCategory` | Advisor portal | Category approved by advisor |
| `approvalMessageSeen` | `boolean` | `continueAfterAdvisorApproval()` | Prevents modal re-showing |
| `approvalMessageSeenAt` | `Timestamp` | `continueAfterAdvisorApproval()` | When user acknowledged approval |
| `restrictedReason` | `string` | `applyLowWellnessRestriction()` | `'Low wellness score detected'` |
| `restrictedAt` | `Timestamp` | `applyLowWellnessRestriction()` | Restriction applied timestamp |
| `lastUpdated` | `Timestamp` | ML pipeline | Last any ML field was updated |

#### `initialQuestionnaireScore` sub-map

| Field | Type | Description |
|---|---|---|
| `depressionScore` | `number` | DASS-21 depression final score ×2 (range 0–42) |
| `anxietyScore` | `number` | DASS-21 anxiety final score ×2 (range 0–42) |
| `stressScore` | `number` | DASS-21 stress final score ×2 (range 0–42) |
| `totalScore` | `number` | Sum of three subscale scores |
| `mainCondition` | `string` | `'depression' \| 'anxiety' \| 'stress'` (highest subscale) |
| `category` | `string` | Severity: `'Normal' \| 'Mild' \| 'Moderate' \| 'Severe' \| 'Extremely Severe'` |
| `completedAt` | `Timestamp` | When questionnaire was submitted |

#### `latestMlEmotionScore` sub-map

| Field | Type | Description |
|---|---|---|
| `prediction` | `string` | `'depression' \| 'anxiety' \| 'normal'` |
| `confidence` | `number` | 0–1 confidence |
| `probabilities` | `map` | `{ depression, anxiety, normal }` all as 0–1 floats |
| `recordedAt` | `Timestamp` | Time of prediction |
| `analyzedAt` | `Timestamp` | Time analysis was written to Firestore |
| `sourceTextsUsed` | `string[]` | E.g., `['journal', 'ai_chat']` |
| `analyzedTextPreview` | `string` | First 80 chars of the combined text analyzed |

#### `mlStabilityCounter` sub-map

| Field | Type | Description |
|---|---|---|
| `lastPrediction` | `string` | Previous prediction label |
| `repeatedCount` | `number` | Consecutive same-prediction count; resets to 0 on category change |
| `lastUpdatedAt` | `Timestamp` | Last counter update |

#### `weeklyTrendSummary` sub-map

| Field | Type |
|---|---|
| `timeframeDays` | `number` (always 7) |
| `validRecordCount` | `number` |
| `dominantPrediction` | `string` |
| `dominantCategory` | `GroupCategory` |
| `dominantCount` | `number` |
| `previousPeerGroupCategory` | `GroupCategory` |
| `suggestedPeerGroupCategory` | `GroupCategory` |
| `finalPeerGroupCategory` | `GroupCategory` |
| `calculatedAt` | `Timestamp` |

---

### 4.4 `users/{uid}/mlAnalysisHistory/{historyId}`

**Written by:** `saveMlAnalysisHistory()` — called after every BERT analysis event.  
**Read by:** `calculateWeeklyMlTrend()`, `getWeeklyDominantEmotion()`.  
**Query:** `where('createdAt', '>=', sevenDaysAgo)` for 7-day window.

| Field | Type | Description |
|---|---|---|
| `prediction` | `string` | `'depression' \| 'anxiety' \| 'normal'` |
| `confidence` | `number` | 0–1 confidence score |
| `probabilities` | `map` | `{ depression, anxiety, normal }` |
| `source` | `string` | `'journal' \| 'group_chat' \| 'ai_chat'` |
| `textPreview` | `string` | First 80 chars of analyzed text |
| `resourceRecommendationCategory` | `string` | Category snapshot at analysis time |
| `createdAt` | `Timestamp` (serverTimestamp) | Used for 7-day window queries |

---

### 4.5 `users/{uid}/wellnessScoreHistory/{docId}`

**Written by:** `saveWellnessScoreHistory()` — on every wellness score change (fire-and-forget).  
**Read by:** Not read by the app — analytics/advisor portal only.

| Field | Type |
|---|---|
| `previousScore` | `number` |
| `newScore` | `number` |
| `changeAmount` | `number` (positive = improved) |
| `source` | `string` (`'journal' \| 'group_chat' \| 'ai_chat'`) |
| `textPreview` | `string` (80 chars) |
| `mlPrediction` | `string` |
| `mlConfidence` | `number` |
| `createdAt` | `Timestamp` |

---

### 4.6 `users/{uid}/questionnaireResponses/{docId}`

**Written by:** `saveQuestionnaireResponse()` — one doc per DASS-21 completion.

| Field | Type |
|---|---|
| `score` | `number` (sum of three subscale final scores) |
| `depression_score` | `number` |
| `anxiety_score` | `number` |
| `stress_score` | `number` |
| `classification_level` | `string` (`'low' \| 'moderate' \| 'severe'`) |
| `date` | `Timestamp` |

---

### 4.7 `users/{uid}/aiChatMessages/{docId}`

**Written by:** `saveAiChatMessage()` — only user messages, not AI responses.  
**Read by:** `fetchUserAiChatTexts()` — last 10 user messages, used as ML text input.

| Field | Type |
|---|---|
| `text` | `string` |
| `sender` | `string` (always `'user'`) |
| `timestamp` | `Timestamp` |

---

### 4.8 `users/{uid}/group_memberships/{groupId}`

**Written by:** `joinPeerGroup()`. Not queried by app (uses `groupMembers` top-level instead).

| Field | Type |
|---|---|
| `group_id` | `string` |
| `joined_at` | `Timestamp` |
| `status` | `string` (`'active'`) |

---

### 4.9 `users/{uid}/feedback/{docId}`

**Written by:** `saveFeedback()` ← `FeedbackScreen`.

| Field | Type |
|---|---|
| `rating` | `number` (1–5, required) |
| `peer_comment` | `string` (required) |
| `app_comment` | `string` (required) |
| `date` | `Timestamp` |

---

### 4.10 `users/{uid}/mentalHealth/recommendationState`

**Single document** owned exclusively by the weekly KNN pipeline.  
**Written by:** `saveKnnRecommendationState()` ← `runWeeklyKnnRecommendation()`.  
**Rate-limited:** Skip if `lastWeeklyAnalysisAt` is within 23 hours.

| Field | Type | Description |
|---|---|---|
| `peerGroupRecommendationCategory` | `string` | KNN group ID (not yet mapped to GroupCategory) |
| `dashboardCategory` | `string` | Same as above |
| `recommendationEngine` | `string` | Always `'knn'` |
| `lastWeeklyAnalysisAt` | `Timestamp` | Rate-limit check field |
| `weeklyTrendSummary` | `WeeklyEmotionSummary` map | Weekly emotion aggregation |

---

### 4.11 `users/{uid}/ml_analysis/{docId}` (Legacy)

**Written by:** `addMlAnalysis()` — legacy path, not used in active ML pipeline.  
The active pipeline stores history in `mlAnalysisHistory` instead.

| Field | Type |
|---|---|
| `source_type` | `string` (`'journal' \| 'chat' \| 'feedback'`) |
| `source_id` | `string` |
| `emotion_detected` | `string` |
| `emotion_score` | `number` |
| `predicted_condition` | `string` |
| `confidence_score` | `number` |
| `status` | `string` (`'pending'`) |
| `created_at` | `Timestamp` |

---

### 4.12 `peer_groups/{groupId}`

**Written by:** Advisor portal / admin console. User app reads only (plus increments `memberCount`).

| Field | Type | Aliases also accepted |
|---|---|---|
| `group_name` | `string` | `name` |
| `group_description` | `string` | `description`, `topic` |
| `group_category` | `string` (GroupCategory) | `category` |
| `group_image_url` | `string \| undefined` | `imageUrl` |
| `memberCount` | `number` | `member_count` |
| `isActive` | `boolean` | Defaults to `true`; used in `fetchRecommendations()` filter |

---

### 4.13 `peer_groups/{groupId}/chatMessages/{msgId}`

**Written by:** `saveChatMessage()`.  
**Real-time:** `subscribeGroupMessages()` — `onSnapshot` ordered by `timestamp` asc.  
**Deleted by:** `deleteGroupMessage()` (user long-press own message).

| Field | Type | Description |
|---|---|---|
| `senderId` | `string` | Firebase UID of message sender |
| `senderName` | `string` | Display name at time of send |
| `text` | `string` | Message body |
| `timestamp` | `Timestamp` | Send time |
| `flagged` | `boolean` | `true` when CRISIS_KEYWORDS matched |
| `reviewStatus` | `string` | `'pending' \| 'approved' \| 'rejected' \| 'not_required'` |
| `reviewedBy` | `string \| null` | Advisor UID (set by advisor portal) |
| `reviewedAt` | `Timestamp \| null` | Review time (set by advisor portal) |
| `deletedByAdvisor` | `boolean` | When `true`, UI shows grey system notice |
| `hasPrivateThread` | `boolean` | When `true`, the sender's UI shows private thread box |

**CRISIS_KEYWORDS that trigger `flagged = true`:**
```
'hurt myself', 'end it', 'suicide', 'kill myself', 'self harm',
'want to die', 'no reason to live'
```

---

### 4.14 `peer_groups/{groupId}/chatMessages/{msgId}/privateThread/{threadMsgId}`

**Written by:** Advisor portal (opens thread, sends first message) + `sendPrivateThreadReply()` (user reply).  
**Real-time:** `subscribePrivateThread()` — `where('visibleTo', 'array-contains', userId)`.  
**Access control:** Only two principals receive each document: `[advisorId, userId]`.  
**Note:** No composite index for `array-contains + orderBy` — messages are sorted client-side after snapshot.

| Field | Type | Description |
|---|---|---|
| `senderId` | `string` | Firebase UID of sender |
| `senderName` | `string` | Display name |
| `senderRole` | `string` | `'user' \| 'advisor'` |
| `receiverId` | `string` | Firebase UID of recipient |
| `receiverName` | `string` | Recipient display name |
| `text` | `string` | Message content |
| `timestamp` | `Timestamp` | Send time |
| `isPrivate` | `boolean` | Always `true` |
| `threadType` | `string` | `'advisor_private_message' \| 'user_private_reply'` |
| `flaggedMessageRef` | `string` | Parent `chatMessages` doc ID |
| `visibleTo` | `string[]` | `[advisorId, userId]` — Firestore access control array |

---

### 4.15 `groupMembers/{groupId_userId}`

**Document ID pattern:** `{groupId}_{userId}` — compound key prevents duplicate joins.  
**Written by:** `joinPeerGroup()`. Deleted by `leavePeerGroup()`.  
**Queried by:** `fetchUserJoinedGroupIds()` — `where('userId', '==', userId)`.

| Field | Type |
|---|---|
| `groupId` | `string` |
| `userId` | `string` |
| `joinedAt` | `Timestamp` |

---

### 4.16 `advisorConnections/{connectionId}`

**Written by:** `connectToAdvisor()` (creates); advisor portal (updates status).  
**Real-time:** `listenToUserAdvisorConnections()`, `listenToAdvisorConnectionsWithNames()`.

**Status lifecycle:** `pending` → `accepted` → `approved` / `reviewed` / `closed`  
**Active statuses** (`pending`, `accepted`): block new connection requests to same advisor.  
**Terminal statuses** (`approved`, `reviewed`, `closed`): allow new connections.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Firebase UID of the user |
| `userName` | `string` | Decrypted display name at connect time |
| `userEmail` | `string` | User's email |
| `advisorId` | `string` | Advisor doc ID |
| `advisorName` | `string` | Advisor display name |
| `status` | `string` | `'pending' \| 'accepted' \| 'approved' \| 'reviewed' \| 'closed'` |
| `caseType` | `string` | Always `'critical_case'` |
| `reason` | `string` | `'User requested advisor support'` |
| `userMentalHealthCategory` | `string` | Snapshot of active category at connect time |
| `createdAt` | `Timestamp` (serverTimestamp) | |
| `updatedAt` | `Timestamp` (serverTimestamp) | Updated on each status change |
| `lastMessage` | `string` | Text of most recent chat message |
| `lastMessageSenderId` | `string` | UID of last message sender |
| `lastMessageAt` | `Timestamp` | Timestamp of last message |

---

### 4.17 `advisorConnections/{connectionId}/messages/{msgId}`

**Written by:** `sendUserAdvisorMessage()` (user), `sendAdvisorUserMessage()` (advisor).  
**Real-time:** `listenToAdvisorConnectionMessages()` — ordered by `createdAt` asc.

| Field | Type | Description |
|---|---|---|
| `senderId` | `string` | Firebase UID |
| `senderRole` | `string` | `'user' \| 'advisor'` |
| `receiverId` | `string` | Firebase UID |
| `messageText` | `string` | Message content |
| `messageType` | `string` | `'text'` (default) |
| `createdAt` | `Timestamp` (serverTimestamp) | |
| `isRead` | `boolean` | Default `false` |

---

### 4.18 `advisors/{advisorId}`

**Written by:** Admin/portal only. User app reads via `fetchAdvisors()`.

| Field | Type |
|---|---|
| `name` | `string` |
| `specialty` | `string` |
| `rating` | `number` (e.g., 4.8) |
| `availability` | `string` (e.g., `'Mon–Fri, 9am–5pm'`) |
| `imageUrl` | `string \| undefined` |
| `experience` | `string \| undefined` (e.g., `'8 years'`) |
| `sessions` | `string \| undefined` (e.g., `'1,200+'`) |
| `about` | `string \| undefined` (bio paragraph) |

---

### 4.19 `resources/{resourceId}`

**Written by:** Advisor portal / admin. User app reads via `fetchResources()` and `fetchResourcesByCategory()`.  
**Normalized by:** `mapResourceDoc()` — checks multiple field name aliases.

| Field | Type | Aliases checked |
|---|---|---|
| `title` | `string` | `resource_title` |
| `description` | `string` | `resource_description` |
| `category` | `string` | `resource_category` |
| `resource_type` | `string` (`'text' \| 'image'`) | `contentType`, `type` |
| `image_url` | `string` | `imageUrl`, `imageURL`, `url` |
| `resource` | `string` | `textContent`, `resource_content`, `content` |
| `isActive` | `boolean` | Defaults to `true` if absent |
| `author` | `string` | `postedBy`, `posted_by`, `advisorName`, `author_name`, `advisor_profile_name` |
| `authorInitials` | `string` | `author_initials` |
| `createdAt` | `Timestamp` | `created_at`, `timestamp` |

---

## 5. TypeScript Types Reference

All interfaces are in `src/types.ts`.

### User & Group

```typescript
interface User {
  id: string;           // Firebase UID
  name: string;         // Decrypted display name
  nickname?: string;
  email: string;
  age?: number;
  riskLevel?: 'low' | 'moderate' | 'severe';
}

type GroupCategory =
  | 'Severe Support'
  | 'Moderate Support'
  | 'Mild Support'
  | 'Wellness - Thriving'
  | 'Wellness - Stress Aware'
  | 'Wellness - Emotionally Aware'
  | 'Recovery & Improvement';

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  category: GroupCategory;
  image: any;    // require() result or { uri: string }
}
```

### Messages & Review Status

```typescript
type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'not_required';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'peer';
  senderId?: string;
  senderName?: string;
  timestamp: Date;
  flagged?: boolean;
  reviewStatus?: ReviewStatus;       // group chat messages only
  reviewedBy?: string | null;        // set by advisor portal
  reviewedAt?: Date | null;          // set by advisor portal
  deletedByAdvisor?: boolean;        // bubble replaced by system notice
  hasPrivateThread?: boolean;        // advisor opened private thread on this msg
}

interface PrivateThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'advisor';
  receiverId: string;
  receiverName: string;
  text: string;
  timestamp: Date;
  isPrivate: boolean;
  threadType: 'advisor_private_message' | 'user_private_reply';
  flaggedMessageRef: string;     // parent chatMessage ID
  visibleTo: string[];           // [advisorId, userId]
}
```

### Mental Health Profile

```typescript
interface MentalHealthRecommendationProfile {
  initialQuestionnaireScore: QuestionnaireScore | null;
  latestMlEmotionScore: MlEmotionScore | null;
  baselineRecommendationCategory: GroupCategory;
  activeRecommendationCategory: GroupCategory;
  recommendationSource: 'questionnaire' | 'ml_analysis' | 'advisor_approval';
  userStatus: 'normal' | 'under_review' | 'restricted';
  mlStabilityCounter: MlStabilityCounter | null;
  // Advisor fields
  advisorConnectionStatus?: string;
  approvedCategory?: GroupCategory;
  approvalMessageSeen?: boolean;
  // Recommendation categories
  peerGroupRecommendationCategory?: GroupCategory;  // weekly 7-day trend
  resourceRecommendationCategory?: GroupCategory;   // per-event real-time
  wellnessScore?: number;                           // 0–100
  restrictedReason?: string;
  restrictedAt?: Date;
  // KNN fields
  knnRecommendedGroup?: string;
  knnMappedCategory?: GroupCategory;
  knnProbabilities?: Record<string, number>;
  knnLastUpdatedAt?: Timestamp;
  knnSafetyFlag?: boolean;
  knnFallbackReason?: 'backend_unreachable' | string;
}

interface MlStabilityCounter {
  lastPrediction: string;
  repeatedCount: number;
  lastUpdatedAt: Date;
}
```

### DASS-21

```typescript
interface Dass21SubscaleResult {
  raw: number;       // sum of 7 items, 0–21
  final: number;     // raw × 2, 0–42 (clinical convention)
  severity: string;  // 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Extremely Severe'
  severityColor: string;
}

interface Dass21Result {
  answers: Record<number, number>;  // questionId → answer (0–3)
  depression: Dass21SubscaleResult;
  anxiety: Dass21SubscaleResult;
  stress: Dass21SubscaleResult;
  group: 1 | 2 | 3 | 4 | 5;        // 1=most severe
  groupCategory: GroupCategory;
  groupColor: string;
  message: string;
  ctaLabel: string;
  ctaVariant: 'danger' | 'primary' | 'warning' | 'success';
  reassessInDays: number;
  riskLevel: 'low' | 'moderate' | 'severe';
}
```

### KNN

```typescript
interface KnnInput {
  depression_score: number;     // DASS-21 depression final (0–42)
  anxiety_score: number;        // (0–42)
  stress_score: number;         // (0–42)
  dominant_emotion: string;     // from 7-day history: 'depression'|'anxiety'|'normal'
  emotion_confidence: number;   // average confidence (0–1)
}

interface WeeklyEmotionSummary {
  dominantEmotion: string;
  averageConfidence: number;
  totalRecords: number;
  emotionDistribution: { depression: number; anxiety: number; normal: number };
}
```

---

## 6. Services Layer

### 6.1 `firebaseConfig.ts`

Initializes Firebase with hot-reload safety (try/catch around `initializeApp`, checks `getApps().length`).

```
Firebase Project: mindmatesplus
API Key: AIzaSyB6xYQWNc6R246bMMnohCbaVe6VmaFCQy0
```

**`experimentalForceLongPolling: true`** — required for Android emulator and environments where WebSocket connections are unreliable.

Exports: `auth: Auth`, `db: Firestore`

---

### 6.2 `dataService.ts` — Core Engine (~2,574 lines)

All Firestore CRUD operations, real-time listeners, ML pipeline functions, recommendation logic, and category helpers.

#### Key Exported Constants

| Constant | Description |
|---|---|
| `COLORS` | Design token color map |
| `GROUP_CATEGORIES` | All 7 GroupCategory strings |
| `PEER_GROUPS` | Static fallback list of 7 groups |
| `DASS_QUESTIONS` | All 21 DASS items with subscale label |
| `DASS_OPTIONS` | Answer options (value 0–3 with human-readable labels) |
| `ML_RECOMMENDATION_ORDER` | 6-tier ordered array (Severe excluded) |
| `KNN_GROUP_TO_CATEGORY` | Maps KNN group IDs → GroupCategory |
| `ML_TO_PRIMARY_CATEGORY` | Maps BERT labels → GroupCategory |
| `ML_CATEGORY_MAP` | Maps BERT labels → user-facing strings |
| `WELLNESS_SCORE_MAP` | Maps GroupCategory → baseline wellness score |

#### Category Navigation Helpers

```
moveCategoryUp(category)      → one step toward higher support (worsening)
moveCategoryDown(category)    → one step toward wellness (improving)
moveOneLevelToward(current, target) → one step toward target
updateCategorySafely(current, suggested, count) → moves only when count ≥ 3
getCategoryLevel(category)    → index in ML_RECOMMENDATION_ORDER (–1 for Severe)
```

---

### 6.3 `geminiService.ts` — Groq AI Client

> **Note on filename:** Named `geminiService.ts` for historical reasons. Uses Groq SDK with LLaMA, not Google Gemini.

**Client:** `new Groq({ apiKey: EXPO_PUBLIC_GROQ_API_KEY, dangerouslyAllowBrowser: true })`  
**Model:** `llama-3.3-70b-versatile`

#### Three Exported Functions

**`sendSupportMessage(userText, dass21Result)`**
- Mindy persona, DASS-21 context in system prompt
- Rules: no diagnosis, 2–4 short sentences, warm/calm tone, crisis reminder for severe
- `max_tokens: 200` | `temperature: 0.7`
- Returns `null` on failure → caller uses `getRuleBasedReply()`

**`moderateContent(text)`**
- Strict JSON-only classifier: `{"safe": true}` or `{"safe": false, "reason": "..."}`
- `max_tokens: 120` | `temperature: 0` (deterministic)
- Groq primary → `localWordFilter` fallback
- Returns `{ safe, reason?, blockedBy?: 'gemini' | 'local' }`
- **Expressly allows** personal distress language

**`askQuestionDoubt(userDoubt, questionText, subscale, questionNum)`**
- Explains one DASS-21 question in plain language, with examples per answer option
- `max_tokens: 180` | `temperature: 0.5`
- Returns `null` on failure → UI shows static help text

---

### 6.4 `mlApiService.ts` — FastAPI HTTP Client

```
Base URL: http://10.0.2.2:8000   (Android emulator → host localhost)
```

```typescript
predictText(text)          → POST /predict
// Response: { prediction, confidence, probabilities: {depression, anxiety, normal} }

recommendGroups(payload)   → POST /recommend-groups
// Response: { recommended_group, description, probabilities, disclaimer }
```

Both functions throw on HTTP errors — callers handle with try/catch.

---

### 6.5 `wordFilter.ts` — Offline Fallback Filter

Called only when Groq API is unavailable. Runs two phases:

**Phase 1: Link/Contact Detection** (on raw text — preserves URL structure)
1. Explicit `http://` or `https://` URLs
2. `www.` prefix URLs
3. Bare domains with known TLDs (com, net, org, io, co, uk, lk, edu, gov, etc.)
4. IPv4 addresses (four dot-groups of 1–3 digits)
5. Email addresses (`user@domain.tld`)
6. Obfuscated protocols (`h t t p`, `h-t-t-p`, `h_t_t_p`)
7. Obfuscated dot notation (`example dot com`, `site [dot] org`)

**Phase 2: Profanity/Slur/Threat** (on leet-normalised text)
- Leet normalisation: `@→a`, `3→e`, `1!|→i`, `0→o`, `$→s`, runs of 3+ same chars collapsed to 2
- Strong profanity (f-word, s-word, b-word, c-word, etc.)
- Racial, ethnic, religious slurs
- Homophobic and transphobic slurs
- Direct threats (`kill yourself`, `kys`, `i will kill`, `i hate you`)

**Explicitly NOT flagged:** `"I want to die"`, `"Help, I can't sleep"` — distress language must reach support systems.

---

### 6.6 `encryption.ts` — Name Obfuscation

```typescript
encryptName(text)  → btoa(encodeURIComponent(text))
decryptName(enc)   → decodeURIComponent(atob(enc))  // fallback: returns raw if atob fails
```

Used to prevent plain-text names in Firebase Console / logs. Same encoding used for both `users/{uid}.name` (Firestore) and Firebase Auth `displayName`.

---

## 7. Context & Global State (AppContext)

**File:** `src/context/AppContext.tsx`  
**Usage:** `const { user, sendAiMessage, ... } = useApp();` — throws if called outside `AppProvider`

### All State Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `user` | `User \| null` | `null` | Current authenticated user |
| `authLoading` | `boolean` | `true` | Firebase auth initializing |
| `selectedGroup` | `Group \| null` | `null` | Currently selected peer group |
| `assessmentScore` | `number` | `0` | Legacy score field |
| `dass21Result` | `Dass21Result \| null` | `null` | Most recent DASS-21 result |
| `journalEntries` | `JournalEntry[]` | `[]` | All journal entries |
| `peerGroups` | `Group[]` | `[]` | All peer groups from Firestore |
| `groupsLoading` | `boolean` | `true` | Groups fetch in progress |
| `mentalHealthProfile` | `MentalHealthProfile \| null` | `null` | Legacy profile object |
| `joinedGroupIds` | `string[]` | `[]` | IDs of groups the user joined |
| `mlMentalHealthProfile` | `MlMentalHealthProfile \| null` | `null` | Journal-based ML profile |
| `recommendationProfile` | `MentalHealthRecommendationProfile \| null` | `null` | Full recommendation profile |
| `isRestricted` | `boolean` | derived | `isUserRestricted(recommendationProfile)` |
| `aiMessages` | `Message[]` | Mindy greeting | In-memory AI chat history |
| `showCrisisAlert` | `boolean` | `false` | Crisis modal visibility |
| `visitedGroupIds` | `string[]` | `[]` | In-memory visited group tracker |

### Four Core `useEffect` Listeners

#### 1. `onAuthStateChanged`
On sign-in, parallel-fetches:
- `fetchJournalEntries(uid)` → `journalEntries`
- `fetchPeerGroups()` → `peerGroups`
- `fetchUserJoinedGroupIds(uid)` → `joinedGroupIds`
- `fetchMentalHealthProfile(uid)` → `mentalHealthProfile`
- `getDoc(users/{uid})` → `nickname`

On sign-out: clears all state.

#### 2. `listenToMentalHealthProfile`
Real-time `onSnapshot` listener on `users/{uid}/mentalHealthProfile/currentProfile`.  
Updates `recommendationProfile` and derived `mlMentalHealthProfile`.  
Shows advisor approval modal when:
- `advisorConnectionStatus === 'accepted'`  
- `approvalMessageSeen !== true`

#### 3. `listenToAdvisorConnectionsWithNames`
Detects status transitions using `prevConnectionStatuses` ref. Shows notification when status becomes `'accepted'`.

#### 4. Weekly KNN Trigger
- Session-scoped `knnTriggeredRef` prevents multiple fires per app session
- Also enforced by 23-hour Firestore rate limit in `runWeeklyKnnRecommendation`
- Only fires when `recommendationProfile?.initialQuestionnaireScore` exists

### Key Context Methods

**`addJournalEntry(title, content, mood, mlAnalysis?)`**
1. `saveJournalEntry()` → Firestore
2. Checks for crisis keywords → `showCrisisAlert`
3. Background: `runMlAnalysisForText(userId, content, 'journal')`
4. `updateMlMentalHealthProfile(userId, entries)` — recalculates dominant emotion

**`sendAiMessage(text)`**
1. Appends user message to `aiMessages`
2. `saveAiChatMessage(userId, text)` → Firestore
3. `sendSupportMessage(text, dass21Result)` (Groq) or `getRuleBasedReply()` fallback
4. Appends AI response
5. Background: `runMlAnalysisForText(userId, text, 'ai_chat')`

**`sendGroupMessage(groupId, text)`**
1. `saveChatMessage(groupId, senderId, senderName, text)` — crisis keyword flagging
2. Background: `runMlAnalysisForText(userId, text, 'group_chat')`

**`getRuleBasedReply(text, dass21Result)`** — Keyword-based chatbot fallback:
- `severe` riskLevel → safety-first reply
- breath/anxious/panic → 4-4-6 breathing exercise
- sad/down/hopeless → gentle activation steps
- plan/routine → mini 3-step action plan
- `moderate` riskLevel → check-in response
- Default → acknowledge + breathing offer

---

## 8. Navigation Architecture

### Route & Param Types

```typescript
type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  ForgotPassword: undefined;
  RecoverPassword: undefined;
  Questionnaire: undefined;
  Result: undefined;
  Advisor: undefined;
  ConsultAdvisor: undefined;
  AdvisorDetails: { advisor: Advisor };
  AdvisorChat: { advisor: Advisor };
  Main: undefined;
  GroupChat: { groupId: string; groupName: string };
  Feedback: undefined;
  WellnessGoals: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Groups: undefined;
  AIChat: undefined;
  Journal: undefined;
  Profile: undefined;
};
```

### Navigator Tree

```
NavigationContainer (ref: navigationRef)
└── RootStack.Navigator (headerShown: false on all)
    ├── Splash            → SplashScreen (2500ms → Auth)
    ├── Auth              → AuthScreen (login + register)
    ├── ForgotPassword    → ForgotPasswordScreen
    ├── RecoverPassword   → RecoverPasswordScreen (UI-only, no Firebase integration yet)
    ├── Questionnaire     → QuestionnaireScreen
    ├── Result            → ResultScreen
    ├── Advisor           → AdvisorScreen (browse advisors)
    ├── ConsultAdvisor    → ConsultAdvisorScreen (connect to advisor)
    ├── AdvisorDetails    → AdvisorDetailsScreen {advisor}
    ├── AdvisorChat       → AdvisorChatScreen {advisor}
    ├── Main              → MainTabs (BottomTab Navigator)
    │   ├── Home          → HomeScreen
    │   ├── Groups        → GroupsScreen
    │   ├── AIChat        → ChatScreen (AI mode, label: 'AI Chat')
    │   ├── Journal       → JournalScreen
    │   └── Profile       → ProfileScreen
    ├── GroupChat         → ChatScreen (group mode, {groupId, groupName})
    ├── Feedback          → FeedbackScreen
    └── WellnessGoals     → WellnessGoalsScreen
```

### Crisis Alert Modal

Rendered inside `MainTabs` component (not a route) as a React Native `Modal`.  
Triggered by `showCrisisAlert` from AppContext.

```
Red overlay with two buttons:
  "Connect with Advisor" → setShowCrisisAlert(false) + navigate('ConsultAdvisor')
  "I'm okay now"         → setShowCrisisAlert(false)
```

---

## 9. Screens — Complete Reference

### 9.1 SplashScreen

**Route:** `Splash`

Logo + tagline fade-in + scale animation (800ms). After 2500ms: `navigation.replace('Auth')`.  
Background: `#EAF1FF` (light blue).

---

### 9.2 AuthScreen

**Route:** `Auth` | **Mode:** Login ↔ Register toggle (same component)

**Login flow:**
1. `login(email, password)` → Firebase `signInWithEmailAndPassword`
2. Check if `users/{uid}/mentalHealthProfile/currentProfile` exists
3. Route to `Main` (has profile) or `Questionnaire` (no profile)

**Register flow:**
1. Validates: all fields filled, nickname ≠ full name, passwords match, age 10–100
2. Requires privacy policy checkbox
3. `register(email, password, name)` → `createUserWithEmailAndPassword` + `updateProfile`
4. `setDoc(users/{uid}, { name: encryptedName, nickname, email, gender, age, dob, createdAt })`
5. Navigate to `Questionnaire`

**Date of Birth picker:** Custom `DropdownPicker` component (Year/Month/Day selectors).
- Year range: 1960 to (currentYear - 10)
- Day count dynamically adjusts when year/month changes
- `scrollToValue: 2000` preset for year dropdown

**Firebase error code → user message mappings:**
- `auth/email-already-in-use` → "An account with this email already exists."
- `auth/invalid-email` → "Please enter a valid email address."
- `auth/weak-password` → "Password must be at least 6 characters."
- `auth/user-not-found` → "No account found with this email."
- `auth/wrong-password` / `auth/invalid-credential` → "Incorrect email or password."
- `auth/too-many-requests` → "Too many attempts. Please try again later."
- `auth/network-request-failed` → "Network error. Please check your connection."

---

### 9.3 ForgotPasswordScreen

**Route:** `ForgotPassword`

Sends Firebase password reset email (`sendPasswordResetEmail`).  
Two states: form → success card.  
Success card: "Check Your Inbox" + button to `RecoverPassword`.

---

### 9.4 RecoverPasswordScreen

**Route:** `RecoverPassword`

**⚠️ Incomplete implementation:** The `handleReset()` function simulates a 1200ms delay and shows a success state, but **does not call any Firebase API** to actually reset the password. The reset code from the email is not validated or applied. This is a UI stub.

---

### 9.5 QuestionnaireScreen

**Route:** `Questionnaire`

DASS-21 assessment with animated progress bar, auto-advance on answer selection, and floating Mindy chatbot assistant.

**Flow:**
1. 21 questions in animated sequence
2. Selecting an answer auto-advances after a brief delay
3. Floating chatbot button → opens doubt panel for the current question
4. Doubt panel: user types question → `askQuestionDoubt()` → Groq clarification
5. Submit: `computeDass21Result(answers)` → `setDass21Result(result)`
6. Saves: `saveQuestionnaireResponse(userId, result)` + `updateQuestionnaireProfile(userId, result)`
7. Navigate to `Result`

---

### 9.6 ResultScreen

**Route:** `Result` | **Input:** `dass21Result` from AppContext

**Layout:**
- Status icon (alert/info/checkmark, color based on group 1–2/3/4–5)
- Three `SubscaleCard` components: Depression / Anxiety / Stress
- `groupCategory` badge with `groupColor` background
- Personalized `message` text
- "We'll check in again in N days" note
- CTA Button (variant: danger/warning/success matching risk)

**Navigation on CTA:**
- `riskLevel === 'severe'` → `ConsultAdvisor`
- Otherwise → `Main`
- Also updates `user.riskLevel` in local state

---

### 9.7 HomeScreen

**Route:** `Home` (tab)

**Group Recommendation Priority Chain** (first non-null wins):
1. `profile.peerGroupRecommendationCategory` — 7-day weekly ML trend
2. `profile.knnMappedCategory` — KNN model output
3. `profile.baselineRecommendationCategory` — DASS-21 baseline
4. `ML_TO_PRIMARY_CATEGORY[mlInsight.dominantCategory]` — BERT fallback

**Wellness Score Card:** Progress bar showing `wellnessScore`, active category label, score percentage.

**Advisor Approval Modal:**  
Shown when `profile.advisorConnectionStatus === 'accepted'` AND `profile.approvalMessageSeen !== true`.  
On "Continue to App": `continueAfterAdvisorApproval(userId)` sets `approvalMessageSeen: true`.

**Restriction Banner:**  
`isRestricted === true` → shows "Account Paused" full-width banner, group buttons disabled.

**Resource Feed:**  
Two tabs (Image / Text). Calls `fetchResourcesByCategory(active, baseline)`.

---

### 9.8 GroupsScreen

**Route:** `Groups` (tab)

Shows only groups in `joinedGroupIds`.  
Unvisited badge: count of groups not in `visitedGroupIds` (in-memory, clears on restart).  
Restriction: if `isRestricted`, shows "Peer Groups Paused" card — no group openable.

**On group tap:**
1. `markGroupAsVisited(groupId)` (updates in-memory `visitedGroupIds`)
2. `navigation.navigate('GroupChat', { groupId, groupName })`

---

### 9.9 ChatScreen (Dual-Mode)

**Routes:** `AIChat` (tab, AI mode) + `GroupChat` (stack, group mode)

#### AI Chat Mode
- Uses `aiMessages` from AppContext
- `sendAiMessage(text)` via context
- Moderation before send
- Message alignment: user right (blue), AI left (purple Mindy avatar)

#### Group Chat Mode (when `route.name === 'GroupChat'`)
Real-time `subscribeGroupMessages(groupId)` listener.

**Message rendering rules:**

| Condition | UI Treatment |
|---|---|
| `deletedByAdvisor: true` | Grey italic system notice: "This message was removed by an advisor" |
| `flagged + reviewStatus === 'pending'` | Yellow "Under Review" badge on message |
| `reviewStatus === 'approved'` | Green "Verified" badge on message |
| `reviewStatus === 'rejected'` | Message completely hidden |
| `hasPrivateThread: true` (own messages) | Purple inline "Private Reply" box below message |

**Private thread UI (inline, not a separate screen):**
- Subscribes via `subscribePrivateThread(groupId, msgId, userId)`
- Shows thread messages in purple bubbles
- Reply input: `sendPrivateThreadReply()` writes to `privateThread` subcollection

**Long-press (own messages):** Shows delete option → `deleteGroupMessage(groupId, msgId)`.

**Moderation:** `moderateContent(text)` runs before every send; unsafe → error toast, message not sent.

---

### 9.10 JournalScreen

**Route:** `Journal` (tab)

**Write flow:**
1. User enters title, content, selects mood
2. `moderateContent(content)` → block if unsafe
3. `addJournalEntry(title, content, mood)` → Firestore save
4. `predictText(content)` → BERT result for `mlAnalysis` field
5. `runMlAnalysisForText(userId, content, 'journal')` → full ML pipeline (background)

**AI Emotion Insight card:**  
Dominant emotion badge (colored), confidence %, risk level, probability breakdown (dep/anx/nor %), last updated.

---

### 9.11 ProfileScreen

**Route:** `Profile` (tab)

**Header section:** Circle avatar (Ionicons person), `user.name (nickname)`, email, risk level badge.

**Settings list (3 items):**
- Notifications — stub, no action
- Wellness Goals — navigate to `WellnessGoals`
- Feedback — navigate to `Feedback`

**`[DEV]` KNN Test button:** Visible only in `__DEV__` mode. Calls `callKnnAndWriteResult(user.id)` and shows an alert with the result.

**Sign Out:** `setUser(null)` → `navigation.getParent().replace('Auth')`

---

### 9.12 ConsultAdvisorScreen

**Route:** `ConsultAdvisor`

Fetches `advisors` collection on mount. Real-time `listenToUserAdvisorConnections(userId)` for status map.

**Button states:**

| Status in `connections[advisor.id]` | Label | Enabled |
|---|---|---|
| none | Connect | Yes |
| `pending` | Pending | No |
| `accepted` | Connected | Yes → navigate to AdvisorDetails |
| `approved` / `reviewed` / `closed` | Connect | Yes (new connection allowed) |

**"Previously approved" banner:** Shown when `connections[advisor.id] === 'approved'`.

**Connect action:** `connectToAdvisor(userId, userName, userEmail, advisor)`.

---

### 9.13 AdvisorDetailsScreen

**Route:** `AdvisorDetails` | **Param:** `advisor: Advisor`

Avatar with fallback by specialty:
- Mental Health / Psychology → `group_image4.jpeg`
- Counseling / Therapy → `group_image5.png`
- Default → `group_image1.jpg`

Shows: specialty badge, stats row (EXP / RATING / SESSIONS), "About" paragraph, availability.

**"Chat" button:** → `navigation.navigate('AdvisorChat', { advisor })`

---

### 9.14 AdvisorChatScreen

**Route:** `AdvisorChat` | **Param:** `advisor: Advisor`

**On mount:**
1. `findAdvisorConnection(userId, advisorId)` — active connection query
2. If found: `listenToAdvisorConnectionMessages(connectionId)` — real-time messages

**Status banners:**
- `pending` → "Connection Request Sent — Awaiting advisor acceptance" (blue)
- `accepted` → No banner — chat fully open
- Otherwise → "Chat not available" (grey)

**Input lock:** Disabled when `connectionStatus !== 'accepted'`. Read-only bar shown instead.

**Send:** `sendUserAdvisorMessage(connectionId, userId, advisorId, text)` — also updates `lastMessage` on connection doc.

---

### 9.15 AdvisorScreen

**Route:** `Advisor`

General advisor listing for browsing. Fetches `advisors` collection. Navigates to `AdvisorDetails` on tap. Different from `ConsultAdvisor` — no connection intent.

---

### 9.16 FeedbackScreen

**Route:** `Feedback`

**Fields:**
- Star rating 1–5 (required — submit button disabled until rated)
- Peer group comment (required text area)
- App feedback comment (required text area)

**Submit:** `submitFeedback(rating, peerComment, appComment)` → `users/{uid}/feedback` → navigate to Profile tab.

---

### 9.17 WellnessGoalsScreen

**Route:** `WellnessGoals`

Two real-time subscriptions:
1. `subscribeToMlMentalHealthProfile(userId)` → `mlMentalHealthProfile`
2. `listenToMentalHealthProfile(userId)` → `recommendationProfile`

**Displays:**
- Wellness score percentage with color-coded ring/bar
- Active category from `recommendationProfile.activeRecommendationCategory`
- Latest emotion badge from `mlMentalHealthProfile.latestPrediction`
- Dominant pattern from `mlMentalHealthProfile.dominantCategory`
- Prediction counts: depression / anxiety / normal
- Last updated timestamp

---

## 10. UI Components

**File:** `src/components/UI.tsx`

### Button

Variants with full color spec:

| Variant | Background | Text Color |
|---|---|---|
| `primary` | `#0B1F5B` (navy) | white |
| `secondary` | `#7879F1` (light indigo) | white |
| `danger` | `#EF4444` (red) | white |
| `ghost` | transparent | `#5D5FEF` (indigo) |
| `outline` | transparent + `#5D5FEF` border (2px) | `#5D5FEF` |
| `warning` | `#FB8C00` (orange) | white |
| `success` | `#43A047` (green) | white |

Base style: `paddingHorizontal: 24`, `paddingVertical: 14`, `borderRadius: 16`.  
Disabled: `opacity: 0.5`.  
Children: string → `<Text>`, mixed → `<View style={buttonRow}>` with mapped Text for strings.

### Card

White background, `borderRadius: 24`, `elevation: 3`, light shadow.  
With `onPress` → `TouchableOpacity (activeOpacity: 0.9)`.  
Without `onPress` → plain `View`.

### Input

| Prop | Behavior |
|---|---|
| `type: 'password'` | Secure text entry + eye toggle icon |
| `type: 'email'` | `keyboardType: 'email-address'`, `autoCapitalize: 'none'` |
| `type: 'textarea'` | Multiline, 5 lines, `minHeight: 120`, `textAlignVertical: 'top'` |
| `type: 'number'` | `keyboardType: 'numeric'` |
| `editable: false` | Read-only appearance |

Background: `rgba(219, 234, 254, 0.3)` (light blue tint), border: `#BFDBFE`.

---

## 11. DASS-21 Assessment Engine

### Subscale → Question Mapping

| Subscale | Question IDs |
|---|---|
| Depression | 3, 5, 10, 13, 16, 17, 21 |
| Anxiety | 2, 4, 7, 9, 15, 19, 20 |
| Stress | 1, 6, 8, 11, 12, 14, 18 |

### Scoring Formula

```
raw  = sum of 7 item scores (each 0–3), range: 0–21
final = raw × 2, range: 0–42   (clinical DASS-21 convention)
```

### Severity Thresholds (final scores)

**Depression:**
| Score | Severity | Color |
|---|---|---|
| 0–9 | Normal | `#43A047` |
| 10–13 | Mild | `#F9A825` |
| 14–20 | Moderate | `#FB8C00` |
| 21–27 | Severe | `#E53935` |
| 28+ | Extremely Severe | `#B71C1C` |

**Anxiety:**
| Score | Severity |
|---|---|
| 0–7 | Normal |
| 8–9 | Mild |
| 10–14 | Moderate |
| 15–19 | Severe |
| 20+ | Extremely Severe |

**Stress:**
| Score | Severity |
|---|---|
| 0–14 | Normal |
| 15–18 | Mild |
| 19–25 | Moderate |
| 26–33 | Severe |
| 34+ | Extremely Severe |

### Group Assignment (`computeDass21Result`)

| Condition | Group | GroupCategory | Risk | Reassess |
|---|---|---|---|---|
| Any "Extremely Severe" | 1 | Severe Support | severe | 14 days |
| Any "Severe" (none Ext.Sev.) | 2 | Severe Support | severe | 14 days |
| Any "Moderate" | 3 | Moderate Support | moderate | 30 days |
| Any "Mild" | 4 | Mild Support | low | 60 days |
| All "Normal", stress dominant | 5 | Wellness - Stress Aware | low | 90 days |
| All "Normal", anxiety/dep > 0 | 5 | Wellness - Emotionally Aware | low | 90 days |
| All "Normal", all zero | 5 | Wellness - Thriving | low | 90 days |

---

## 12. ML Pipelines

### 12.1 Per-Event BERT Pipeline (`runMlAnalysisForText`)

**Triggered by:** Journal save, group chat send, AI chat send.

```
text (trimmed, ≥3 chars)
  ↓
POST /predict  →  { prediction, confidence, probabilities }
  ↓  [all 4 run in parallel via Promise.all]
  ├─ updateMentalHealthProfileFromMl()     → writes latestMlEmotionScore,
  │                                           applies ML stability rules to activeRecommendationCategory
  ├─ updateResourceRecommendationFromLatestMl()  → writes resourceRecommendationCategory (fast-moving)
  ├─ updateWellnessScoreGradually()        → adjusts wellnessScore ±1-4 pts
  │                                           triggers restriction if score < 10
  └─ saveMlAnalysisHistory()               → appends to mlAnalysisHistory subcollection
  ↓
  calculateWeeklyMlTrend()    → reads 7-day history, may update peerGroupRecommendationCategory
  ↓
  callKnnAndWriteResult()     → POST /recommend-groups, writes knn* fields to profile
```

### 12.2 ML Stability Rules

**Purpose:** Prevents rapid category thrashing from individual ML predictions.

**Threshold:** `confidence >= 0.80` required for any category transition.

**Counter mechanics:**
```
if same prediction as lastPrediction:
  repeatedCount++
else:
  repeatedCount = 1

if repeatedCount >= 3:
  move category one step toward ML-suggested category
  reset repeatedCount to 0

if confidence < 0.80:
  no counter increment
  reset activeRecommendationCategory to baseline
  set recommendationSource = 'questionnaire'
```

**ML prediction → target category:**
| Prediction | Target (suggested) GroupCategory |
|---|---|
| `normal` | Wellness - Thriving |
| `depression` | Moderate Support |
| `anxiety` | Moderate Support |

**Special case — Severe baseline (`baselineRecommendationCategory === 'Severe Support'`):**
- Category is never auto-changed by ML
- ML instead sets `userStatus = 'under_review'`
- Category can only change via advisor portal intervention

### 12.3 Weekly ML Trend Pipeline (`calculateWeeklyMlTrend`)

**Triggered by:** Every call to `runMlAnalysisForText` (after per-event pipeline).  
**Purpose:** Drives `peerGroupRecommendationCategory` (more stable than per-event ML).

```
Query: mlAnalysisHistory where createdAt >= 7 days ago
Filter: confidence >= 0.80
Count depression / anxiety / normal occurrences
Determine dominant prediction

Requirements to move peerGroupRecommendationCategory:
  validRecordCount >= 5   AND   dominantCount >= 3
  → move one step toward suggestedPeerGroupCategory

Always persists weeklyTrendSummary map to profile.
```

### 12.4 Text Batch Collection for ML

`collectUserMlTextBatch(userId)` aggregates:
1. Last 5 journal entries — title + content joined
2. Last 10 group chat messages the user sent (across all joined groups)
3. Last 10 AI chat messages the user sent (sender === 'user' only)

Combined into one string for a single `/predict` call.

---

## 13. Content Moderation Pipeline

Applied before every user text is saved to Firestore.

```
text
  ↓
[Groq Available?]
  YES → POST llama-3.3-70b with MODERATION_PROMPT
          Response: {"safe": true}            → ALLOW
          Response: {"safe": false, "reason"} → BLOCK (blockedBy: 'gemini')
  NO  → localWordFilter(text)
          flagged: false                       → ALLOW
          flagged: true                        → BLOCK (blockedBy: 'local')
```

**Groq MODERATION_PROMPT categories:**
1. Hate speech & slurs (racial, ethnic, religious, national, homophobic, transphobic, gender-based)
2. Profanity & sexually explicit language
3. Threats, harassment, doxxing, blackmail
4. Harmful content (self-harm instructions, violence glorification, graphic descriptions)
5. Links & external contact (URLs, domains, IPs, emails, obfuscated variants like "dot" notation)

**IMPORTANT — Explicitly ALLOWED by Groq prompt:**  
Expressions of personal distress: `"I feel like hurting myself"`, `"I want to die"`, `"I feel hopeless"` — these must pass through so users receive support.

---

## 14. KNN Recommendation Pipeline

### 5-Feature Input Vector

```typescript
{
  depression_score: number,    // DASS-21 depression ×2 (0–42)
  anxiety_score: number,       // DASS-21 anxiety ×2 (0–42)
  stress_score: number,        // DASS-21 stress ×2 (0–42)
  dominant_emotion: string,    // 7-day dominant BERT label
  emotion_confidence: number,  // average confidence for dominant emotion
}
```

### KNN Group ID → GroupCategory Mapping

| KNN Group ID | GroupCategory | Notes |
|---|---|---|
| `G1_Crisis_Peer_Support` | ⚠️ **SAFETY FLAG** | Never auto-assigned — sets `knnSafetyFlag: true` only |
| `G2_Academic_Burnout` | Moderate Support | |
| `G3_Social_Isolation` | Moderate Support | |
| `G4_Anxiety_Management` | Mild Support | |
| `G5_Study_Buddy` | Wellness - Stress Aware | |
| `G6_General_Wellness` | Wellness - Thriving | |
| `G7_Recovery_Resilience` | Recovery & Improvement | |
| `G8_Depression_Support` | Moderate Support | |

### Guards Before KNN Runs

- `initialQuestionnaireScore` must be present (questionnaire completed)
- `userStatus` must be `'normal'` (not `under_review` or `restricted`)

### Fallback When Backend Unreachable

```typescript
// Written when /recommend-groups POST fails:
knnRecommendedGroup: 'FALLBACK_QUESTIONNAIRE',
knnMappedCategory: mapDassScoreToFallbackCategory(initialQuestionnaireScore),
knnFallbackReason: 'backend_unreachable',

// mapDassScoreToFallbackCategory logic:
max(dep, anx, str) >= 21  → Severe Support
                  >= 14  → Moderate Support
                  >= 10  → Mild Support
                  else   → Wellness - Thriving
```

---

## 15. Advisor System

### Connection Request Lifecycle

```
User taps "Connect" on ConsultAdvisorScreen
  → connectToAdvisor():
      - Creates advisorConnections/{id} (status: 'pending')
      - Updates mentalHealthProfile:
          connectedAdvisorId, advisorConnectionId,
          advisorConnectionStatus: 'pending',
          userStatus: 'under_review'

Advisor portal accepts:
  → advisorConnections.status → 'accepted'
  → May update mentalHealthProfile.approvedCategory

AppContext detects status change to 'accepted':
  → Shows advisor approval modal (one-time, guarded by approvalMessageSeen)

User acknowledges approval modal:
  → continueAfterAdvisorApproval() sets:
      approvalMessageSeen: true, approvalMessageSeenAt: Timestamp

Advisor can additionally:
  → Hard-delete group chat messages (sets deletedByAdvisor: true on chatMessage)
  → Open private thread on flagged message (sets hasPrivateThread: true)
  → Send private thread messages (threadType: 'advisor_private_message')
  → Update recommendationCategory fields on user's profile
  → Move status to 'reviewed' or 'closed'
```

### Advisor Chat

- `findAdvisorConnection(userId, advisorId)` — finds active connection (status in/pending/accepted)
- `listenToAdvisorConnectionMessages(connectionId)` — real-time message stream
- Chat locked when `status !== 'accepted'`

### Private Thread Access Model

`visibleTo: [advisorId, userId]` array field + Firestore `where('visibleTo', 'array-contains', userId)` query.  
Other group members who view the parent message cannot subscribe to the private thread subcollection.  
Server-side enforcement depends on Firestore Security Rules (managed by the advisor portal project).

---

## 16. Wellness Score System

### Baseline Scores by Category

| GroupCategory | Baseline Score |
|---|---|
| Wellness - Thriving | 100 |
| Wellness - Stress Aware | 85 |
| Wellness - Emotionally Aware | 75 |
| Recovery & Improvement | 65 |
| Mild Support | 50 |
| Moderate Support | 35 |
| Severe Support | 20 |

### Adjustment per ML Event

```
ML adjustment (requires confidence >= 0.80):
  prediction = 'normal'     → +2
  prediction = 'anxiety'    → -1
  prediction = 'depression' → -1
  confidence < 0.80         → 0

Keyword adjustment (independent of confidence):
  positive keywords found   → +2
  negative keywords found   → -1
  (both possible in same text: -1 + 2 = +1)

Total per event: range -2 to +4 (clamped to 0–100)
```

**Positive keywords:** `happy, good, better, calm, grateful, relaxed, excited, hopeful, peaceful`  
**Negative keywords:** `sad, stressed, anxious, angry, tired, lonely, worried, depressed, upset`

### Restriction Trigger

```
if wellnessScore < 10:
  applyLowWellnessRestriction():
    userStatus:          'restricted'
    restrictedReason:    'Low wellness score detected'
    restrictedAt:        serverTimestamp()
    recommendationSource: 'safety_restriction'
```

`isUserRestricted(profile)`:
```typescript
profile.userStatus === 'restricted'
  OR
(typeof profile.wellnessScore === 'number' && profile.wellnessScore < 10)
```

---

## 17. Peer Group Chat System

### Message Send Flow

```
User types → Send pressed
  ↓
moderateContent(text)         [Groq + localWordFilter fallback]
  ↓ if unsafe → show error toast, stop
  ↓ if safe:
saveChatMessage(groupId, senderId, senderName, text)
  - localCrisisKeywordCheck → flagged + reviewStatus
  - writes to Firestore
  ↓
runMlAnalysisForText(userId, text, 'group_chat')  [background, no await]
```

### Message Rendering Decision Tree

| Check | Rendering |
|---|---|
| `deletedByAdvisor === true` | Grey italic system text: "This message was removed by an advisor" |
| `flagged && reviewStatus === 'pending'` | Message + yellow badge: "⏳ Under Review" |
| `reviewStatus === 'approved'` | Message + green badge: "✅ Verified" |
| `reviewStatus === 'rejected'` | Completely hidden (not rendered) |
| `hasPrivateThread && senderId === currentUserId` | Normal bubble + purple inline thread box below |
| Default | Normal chat bubble |

### Private Thread Inline UI

- Only shown to the **message sender** (`senderId === currentUser.id`)
- Thread messages shown in purple-tinted bubbles
- Reply input at bottom of thread box
- `sendPrivateThreadReply()` → writes to `privateThread` subcollection with `visibleTo: [advisorId, userId]`

---

## 18. Recommendation Category System

### 7-Tier Hierarchy (Most → Least Support Need)

```
1. Severe Support              (DASS-21 severe/extremely severe; ML ceiling)
2. Moderate Support            (DASS-21 moderate; ML: depression/anxiety)
3. Mild Support                (DASS-21 mild; KNN: anxiety management)
4. Recovery & Improvement      (KNN: recovery/resilience)
5. Wellness - Emotionally Aware (DASS-21 normal + some dep/anx signal)
6. Wellness - Stress Aware      (DASS-21 normal + stress; KNN: study buddy)
7. Wellness - Thriving          (All normal, zero scores; ML: normal prediction)
```

### ML_RECOMMENDATION_ORDER (6-tier, Severe excluded)

```typescript
[
  'Wellness - Thriving',           // index 0 — lowest support need
  'Wellness - Stress Aware',       // index 1
  'Wellness - Emotionally Aware',  // index 2
  'Recovery & Improvement',        // index 3
  'Mild Support',                  // index 4
  'Moderate Support',              // index 5 — ML ceiling
]
```

`Severe Support` is never in this array — ML cannot auto-assign it. It is only set by the initial questionnaire baseline.

### BERT Label → GroupCategory (`ML_TO_PRIMARY_CATEGORY`)

| BERT label | GroupCategory |
|---|---|
| `depression` | Moderate Support |
| `anxiety` | Wellness - Stress Aware |
| `normal` | Wellness - Thriving |

### Dashboard Category Priority (`getDashboardCategory`)

```typescript
profile.peerGroupRecommendationCategory    // 1st: stable 7-day trend
  ?? profile.baselineRecommendationCategory // 2nd: DASS-21 baseline
  ?? profile.activeRecommendationCategory   // 3rd: per-event ML
```

### HomeScreen Priority Chain (most specific → least)

```
peerGroupRecommendationCategory  (weekly 7-day ML trend)
→ knnMappedCategory               (KNN model)
→ baselineRecommendationCategory  (DASS-21)
→ ML_TO_PRIMARY_CATEGORY[mlInsight.dominantCategory]  (BERT fallback)
```

### Fallback Group Categories (`RELATED_CATEGORIES`)

When no Firestore groups exist for the exact category:
```
Severe Support         → [Moderate Support]
Moderate Support       → [Mild Support]
Mild Support           → [Recovery & Improvement, Moderate Support]
Recovery & Improvement → [Wellness - Emotionally Aware, Mild Support]
Wellness - Emotionally Aware → [Wellness - Stress Aware, Recovery & Improvement]
Wellness - Stress Aware → [Wellness - Thriving, Wellness - Emotionally Aware]
Wellness - Thriving    → [Wellness - Stress Aware]
```

---

## 19. Authentication & Security

### Firebase Auth

- **Method:** Email/password only (no OAuth)
- **Persistence:** `AsyncStorage` — sessions survive app close/restart
- **Hot-reload safety:** `getApps().length === 0` guard before `initializeApp`

### Name Obfuscation

**Why:** Prevents plain-text PII in Firebase Console and server logs.  
**How:** `btoa(encodeURIComponent(name))` — URL-encodes Unicode, then base64  
**Stored in:**
- `users/{uid}.name` (Firestore)
- Firebase Auth `displayName`

**Decoding:** `decodeURIComponent(atob(encoded))` — with try/catch fallback for legacy accounts with plain-text names.

### Content Moderation as Write Gate

`moderateContent()` is called before every Firestore write of user-generated text. Unsafe text is blocked at the app layer before it reaches Firestore.

### Private Thread Security Model

- `visibleTo: [advisorId, userId]` array stored on each private thread document
- App-layer query: `where('visibleTo', 'array-contains', userId)`  
- Server-layer: Firestore Security Rules (managed by advisor portal project) must enforce that only listed principals can read/write

---

## 20. Color System & Design Tokens

**Source:** `COLORS` object exported from `dataService.ts`.

```typescript
COLORS = {
  primary:     '#0B1F5B',                    // deep navy (primary buttons, headers)
  accent:      '#5D5FEF',                    // indigo (links, active states, badges)
  accentLight: '#7879F1',                    // lighter indigo (secondary buttons)
  background:  '#F8F9FF',                    // near-white blue-tint (all screen backgrounds)
  white:       '#FFFFFF',                    // card backgrounds
  text:        '#1A1A1A',                    // primary body text
  muted:       '#6E6E6E',                    // secondary text, placeholders, icons
  border:      '#EEF2FF',                    // tab bar, dividers
  cardBorder:  'rgba(219, 234, 254, 0.5)',   // card border
  success:     '#4ADE80',                    // green (positive outcomes)
  warning:     '#FACC15',                    // amber (moderate states)
  danger:      '#F87171',                    // red (errors, restricted)
}
```

**DASS-21 severity colors:**
| Severity | Color |
|---|---|
| Normal | `#43A047` (green) |
| Mild | `#F9A825` (amber) |
| Moderate | `#FB8C00` (orange) |
| Severe | `#E53935` (red) |
| Extremely Severe | `#B71C1C` (dark red) |

---

## Appendix A: Static Peer Groups

`PEER_GROUPS` constant in `dataService.ts` — used as fallback if Firestore is unavailable:

| ID | Name | Category |
|---|---|---|
| 1 | Crisis Support Circle | Severe Support |
| 2 | Steady Steps | Moderate Support |
| 3 | Gentle Progress | Mild Support |
| 4 | Thriving Together | Wellness - Thriving |
| 5 | Stress Busters | Wellness - Stress Aware |
| 6 | Emotionally Aware | Wellness - Emotionally Aware |
| 7 | Recovery & Growth | Recovery & Improvement |

**Image map** (`GROUP_IMAGE_MAP`):
- Severe Support → `group_image4.jpeg`
- Moderate Support → `group_image1.jpg`
- Mild Support → `group_image5.png`
- Wellness - Thriving → `group_image3.png`
- Wellness - Stress Aware → `group_image5.png`
- Wellness - Emotionally Aware → `group_image1.jpg`
- Recovery & Improvement → `group_image3.png`

---

## Appendix B: Complete Function Export Index

### `dataService.ts`

| Function | Category |
|---|---|
| `saveJournalEntry` | Journal |
| `fetchJournalEntries` | Journal |
| `deleteJournalEntry` | Journal |
| `saveFeedback` | Feedback |
| `fetchPeerGroups` | Groups |
| `fetchUserJoinedGroupIds` | Groups |
| `joinPeerGroup` | Groups |
| `leavePeerGroup` | Groups |
| `saveMentalHealthProfile` | Profile (legacy) |
| `fetchMentalHealthProfile` | Profile |
| `saveQuestionnaireResponse` | Questionnaire |
| `addMlAnalysis` | ML (legacy) |
| `getRecommendedGroups` | Recommendations |
| `computeDass21Result` | DASS-21 |
| `saveChatMessage` | Chat |
| `subscribeGroupMessages` | Chat |
| `deleteGroupMessage` | Chat |
| `subscribePrivateThread` | Chat |
| `sendPrivateThreadReply` | Chat |
| `fetchAdvisors` | Advisors |
| `listenToUserAdvisorConnections` | Advisors |
| `listenToAdvisorConnectionsWithNames` | Advisors |
| `getAdvisorButtonStatus` | Advisors |
| `checkExistingAdvisorConnection` | Advisors |
| `connectToAdvisor` | Advisors |
| `updateUserAdvisorStatus` | Advisors |
| `findAdvisorConnection` | Advisors |
| `listenToAdvisorConnectionMessages` | Advisors |
| `sendUserAdvisorMessage` | Advisors |
| `sendAdvisorUserMessage` | Advisors |
| `updateAdvisorConnectionLastMessage` | Advisors |
| `getUserAdvisorConnection` | Advisors (alias) |
| `listenToAdvisorMessages` | Advisors (alias) |
| `updateConnectionLastMessage` | Advisors (alias) |
| `fetchResources` | Resources |
| `fetchResourcesByCategory` | Resources |
| `fetchRecommendedResources` | Resources |
| `listenToUserRecommendationCategory` | Resources |
| `updateMlMentalHealthProfile` | ML |
| `subscribeToMlMentalHealthProfile` | ML |
| `buildKnnInput` | KNN |
| `updateQuestionnaireBaseline` | Profile |
| `updateQuestionnaireProfile` | Profile |
| `updateMlEmotionRecommendation` | ML |
| `updateMlEmotionProfile` | ML |
| `subscribeToRecommendationProfile` | Profile |
| `listenToMentalHealthProfile` | Profile (alias) |
| `continueAfterAdvisorApproval` | Advisors |
| `getCategoryLevel` | Categories |
| `moveCategoryUp` | Categories |
| `moveCategoryDown` | Categories |
| `moveOneLevelToward` | Categories |
| `updateCategorySafely` | Categories |
| `updateCategoryWithStabilityRules` | ML |
| `calculateWellnessScore` | Wellness |
| `fetchUserJournalTexts` | ML Text |
| `fetchUserGroupChatTexts` | ML Text |
| `fetchUserAiChatTexts` | ML Text |
| `saveAiChatMessage` | Chat |
| `collectUserMlTextBatch` | ML Text |
| `runMlAnalysis` | ML |
| `updateMentalHealthProfileFromMl` | ML |
| `runUserTextMlAnalysis` | ML |
| `triggerBatchMlAnalysis` | ML (alias) |
| `isUserRestricted` | Restriction |
| `applyLowWellnessRestriction` | Restriction |
| `calculateScoreAdjustment` | Wellness |
| `saveWellnessScoreHistory` | Wellness |
| `updateWellnessScoreGradually` | Wellness |
| `runMlAnalysisForText` | ML (main entry point) |
| `saveMlAnalysisHistory` | ML |
| `updateResourceRecommendationFromLatestMl` | ML |
| `calculateWeeklyMlTrend` | ML |
| `updatePeerGroupRecommendationFromWeeklyTrend` | ML |
| `getDashboardCategory` | Categories |
| `fetchRecommendedGroups` | Groups |
| `getWeeklyDominantEmotion` | KNN |
| `callKnnAndWriteResult` | KNN |
| `runWeeklyKnnRecommendation` | KNN |
| `buildRecommendationCategory` | Categories |
| `mapToAppCategory` | Categories |
| `fetchRecommendations` | Recommendations |
| `fetchRecommendationsByCategory` | Recommendations |
| `getGroupsByMlPrediction` | Groups |
| `getMlGroupCategory` | Categories |
| `mapDassScoreToFallbackCategory` | KNN (internal) |

### `geminiService.ts`

| Function | Purpose |
|---|---|
| `sendSupportMessage(userText, dass21Result)` | Post-assessment AI chat (Mindy) |
| `moderateContent(text)` | Two-layer content safety check |
| `askQuestionDoubt(userDoubt, questionText, subscale, questionNum)` | DASS-21 Q clarification |

### `mlApiService.ts`

| Function | Endpoint |
|---|---|
| `predictText(text)` | `POST /predict` |
| `recommendGroups(payload)` | `POST /recommend-groups` |

### `wordFilter.ts`

| Function | Purpose |
|---|---|
| `localWordFilter(text)` | Offline regex content filter (fallback) |

### `encryption.ts`

| Function | Purpose |
|---|---|
| `encryptName(name)` | `btoa(encodeURIComponent(name))` |
| `decryptName(encoded)` | `decodeURIComponent(atob(encoded))` with fallback |

---

*Document generated from full codebase analysis — 2026-05-23*  
*Covers: 17 screens, 5 services, ~2,574-line dataService, 19 Firestore collections/subcollections*
