# 🔴 Firebase Rules Deployment Guide

## ⚠️ Current Issue

The Firebase Realtime Database Rules haven't been deployed to Firebase Console yet. The rules file exists in the repository (`firebase-rules.json`) but are not active in Firebase.

This causes the permission errors you're seeing:
- `permission_denied at /attendance/today`
- `permission_denied at /pengajuan`
- `permission_denied at /pegawai_passwords`

## ✅ Solution: Deploy Rules to Firebase

### **Option 1: Using Firebase CLI (Recommended)**

#### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

#### Step 2: Authenticate with Firebase
```bash
firebase login
```
This will open a browser window to authenticate with your Google account.

#### Step 3: Deploy Rules
```bash
npm run firebase:deploy-rules
```

Or manually:
```bash
firebase deploy --only database --project siapel-ed2b0
```

#### Step 4: Verify Deployment
```bash
firebase database:get / --project siapel-ed2b0
```

---

### **Option 2: Manual Deployment via Firebase Console**

1. **Open Firebase Console**
   - URL: https://console.firebase.google.com
   - Sign in with your Google account

2. **Select Project**
   - Click on **siapel-ed2b0**

3. **Navigate to Database Rules**
   - Left sidebar → **Realtime Database**
   - Click on **Rules** tab at the top

4. **Update Rules**
   - Copy all contents from `firebase-rules.json` file
   - Paste into the Rules editor (replacing existing content)
   - Or copy-paste the rules below:

```json
{
  "rules": {
    "attendance": {
      ".indexOn": ["status"],
      "today": {
        ".read": "auth !== null",
        ".write": "auth !== null",
        "$pegawaiId": {
          ".validate": "newData.hasChildren(['status'])",
          "status": {
            ".validate": "newData.isString() && (newData.val() === 'Hadir' || newData.val() === 'Dinas Dalam' || newData.val() === 'Dinas Luar' || newData.val() === 'Izin' || newData.val() === 'Sakit' || newData.val() === 'Tanpa Keterangan')"
          },
          "jamHadir": {
            ".validate": "!newData.exists() || (newData.isString() && newData.val().matches(/^[0-9]{2}:[0-9]{2}$/))"
          },
          "$other": {
            ".validate": false
          }
        }
      },
      "$other": {
        ".write": false,
        ".read": false
      }
    },
    "apel": {
      "session": {
        ".read": "auth !== null",
        ".write": "auth !== null",
        ".validate": "newData.isString() && (newData.val() === 'before' || newData.val() === 'ongoing' || newData.val() === 'ended' || newData.val() === 'ditiadakan')"
      },
      "reason": {
        ".read": "auth !== null",
        ".write": "auth !== null",
        ".validate": "newData.isString() || newData.hasChildren(['id', 'text'])"
      },
      "$other": {
        ".write": false,
        ".read": false
      }
    },
    "qr": {
      "current": {
        ".read": "auth !== null",
        ".write": "auth !== null",
        ".validate": "newData.hasChildren(['token', 'issuedAt', 'expiresAt'])",
        "token": {
          ".validate": "newData.isString() && newData.val().length === 6"
        },
        "issuedAt": {
          ".validate": "newData.isNumber()"
        },
        "expiresAt": {
          ".validate": "newData.isNumber() && newData.val() > now"
        },
        "$other": {
          ".validate": false
        }
      },
      "$other": {
        ".write": false,
        ".read": false
      }
    },
    "pengajuan": {
      ".read": "auth !== null",
      ".write": "auth !== null",
      ".indexOn": ["pegawaiId", "statusVerifikasi", "createdAt"],
      "$pengajuanId": {
        ".validate": "newData.hasChildren(['pegawaiId', 'nama', 'statusBaru', 'keterangan', 'statusVerifikasi', 'createdAt']) && newData.hasChildren(['nip', 'statusLama', 'dokumen', 'dokumenPath', 'waktu'])",
        ".write": "auth !== null",
        "pegawaiId": {".validate": "newData.isString()"},
        "nama": {".validate": "newData.isString()"},
        "nip": {".validate": "newData.isString()"},
        "statusLama": {".validate": "newData.isString()"},
        "statusBaru": {".validate": "newData.isString() && (newData.val() === 'Hadir' || newData.val() === 'Dinas Dalam' || newData.val() === 'Dinas Luar' || newData.val() === 'Izin' || newData.val() === 'Sakit')"},
        "keterangan": {".validate": "newData.isString() && newData.val().length >= 1"},
        "dokumen": {".validate": "newData.isString()"},
        "dokumenPath": {".validate": "newData.isString()"},
        "waktu": {".validate": "newData.isString()"},
        "statusVerifikasi": {".validate": "newData.isString() && (newData.val() === 'menunggu' || newData.val() === 'disetujui' || newData.val() === 'ditolak')"},
        "createdAt": {".validate": "newData.isNumber()"},
        "$other": {".validate": false}
      }
    },
    "activeSessions": {
      ".read": true,
      ".write": true,
      "$userId": {
        ".write": true,
        ".validate": "newData.hasChildren(['sessionId', 'deviceId', 'loginAt'])",
        "sessionId": {".validate": "newData.isString() && newData.val().length > 0"},
        "deviceId": {".validate": "newData.isString() && newData.val().length > 0"},
        "loginAt": {".validate": "newData.isNumber() && newData.val() > 0"},
        "$other": {".validate": false}
      }
    },
    "fingerprints": {
      ".read": "auth !== null",
      ".write": "auth !== null",
      "$pegawaiId": {
        "deviceId": {".validate": "newData.isString()"},
        "lastLogin": {".validate": "newData.isNumber()"},
        "deviceInfo": {".validate": "newData.isString()"},
        "$other": {".validate": false}
      }
    },
    "pegawai_passwords": {
      ".read": "auth !== null",
      ".write": "auth !== null",
      "$key": {".validate": "newData.isString() && newData.val().length >= 4"}
    },
    "master_pegawai": {
      ".read": "auth !== null",
      ".write": "auth !== null",
      ".indexOn": ["id", "nip", "nama", "unit"],
      "$pegawaiId": {
        ".validate": "newData.hasChildren(['id', 'nama', 'nip', 'nik', 'jabatan', 'bidang', 'unit', 'role', 'password', 'isActive'])",
        "id": {".validate": "newData.isNumber()"},
        "nama": {".validate": "newData.isString() && newData.val().length > 0"},
        "nip": {".validate": "newData.isString() && newData.val().length > 0"},
        "nik": {".validate": "newData.isString()"},
        "jabatan": {".validate": "newData.isString()"},
        "bidang": {".validate": "newData.isString()"},
        "unit": {".validate": "newData.isString()"},
        "role": {".validate": "newData.isString() && (newData.val() === 'EMPLOYEE' || newData.val() === 'UNIT_LEADER' || newData.val() === 'EXECUTIVE' || newData.val() === 'ADMIN' || newData.val() === 'DEVELOPER')"},
        "password": {".validate": "newData.isString() && newData.val().length >= 4"},
        "phoneFingerprint": {".validate": "!newData.exists() || newData.isString()"},
        "isActive": {".validate": "newData.isBoolean()"},
        "$other": {".validate": false}
      }
    }
  }
}
```

5. **Publish Rules**
   - Click the blue **"Publish"** button
   - Wait for confirmation: "Rules updated successfully ✅"

---

## 🔍 After Deployment

### Step 1: Clear Browser Cache
```
Ctrl + Shift + Delete (Windows/Linux)
or Cmd + Shift + Delete (Mac)
```

### Step 2: Close and Reopen Browser
- Close the app tab completely
- Reopen and reload the page

### Step 3: Test Login
1. **As Admin:**
   - Login with admin credentials
   - Try generating QR token
   - Check scanner opens without blank white screen

2. **As Pegawai:**
   - Login with employee credentials
   - Open attendance scanner
   - Verify camera displays properly

---

## ✅ Verification Checklist

- [ ] Firebase rules deployed successfully
- [ ] No `permission_denied` errors in browser console
- [ ] Admin can generate QR token
- [ ] Employee scanner shows camera feed (not blank white)
- [ ] Attendance data loads without errors
- [ ] Pengajuan data loads without errors

---

## 📊 Rules Explanation

| Path | Permission | Description |
|------|-----------|-------------|
| `attendance/today` | auth !== null | Employees can log attendance |
| `pengajuan` | auth !== null | Employees can submit requests |
| `qr/current` | auth !== null | Generate QR codes with validation |
| `master_pegawai` | auth !== null | Read employee master data |
| `pegawai_passwords` | auth !== null | Read password overrides |
| `activeSessions` | true | Track active user sessions |

---

## 🚨 Troubleshooting

### Issue: "Rules have an error" when publishing

**Solution:** Validate JSON syntax
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('firebase-rules.json', 'utf-8')))"
```

### Issue: Still getting permission_denied after deployment

**Solution:** 
1. Wait 1-2 minutes for Firebase to sync
2. Clear all browser cache completely
3. Logout and login again
4. Check that user has proper authentication

### Issue: Can't authenticate with Firebase CLI

**Solution:**
```bash
firebase logout
firebase login --reauth
```

---

## 📞 Support

If issues persist:
1. Check Firebase Console > Database > Rules > Execution log
2. Review browser console for exact error messages
3. Ensure user is authenticated before accessing data
