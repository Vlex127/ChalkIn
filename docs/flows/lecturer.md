Your device-key idea is right. One upgrade: use a **key pair** instead of a shared secret. Details are in the auth section after the screens.

# Lecturer flow

```
Sign up (online, once) → wait for approval → Add course → Add students
   → Start session → write code on board → Close → Sync → View results
```

# Lecturer screens

**1. Sign up / Login**
```
┌─────────────────────────┐
│        ChalkIn          │
│  Full name  [_________] │
│  School email [_______] │
│  Staff number [_______] │
│  Password   [_________] │
│  [ Create account ]     │
│  Already have one? Login│
└─────────────────────────┘
```
After signup: "Pending approval". Only an approved lecturer sees the app.

**2. Home (my courses)**
```
┌─────────────────────────┐
│ Hello, Dr. Ade   ● synced│
│ CSC 301   212 students  │
│ CSC 319    98 students  │
│ [ + Add course ]        │
│ ⚠ 1 session not synced  │
└─────────────────────────┘
```

**3. Course page**
```
┌─────────────────────────┐
│ CSC 301                 │
│ [ START SESSION ]       │ ← the big button
│ Past sessions (12)      │
│ Students · Below 75% (9)│
│ Export Excel / PDF      │
└─────────────────────────┘
```

**4. Live session (the most important screen)**
```
┌─────────────────────────┐
│   Write this on board   │
│                         │
│      4 8 2 9 1 7        │  ← huge font
│                         │
│  Open for: 04:12        │
│  [ +5 min ]  [ Close ]  │
└─────────────────────────┘
```
Offline, the lecturer can't see a live count. The screen should say that plainly: "Counts appear after you sync." Keep the screen awake with the Wake Lock API.

**5. Session closed**
```
│ Session saved on this phone │
│ ○ Waiting to sync           │
│ [ Sync now ]                │
```

**6. Results (after sync)**
```
│ 4 Nov · CSC 301             │
│ Verified 187 · Flagged 6 ·  │
│ Pending 19                  │
│ [ Review flagged ]          │
```
Review flagged shows each name and reason (outside location, wrong device, late sync) with Approve and Reject buttons.

# Course setup and students

The simplest way to get a roster for the pilot is for the lecturer to **upload a CSV** (matric number and name). The student signs up with their matric number, and the system matches them to the roster. The other option is a course join code that students enter once, with the lecturer approving them. Start with CSV.

# Signup and login

**Lecturer approval.** Require a school email (.edu.ng) and a staff number, but don't trust them automatically. For the pilot, you approve lecturers by hand. Later, a department admin does it.

**Students.** They sign up with their matric number, email, and password, then go through device binding (below).

**Staying logged in forever:**
- Supabase already gives you this: a short-lived access token (about 1 hour) plus a long-lived refresh token stored on the phone. The client library renews it silently whenever there's internet.
- **Offline, don't check the token at all.** The app opens straight to the home screen based on the cached session. Submissions don't need a valid token at the time they're entered, only when they sync.
- If the refresh token has expired or been revoked by the time they sync, the queue stays on the phone, and they're asked to log in again before anything is sent.

# Device key (your idea, tightened)

A shared secret has a weakness: if the phone has the secret, it can be copied out. Use a key pair instead.

1. At device binding (online, once), the app generates a key pair with the Web Crypto API and marks the private key **non-extractable**, so JavaScript can use it but can't read or export it. It's stored in IndexedDB.
2. The app sends the **public key** to the server, which saves it in `devices` instead of the `device_hash` column we sketched earlier.
3. Every submission is **signed** with the private key (over the id, code, timestamp, and location).
4. The server verifies the signature against the student's registered public key. A bad signature means the submission is rejected.

This means a forged request, or a copied account on another phone, fails. And a student can't sign for a friend even if they log into the friend's account, because they don't have the friend's phone's key.

# Logout and edge cases

- **Logout clears the login session but not the device key or the outbox.** Binding belongs to the phone and account, not to the login. Otherwise logging out would delete pending attendance.
- If items are still pending, the logout button warns: "You have 2 unsent submissions. Sync first or they'll be lost," and only a deliberate "log out anyway" allows it. I'd still keep the queue and just lock it until the same student logs in again.
- **A different student logging into a bound phone** is refused: "This phone is registered to another student."
- **New phone or lost phone:** the student requests a rebind. For the pilot, the lecturer or admin approves it (this is where cheating shows up, so keep it visible), and the old key is revoked.
- **iPhone storage wipe or app reinstall:** the key is gone, so a rebind is needed. This is another reason to push "Add to Home Screen" on iOS.
- **Lecturers get a key pair too**, so the server knows a session really came from that lecturer's registered phone.

The student-side screens are fairly short (login, pick course, enter code, receipt, history). Want those next, or the Supabase auth and RLS setup so we can start building?