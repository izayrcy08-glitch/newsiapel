# SIAPEL App - Integration Test Plan
## Comprehensive Testing for 4 Critical Fixes

---

## TEST EXECUTION SUMMARY

**Test Date**: [DATE]  
**Tester**: [NAME]  
**Environment**: [LOCAL/STAGING/PRODUCTION]  
**Browser**: Chrome, Firefox, Safari, Edge  
**Device**: Desktop, Mobile (iOS, Android)  

---

## PART 1: AUTH INITIALIZATION TESTS (Phase 1)

### Test 1.1: Auth Wait on Page Load
**Objective**: Verify AuthInit waits for Firebase auth before rendering children

**Steps**:
1. Open app in browser
2. Open DevTools Console (F12)
3. Check console for `[AuthInit]` logs
4. Verify LoadingSpinner appears briefly
5. Wait for auth to complete

**Expected Results**:
- ✅ Console shows `✅ [AuthInit] Anonymous auth initialized successfully`
- ✅ No `❌ [AuthInit] Firebase anonymous auth failed` errors
- ✅ No `permission_denied` errors
- ✅ LoadingSpinner visible during init
- ✅ App content renders after auth ready
- ✅ Attendance/Apel/Pengajuan pages accessible

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 1.2: Auth Retry Logic
**Objective**: Verify AuthInit retries on failure (max 3 times)

**Steps**:
1. Simulate auth failure (disconnect network briefly)
2. Check console for retry messages
3. Wait for 2s interval
4. Reconnect network
5. Verify auth succeeds

**Expected Results**:
- ✅ Console shows retry attempts
- ✅ Waits 2s between retries
- ✅ Max 3 retries enforced
- ✅ Success after network restored
- ✅ No permission_denied errors

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 2: SESSION CONFLICT TESTS (Phase 2)

### Test 2.1: Page Refresh Keeps User Logged In
**Objective**: User stays logged in after F5 refresh (CRITICAL)

**Steps**:
1. Login as pegawai user (not admin/developer)
2. Verify login successful, see dashboard
3. Note the sessionId in console
4. Press F5 to refresh page
5. Check if user still logged in
6. Verify can access attendance page
7. Check console for SESSION logs

**Expected Results**:
- ✅ User stays logged in after F5
- ✅ Dashboard visible immediately
- ✅ No logout redirect
- ✅ No `🔴 Immediate conflict` messages
- ✅ Console shows `🔄 Detected refresh (same device)`
- ✅ Can scan QR codes
- ✅ Attendance data persists

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 2.2: Multi-Device Login Detects Conflict
**Objective**: Verify login on different device logs out first device

**Steps**:
1. Login on Device A (PC/Mac)
   - Note deviceId in localStorage
2. Login on Device B (different PC/Mac)
   - Different deviceId
3. Go back to Device A
4. Check if logged out
5. Verify redirect to login page

**Expected Results**:
- ✅ Device A shows logout
- ✅ Redirect to login page on Device A
- ✅ Console shows `🔴 Device conflict detected`
- ✅ Different deviceId detected
- ✅ No false positives on same device

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 2.3: Same Device, New User Logout
**Objective**: Verify logout when same device, different user

**Steps**:
1. Login as User A on Device (store deviceId, userId)
2. Logout User A
3. Login as User B on same Device (same deviceId, different userId)
4. Go back to app (open in new tab)
5. Verify correct user is logged in

**Expected Results**:
- ✅ User B successfully logged in
- ✅ User A session cleared
- ✅ No spurious logouts
- ✅ Correct user data displayed

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 2.4: Session Cleanup on Logout
**Objective**: Verify session properly cleaned up on logout

**Steps**:
1. Login as pegawai
2. Check Firebase `/active_sessions/{userId}`
3. Click logout
4. Verify session record deleted
5. Try to access app
6. Should redirect to login

**Expected Results**:
- ✅ Session record deleted from Firebase
- ✅ Redirect to login on logout
- ✅ Cannot access protected pages
- ✅ Clean state for next login

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 3: SCANNER ABORTERROR TESTS (Phase 3)

### Test 3.1: No AbortError in Console
**Objective**: Verify AbortError suppressed when closing scanner

**Steps**:
1. Login as pegawai
2. Go to Attendance page
3. Click Buka Scanner button
4. Wait 2-3 seconds
5. Click Tutup button (close scanner)
6. Open DevTools Console (F12)
7. Check for error messages

**Expected Results**:
- ✅ Camera appears and works
- ✅ No AbortError messages
- ✅ No `Scanner stop error` messages
- ✅ No `Scanner clear error` messages
- ✅ Console is clean
- ✅ Scanner stops cleanly

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 3.2: Rapid Open/Close Scanner
**Objective**: Verify no race condition on rapid open/close

**Steps**:
1. Login as pegawai
2. Click Buka Scanner
3. Wait 1 second
4. Click Tutup
5. Repeat 5 times rapidly
6. Check console

**Expected Results**:
- ✅ No crashes
- ✅ No AbortError spam
- ✅ All open/close operations clean
- ✅ No state corruption
- ✅ Can reopen scanner

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 4: CAMERA TIMEOUT TESTS (Phase 4)

### Test 4.1: Camera Displays on Available Device
**Objective**: Verify camera works normally on device with camera

**Steps**:
1. Login on device WITH camera (laptop/phone)
2. Go to Attendance page
3. Click Buka Scanner
4. Wait for camera to appear
5. Check if video stream shows

**Expected Results**:
- ✅ Camera appears within 5 seconds
- ✅ Video stream visible
- ✅ Can scan QR codes
- ✅ No timeout errors
- ✅ No blank white screen
- ✅ Error messages NOT shown

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 4.2: Camera Unavailable Shows Error
**Objective**: Verify error message shown on devices without camera

**Steps**:
1. Run app on device WITHOUT camera (PC/Mac without webcam)
2. OR deny camera permission in browser
3. Go to Attendance page
4. Click Buka Scanner
5. Wait 5+ seconds
6. Check for error message

**Expected Results**:
- ✅ Error message appears after timeout
- ✅ Shows `NO CAMERA FOUND` or permission error
- ✅ NOT blank white screen
- ✅ Clear message to user
- ✅ Can close modal and retry
- ✅ App doesn't crash

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 4.3: Camera Permission Denied
**Objective**: Verify graceful handling of permission denied

**Steps**:
1. Open browser settings
2. Deny camera permission for app
3. Go to Attendance page
4. Click Buka Scanner
5. Browser should prompt
6. Click "Block" or "Deny"
7. Check app response

**Expected Results**:
- ✅ Browser shows permission prompt
- ✅ Error message shown after deny
- ✅ NOT blank white screen
- ✅ Helpful error message
- ✅ Can change permissions and retry
- ✅ App remains functional

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 4.4: Slow Camera Initialization
**Objective**: Verify timeout works on slow camera

**Steps**:
1. Use device with slow camera (older hardware)
2. OR simulate slow network
3. Click Buka Scanner
4. Wait up to 5 seconds
5. Observe behavior

**Expected Results**:
- ✅ Timeout after 5 seconds if no camera
- ✅ Error message shown
- ✅ NOT frozen indefinitely
- ✅ User can retry
- ✅ No blank white screen

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 5: QR SCANNING REGRESSION TESTS

### Test 5.1: Valid QR Code Scanning
**Objective**: Verify QR scanning still works after fixes

**Steps**:
1. Login as pegawai
2. Generate valid QR code
3. Go to Attendance page
4. Click Buka Scanner
5. Scan valid QR code
6. Verify success message

**Expected Results**:
- ✅ QR code scanned
- ✅ Token validated
- ✅ Success message shown
- ✅ Attendance registered
- ✅ Scanner auto-closes on success
- ✅ Attendance data saved

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 5.2: Invalid QR Code Handling
**Objective**: Verify invalid QR handling still works

**Steps**:
1. Login as pegawai
2. Open scanner
3. Show invalid/expired QR code
4. Verify error message

**Expected Results**:
- ✅ Invalid message shown
- ✅ Scanner stays open
- ✅ Can try again
- ✅ No app crash
- ✅ Error logged

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 5.3: Multiple QR Scans in Session
**Objective**: Verify scanner works for multiple scans

**Steps**:
1. Login as pegawai
2. Scan 3 different QR codes
3. Each time, wait for success message
4. Close and reopen scanner between scans
5. Verify all scans recorded

**Expected Results**:
- ✅ All 3 scans recorded
- ✅ No race conditions
- ✅ No state corruption
- ✅ Attendance data correct
- ✅ No memory leaks
- ✅ App stable

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 6: LOGIN FLOW TESTS

### Test 6.1: Admin Login
**Objective**: Verify admin login still works

**Steps**:
1. Go to login page
2. Enter admin credentials
3. Click login
4. Verify redirected to dashboard

**Expected Results**:
- ✅ Admin login successful
- ✅ See admin menu/buttons
- ✅ Can access admin features
- ✅ No auth errors

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 6.2: Developer Login
**Objective**: Verify developer login still works

**Steps**:
1. Go to login page
2. Enter developer credentials
3. Click login
4. Verify redirected to dashboard

**Expected Results**:
- ✅ Developer login successful
- ✅ See developer features
- ✅ Can access dev tools
- ✅ No auth errors

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 6.3: Pegawai Login
**Objective**: Verify pegawai login still works

**Steps**:
1. Go to login page
2. Enter pegawai credentials
3. Click login
4. Verify see attendance page

**Expected Results**:
- ✅ Pegawai login successful
- ✅ See attendance/apel/pengajuan
- ✅ Can scan QR codes
- ✅ No auth errors

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 7: DATA PERSISTENCE TESTS

### Test 7.1: Attendance Data After Refresh
**Objective**: Verify attendance data persists after page refresh

**Steps**:
1. Login as pegawai
2. Scan QR code (record attendance)
3. Verify attendance shown
4. Press F5 to refresh
5. Check if attendance still shown

**Expected Results**:
- ✅ Attendance data still visible
- ✅ No data loss
- ✅ Correct attendance info
- ✅ User stays logged in

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 7.2: Apel Data After Refresh
**Objective**: Verify apel (roll call) data persists

**Steps**:
1. Login as pegawai
2. Go to Apel page
3. View apel data
4. Press F5 to refresh
5. Check if apel data still shown

**Expected Results**:
- ✅ Apel data still visible
- ✅ No data loss
- ✅ Correct apel info
- ✅ User stays logged in

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 7.3: Pengajuan Data After Refresh
**Objective**: Verify pengajuan (request) data persists

**Steps**:
1. Login as pegawai
2. Go to Pengajuan page
3. View pengajuan data
4. Press F5 to refresh
5. Check if pengajuan data still shown

**Expected Results**:
- ✅ Pengajuan data still visible
- ✅ No data loss
- ✅ Correct pengajuan info
- ✅ User stays logged in

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 8: ERROR RECOVERY TESTS

### Test 8.1: Network Disconnect
**Objective**: Verify app handles network disconnect gracefully

**Steps**:
1. Login and use app
2. Disconnect network (wifi/mobile)
3. Try to perform action
4. Check error handling
5. Reconnect network
6. Verify recovery

**Expected Results**:
- ✅ Graceful error message
- ✅ App doesn't crash
- ✅ Can recover after reconnect
- ✅ No data corruption

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 8.2: Firebase Auth Timeout
**Objective**: Verify app recovers from auth timeout

**Steps**:
1. Leave app open for extended period
2. Disconnect network
3. Try to use app
4. Reconnect network
5. Retry action

**Expected Results**:
- ✅ Proper error message
- ✅ Can retry
- ✅ No undefined errors
- ✅ App stable

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 9: CONSOLE LOG VERIFICATION

### Test 9.1: No Errors in Console
**Objective**: Verify no errors during normal usage

**Steps**:
1. Open DevTools (F12)
2. Go to Console tab
3. Perform normal workflows:
   - Login
   - View pages
   - Refresh
   - Scan QR
   - Logout
4. Check for errors/warnings

**Expected Results**:
- ✅ No red error messages
- ✅ Only `[SESSION]`, `[AuthInit]` info logs
- ✅ No `AbortError`
- ✅ No `permission_denied`
- ✅ No undefined errors
- ✅ Clean console

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 9.2: Expected Debug Logs Present
**Objective**: Verify debug logs for troubleshooting

**Steps**:
1. Open DevTools Console
2. Perform actions
3. Look for expected logs:
   - `[AuthInit]` logs on page load
   - `[SESSION]` logs on login/refresh
   - Scanner logs on camera open/close
4. Verify timestamps and sequences

**Expected Results**:
- ✅ `[AuthInit]` logs visible on load
- ✅ `[SESSION]` logs on login
- ✅ `🔄 Detected refresh` on F5
- ✅ Clear sequence of events
- ✅ Helpful for debugging

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## PART 10: EDGE CASES

### Test 10.1: Very Rapid Refresh (Ctrl+Shift+R)
**Objective**: Verify hard refresh doesn't break session

**Steps**:
1. Login as pegawai
2. Press Ctrl+Shift+R (hard refresh)
3. Wait for page to load
4. Check if logged in
5. Try to use app

**Expected Results**:
- ✅ User stays logged in
- ✅ Session persists
- ✅ No crashes
- ✅ App functional

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 10.2: Multiple Tabs Same User
**Objective**: Verify multiple tabs with same user work

**Steps**:
1. Login in Tab 1
2. Open Tab 2, go to app URL
3. Should see logged in state
4. Perform action in Tab 1
5. Check if Tab 2 updates

**Expected Results**:
- ✅ Both tabs share session
- ✅ No conflicts
- ✅ Data syncs between tabs
- ✅ No double-login issues

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

### Test 10.3: Same User, Multiple Tabs
**Objective**: Verify same user in multiple tabs

**Steps**:
1. Login in Tab 1
2. Open Tab 2, login again (same user)
3. Both should work
4. Perform action in Tab 1
5. Check Tab 2 state

**Expected Results**:
- ✅ Last login wins
- ✅ Previous tab may show conflict
- ✅ Clear session handling
- ✅ No data corruption

**Pass**: ☐  |  **Fail**: ☐  |  **Notes**: ________________

---

## SUMMARY CHECKLIST

### Phase 1 - AuthInit Tests
- [ ] Test 1.1: Auth Wait ✅/❌
- [ ] Test 1.2: Auth Retry ✅/❌

### Phase 2 - Session Tests
- [ ] Test 2.1: Refresh Keeps Login ✅/❌
- [ ] Test 2.2: Multi-Device Logout ✅/❌
- [ ] Test 2.3: Same Device New User ✅/❌
- [ ] Test 2.4: Session Cleanup ✅/❌

### Phase 3 - AbortError Tests
- [ ] Test 3.1: No AbortError ✅/❌
- [ ] Test 3.2: Rapid Open/Close ✅/❌

### Phase 4 - Camera Tests
- [ ] Test 4.1: Camera Works ✅/❌
- [ ] Test 4.2: No Camera Error ✅/❌
- [ ] Test 4.3: Permission Denied ✅/❌
- [ ] Test 4.4: Slow Camera ✅/❌

### Regression Tests
- [ ] Test 5.1: QR Scanning ✅/❌
- [ ] Test 5.2: Invalid QR ✅/❌
- [ ] Test 5.3: Multiple Scans ✅/❌
- [ ] Test 6.1: Admin Login ✅/❌
- [ ] Test 6.2: Developer Login ✅/❌
- [ ] Test 6.3: Pegawai Login ✅/❌
- [ ] Test 7.1: Attendance Data ✅/❌
- [ ] Test 7.2: Apel Data ✅/❌
- [ ] Test 7.3: Pengajuan Data ✅/❌
- [ ] Test 8.1: Network Disconnect ✅/❌
- [ ] Test 8.2: Auth Timeout ✅/❌
- [ ] Test 9.1: No Console Errors ✅/❌
- [ ] Test 9.2: Expected Debug Logs ✅/❌
- [ ] Test 10.1: Hard Refresh ✅/❌
- [ ] Test 10.2: Multiple Tabs ✅/❌
- [ ] Test 10.3: Same User Multiple Tabs ✅/❌

---

## RESULTS

**Total Tests**: 26  
**Passed**: ___  
**Failed**: ___  
**Pass Rate**: ____%  

**Critical Issues Found**: ☐ Yes ☐ No  
**Blocking Issues**: ☐ Yes ☐ No  

---

## SIGN-OFF

**Tested By**: _________________________ **Date**: __________

**QA Manager**: _______________________ **Date**: __________

**Status**: ☐ APPROVED FOR DEPLOYMENT ☐ NEEDS FIXES ☐ BLOCKED

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

