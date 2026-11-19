# Firestore Security Architecture Specification

## 1. Core Data Invariants
1. **Default Deny**: All unmatched paths are denied (`allow read, write: if false`).
2. **PII & Profile Protection (`users/{userId}`)**:
   - Users can read and create only their own profile (`uid == request.auth.uid`), with `role == 'user'` and `balance == 0` enforced on creation.
   - Users cannot modify `role`, `balance`, `status`, `uid`, or `createdAt` from the frontend. Only admins can adjust balance, status, or role.
3. **Order Integrity (`orders/{orderId}`)**:
   - Users can create orders only with `userId == request.auth.uid`, `status == 'Pending'`, `charge >= 0` matching server/service constraints, and `serviceId` referencing an existing active service.
   - Users CANNOT modify `charge`, `status`, `providerId`, `providerOrderId`, `remains`, `startCount`, or `userId` after creation.
4. **Catalog Security (`categories`, `services`)**:
   - Readable by customers/public (`active` or all for catalog display), writable ONLY by authorized admins (`isAdmin()`).
5. **Financial & Ledger Protection (`payments`, `transactions`)**:
   - Users can read only their own `payments` and `transactions` (`resource.data.userId == request.auth.uid`).
   - Users can submit a `Pending` payment request (`status == 'Pending'`), but cannot approve (`Completed`) payments or forge `transactions`.
6. **Admin Isolation (`adminUsers`, `apiProviders`, `settings/firebaseConfig`, `settings/setup`)**:
   - Strictly restricted to authorized admins verified via `adminUsers/{uid}` or bootstrapped verified owner email.
   - Regular users have zero access to `apiProviders`, `adminUsers`, or sensitive configuration documents.

## 2. "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Role Escalation on Signup**: User creates `/users/{uid}` with `role: "admin"`.
2. **Balance Self-Top-Up on Signup**: User creates `/users/{uid}` with `balance: 50000`.
3. **Balance Tampering on Update**: Authenticated user updates `/users/{uid}` changing `balance` from `0` to `9999`.
4. **Cross-User PII Read**: User A attempts `get(/users/userB)` or `list(/users)` without `userId` ownership.
5. **Order Status Bypass**: User creates `/orders/{id}` with `status: "Completed"` instead of `"Pending"`.
6. **Order Price Tampering**: User updates `/orders/{id}` changing `charge` or `providerOrderId`.
7. **Orphaned Service Reference**: User creates `/orders/{id}` with a non-existent `serviceId`.
8. **Cross-User Order Scraping**: User A lists `/orders` without filtering `userId == request.auth.uid`.
9. **Unauthorized Catalog Mutation**: Non-admin user creates/updates `/services/{id}` or `/categories/{id}`.
10. **Payment Self-Approval**: User creates `/payments/{id}` with `status: "Completed"` or updates `status` from `"Pending"` to `"Completed"`.
11. **Ledger Forgery**: Non-admin user writes directly to `/transactions/{id}`.
12. **Admin Provider Exfiltration**: Non-admin user reads `/apiProviders/{id}` or `/adminUsers/{id}`.
