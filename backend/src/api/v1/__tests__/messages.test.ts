// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
import Message from '../entity/Message';
import Conversation from '../entity/Conversation';
import Reaction from '../entity/Reaction';
// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Constants, Helpers & Types
import * as helpers from '../helpers';
import { ResponseCode, UploadType, MediaCategory, Publish } from '../types/enum';
import { Conversations, MessageInput, ReactionKeys } from '../types';
import { maxLimit, missedVideoCall } from '../constants';
import { createMessage, bulkUserMessages, createUser, createReacted } from '../helpers';
import {
  useTestServer,
  graphQLRequest,
  loginUser,
  testSuccess,
  testError,
  testPagination,
  testUnauthenticated,
  authenticateUser,
  resolved,
  uploadImageFile,
  wsToken,
  uploadMediaFile,
} from './helpers';

// 👇 server start & stop hook
useTestServer();

const bulkUsers = async (total: number) =>
  await Promise.all(Array.from({ length: total }, async () => await createUser()));

describe('Messages', () => {
  // 👇 PREVENT DELETE OF UPLOADS WITH NO REFERENCE AFTER UPLOAD
  const spyUploadCheck = jest.spyOn(helpers, 'uploadCheck').mockImplementation(resolved);
  // 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
  const spyCreateNotification = jest.spyOn(helpers, 'createNotification').mockImplementation(resolved);
  const spyPublish = jest.spyOn(pubsub, 'publish').mockImplementation(resolved);

  beforeEach(() => {
    spyPublish.mockClear();
    spyCreateNotification.mockClear();
  });
  afterAll(() => {
    spyUploadCheck.mockRestore();
    spyCreateNotification.mockRestore();
  });

  it('should get messages', async () => {
    const query = 'getMessages';
    // 👇 UNAUTHENTICATED
    await testUnauthenticated(query);

    const from = await createUser();
    const to = await createUser();
    const headers = await loginUser(from);

    // 👇 GET MESSAGES INVOLVING THIS USER
    let { messages } = await bulkUserMessages(from, [to], maxLimit, { clear: true });
    let request = await graphQLRequest<Message[]>(query, undefined, headers);
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((message, index) => {
      // 👇 CHECK MESSAGES IN REVERSE ORDER
      index = body!.length - index - 1;
      expect(message.id).toEqual(messages[index].id);
      expect(message.from.id).toEqual(from.id);
      expect(message.to.id).toEqual(to.id);
      expect(message.body).toEqual(messages[index].body);
      expect(message.deleted).toBeFalsy();
      expect(message.media).toBeFalsy();
      expect(message.missed).toBeFalsy();
      expect(message.reactions).toHaveLength(0);
    });

    // 👇 GET MESSAGES INVOLVING THIS USER (DELETED)
    ({ messages } = await bulkUserMessages(from, [to], maxLimit, { clear: true, deleted: true }));
    request = await graphQLRequest<Message[]>(query, undefined, headers);
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((message, index) => {
      // 👇 CHECK MESSAGES IN REVERSE ORDER
      index = body!.length - index - 1;
      expect(message.id).toEqual(messages[index].id);
      expect(message.from.id).toEqual(from.id);
      expect(message.to.id).toEqual(to.id);
      expect(message.body).toBeFalsy();
      expect(message.deleted).toBeTruthy();
    });

    // 👇 GET MESSAGES INVOLVING THIS USER (MISSED VIDEO CALL)
    ({ messages } = await bulkUserMessages(from, [to], maxLimit, { clear: true, missed: true }));
    request = await graphQLRequest<Message[]>(query, undefined, headers);
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((message, index) => {
      // 👇 CHECK MESSAGES IN REVERSE ORDER
      index = body!.length - index - 1;
      expect(message.id).toEqual(messages[index].id);
      expect(message.from.id).toEqual(from.id);
      expect(message.to.id).toEqual(to.id);
      expect(message.body).toEqual(missedVideoCall);
      expect(message.missed).toBeTruthy();
    });

    // 👇 GET MESSAGES INVOLVING THIS USER (WITH MEDIA)
    ({ messages } = await bulkUserMessages(from, [to], maxLimit, { clear: true, media: 'image/png' }));
    request = await graphQLRequest<Message[]>(query, undefined, headers);
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((message, index) => {
      // 👇 CHECK MESSAGES IN REVERSE ORDER
      index = body!.length - index - 1;
      expect(message.id).toEqual(messages[index].id);
      expect(message.from.id).toEqual(from.id);
      expect(message.to.id).toEqual(to.id);
      expect(message.media).toEqual('image/png');
    });

    // 👇 GET MESSAGES INVOLVING THIS USER AND ANOTHER USER
    const messageCount = 3;
    const users = await bulkUsers(2);
    const { messages: conversations } = await bulkUserMessages(from, users, messageCount, { clear: true });
    expect(conversations).toHaveLength(messageCount * users.length);
    // 👇 GET OTHER USERS MESSAGE BETWEEN THIS USER
    for (const user of users) {
      const request = await graphQLRequest<Message[]>(query, { id: user.id }, headers);
      body = request.body;
      testSuccess(request);
      expect(body).toHaveLength(messageCount);
      body?.forEach((message) => {
        const conversation = conversations.find((conversation) => conversation.id === message.id);
        expect(message.id).toEqual(conversation?.id);
        expect(message.from.id).toEqual(from.id);
        expect(message.to.id).toEqual(user.id);
        expect(message.body).toEqual(conversation?.body);
      });
    }

    // 👇 CHECK PAGINATION
    ({ messages } = await bulkUserMessages(from, [to], maxLimit * 2, { clear: true }));
    await testPagination(query, messages, {}, headers);
  });

  it('should get conversations', async () => {
    const query = 'getConversations';
    // 👇 UNAUTHENTICATED
    await testUnauthenticated(query);

    const from = await createUser();
    const headers = await loginUser(from);
    const usersCount = 5;
    let users = await bulkUsers(usersCount);

    // 👇 GET CONVERSATIONS INVOLVING THIS USER
    let { messages: conversations } = await bulkUserMessages(from, users, maxLimit, { clear: true });
    // 👇 CHECK PUBLISHED NOTIFICATIONS FOR NEW MESSAGE AND CONVERSATION FOR EACH USER
    expect(spyPublish).toHaveBeenCalledTimes(usersCount * maxLimit * 2);
    spyPublish.mockClear();
    const request = await graphQLRequest<Conversation[]>(query, undefined, headers);
    // 👇 CHECK PUBLISHED NOTIFICATIONS
    expect(spyPublish).toHaveBeenCalledTimes(0);
    const body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(usersCount);
    users?.forEach((user) => {
      const conversation = body?.find((conversation) => conversation.to.id === user.id);
      expect(conversation?.from.id).toEqual(from.id);
      expect(conversation?.to.id).toEqual(user.id);
      // 👇 GET THE MESSAGE REFERENCE FROM THE CONVERSATION
      const message = conversations?.findIndex((message) => message.id === conversation?.message.id);
      expect(message).toBeGreaterThanOrEqual(0);
    });

    // 👇 CHECK PAGINATION
    users = await bulkUsers(maxLimit * 2);
    ({ messages: conversations } = await bulkUserMessages(from, users, 1, { clear: true }));
    await testPagination(query, conversations, {}, headers);
  });

  it('should send a message', async () => {
    const query = 'sendMessage';
    let from = await createUser();
    const to = await createUser();
    const { body } = await createMessage(from, to, false);
    const messageInput: Partial<MessageInput> = {
      to: '',
      body,
    };
    // 👇 UNAUTHENTICATED
    await testUnauthenticated(query, { messageInput });

    // 👇 NO 'MESSAGE BODY' OR NO 'TO'
    const headers = await loginUser(from);
    let request = await graphQLRequest<Message>(query, { messageInput }, headers);
    testError(request, ResponseCode.INPUT_ERROR, query);

    // 👇 SUCCESSFULLY SEND MESSAGE
    messageInput.to = to.id;
    spyPublish.mockClear();
    request = await graphQLRequest<Message>(query, { messageInput }, headers);
    testSuccess(request);
    const message = request.body as Message;
    expect(message.id).toBeTruthy();
    expect(message.from.id).toEqual(from.id);
    expect(message.to.id).toEqual(to.id);
    expect(message.body).toEqual(messageInput.body);
    expect(message.deleted).toBe(false);
    expect(message.missed).toBe(false);
    expect(message.media).toBe(null);
    expect(message.reactions).toBe(null);
    const messageExist = await helpers.entityManager.count(Message, {
      where: { id: message.id },
    });
    expect(messageExist).toEqual(1);
    // 👇 CHECK PUBLISHED NOTIFICATIONS
    expect(spyPublish).toHaveBeenCalledTimes(2);
    expect(spyPublish).toHaveBeenNthCalledWith(1, Publish.MESSAGE, {
      [Publish.MESSAGE]: expect.objectContaining<Partial<Message>>({
        id: message.id,
      }),
    });
    expect(spyPublish).toHaveBeenNthCalledWith(2, Publish.CONVERSATIONS, {
      [Publish.CONVERSATIONS]: expect.objectContaining<Partial<Conversations>>({
        from: from.id,
        to: to.id,
        unseen: 1,
        update: false,
      }),
    });

    // 👇 INVALID MESSAGE ID
    messageInput.id = faker.datatype.uuid();
    request = await graphQLRequest<Message>(query, { messageInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 MESSAGE ID WITH NO MEDIA FILE REFERENCE
    from = await authenticateUser(headers);
    messageInput.id = await wsToken(from, UploadType.MESSAGE_MEDIA);
    request = await graphQLRequest<Message>(query, { messageInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 MESSAGE ID WITH NO IMAGE FILE REFERENCE
    messageInput.id = await wsToken(from, UploadType.MESSAGE_IMAGE);
    request = await graphQLRequest<Message>(query, { messageInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 SUCCESSFUL IMAGE UPLOAD
    const imageFile = await uploadImageFile(UploadType.MESSAGE_IMAGE, MediaCategory.MESSAGE);
    messageInput.id = imageFile.imageId;
    request = await graphQLRequest<Message>(query, { messageInput }, imageFile.headers);
    testSuccess(request);
    expect(request.body).toMatchObject<Partial<Message>>({
      id: messageInput.id,
      from: expect.objectContaining<Partial<User>>({
        id: imageFile.user.id,
      }),
      body: messageInput.body,
      media: expect.stringContaining('image'),
    });

    // 👇 SUCCESSFUL VIDEO UPLOAD
    const mediaFile = await uploadMediaFile(UploadType.MESSAGE_MEDIA, MediaCategory.MESSAGE, 'video');
    messageInput.id = mediaFile.mediaId;
    request = await graphQLRequest<Message>(query, { messageInput }, mediaFile.headers);
    testSuccess(request);
    expect(request.body).toMatchObject<Partial<Message>>({
      id: messageInput.id,
      from: expect.objectContaining<Partial<User>>({
        id: mediaFile.user.id,
      }),
      body: messageInput.body,
      media: expect.stringContaining('video'),
    });
  });

  it('should delete a message', async () => {
    const query = 'deleteMessage';
    // 👇 UNAUTHENTICATED
    const id = faker.datatype.uuid();
    await testUnauthenticated(query, { id });

    // 👇 MESSAGE NOT FOUND
    const from = await createUser();
    const headers = await loginUser(from);
    let request = await graphQLRequest<Message>(query, { id }, headers);
    testError(request, ResponseCode.INPUT_ERROR, query);

    spyPublish.mockClear();
    const to = await createUser();
    const message = await createMessage(from, to);
    // 👇 CHECK PUBLISHED NOTIFICATIONS AFTER MESSAGE CREATED
    expect(spyPublish).toHaveBeenCalledTimes(2);
    expect(spyPublish).toHaveBeenNthCalledWith(1, Publish.MESSAGE, {
      [Publish.MESSAGE]: expect.objectContaining<Partial<Message>>({
        id: message.id,
      }),
    });
    expect(spyPublish).toHaveBeenNthCalledWith(2, Publish.CONVERSATIONS, {
      [Publish.CONVERSATIONS]: expect.objectContaining<Partial<Conversations>>({
        from: from.id,
        to: to.id,
        unseen: 1,
        update: false,
      }),
    });
    // 👇 MESSAGE SHOULD NOT BE DELETED
    let messageDeleted = await helpers.entityManager.count(Message, {
      where: { id: message.id, deleted: true },
    });
    expect(messageDeleted).toEqual(0);

    spyPublish.mockClear();
    request = await graphQLRequest<Message>(query, { id: message.id }, headers);
    expect(request.body).toMatchObject<Partial<Message>>({
      id: message.id,
    });
    // 👇 MESSAGE SHOULD BE DELETED
    messageDeleted = await helpers.entityManager.count(Message, {
      where: { id: message.id, deleted: true },
    });
    expect(messageDeleted).toEqual(1);
    // 👇 CHECK PUBLISHED NOTIFICATIONS
    expect(spyPublish).toHaveBeenCalledTimes(1);
    expect(spyPublish).toHaveBeenCalledWith(Publish.MESSAGE, {
      [Publish.MESSAGE]: expect.objectContaining<Partial<Message>>({
        id: message.id,
      }),
    });
  });

  it('should add reaction to a message', async () => {
    const query = 'addReactionMessage';
    // 👇 UNAUTHENTICATED
    const variables: {
      id: string;
      reaction: ReactionKeys;
    } = {
      id: faker.datatype.uuid(),
      reaction: 'like',
    };
    await testUnauthenticated(query, variables);

    // 👇 MESSAGE NOT FOUND
    const from = await createUser();
    const headers = await loginUser(from);
    const to = await createUser();
    let request = await graphQLRequest<Reaction>(query, variables, headers);
    testError(request, ResponseCode.INPUT_ERROR, query);

    // 👇 REACTED
    const message = await createMessage(from, to);
    variables.id = message.id;
    spyPublish.mockClear();
    request = await graphQLRequest<Reaction>(query, variables, headers);
    testSuccess(request);
    expect(request.body).toMatchObject<Partial<Reaction>>({
      message: expect.objectContaining<Partial<Message>>({
        id: variables.id,
      }),
      reaction: variables.reaction,
      user: expect.objectContaining<Partial<User>>({
        id: from.id,
      }),
    });
    // 👇 CHECK PUBLISHED NOTIFICATIONS
    expect(spyPublish).toHaveBeenCalledTimes(1);
    expect(spyPublish).toHaveBeenCalledWith(Publish.REACTED, {
      [Publish.REACTED]: createReacted(message, from, variables.reaction),
    });
  });

  it('should remove reaction from a message', async () => {
    const query = 'removeReactionMessage';
    // 👇 UNAUTHENTICATED
    const variables: {
      id: string;
    } = {
      id: faker.datatype.uuid(),
    };
    await testUnauthenticated(query, variables);

    // 👇 MESSAGE NOT FOUND
    const from = await createUser();
    const headers = await loginUser(from);
    const to = await createUser();
    let request = await graphQLRequest<Reaction>(query, variables, headers);
    testError(request, ResponseCode.INPUT_ERROR, query);

    // 👇 REACTION REMOVED
    const message = await createMessage(from, to);
    variables.id = message.id;
    spyPublish.mockClear();
    request = await graphQLRequest<Reaction>(query, variables, headers);
    testSuccess(request);
    expect(request.body).toBe(true);
    // 👇 CHECK PUBLISHED NOTIFICATIONS
    expect(spyPublish).toHaveBeenCalledTimes(1);
    expect(spyPublish).toHaveBeenCalledWith(Publish.REACTED, {
      [Publish.REACTED]: createReacted(message, from),
    });
  });
});
