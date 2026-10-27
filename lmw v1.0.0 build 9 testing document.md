# LMW v1.0.0 Build 9 — Testing Document

A step-by-step guide for testing the **Partner App** and the **Outlet Admin App** side by side.

- Tick each box ☐ → ☑ when the step works.
- If something goes wrong, write it in the **Notes** column with a screenshot.
- Work through the sections in order. Later tests use the accounts and wallet balances created in earlier ones.

---

## 0. Before you start

### What you need

| Item | Used for |
|---|---|
| **Phone A**: Partner App (Partner 1, the main tester) | Registering, showing QR codes, wallet, sending money |
| **Phone B**: Outlet Admin App | Scanning QR codes and making bills |
| **Phone C**: Partner App (Partner 2) | Receiving wallet money, checking referral rewards |
| **Laptop**: Super Admin panel (superadmin.lotmorewins.com) | Checking settings and looking at bills |
| Outlet Admin email + password | Signing in on Phone B |
| 2 new email IDs + 2 new mobile numbers | Registering new partners |
| About 12 "guest" names + mobile numbers | Referral bills (they don't need to be real people) |

### Write down the current settings first

Open **Super Admin → Settings** and the outlet's **Slabs** page (Phone B). Write the values here, because every calculation below depends on them.

| Setting | Default | Actual value |
|---|---|---|
| First bill discount | 20% | |
| Repeat bill discount | 10% | |
| Referred guest discount | 10% | |
| Birthday bonus | — | |
| Referral goal (successful referrals needed) | 10 | |
| Referral reward discount | 20% | |
| Cashback (purchase points %) | — | |
| Referring partner reward % | — | |
| GST % (this outlet) | — | |
| Points to rupees (e.g. 1 point = ₹1) | — | |
| Points basis (bill amount or amount after discount) | — | |
| Redeem QR switched on? | Yes (needed) | |
| Code sent by (Email / WhatsApp) | — | |

> The examples below use **1 point = ₹1** and **GST 5%**. If your values are different, use the calculator rules in section 9.

### Rules to keep in mind

- **One QR per bill.** A bill uses a Personal Discount QR, a Referral QR or a Redeem QR, never two.
- **Never more than 50% off.** The total discount, including birthday and referral reward, stops at half the bill. The wallet also pays at most half the bill.
- **GST is added after the discount.**
- **The final amount is rounded to whole rupees.** For example, ₹1060.82 becomes ₹1061.
- **The same bill can't be made twice within 1 minute.**

---

## 1. Partner App: register as a new partner (Phone A)

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 1.1 | Open the app for the first time | Welcome/start screen opens | ☐ | |
| 1.2 | Tap to register / get started | **"Let's get you started"** screen | ☐ | |
| 1.3 | Leave name, email or mobile empty and tap Continue | Error shown, can't continue | ☐ | |
| 1.4 | Enter a 9-digit mobile | Error: needs 10 digits | ☐ | |
| 1.5 | Enter a mobile or email that is **already registered** | Clear error message, not a crash | ☐ | |
| 1.6 | Enter a correct name, email and mobile, then Continue | **"Where are you based?"** screen | ☐ | |
| 1.7 | Tap "use current location" | City, state and pincode fill in | ☐ | |
| 1.8 | Or type city, state and pincode by hand, then Continue | Birthday screen opens | ☐ | |
| 1.9 | Birthday screen: try **Skip for now** (on a second test account) | Goes to the code screen | ☐ | |
| 1.10 | Birthday screen: pick a date, then **Save my birthday** | Shows "every year on <date> your discount gets an extra +…" | ☐ | |
| 1.11 | **"Enter your code"**: type a wrong code | Error, account not created | ☐ | |
| 1.12 | Type the correct code (email or WhatsApp) | Account created, Home screen opens | ☐ | |
| 1.13 | Check the Home screen | Name shown, outlets list, Personal Discount QR and Referral QR buttons | ☐ | |
| 1.14 | Open **Profile** | Details match what you typed | ☐ | |
| 1.15 | No password is asked anywhere | No password fields at all | ☐ | |

👉 Repeat section 1 on **Phone C** to create **Partner 2**.

---

## 2. Partner App: sign out and sign in

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 2.1 | Close the app fully and open it again | Still signed in, no login asked | ☐ | |
| 2.2 | Profile → **Log out** | Back to the sign-in screen | ☐ | |
| 2.3 | Sign in with an email/mobile that is **not registered** | "Partner not found" message | ☐ | |
| 2.4 | Sign in with the registered **email** → **Send code** | Code arrives; screen shows where it was sent (partly hidden) | ☐ | |
| 2.5 | Enter a wrong code | Error, stays on the screen | ☐ | |
| 2.6 | Enter the right code | Signed in, Home opens | ☐ | |
| 2.7 | Log out and sign in again using the **mobile number** | Works the same way | ☐ | |
| 2.8 | Request a code more than 5 times in 10 minutes | "Too many requests"-type message | ☐ | |
| 2.9 | Wait more than 10 minutes, then use an old code | Code no longer works | ☐ | |

---

## 3. Partner App: profile page

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 3.1 | Change the name → **Save changes** | Saved; new name on Home | ☐ | |
| 3.2 | Change the email or mobile | Asks for a verification code (**"Confirm it's you"**) | ☐ | |
| 3.3 | Enter the code → **Verify and save** | Saved | ☐ | |
| 3.4 | Change the date of birth | Note says a changed date counts only **after 30 days** | ☐ | |
| 3.5 | No UPI field anywhere | UPI is hidden | ☐ | |

---

## 4. Outlet Admin App: sign in, profile and history (Phone B)

### 4A. Sign in

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 4.1 | Wrong email or password | Error, stays on the screen | ☐ | |
| 4.2 | Correct email and password → **Sign in** | **Scan** tab opens | ☐ | |
| 4.3 | Close the app and open it again | Still signed in | ☐ | |
| 4.4 | Tabs at the bottom | **Scan, History, Slabs, Outlet** | ☐ | |

### 4B. Outlet tab (profile and settings)

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 4.5 | Open **Outlet** | Outlet name, email, mobile, address, description and map link are shown | ☐ | |
| 4.6 | Edit the description and address → **Save profile** | "Outlet profile saved." | ☐ | |
| 4.7 | Add a wrong map link (not a web link) | Error shown | ☐ | |
| 4.8 | Add outlet photos | Asks for photo access the first time, then the photos upload | ☐ | |
| 4.9 | On Partner App, open this outlet from Home | New description, address and photos show | ☐ | |
| 4.10 | **Sign out** → sign in again | Works | ☐ | |

### 4C. History tab (check this after the billing tests)

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 4.11 | **Today** / **All bills** filter | List changes to match | ☐ | |
| 4.12 | Totals at the top | Bills, Collected, Discount given, First-time bonus and GST collected add up correctly | ☐ | |
| 4.13 | Tap any bill | Bill details open with the same numbers as when it was made | ☐ | |
| 4.14 | No points or cashback shown | Hidden in billing, bill details and history | ☐ | |

---

## 5. Outlet Admin App: Slabs page (rates)

The **Slabs** page sets this outlet's rates. A change applies **from the next bill**.

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 5.1 | Open **Slabs** | Sections: **Partner bills** (First bill, Repeat bill, Cashback), **Referral bills** (Referred guest discount, Referring partner reward) and **Tax** (GST) | ☐ | |
| 5.2 | Check the example bill (₹1000) at the bottom | Shows Product total, discount, GST, Round off and Total | ☐ | |
| 5.3 | Tap **Save slabs** without changing anything | "Nothing to save: no slab has changed." | ☐ | |
| 5.4 | Set First bill discount to **60** | Error: discount can't be more than 50% | ☐ | |
| 5.5 | Set GST to **60** | Error: GST can't be more than 50% | ☐ | |
| 5.6 | Clear a box (leave it empty) | Error: "Enter a percentage (0 for none)" | ☐ | |
| 5.7 | Type 3 decimal places (e.g. 5.555) | Error: at most 2 decimals | ☐ | |
| 5.8 | Set a correct value (e.g. GST 5) → Save | "Slabs saved. The next bill uses them." | ☐ | |
| 5.9 | **Recent changes** list | Shows the change as old → new, with the time | ☐ | |
| 5.10 | Super Admin → this outlet | Same new values and the same change log | ☐ | |
| 5.11 | Change a slab **while a bill is open** on the amount screen, then complete that bill | The bill is refused with a "settings changed" message; scanning again gives the new rate | ☐ | |

> Put the slabs back to the values in section 0 before the billing tests.

---

## 6. Billing tests (Phone A or C shows the QR, Phone B scans it)

### How to scan (applies to every bill)

- **Camera scan:** point Phone B's camera at the QR on the partner's phone.
- **Enter code:** type the code printed under the QR (`LMW-DISC-…`, `LMW-REF-…` or `LMW-RDM.…`).
- **Total product bill:** enter the amount **before** discount and GST.
- Check the preview, then tap **Complete bill · ₹…**.

### Scanner checks

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 6.1 | Scan any random QR (not LMW) | "QR not accepted" / not a Lot More Wins QR | ☐ | |
| 6.2 | Type a made-up code | "QR code not recognised" | ☐ | |
| 6.3 | Camera scan and Enter code give the same result | Same partner card | ☐ | |

---

### 6A. Personal Discount QR (the partner's own bill)

On Phone A: **Home → Personal Discount QR**.

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 6.4 | Try a screenshot or screen recording of the QR page | Blocked (black screen or not allowed) | ☐ | |
| 6.5 | Look for a Download button | **No Download button** on this page | ☐ | |
| 6.6 | Phone B scans it | Partner card: name, partner code, mobile | ☐ | |
| 6.7 | **First bill at this outlet**: enter ₹1000 | Discount 20% → after discount ₹800 → GST 5% ₹40 → **Customer pays ₹840** | ☐ | |
| 6.8 | Complete the bill | Success screen with receipt; bill appears in History | ☐ | |
| 6.9 | Partner App → Wallet | Cashback points added (cashback % of the bill) | ☐ | |
| 6.10 | Partner App → notification | Bill notification received | ☐ | |
| 6.11 | Immediately make the **same bill again** (same QR, same amount) | Refused: "An identical bill was completed moments ago" | ☐ | |
| 6.12 | **Second bill, same outlet**: ₹1000 | Now the **repeat** discount: 10% → ₹900 + GST ₹45 = **₹945** | ☐ | |
| 6.13 | Odd amount: ₹999 with 10% off and 18% GST | 999 − 99.90 = 899.10 → **₹899**; GST ₹161.82; total 1060.82 → **pays ₹1061** (round off +₹0.18) | ☐ | |
| 6.14 | First bill of the same partner at a **different outlet** | First bill discount again (first time is counted per outlet) | ☐ | |
| 6.15 | Enter amount 0, or letters | Not allowed | ☐ | |
| 6.16 | **Birthday** (account whose birthday is today, set at registration or more than 30 days ago) | Extra birthday % added on top; total never more than 50% | ☐ | |

---

### 6B. Referral QR (partner refers a guest)

On Phone A: **Home → Referral QR** (this one can be shared and downloaded). The **guest** brings it to the outlet.

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 6.17 | **Share QR** on Phone A | Share menu opens (WhatsApp etc.) | ☐ | |
| 6.18 | Phone B scans the Referral QR | Asks for **Guest details** (name, mobile, optional email) | ☐ | |
| 6.19 | Enter **Partner 1's own mobile** as the guest | Refused: a partner can't use their own referral QR | ☐ | |
| 6.20 | Enter a new guest → Continue → ₹1000 | Guest discount 10% → ₹900 + GST ₹45 = **₹945** | ☐ | |
| 6.21 | Complete the bill | Success; bill type is **Referral** in History | ☐ | |
| 6.22 | Partner 1's wallet | **Referring partner reward** points added (reward % of the guest's bill) | ☐ | |
| 6.23 | Partner 1's Home | Referral progress goes up by 1 (e.g. 1 / 10) | ☐ | |
| 6.24 | Use **Partner 2's mobile** as the guest (a registered partner) | Partner 2 gets the cashback points; Partner 1 gets the referral reward | ☐ | |
| 6.25 | A guest who is **not** registered later registers with that same mobile | The guest's held cashback points appear in their new wallet | ☐ | |

---

### 6C. Referral reward: 10 successful referrals give 20% on the next own bill

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 6.26 | Make referral bills with Partner 1's Referral QR until progress shows **10 / 10** (each completed referral bill counts) | Progress counts up correctly after each bill | ☐ | |
| 6.27 | When the 10th referral bill completes | Partner 1 gets a notification that the reward is unlocked | ☐ | |
| 6.28 | Partner 1 shows the **Personal Discount QR**; bill ₹1000 (the partner usually gets the 10% repeat discount) | Discount is **20%** (the reward replaces the 10%) → ₹800 + GST ₹40 = **₹840** | ☐ | |
| 6.29 | After that bill | Progress goes back to **0 / 10** | ☐ | |
| 6.30 | The next own bill | Back to the normal repeat discount (10%) | ☐ | |
| 6.31 | Reward + birthday on the same day | Both added, but never more than **50%** | ☐ | |
| 6.32 | Partner's usual discount is already **higher** than the reward | The reward is **not** used up; the higher discount applies and progress stays | ☐ | |
| 6.33 | The reward does **not** apply when a guest uses the Referral QR | Only the guest discount applies there | ☐ | |

---

### 6D. Wallet QR (Redeem QR): paying with wallet points

On the Partner App: **Wallet → Generate redeem QR**.

**Rules:**
- The QR is worth the **whole wallet**.
- It works **once** and expires after **10 minutes**.
- At the outlet, the wallet pays **at most half the bill amount**, and the customer pays the rest.
- There's **no discount and no cashback** on a wallet bill. GST is charged on the full bill.
- Any value the bill doesn't use stays in the wallet.

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 6.34 | Open the Redeem QR | QR with a 10-minute countdown and the amount it's worth | ☐ | |
| 6.35 | Phone B scans it | Shows **Redeem QR**, partner code, mobile, **Wallet balance**, **"This QR is worth up to ₹…"** | ☐ | |
| 6.36 | **Small wallet** (₹300 balance), bill ₹1000, GST 5% | Bill ₹1000 + GST ₹50 = ₹1050 → wallet pays **₹300** → **customer pays ₹750** → wallet now ₹0 | ☐ | |
| 6.37 | **Big wallet** (₹800 balance), bill ₹1000, GST 5% | Wallet pays **₹500** (half of ₹1000) → **customer pays ₹550** → **₹300 stays** in the wallet | ☐ | |
| 6.38 | Scan the **same Redeem QR again** after it was used | Refused, already used | ☐ | |
| 6.39 | Wait more than 10 minutes, then scan | Refused, expired; tapping refresh on the phone makes a new QR | ☐ | |
| 6.40 | Wallet balance ₹0 | Can't redeem / nothing to pay from the wallet | ☐ | |
| 6.41 | Partner App → Wallet → Transaction history | Shows the redemption with the right amount; tapping it opens the details | ☐ | |
| 6.42 | No cashback earned on this bill | Wallet doesn't go up from this bill | ☐ | |

---

## 7. Wallet to wallet transfer (Phone A → Phone C)

**Rules:**
- A partner can send money only to another **registered** partner, found by mobile number.
- One transfer can send **at most half** the wallet.
- A code is sent to the **sender** to confirm.

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 7.1 | Wallet → **Send to a partner** | **"Send to a partner"** screen | ☐ | |
| 7.2 | Enter a mobile that is **not registered** → **Find partner** | "Partner not found" | ☐ | |
| 7.3 | Enter **your own** mobile | Refused: can't send to yourself | ☐ | |
| 7.4 | Enter Partner 2's mobile | Partner 2's name shown, ask to confirm | ☐ | |
| 7.5 | Enter **more than half** the balance (e.g. wallet ₹400 → send ₹250) | Refused: shows the maximum (₹200) | ☐ | |
| 7.6 | Enter a correct amount (e.g. ₹100) → Continue | Code sent to the sender | ☐ | |
| 7.7 | Enter a wrong code | Refused, no money moves | ☐ | |
| 7.8 | Enter the right code | Success; Partner 1's wallet goes down ₹100 | ☐ | |
| 7.9 | Phone C (Partner 2) | Wallet goes up ₹100; notification received | ☐ | |
| 7.10 | Both transaction histories | "Sent" on A, "Received" on C, same amount and time | ☐ | |
| 7.11 | Tap the confirm button twice quickly | Money is sent **only once** | ☐ | |
| 7.12 | Partner 2 uses the received money on a Redeem QR bill | Works like any other wallet money | ☐ | |

---

## 8. Partner App: wallet and transaction history

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 8.1 | Wallet shows **one** balance | Cashback, referral rewards and received money all in one; no separate cash wallet | ☐ | |
| 8.2 | Filter by type (bills, rewards, transfers, redemptions) | List changes correctly | ☐ | |
| 8.3 | Filter by date range | Only those dates shown | ☐ | |
| 8.4 | **Show more** | Older items load | ☐ | |
| 8.5 | Tap any item | Details page with the correct numbers | ☐ | |
| 8.6 | Notifications page | Every bill, reward and transfer has a notification | ☐ | |
| 8.7 | Offers on Home and outlet pages | Say **"up to X%"**, not "flat X%" | ☐ | |

---

## 9. Bill calculation rules (for checking any bill by hand)

### Normal bill (Personal Discount QR or Referral QR)

1. **Discount %** is the first one that applies:
   - Referral QR → **guest discount**.
   - Partner's first bill at this outlet → **first bill discount**.
   - Otherwise → **repeat discount**.
   - If a referral reward is waiting and it's bigger, it **replaces** the usual discount (own bill only).
   - A birthday bonus is **added** (own bill only).
   - The total is capped at **50%**.
2. **After discount** = bill − discount, rounded to whole rupees (₹330.70 → ₹331, ₹330.40 → ₹330).
3. **GST** = after discount × GST %, to the paisa.
4. **Customer pays** = after discount + GST, rounded to whole rupees (₹166.50 → ₹167, ₹166.49 → ₹166).
5. **Cashback / reward points** are worked out on the amount **before GST**: either the bill or the after-discount amount, depending on the points basis setting.

### Wallet (Redeem QR) bill

1. **GST** = full bill × GST %. There's no discount.
2. **Wallet pays** = the smallest of: the wallet balance, what the QR is worth, or **half the bill** (before GST).
3. **Customer pays** = bill + GST − wallet part, rounded to whole rupees.

### Quick examples (GST 5%)

| Case | Bill | Discount | After discount | GST | Wallet | Customer pays |
|---|---|---|---|---|---|---|
| First bill (20%) | 1000 | 200 | 800 | 40 | — | **840** |
| Repeat bill (10%) | 1000 | 100 | 900 | 45 | — | **945** |
| Referral guest (10%) | 1000 | 100 | 900 | 45 | — | **945** |
| Referral reward (20%) | 1000 | 200 | 800 | 40 | — | **840** |
| Wallet ₹300 | 1000 | 0 | 1000 | 50 | 300 | **750** |
| Wallet ₹800 | 1000 | 0 | 1000 | 50 | 500 | **550** |
| GST 0% repeat (10%) | 1000 | 100 | 900 | 0 | — | **900** |

---

## 10. Other checks

| # | Step | What should happen | ☐ | Notes |
|---|---|---|---|---|
| 10.1 | Super Admin makes the **outlet inactive**, then try a bill | Refused: outlet is inactive | ☐ | |
| 10.2 | Super Admin makes **Partner 1 inactive**, then scan their QR | Refused: partner is not active | ☐ | |
| 10.3 | Turn mobile data off on Phone B mid-bill, then complete | Clear error; when retried, the bill is **not** made twice | ☐ | |
| 10.4 | Every bill shows in Super Admin → Transactions | Same amounts, GST and discount as on the phones | ☐ | |
| 10.5 | Old v1.0.0 apps (if one is available) | Can still sign in and bill | ☐ | |

---

## Sign-off

| Tester | Device / Android version | Date | Result (Pass / Fail) | Comments |
|---|---|---|---|---|
| | | | | |
