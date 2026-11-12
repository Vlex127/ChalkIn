# Student flow

```
Sign up (online, once) → match to class list → bind phone → add to Home Screen
   → in class: open app → pick course → type code → receipt
   → later: auto-sync → status changes to Verified / Flagged
```

# Student screens

**1. Sign up and bind phone** (needs internet, happens once)
```
┌─────────────────────────┐
│        ChalkIn          │
│  Matric no  [_________] │
│  Email      [_________] │
│  Password   [_________] │
│  [ Create account ]     │
└─────────────────────────┘
        ↓ matched to your class list
┌─────────────────────────┐
│  Register this phone    │
│  Only this phone can    │
│  mark your attendance.  │
│  [ Register phone ]     │
└─────────────────────────┘
```
Registering is where the key pair is generated. If the matric number isn't on any class list yet, show: "Ask your lecturer to add you."

**2. Install prompt** (iPhone only, shown right after binding)
```
│ Tap Share ⬆ then            │
│ "Add to Home Screen"        │
│ Otherwise your phone may    │
│ delete unsent attendance.   │
```
On Android, show the normal "Install app" button instead.

**3. Home**
```
┌─────────────────────────┐
│ Hi, Vincent      ○ offline│
│ ⏳ 2 pending, will sync  │
│ ─────────────────────── │
│ [ MARK ATTENDANCE ]     │  ← the big button
│ My courses              │
│ CSC 301     82% ✓       │
│ CSC 319     68% ⚠       │
└─────────────────────────┘
```
Percentages come from the last sync and are cached, so they open offline. Add "last updated 2 days ago" so students don't think it's live.

**4. Enter code** (the screen used in the hall, so keep it fast)
```
┌─────────────────────────┐
│ Course: CSC 301  [change]│
│                         │
│     [ 4 ][ 8 ][ 2 ]     │
│     [ 9 ][ 1 ][ 7 ]     │
│                         │
│  [1][2][3]              │
│  [4][5][6]  big number  │
│  [7][8][9]  keypad      │
│     [0] [⌫]             │
└─────────────────────────┘
```
- Pre-select the course used last time, so most students never touch the course picker.
- Auto-submit on the sixth digit, with no extra button.
- Ask for location permission the first time, and explain why: "To confirm you're in class."
- If location is denied, still accept the submission, but tell them it may be flagged.
- If they enter another code for the same course within a few minutes, warn: "You already submitted for CSC 301 just now."

**5. Receipt**
```
┌─────────────────────────┐
│         ✓               │
│  Saved on your phone    │
│  Receipt #A7K2          │
│  CSC 301 · 10:04 AM     │
│                         │
│  Not confirmed yet.     │
│  It will verify when    │
│  you next have data.    │
│  [ Done ]               │
└─────────────────────────┘
```
Never say "attendance marked" here, because it isn't confirmed. Say "saved". The offline app also can't tell a typo from a correct code, so add "Double-check the code on the board" under the receipt.

**6. My attendance (per course)**
```
│ CSC 301 · 82%  (9 of 11)    │
│ ▓▓▓▓▓▓▓▓░░  min 75%         │
│ 4 Nov  ✓ Verified           │
│ 2 Nov  ⏳ Pending           │
│ 28 Oct ⚠ Flagged            │
│         "Location far from  │
│          class. Contact     │
│          your lecturer."    │
│ 21 Oct ✗ Expired            │
│         "Not synced in 48h" │
```
Every status gets a plain-language reason. Students will argue with flags, so the reason has to be visible and the next step has to be clear.

**7. Settings**
```
│ Registered phone: ✓          │
│ Request new phone            │
│ Log out                      │
```
Logout warns if there are pending submissions, as we covered.

# Small things that matter in a real hall

- **Dark mode and low brightness** work well, since halls are often dim.
- **Tiny data use.** Don't load images, fonts, or analytics at launch.
- **Big tap targets.** The keypad buttons should be easy to hit with a thumb in a crowded seat.
- **App must open instantly with no network.** Test this on a cheap Android with airplane mode on, because that's your real user.
- **Sync status is always visible** at the top, as a small dot: synced, pending, or offline.

That covers both sides. The next step is the Supabase auth and RLS setup so you can start building. Do you want the project folder structure first, or the SQL migration with the policies?
