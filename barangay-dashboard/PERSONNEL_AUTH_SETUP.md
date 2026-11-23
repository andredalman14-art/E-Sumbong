# Personnel authentication integration

The portal is currently a static HTML/CSS/JavaScript application. It does not include an authentication server, personnel account database, email sender, or server-side route protection. The login page therefore does not store credentials or create a client-side session. It sends requests to same-origin API routes and only redirects after a server response confirms the authenticated account and assigned role.

## API routes used by the page

- `POST /api/personnel/auth/login` — accepts `{ "identifier", "password", "rememberMe", "requestedRole" }`. On success, set a `Secure`, `HttpOnly`, `SameSite` session cookie and return `{ "user": { "id", "name", "role" } }`. Use HTTP 401 for invalid credentials and HTTP 403 for a disabled or unauthorized account. The server must validate credentials and the account's assigned role; `requestedRole` is only a UI selection.
- `POST /api/personnel/auth/logout` — invalidates the server session. The page calls this if the server authenticates a user whose assigned role differs from the selected role.
- `POST /api/personnel/auth/password-reset-requests` — accepts `{ "email" }`. The server should return a generic response that does not reveal whether an account exists and send recovery instructions through its configured mail service.
- `POST /api/personnel/auth/account-requests` — accepts `{ "firstName", "lastName", "fullName", "email", "requestedRole", "contactNumber", "password", "termsAccepted", "privacyAccepted" }`. The account identifier is the email address; no username is collected. Validate the values again on the server, hash the password using a modern password hashing algorithm, and create a pending application for administrator verification. Never store or log the plaintext password. It must not grant a role or activate credentials from the requested role or the client consent fields. The requested role is only a request for administrator review.

The login screen first asks the user to re-enter the password and confirm official use in an identity verification dialog. After that confirmation, it sends the regular login request above; the modal is an interaction step, not an independent authentication factor. The server remains responsible for validating the password, setting a protected session, and checking the assigned role.

Set a global `window.PERSONNEL_AUTH_CONFIG` before `js/auth.js` if the API uses different same-origin paths, for example:

```js
window.PERSONNEL_AUTH_CONFIG = {
  loginEndpoint: "/api/personnel/auth/login",
  logoutEndpoint: "/api/personnel/auth/logout",
  recoveryEndpoint: "/api/personnel/auth/password-reset-requests",
  accountRequestEndpoint: "/api/personnel/auth/account-requests",
};
```

Use HTTPS in deployment. The backend must protect the dashboard and all complaint data routes by checking the server session and authorization on every request. Because these pages are static and currently read complaint data from browser localStorage, the UI alone cannot enforce confidentiality or access control. Do not deploy this demonstration portal with real resident records until server authentication, authorization, data persistence, and protected routes are configured.
