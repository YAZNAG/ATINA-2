# Dark Store — Applications Mobile Flutter

Architecture monorepo avec 3 apps Flutter indépendantes.

## Structure

```
mobile/
├── customer_app/   # App client (commandes, catalogue, panier)
├── picker_app/     # App picker (sessions picking, scan EAN)
└── driver_app/     # App driver (tournées, livraisons)
```

## Stack technique

| Lib | Usage |
|---|---|
| flutter_riverpod | State management |
| go_router | Navigation |
| dio | HTTP client |
| flutter_secure_storage | JWT token |
| flutter_screenutil | Responsive |
| google_fonts | Poppins |

## Auth backend

| App | Endpoint | Credentials |
|---|---|---|
| Customer | `POST /api/auth/login` | phone + password |
| Picker | `POST /api/auth/picker/login` | phone + password |
| Driver | `POST /api/auth/driver/login` | phone + password |

## Lancer une app

```bash
cd customer_app && flutter pub get && flutter run
cd picker_app   && flutter pub get && flutter run
cd driver_app   && flutter pub get && flutter run
```

## Thèmes

| App | Couleur | Hex |
|---|---|---|
| Customer | Rouge | #DC2626 |
| Picker | Violet | #7C3AED |
| Driver | Emerald | #059669 |
