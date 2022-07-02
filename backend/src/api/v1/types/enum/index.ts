export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NEUTRAL = 'neutral',
}
export enum ReactionType {
  POST = 'post',
  MESSAGE = 'message',
}

export enum AuthType {
  PASSWORD = 'password',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

export enum MediaCategory {
  AVATAR = 'avatar',
  POST = 'post',
  REPLY = 'reply',
  MESSAGE = 'message',
}
export enum ModelType {
  AVATAR = 'avatars',
  POST = 'posts',
  REPLY = 'replies',
  MESSAGE = 'messages',
}
export enum UploadType {
  MESSAGE_MEDIA = 'MESSAGE_MEDIA',
  POST_MEDIA = 'POST_MEDIA',
  REPLY_MEDIA = 'REPLY_MEDIA',
  MESSAGE_IMAGE = 'MESSAGE_IMAGE',
  POST_IMAGE = 'POST_IMAGE',
  REPLY_IMAGE = 'REPLY_IMAGE',
}

export enum ClientDB {
  SESSION = 0,
  PUBLISHER = 1,
  SUBSCRIBER = 2,
  SOCKET = 3,
}

export enum NotificationType {
  POST_CREATE = 'POST_CREATE',
  POST_LIKE = 'POST_LIKE',
  FOLLOWING_YOU = 'FOLLOWING_YOU',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
}
export enum MessageType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  MISSED_CALL = 'MISSED_CALL',
  DELETED_MESSAGE = 'DELETED_MESSAGE',
}
export enum Publish {
  CONVERSATIONS = 'conversations',
  REACTED = 'reacted',
  NOTIFICATION = 'notification',
  MESSAGE = 'message',
}

export enum ResponseCode {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  GENERIC_ERROR = 'GENERIC_ERROR',
  FILE_MISSING = 'LIMIT_UNEXPECTED_FILE',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  INVALID_MIMETYPE = 'INVALID_MIMETYPE',
  MAX_FILE_SIZE = 'MAX_FILE_SIZE',
  IMAGE_ID_INVALID = 'IMAGE_ID_INVALID',
  IMAGE_CATEGORY_INVALID = 'IMAGE_CATEGORY_INVALID',
  MEDIA_ID_INVALID = 'MEDIA_ID_INVALID',
  MEDIA_CATEGORY_INVALID = 'MEDIA_CATEGORY_INVALID',
  MEDIA_EXISTS = 'MEDIA_EXISTS',
  MEDIA_INVALID = 'MEDIA_INVALID',
  INPUT_ERROR = 'INPUT_ERROR',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}
