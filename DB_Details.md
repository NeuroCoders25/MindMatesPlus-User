# MindMatesPlus — Firestore Database Details

---

## Root Collections

---

### 1. `users/{userId}`

**Document fields:**

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `nickname` | string? | |
| `email` | string | |
| `age` | number? | |
| `riskLevel` | string? | low / moderate / severe |
| `avatarSeed` | string? | |
| `profileImageUrl` | string? | Firebase Storage URL |
| `supportScore` | number | Gamification points |
| `earnedBadges` | string[] | Badge ID array |
| `mlMentalHealthProfile` | map | Embedded — see below |

**`mlMentalHealthProfile` (embedded map):**

| Field | Type |
|---|---|
| `latestPrediction` | string |
| `latestConfidence` | number |
| `dominantCategory` | string |
| `depressionCount` | number |
| `anxietyCount` | number |
| `normalCount` | number |
| `lastUpdated` | Timestamp |

---

#### Subcollections under `users/{userId}`

---

##### `journal_entries/{entryId}`

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `content` | string | |
| `mood_tag` | string | |
| `date` | Timestamp | |
| `analysis` | map? | sentiment, emotion, risk, score |
| `ml_analysis` | map? | prediction, confidence, probabilities |

---

##### `feedback/{feedbackId}`

| Field | Type |
|---|---|
| `rating` | number |
| `peer_comment` | string |
| `app_comment` | string |
| `date` | Timestamp |

---

##### `group_memberships/{groupId}`

| Field | Type | Notes |
|---|---|---|
| `group_id` | string | FK → `peer_groups` |
| `joined_at` | Timestamp | |
| `status` | string | active |

---

##### `mentalHealthProfile/currentProfile` *(single document)*

| Field | Type | Notes |
|---|---|---|
| `initialQuestionnaireScore` | map | depressionScore, anxietyScore, stressScore, totalScore, mainCondition, category, completedAt |
| `latestMlEmotionScore` | map | prediction, confidence, probabilities, recordedAt, analyzedAt, sourceTextsUsed, analyzedTextPreview |
| `baselineRecommendationCategory` | string | GroupCategory |
| `activeRecommendationCategory` | string | GroupCategory |
| `peerGroupRecommendationCategory` | string? | GroupCategory |
| `resourceRecommendationCategory` | string? | GroupCategory |
| `recommendationSource` | string | questionnaire / ml_analysis / advisor_approval |
| `userStatus` | string | normal / under_review / restricted |
| `mlStabilityCounter` | map | lastPrediction, repeatedCount, lastUpdatedAt |
| `resourceStabilityCounter` | map | lastPrediction, repeatedCount, lastUpdatedAt |
| `wellnessScore` | number? | 0–100 |
| `wellnessScoreUpdatedAt` | Timestamp? | |
| `connectedAdvisorId` | string? | FK → `advisors` |
| `advisorConnectionId` | string? | FK → `advisorConnections` |
| `advisorConnectionStatus` | string? | |
| `approvedCategory` | string? | GroupCategory |
| `approvalMessageSeen` | boolean? | |
| `approvalMessageSeenAt` | Timestamp? | |
| `approvedByAdvisorId` | string? | FK → `advisors` |
| `dashboardCategory` | string? | GroupCategory |
| `weeklyTrendSummary` | map? | timeframeDays, validRecordCount, dominantPrediction, dominantCategory, dominantCount, previousPeerGroupCategory, suggestedPeerGroupCategory, finalPeerGroupCategory, calculatedAt |
| `knnRecommendedGroup` | string? | |
| `knnMappedCategory` | string? | GroupCategory |
| `knnProbabilities` | map? | |
| `knnLastUpdatedAt` | Timestamp? | |
| `knnSafetyFlag` | boolean? | |
| `knnFallbackReason` | string? | backend_unreachable |
| `restrictedReason` | string? | |
| `restrictedAt` | Timestamp? | |
| `lastUpdated` | Timestamp? | |

---

##### `questionnaireResponses/{docId}`

| Field | Type |
|---|---|
| `score` | number |
| `depression_score` | number |
| `anxiety_score` | number |
| `stress_score` | number |
| `classification_level` | string |
| `date` | Timestamp |

---

##### `ml_analysis/{docId}`

| Field | Type | Notes |
|---|---|---|
| `source_type` | string | journal / chat / feedback |
| `source_id` | string | |
| `emotion_detected` | string | |
| `emotion_score` | number | |
| `predicted_condition` | string | |
| `confidence_score` | number | |
| `status` | string | pending |
| `created_at` | Timestamp | |

---

##### `mlAnalysisHistory/{docId}`

| Field | Type | Notes |
|---|---|---|
| `prediction` | string | depression / anxiety / normal |
| `confidence` | number | 0–1 |
| `probabilities` | map | depression, anxiety, normal |
| `source` | string | journal / group_chat / ai_chat |
| `textPreview` | string | Max 80 chars |
| `resourceRecommendationCategory` | string | GroupCategory |
| `createdAt` | Timestamp | |

---

##### `aiChatMessages/{docId}`

| Field | Type | Notes |
|---|---|---|
| `text` | string | Encrypted |
| `timestamp` | Timestamp | |
| `sender` | string | user / ai |

---

##### `savedResources/{resourceId}`

| Field | Type | Notes |
|---|---|---|
| `resourceId` | string | FK → `resources` |
| `title` | string | |
| `description` | string | |
| `category` | string | |
| `contentType` | string | text / image |
| `imageUrl` | string? | |
| `textContent` | string? | |
| `postedBy` | string? | |
| `posterImageUrl` | string? | |
| `authorId` | string? | FK → `advisors` |
| `createdAt` | Timestamp | |
| `savedAt` | Timestamp | |

---

##### `wellnessScoreHistory/{docId}`

| Field | Type |
|---|---|
| `previousScore` | number |
| `newScore` | number |
| `changeAmount` | number |
| `source` | string |
| `textPreview` | string |
| `mlPrediction` | string |
| `mlConfidence` | number |
| `createdAt` | Timestamp |

---

##### `mentalHealth/recommendationState` *(single document — KNN pipeline only)*

| Field | Type |
|---|---|
| `peerGroupRecommendationCategory` | string |
| `dashboardCategory` | string |
| `recommendationEngine` | string (knn) |
| `lastWeeklyAnalysisAt` | Timestamp |
| `weeklyTrendSummary` | map (dominantEmotion, averageConfidence, totalRecords, emotionDistribution) |

---

### 2. `peer_groups/{groupId}`

| Field | Type | Notes |
|---|---|---|
| `group_name` | string | |
| `group_description` | string | |
| `group_category` | string | GroupCategory |
| `memberCount` | number | |
| `group_image_url` | string? | |
| `group_moderator` | string? | Advisor name |
| `isActive` | boolean | |

---

#### Subcollection: `peer_groups/{groupId}/chatMessages/{msgId}`

| Field | Type | Notes |
|---|---|---|
| `senderId` | string | FK → `users` |
| `senderName` | string | |
| `senderAvatarSeed` | string? | |
| `text` | string | Encrypted |
| `timestamp` | Timestamp | |
| `flagged` | boolean | Crisis keyword detected |
| `reviewStatus` | string | pending / not_required / approved / rejected |
| `reviewedBy` | string? | Advisor ID |
| `reviewedAt` | Timestamp? | |
| `deletedByAdvisor` | boolean | |
| `hasPrivateThread` | boolean | |
| `bertPrediction` | map? | label, confidence |

---

#### Subcollection: `peer_groups/{groupId}/chatMessages/{msgId}/privateThread/{threadMsgId}`

| Field | Type | Notes |
|---|---|---|
| `senderId` | string | |
| `senderName` | string | |
| `senderRole` | string | user / advisor |
| `receiverId` | string | |
| `receiverName` | string | |
| `text` | string | Encrypted |
| `timestamp` | Timestamp | |
| `isPrivate` | boolean | Always true |
| `threadType` | string | advisor_private_message / user_private_reply |
| `flaggedMessageRef` | string | FK → `chatMessages` |
| `visibleTo` | string[] | [advisorId, userId] |

---

### 3. `groupMembers/{memberId}` *(memberId = `{groupId}_{userId}`)*

| Field | Type | Notes |
|---|---|---|
| `groupId` | string | FK → `peer_groups` |
| `userId` | string | FK → `users` |
| `joinedAt` | Timestamp | |

> Flat junction table — denormalized mirror of `users/{uid}/group_memberships` to allow cross-user queries (e.g. fetch all members of a group).

---

### 4. `advisors/{advisorId}`

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Matches Firebase Auth UID |
| `name` | string | |
| `specialty` / `role` | string | |
| `availability` | string | |
| `profileImageUrl` / `imageUrl` | string? | |
| `experience` | string? | |
| `sessions` | string? | |
| `about` | string? | |
| `averageRating` | number? | Computed aggregate |
| `ratingSum` | number | Running total for average |
| `ratingCount` | number | Running count for average |

---

#### Subcollection: `advisors/{advisorId}/ratings/{ratingId}` *(ratingId = `{userId}_{connectionId}`)*

| Field | Type | Notes |
|---|---|---|
| `userId` | string | FK → `users` |
| `userNickname` | string | |
| `advisorId` | string | FK → `advisors` |
| `connectionId` | string | FK → `advisorConnections` |
| `rating` | number | 1–5 |
| `comment` | string? | |
| `createdAt` | Timestamp | |

> Deterministic document ID prevents duplicate ratings per user per connection.

---

### 5. `advisorConnections/{connectionId}`

| Field | Type | Notes |
|---|---|---|
| `userId` | string | FK → `users` |
| `userName` | string | |
| `userEmail` | string | |
| `userNickname` | string? | |
| `advisorId` | string | FK → `advisors` |
| `advisorName` | string | |
| `status` | string | pending / accepted / approved / reviewed / closed |
| `caseType` | string | critical_case / listener_support |
| `source` | string? | listener_expert |
| `reason` | string | |
| `userMentalHealthCategory` | string | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |
| `lastMessage` | string | Plaintext preview |
| `lastMessageAt` | Timestamp? | |
| `lastMessageSenderId` | string? | |
| `userRated` | boolean? | Prevents duplicate rating prompts |

---

#### Subcollection: `advisorConnections/{connectionId}/messages/{msgId}`

| Field | Type | Notes |
|---|---|---|
| `senderId` | string | |
| `senderRole` | string | user / advisor |
| `receiverId` | string | |
| `messageText` | string | Encrypted |
| `messageType` | string | text |
| `createdAt` | Timestamp | |
| `isRead` | boolean | |

---

### 6. `resources/{resourceId}`

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `description` | string? | |
| `category` / `resourceCategory` | string | |
| `contentType` / `resource_type` | string | text / image |
| `imageUrl` / `image_url` | string? | |
| `textContent` / `resource` | string? | |
| `isActive` | boolean | |
| `postedBy` / `author` / `advisorName` | string? | |
| `authorId` | string? | FK → `advisors` |
| `authorInitials` | string? | |
| `url` | string? | |
| `createdAt` | Timestamp | |

---

#### Subcollection: `resources/{resourceId}/likes/{likeId}` *(likeId = userId)*

| Field | Type | Notes |
|---|---|---|
| `userId` | string | FK → `users` |
| `createdAt` | Timestamp | |

---

## GroupCategory Enum Values

```
Severe Support
Moderate Support
Mild Support
Wellness - Thriving
Wellness - Stress Aware
Wellness - Emotionally Aware
Recovery & Improvement
```

---

## Key Relationships

```
users ──< journal_entries
users ──< feedback
users ──< questionnaireResponses
users ──< ml_analysis
users ──< mlAnalysisHistory
users ──< aiChatMessages
users ──< wellnessScoreHistory
users ──< savedResources >── resources
users ──< group_memberships >── peer_groups
users ──1 mentalHealthProfile/currentProfile
users ──1 mentalHealth/recommendationState

groupMembers (flat junction: users × peer_groups)

peer_groups ──< chatMessages
chatMessages ──< privateThread

advisors ──< ratings

advisorConnections (junction: users × advisors)
advisorConnections ──< messages

resources ──< likes
```

---

## Notes

- All chat message `text` fields and advisor `messageText` fields are **AES-encrypted** at rest.
- `groupMembers` is a **denormalized flat junction** that mirrors `users/{uid}/group_memberships` to support collection-group queries.
- `mentalHealthProfile/currentProfile` is a **single document** (not a sub-collection), acting as both the DASS-21 baseline store and the live ML recommendation state machine.
- `advisors/{advisorId}/ratings/{ratingId}` uses a **deterministic compound ID** (`{userId}_{connectionId}`) to enforce one rating per user per connection at the database level.
- The `resources` collection uses **inconsistent field naming** across documents (legacy vs. new schema) — field resolution is handled client-side with fallback lookups.
