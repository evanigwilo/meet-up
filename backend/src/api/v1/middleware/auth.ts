// 👇 Express
import { NextFunction, Request, Response } from 'express';
// 👇 Constants, Helpers & Types
import { ResponseCode } from '../types/enum';

// 👇 authentication checker
export const auth = (req: Request) => {
  // 👇 Password or OAuth
  req.authInfo = req.session?.user || req.user;
  return req.authInfo;
};

// 👇 authentication checker middleware
export const authCheck =
  (passportProvider = '') =>
  (req: Request, res: Response, next: NextFunction) => {
    if (auth(req)) {
      passportProvider ? res.redirect(`${passportProvider}/success`) : next();
    } else {
      passportProvider
        ? next()
        : res.status(400).json({
            code: ResponseCode.UNAUTHENTICATED,
            message: 'You are not authorized to perform this action.',
          });
    }
  };
