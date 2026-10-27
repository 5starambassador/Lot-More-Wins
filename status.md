# Status — 23 October 2026

## Done today

### Partner app
- **Login and registration:** partners sign in with a one-time code only, sent by email or WhatsApp (the Super Admin picks which). The password step is gone from registration and login. Partners stay signed in until they sign out themselves.
- **One wallet:** purchase points, referral rewards, cashback and money received from other partners all go into one balance. There's no separate cash wallet and no UPI payouts.
- **Generate redeem QR button** on the wallet page:
  - The QR is worth up to half the wallet and expires after 10 minutes.
  - At the outlet, the wallet pays at most half the bill and the partner pays the rest. Whatever isn't used stays in the wallet.
- **Send to a partner:** move wallet balance to another partner by searching their mobile number, then confirm with a one-time code.
- **Transaction history:** every bill, reward, transfer and redemption is in one list on the wallet page, filtered by type and date range. Tapping any line opens a details page.
- **Personal Discount QR page:** the Download button is hidden, and screenshots and screen recording are blocked.
- **UPI removed:** every UPI field and section is hidden.
- **Wording:** offers say "up to X%" instead of "flat X%".

### Outlet Admin app
- Staff stay signed in until they sign out themselves.
- **Redeem QR bills:** staff enter only the bill amount. The wallet pays up to half the bill and the customer pays the rest.
- **No points or cashback shown:** they're hidden from billing, the bill details and the history page.

### Super Admin panel
- **Per-outlet rates:** each outlet can have its own points and cashback rates. A blank rate uses the global setting.
- **50% limit:** discounts can't be set above 50%, and no bill can be reduced by more than half.
- **First-time discount:** it now applies to a partner's first bill at each outlet.
- **UPI and payouts removed:** the UPI columns, the payout panels, the Finance menu item and the weekly payout settings are hidden.

### Database
- **Test database:** the new wallet changes (migrations 16 and 17) are applied, and Redeem QR is turned on for testing.
- **Live database:** not changed yet. Apply migrations 16 and 17 to it at release time, together with deploying the new server code.

## Next day
1. **Outlet Admin app: discount and reward rates (slabs).** Finish turning on the per-outlet first-time, repeat, cashback and referral rates and test them end to end.
2. **Outlet Admin app: GST calculations.** Complete and check the GST calculations on bills.
3. **Build files:**
   - Outlet Admin app: APK, Play Store and App Store builds.
   - Partner app: APK, Play Store and App Store builds.

   The new builds are needed for the redeem QR, transfers, transaction history and screenshot blocking.
