// 👇 Express
import express from 'express';
// 👇 Passport
import passport from 'passport';
import passportGoogle from 'passport-google-oauth2';
import passportFacebook, { VerifyFunctionWithRequest } from 'passport-facebook';
// 👇 Entities
import User from '../entity/User';
// 👇 Models
import { Avatar } from '../models/Image';
// 👇 Constants, Helpers & Types
import { AuthType, Gender } from '../types/enum';
import { entityManager, urlToBuffer } from '../helpers';
import {
  apiPath,
  authFacebook,
  authGoogle,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET,
  OAUTH_GOOGLE_CLIENTID,
  OAUTH_GOOGLE_CLIENTSECRET,
} from '../constants';

// once the strategy is successfully executed control moves on to passport.serializeUser().
// The result of the serializeUser method is attached to the session as req.session.passport.user = {}
passport.serializeUser<Partial<User>>((user, done) => done(null, user));
// So, let’s say if you are trying to hit the protected routes in backend,
// then in deserializeUser() you can check if the user is authenticated or not.
// DeserializeUser gets called every time when a route is hit at backend server
passport.deserializeUser<Partial<User>>((user, done) => done(null, user));

export const verifyCallback /* :VerifyFunctionWithRequest */ = async (
  req: express.Request,
  accessToken: string,
  refreshToken: string,
  profile: passportFacebook.Profile,
  done: (error: any, user?: any, info?: any) => void,
) => {
  // 👇  Google or Facebook provider
  const email = profile.emails?.[0].value.toLowerCase();
  const avatarUrl = profile.photos?.[0]?.value;

  let user = await entityManager.findOne(User, {
    where: { email, auth: profile.provider as AuthType },
  });
  // 👇 creat user if not exist in database
  if (!user) {
    const username = email?.substring(0, email?.indexOf('@')).toLowerCase();
    user = await entityManager.save(
      new User({
        email,
        username,
        name: username,
        gender: Gender.NEUTRAL,
        auth: profile.provider as AuthType,
      }),
    );

    // 👇 create profile image from profile url
    if (avatarUrl) {
      await Avatar()?.create({
        filename: user.id,
        metadata: {
          userId: user.id,
          username,
          email,
          auth: user.auth,
        },
        image: await urlToBuffer(avatarUrl),
      });
    }
  }

  done(null, { ...user });
};

passport.use(
  new passportGoogle.Strategy(
    {
      clientID: OAUTH_GOOGLE_CLIENTID,
      clientSecret: OAUTH_GOOGLE_CLIENTSECRET,
      callbackURL: `${apiPath}${authGoogle}/redirect`,
      passReqToCallback: true,
    },
    verifyCallback,
  ),
);
passport.use(
  new passportFacebook.Strategy(
    {
      clientID: FACEBOOK_CLIENT_ID,
      clientSecret: FACEBOOK_CLIENT_SECRET,
      callbackURL: `${apiPath}${authFacebook}/redirect`,
      passReqToCallback: true,
      // 👇 helps prevent use of tokens stolen by malicious software or man in the middle attacks.
      enableProof: true,
      profileFields: ['emails', 'picture.type(large)'],
    },
    verifyCallback,
  ),
);

export default passport;
