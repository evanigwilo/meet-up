export enum ActionType {
  SHOW_MODAL = "SHOW_MODAL",
  HIDE_MODAL = "HIDE_MODAL",
  TOGGLE_NOTIFICATION = "TOGGLE_NOTIFICATION",
  UPDATE_NOTIFICATION = "UPDATE_NOTIFICATION",
  UPDATE_CONVERSATION = "UPDATE_CONVERSATION",
  AUTHENTICATING = "AUTHENTICATING",
  AUTHENTICATED = "AUTHENTICATED",
  ANSWER = "ANSWER",
  CHAT = "CHAT",
  PLAYING = "PLAYING",
  REPLYING = "REPLYING",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  NEUTRAL = "neutral",
}

export enum AuthType {
  PASSWORD = "password",
  GOOGLE = "google",
  FACEBOOK = "facebook",
}

export enum ProfileState {
  EXPAND = "EXPAND",
  SCALE = "SCALE",
}
