// 👇 Constants, Helpers & Types
import { QueryMutation } from '../../types';
import { mimeTypes } from '../../constants';

const resolver: QueryMutation = {
  Query: {
    getMimeTypes: () => {
      return mimeTypes;
    },
  },
};

export default resolver;
