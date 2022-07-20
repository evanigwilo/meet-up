// 👇 Express
import { Router } from 'express';
// 👇 Middleware
import { auth, authCheck } from '../middleware/auth';
import passport from '../middleware/passport';
// 👇 Constants, Helpers & Types
import { apiPath, authFacebook, authGoogle, production } from '../constants';

// 👇 redirect response with script for cross-origin communication between window objects
const OAuthResponse = (message: string, status: 'success' | 'failure') => `
    <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${status}</title>
      </head>
      <body>
          <p>${message}</p>
          <script type="text/javascript">
            ${production ? ' window.location.replace("/")' : "window.opener.postMessage('${status}', '*')"} ;
          </script>
      </body>
      </html>
    `;

const router = Router();

const passportInit = passport.initialize();
const passportSession = passport.session();

router.use(passportInit);
router.use(passportSession);

router.get(authGoogle, authCheck(authGoogle), passport.authenticate('google', { scope: ['email'] }));
router.get(
  `${authGoogle}/redirect`,
  passport.authenticate('google', {
    successRedirect: `${apiPath}${authGoogle}/success`,
    failureRedirect: `${apiPath}${authGoogle}/failure`,
  }),
);

router.get(authFacebook, authCheck(authFacebook), passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  `${authFacebook}/redirect`,
  passport.authenticate('facebook', {
    successRedirect: `${apiPath}${authFacebook}/success`,
    failureRedirect: `${apiPath}${authFacebook}/failure`,
  }),
);

router.get([`${authGoogle}/success`, `${authFacebook}/success`], (req, res) => {
  // 👇 get user information
  auth(req);
  res.send(OAuthResponse(`Welcome ${req.authInfo?.email}`, 'success'));
});
router.get([`${authGoogle}/failure`, `${authFacebook}/failure`], (req, res) => {
  res.send(OAuthResponse('Authorization failed', 'failure'));
});

export { passportInit, passportSession };

export default router;
