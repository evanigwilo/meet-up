// 👇 Mongoose
import { Schema } from 'mongoose';
// 👇 Constants, Helpers & Types
import { mongoGetDb } from '../helpers';
import { ImageSchema } from '../types';
import { AuthType, ModelType } from '../types/enum';

// 👇 image collection schema
const createSchema = (collection: ModelType) =>
  new Schema<ImageSchema>(
    {
      filename: { type: String, required: true, unique: true },
      metadata: {
        type: {
          _id: false,
          userId: { type: String, required: true, index: true },
          email: { type: String, required: true },
          username: { type: String, required: true, index: true },
          auth: { type: String, enum: AuthType, required: true, index: true },
        },
        required: true,
      },
      image: {
        data: Buffer,
        contentType: String,
        size: String,
      },
    },
    {
      //   _id: false,
      collection,
      timestamps: {
        createdAt: 'createdDate',
        updatedAt: 'updatedDate',
        currentTime: () => Date.now(),
      },
    },
  );

const getSchema = {
  avatar: createSchema(ModelType.AVATAR),
  post: createSchema(ModelType.POST),
  message: createSchema(ModelType.MESSAGE),
  reply: createSchema(ModelType.REPLY),
};

export const Avatar = () => {
  const defaultDb = mongoGetDb('image');
  return defaultDb?.model(ModelType.AVATAR, getSchema.avatar);
};

export const Message = () => {
  const defaultDb = mongoGetDb('image');
  return defaultDb?.model(ModelType.MESSAGE, getSchema.message);
};

export const Post = () => {
  const defaultDb = mongoGetDb('image');
  return defaultDb?.model(ModelType.POST, getSchema.post);
};

export const Reply = () => {
  const defaultDb = mongoGetDb('image');
  return defaultDb?.model(ModelType.REPLY, getSchema.reply);
};
