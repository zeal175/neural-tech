# ENCLAVE tooling

The **live site** is part of the club Next.js app:

| URL | What |
| --- | --- |
| `/enclave` | Landing |
| `/enclave/register` | Registration + UPI QR |
| `/enclave/admin` | Payment screenshot review |
| `/enclave/checkin` | Door scanner |

Source for that lives under `app/enclave/`, `components/enclave/`, `lib/enclave/`, and `public/enclave/`.

This `enclave/` folder keeps Blender scripts, SQL (`scripts/enclave-registrations.sql` is also copied to `scripts/enclave/`), and older standalone-app leftovers. Do not deploy this folder as its own Vercel project.
