import { gql } from 'apollo-server-core';
import { DocumentNode } from 'graphql';
import { Publish } from '../../types/enum';

export const getPosts = {
  query: `query getPosts($id: ID, $limit: Int, $offset: Int) {
      getPosts(id: $id, limit: $limit, offset: $offset) {
        id
        body
        media
        createdDate
        createdBy {
          id
          name
          username
          auth
          active
          createdDate
        }
        stats {
          likes
          comments
          liked
        }
        parent {
          id
          stats {
            likes
            comments
            liked
          }
        }
      }
    }`,
  variables: { offset: 0 },
};

export const login = {
  query: `mutation login($usernameOrEmail: String!, $password: String!) {
      login(usernameOrEmail: $usernameOrEmail, password: $password) {
        id
        name
        username
        auth
        active
        createdDate
        __typename
      }
    }`,
  variables: {
    usernameOrEmail: '789@789.com',
    password: '789@789.com',
  },
};

export const register = {
  query: `mutation register(userInput: UserInput!) {
    register(userInput: $userInput) {
        id
        name
        username
        auth
        active
        createdDate
        __typename
      }
    }`,
};

export const auth = {
  query: `query auth {
    auth {
      id
      name
      username
      auth
      active
      createdDate
      email
      gender
      bio
      mutual
      token
      notification
      notifications {
        type
        total
      }
    }
  }`,
  variables: {},
};

export const gqlUserSub = `
  id
  name
  username
  auth
  active
  createdDate
`;

export const gqlUser = `
  ${gqlUserSub}
  email
  gender
  bio
  mutual
  token
  notification
  notifications {
    type
    total
  }
`;

export const gqlPost = `
  id
  body
  media
  createdDate
  createdBy {
    ${gqlUserSub}
  }
  stats {
    likes
    comments
    liked
  }
  parent {
    id
    stats {
      likes
      comments
      liked
    }
  }
  `;

export const gqlReaction = `
  id
  reaction
  user {
    ${gqlUserSub}
  }
  createdDate
  message {
    id
  }
`;

export const gqlMessageSub = `
  id
  body
  createdDate
  missed
  deleted
  media
  type
`;

export const gqlMessage = `
  ${gqlMessageSub}
  reactions {
    ${gqlReaction}
  }
  from {
    ${gqlUserSub}
  }
  to {
    id
  }
`;

export const gqlConversation = `
  id
  seen
  from {
    ${gqlUserSub}
  }
  to {
    ${gqlUserSub}
  }
  message {
    ${gqlMessageSub}
  }
`;

export const gqlConversations = `
  unseen
  update
  from
  to
`;

export const gqlReacted = `
  reaction
  deleted
  message
  from
  to
  user
`;

export const gqlNotification = `
  id
  identifier
  type
  seen
  viewed
  createdDate
  from {
    id
    name
  }
  to {
    id
  }
`;

export const gqlFollowCount = `
  followers
  following
`;

export const gqlMimeTypes = `
  image
  video
  audio
`;

export const gqlQueries = {
  getUser: gqlUser,
  getPost: gqlPost,
  getPosts: gqlPost,
  getMessages: gqlMessage,
  getUserPosts: gqlPost,
  getUserComments: gqlPost,
  getUserMedias: gqlPost,
  getUserLikes: gqlPost,
  getFollowers: gqlUser,
  getFollowing: gqlUser,
  getConversations: gqlConversation,
  getNotifications: gqlNotification,
  getFollowCount: gqlFollowCount,
  getFollowStatus: gqlFollowCount,
  findUser: gqlUserSub,
  getMimeTypes: gqlMimeTypes,
  auth: gqlUser,
};

export const gqlMutations = {
  likePost: `
    mutation likePost($id: ID!) {
      likePost(id: $id)
    }
  `,
  unLikePost: `
    mutation likePost($id: ID!) {
      unLikePost(id: $id)
    }
  `,
  login: `
    mutation login($usernameOrEmail: String!, $password: String!) {
      login(usernameOrEmail: $usernameOrEmail, password: $password) {
        ${gqlUserSub}
      }
    }
  `,
  logout: `
    mutation Logout {
      logout
    }
  `,
  register: `
    mutation register($userInput: UserInput!) {
      register(userInput: $userInput) {
        ${gqlUserSub}
      }
    }
  `,
  toggleNotification: `
    mutation toggleNotification($toggle: Boolean!) {
      toggleNotification(toggle: $toggle)
    }
  `,
  createPost: `
    mutation createPost($postInput: PostInput!) {
      createPost(postInput: $postInput) {
        ${gqlPost}
      }
    }
    `,
  sendMessage: `
    mutation sendMessage($messageInput: MessageInput!) {
        sendMessage(messageInput: $messageInput) {
        ${gqlMessage}
        }
      }
    `,
  followUser: `
    mutation followUser($authInput: AuthInput!) {
      followUser(authInput: $authInput)
    }
  `,
  unFollowUser: `
    mutation unFollowUser($authInput: AuthInput!) {
      unFollowUser(authInput: $authInput)
    }
  `,
  deleteMessage: `
    mutation deleteMessage($id: ID!) {
      deleteMessage(id: $id) {
        id
      }
    }
  `,
  addReactionMessage: `
    mutation addReactionMessage($id: ID!, $reaction: String!) {
      addReactionMessage(id: $id, reaction: $reaction) {
        ${gqlReaction}
      }
    }`,
  removeReactionMessage: `
    mutation removeReactionMessage($id: ID!) {
      removeReactionMessage(id: $id)
    }
  `,
  updateBio: `
    mutation updateBio($bio: String!) {
      updateBio(bio: $bio)
    }
  `,
};

export const gqlSubscriptions: Record<Publish, DocumentNode> = {
  notification: gql`
    subscription notification {
      notification {
        ${gqlNotification}
      }
    }
    `,
  conversations: gql`
    subscription conversations {
      conversations {
        ${gqlConversations}
      }
    }
    `,
  reacted: gql`
    subscription reacted {
      reacted {
        ${gqlReacted}
      }
    }
    `,
  message: gql`
    subscription message {
      message {
        ${gqlMessage}
      }
    }
    `,
};
