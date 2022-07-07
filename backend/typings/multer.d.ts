// 👇 Constants, Helpers & Types
import { ResponseCode, ModelType, UploadType } from '../src/api/v1/types/enum';

declare global {
  namespace Express {
    // 👇 type for muter upload operations
    interface Request {
      multer: Partial<{
        error: {
          code: ResponseCode;
          message: string;
        };
        abort: boolean;
        type: UploadType;
        collection: ModelType;
      }>;
    }
  }
}

export {};
