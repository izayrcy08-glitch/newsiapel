# QR & SCAN FLOW — DETAILED ANALYSIS PLAN
**Status:** Analysis Only (NO CHANGES YET)  
**TTL Setting:** 10 seconds (FIXED - User does NOT want to change)

---

## EXECUTIVE SUMMARY

Setelah analisis mendalam terhadap QR generation & scan flow, ditemukan:
- ✅ Flow logic sudah **SOLID dan AMAN** 
- ✅ Security **BAIK** (token validation, Firebase rules)
- ⚠️ **1 POTENTIAL ISSUE** yang bersifat **OPTIONAL FIX** (tidak critical)

---

## SECTION 1: WHAT WORKS WELL ✅

### 1.1 QR Token Generation (Admin Side)
**File:** `src/hooks/useQrGenerator.js` line 34-46

```javascript
const generateAndStoreToken = () => {
  const issuedAt = Date.now();
  const qrData = {
    token: createQrToken(),
    issuedAt,
    expiresAt: issuedAt + QR_TOKEN_TTL_MS,  // 10 seconds
  };
  currentQrRef.current = qrData;  // Immediate update
  setCurrentQr(qrData);           // React state
  set(ref(database, QR_PATH), qrData).catch(...)  // Firebase async
};
```

**Analysis:**
- ✅ Token dibuat dengan `crypto.getRandomValues()` (secure)
- ✅ Ref update IMMEDIATE (line 42) SEBELUM React render (prevents stale reads)
- ✅ Firebase write async dengan error handling
- ✅ issuedAt + expiresAt logic benar

**Kesimpulan:** No issues here ✅

---

### 1.2 Token Refresh Loop
**File:** `src/hooks/useQrGenerator.js` line 68-78

```javascript
const timer = setInterval(() => {
  const t = Date.now();
  setNow(t);  // Update UI countdown
  const qr = currentQrRef.current;
  if (!qr) {
    generateAndStoreToken();
  } else if (qr.expiresAt <= t) {  // Expired?
    generateAndStoreToken();        // Auto-regenerate
  }
}, 1000);  // Check every 1 second
```

**Analysis:**
- ✅ Checks every 1 second = minimal delay for expiry detection
- ✅ Uses `currentQrRef.current` (not state) = no React render lag
- ✅ Only regenerate when ACTUALLY expired (good logic)
- ✅ Cleanup on unmount ✅

**Kesimpulan:** No issues here ✅

---

### 1.3 Scanner Initialization (Pegawai Side)
**File:** `src/hooks/useQrScanner.js` line 52-118

**Key Features:**
- ✅ Duplicate scan protection with `isValidatingScan.current`
- ✅ Camera selection logic (prefer rear camera, fallback to front)
- ✅ Fallback for environment mode vs device ID
- ✅ Error handling at multiple levels
- ✅ Proper cleanup on unmount

**Kesimpulan:** No issues here ✅

---

### 1.4 Token Validation Logic
**File:** `src/utils/qr-token.js` line 11-25

```javascript
export const validateQrToken = async (token) => {
  const submittedToken = token.trim();
  const snapshot = await get(ref(database, QR_PATH));
  const currentQr = snapshot.val();

  if (!currentQr?.token || submittedToken !== currentQr.token) {
    return { type: "invalid", label: "INVALID TOKEN" };
  }

  if (Date.now() > currentQr.expiresAt) {
    return { type: "expired", label: "EXPIRED TOKEN" };
  }

  return { type: "valid", label: "VALID TOKEN" };
};
```

**Analysis:**
- ✅ Token matching: exact string comparison (secure)
- ✅ TTL validation: `Date.now() > expiresAt` (correct logic)
- ✅ Null safety: `currentQr?.token` guard clause
- ✅ 3 clear return states: valid / expired / invalid

**Kesimpulan:** Logic is sound ✅

---

### 1.5 Firebase Integration
**File:** `firebase-rules.json` line 42-63

**Rules Analysis:**
- ✅ Read/write authenticated (requires `auth !== null`)
- ✅ Schema validation: `hasChildren(['token', 'issuedAt', 'expiresAt'])`
- ✅ Token format: exactly 6 characters (matches generation)
- ✅ Timestamps validated as numbers
- ✅ expiresAt > issuedAt enforced

**Kesimpulan:** Security rules are solid ✅

---

## SECTION 2: TIMING ANALYSIS (TTL = 10s)

### Real-world Scan Scenario

```
T=0s:     Admin generates QR token (expires at T=10s)
├─ Token stored: issuedAt=0ms, expiresAt=10000ms
├─ currentQrRef.current updated immediately
└─ Firebase write initiated (async)

T=0.5s:   Firebase write completes
└─ Token available globally in Realtime DB

T=2s:     Pegawai opens scanner modal
├─ Camera permission requested
└─ Scanner initialization starts

T=3s:     Camera ready
└─ Device waits for QR scan

T=5s:     Pegawai aims at QR code
├─ Scanning in progress
└─ No errors

T=6.5s:   QR code detected
├─ Html5Qrcode triggers onScanSuccessWrapper
└─ decodedText = "123456" (example)

T=7s:     validateQrToken("123456") called
├─ await get(ref(database, QR_PATH)) started
│  └─ Network call to Firebase
├─ Waiting for snapshot...
└─ (200-500ms typical latency)

T=7.3s:   Firebase responds with token data
├─ currentQr = { token: "123456", issuedAt: 0, expiresAt: 10000 }
├─ Token match check: "123456" === "123456" ✅
├─ TTL check: Date.now() (7300) > expiresAt (10000)? NO ✅
├─ Result: { type: "valid" }
└─ onScan(pegawai.id) triggered

T=7.5s:   Attendance recorded
└─ SUCCESS ✅
```

**Elapsed Time Analysis:**
- Network latency: ~0.3s
- Scanner init: ~1s
- Scanning: ~3.5s (user-dependent)
- Validation: ~0.3s
- **Total: ~5.1 seconds**
- **TTL Remaining at scan: ~4.9 seconds buffer** ✅

**Conclusion:** 10 second TTL provides **sufficient buffer** for normal conditions ✅

---

## SECTION 3: EDGE CASES & RISKS

### Edge Case #1: Slow Network (500ms latency)

```
T=6.5s:   Scan detected
T=7s:     validateQrToken starts
T=7.5s:   Firebase call slow (500ms)...still waiting
T=7.8s:   Response received
├─ Date.now() = 7800ms
├─ expiresAt = 10000ms  
├─ 7800 > 10000? NO ✅
└─ VALID ✅
```

**Analysis:** Still passes ✅

---

### Edge Case #2: Extremely Slow Scan (4+ seconds scanning)

```
T=0s:     Token created (expires at T=10s)
T=2s:     Scanner opened
T=6s:     User still scanning...
T=6.5s:   QR detected, validation starts
T=7s:     Firebase call returns
├─ Date.now() = 7000ms
├─ expiresAt = 10000ms
├─ 7000 > 10000? NO ✅
└─ VALID ✅
```

**Analysis:** Still within 10s window ✅

---

### Edge Case #3: TOKEN EXPIRES DURING SCAN (Critical)

```
T=0s:     Token created (expires at T=10s)
T=2s:     Scanner opened
T=3s:     Another admin generates NEW token (replaces old one)
T=5s:     Pegawai scans OLD token (from T=0s)
T=5.3s:   validateQrToken called
├─ get(QR_PATH) returns NEW token (from T=3s)
├─ "oldToken" !== "newToken"
├─ Result: { type: "invalid" } ⚠️
└─ FAIL
```

**Analysis:** User sees "INVALID TOKEN" instead of scanning old token
- **This is EXPECTED behavior** (admin started new apel)
- **Not a bug** - correct security logic

---

### Edge Case #4: Firebase Down (THE REAL ISSUE)

```
T=6.5s:   Scan detected, validateQrToken called
T=7s:     Firebase get() initiated
├─ Connection timeout...
├─ Network unstable...
├─ Firebase region unreachable...
└─ NO RESPONSE

T=8s:     Still waiting...
T=9s:     Still waiting...
T=10s:    Still waiting... (user sees loading spinner)
T=15s:    Browser timeout (varies by config)
├─ User frustrated
└─ Scan failed ❌
```

**Analysis:** This is a REAL problem, but edge case
- Network failure = rare in good conditions
- User experience degrades (loading spinner for 5+ seconds)
- **Optional fix:** Add timeout to Firebase call

---

## SECTION 4: PROPOSED FIXES

### Option A: ADD FIREBASE TIMEOUT (Recommended)

**Rationale:**
- Prevents hang if Firebase is slow/down
- Graceful fallback instead of infinite wait
- Does NOT change TTL logic
- Low risk, high benefit

**Implementation:**
```javascript
export const validateQrToken = async (token, timeoutMs = 5000) => {
  const submittedToken = token.trim();
  
  try {
    const getPromise = get(ref(database, QR_PATH));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    );
    
    const snapshot = await Promise.race([getPromise, timeoutPromise]);
    const currentQr = snapshot.val();
    
    // ... existing validation logic ...
  } catch (error) {
    if (error.message === "Timeout") {
      return { type: "timeout", label: "VALIDATION TIMEOUT" };
    }
    console.error("QR validation error:", error);
    return { type: "error", label: "VALIDATION ERROR" };
  }
};
```

**Impact:**
- ✅ No change to TTL logic
- ✅ Fixes Firebase hang issue
- ✅ User gets feedback after 5s max
- ✅ DashboardPegawai can handle timeout response
- ✅ Zero breaking changes to existing flow

**Risk Level:** 🟢 LOW
- Simple Promise.race pattern
- No business logic changes
- Graceful error handling

---

### Option B: EXTEND TTL (NOT RECOMMENDED - User doesn't want)

User explicitly wants to keep TTL at 10 seconds, so this is OFF the table.

---

### Option C: DO NOTHING

Keep current implementation as-is.

**Pros:**
- Zero changes = zero risk
- Current flow works fine in normal conditions

**Cons:**
- Firebase hang scenario (edge case but bad UX)
- No graceful timeout handling

---

## SECTION 5: IMPLEMENTATION PLAN (IF APPROVED)

### Step 1: Modify `src/utils/qr-token.js`
- Add `timeoutMs = 5000` parameter
- Wrap Firebase `get()` with `Promise.race()`
- Add error handling for timeout case
- **Files affected:** 1 file only
- **Lines changed:** ~20 lines
- **Risk:** Low (no logic changes, just timeout wrapping)

### Step 2: Test Changes
- `npm run build` (verify no TypeScript errors)
- Manual test: scan QR codes (should work same as before)
- Simulate slow Firebase (harder to test manually)

### Step 3: Verify No Breaking Changes
- DashboardPegawai already handles `timeout` and `error` response types
- Existing flow unchanged
- Backward compatible

---

## SECTION 6: DECISION MATRIX

| Aspect | Current | With Fix | Impact |
|--------|---------|----------|--------|
| TTL | 10s ✅ | 10s ✅ | None (unchanged) |
| Firebase timeout | No ⚠️ | 5s ✅ | Prevents hang |
| Scan in normal conditions | Works ✅ | Works ✅ | Same behavior |
| Firebase down scenario | Hangs ❌ | Timeout 5s ✅ | Better UX |
| Breaking changes | - | None | Safe |
| Complexity added | Low | Low | Minimal |

---

## SECTION 7: RECOMMENDATION

**Implement Option A (Firebase Timeout)** with these conditions:
1. ✅ Keep TTL at 10 seconds (NO CHANGE)
2. ✅ Add Promise.race timeout (5 seconds)
3. ✅ Handle timeout gracefully in response
4. ✅ Run build test before deployment
5. ✅ Zero breaking changes to existing flow

**Rationale:**
- Minimal risk (single file, ~20 lines)
- Solves edge case (Firebase down)
- No impact to normal scanning flow
- Improves user experience in bad conditions

---

## NEXT STEPS

1. **User Decision:** Approve Option A? Yes/No/Other?
2. **If Yes:** Proceed with implementation
3. **If No:** Keep current implementation (still works fine)

---

**Analysis Complete**  
**Ready for User Review**
